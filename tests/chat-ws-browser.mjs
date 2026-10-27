import {chromium} from '../backend/chat/node_modules/playwright/index.mjs';
import {startChat} from '../backend/chat/local.mjs';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
const stateDir=await mkdtemp(path.join(tmpdir(),'chat01-browser-')),out='docs/diagnostics/chat01-ws';
await mkdir(out,{recursive:true});
const app=await startChat({port:0,stateDir,adminToken:'browser-test-admin-key-long-enough'}),browser=await chromium.launch({headless:true});
const checks=[],errors=[],geometry=[];checks.push=(...items)=>{console.log(items.join('\n'));return Array.prototype.push.apply(checks,items);};
try{
 const a=await browser.newContext({viewport:{width:1440,height:1000}}),b=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const alice=await a.newPage(),bob=await b.newPage();
 for(const p of [alice,bob]){p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',r=>new URL(r.request().url()).origin===app.url?r.continue():r.abort());await p.goto(app.url+'/chat/');}
 async function join(p,n){await p.locator('#nickname').fill(n);await p.locator('#join-form button').click();await p.locator('#room').waitFor({state:'visible'});await p.getByText('В сети · #tuz19',{exact:true}).waitFor();}
 await join(alice,'Борис Мурлок');await join(bob,'Форумщик');await alice.locator('#online-count').getByText('2',{exact:true}).waitFor();checks.push('two independent contexts join; live presence=2');
 await alice.locator('#message').fill('Первый! Форум жив, господа.');await alice.locator('#message').press('Enter');await bob.getByText('Первый! Форум жив, господа.',{exact:true}).waitFor({timeout:3000});checks.push('WebSocket delivery under 3 seconds without reload; Enter sends');
 await bob.locator('#message').fill('Проверка строки');await bob.locator('#message').press('Shift+Enter');assert.match(await bob.locator('#message').inputValue(),/\n/);await bob.locator('#message').fill('С телефона тоже слышно.');await bob.locator('#send').click();await alice.getByText('С телефона тоже слышно.',{exact:true}).waitFor();checks.push('mobile send and Shift+Enter newline');
 const attack='<img src=x onerror="window.pwned=1"><script>window.pwned=2</script>';
 await alice.locator('#message').fill(attack);await alice.locator('#send').click();await bob.getByText(attack,{exact:true}).waitFor();assert.equal(await bob.locator('.chat-row img,.chat-row script').count(),0);assert.equal(await bob.evaluate(()=>window.pwned),undefined);checks.push('HTML/JS remains inert text');
 await alice.reload();await alice.getByText('В сети · #tuz19',{exact:true}).waitFor();await alice.getByText(attack,{exact:true}).waitFor();assert.equal(await alice.locator('#online-count').textContent(),'2');assert.equal(await alice.getByText('*** Борис Мурлок вошёл в чат',{exact:true}).count(),1);checks.push('reload restores session/history with no duplicate join');
 // A real dropped transport followed by automatic retry.
 const before=await alice.locator('.chat-row').count();await a.setOffline(true);app.disconnect();await bob.getByText('Нет связи · переподключаемся…',{exact:true}).waitFor();await bob.getByText('В сети · #tuz19',{exact:true}).waitFor();await bob.locator('#message').fill('Сообщение во время обрыва');await bob.locator('#send').click();await a.setOffline(false);
 await alice.getByText('Сообщение во время обрыва',{exact:true}).waitFor({timeout:25000});assert.equal(await alice.getByText('Сообщение во время обрыва',{exact:true}).count(),1);assert.equal(await alice.locator('.chat-row').count(),before+1);checks.push('offline reconnect catches missed message once');
 await bob.locator('#leave').click();await alice.getByText('*** Форумщик вышел из чата',{exact:true}).waitFor();await alice.locator('#online-count').getByText('1',{exact:true}).waitFor();checks.push('explicit leave immediately updates system log and presence');
 await join(bob,'Форумщик');await bob.close();
 try{await alice.getByText('*** Форумщик потерял соединение',{exact:true}).waitFor({timeout:110000});}catch(e){console.log('TIMEOUT LOG:',await alice.locator('#chat-log').textContent(),'STATE:',await alice.locator('#connection').textContent());throw e;}await alice.locator('#online-count').getByText('1',{exact:true}).waitFor();checks.push('closed browser expires after server lease; connection loss differs from leave');
 // Origin and moderation checked over the actual Worker/DO emulator.
 const bad=await fetch(app.url+'/api/chat/status',{headers:{Origin:'https://evil.example'}});assert.equal(bad.status,403);
 const denied=await fetch(app.url+'/api/chat/admin',{method:'POST',headers:{Origin:app.url,'Content-Type':'application/json'},body:'{"action":"enabled","value":false}'});assert.equal(denied.status,403);
 const id=Number(await alice.locator('.chat-row').filter({hasText:attack}).getAttribute('data-id'));
 const deleted=await fetch(app.url+'/api/chat/admin',{method:'POST',headers:{Origin:app.url,Authorization:'Bearer browser-test-admin-key-long-enough','Content-Type':'application/json'},body:JSON.stringify({action:'delete',id})});assert.equal(deleted.status,200);await alice.getByText('Сообщение удалено модератором.',{exact:true}).waitFor();checks.push('actual Worker Origin/admin protection and deletion broadcast');
 for(const width of [320,390,768,1440]){
  await alice.setViewportSize({width,height:width<500?844:1000});await alice.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  if(width===390){await alice.locator('#online-toggle').click();await alice.locator('#online-panel.open').waitFor();await alice.screenshot({path:out+'/chat-mobile-online.png',fullPage:true});await alice.locator('#online-toggle').click();}
  const g=await alice.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth-innerWidth,textareaWidth:document.querySelector('#message').getBoundingClientRect().width}));assert(g.overflow<=1,JSON.stringify(g));geometry.push(g);await alice.screenshot({path:`${out}/chat-${width}.png`,fullPage:true});
 }
 checks.push('320/390/768/1440 widths fit viewport; mobile online drawer toggles');
 await alice.setViewportSize({width:390,height:844});
 for(let i=0;i<7;i++){await alice.locator('#message').fill(('Строка '+i+' — форумная история. ').repeat(16).slice(0,490));await alice.locator('#send').click();await alice.waitForFunction(()=>document.querySelector('#message').value==='');}
 const atBottom=await alice.locator('#chat-log').evaluate(e=>e.scrollHeight-e.scrollTop-e.clientHeight);assert(atBottom<55);
 await alice.locator('#chat-log').evaluate(e=>e.scrollTop=0);await alice.locator('#message').fill('Новое сообщение при чтении истории');await alice.locator('#send').click();await alice.getByText('Новое сообщение при чтении истории',{exact:true}).waitFor();assert.equal(await alice.locator('#chat-log').evaluate(e=>e.scrollTop),0);await alice.locator('#new-messages').waitFor({state:'visible'});checks.push('autoscroll follows bottom and preserves history scroll');
 await alice.waitForFunction(()=>document.querySelector('#message').value==='');await alice.locator('#message').fill('Лимит девятого сообщения');await alice.locator('#send').click();await alice.locator('#chat-error').getByText(/Слишком часто/).waitFor();checks.push('server rate limit rejects ninth burst message');
 assert.deepEqual(errors,[]);await writeFile(out+'/browser-results.json',JSON.stringify({checks,geometry,pageErrors:errors},null,2));console.log(JSON.stringify({checks,geometry,pageErrors:errors},null,2));
}finally{await browser.close();await app.close();await rm(stateDir,{recursive:true,force:true});}
