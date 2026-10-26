import {setHeaderLight} from './header-controls.mjs';
import {D,raw,choose,nav} from './browser-support.mjs';
import {chromium} from 'playwright';
import fs from 'node:fs';import assert from 'node:assert/strict';import http from 'node:http';import path from 'node:path';
import{normalizeData}from'../js/data.js';import{buildProfiles,sortScores}from'../js/judge-profile-model.js';
const main=raw.main,forum=raw.forum,profiles=buildProfiles(D),all=[...profiles.values()],known=all.filter(p=>p.count),testJudge=all.find(p=>p.name==='Plaga Medicus'),checks=[];
const root=path.resolve('dist'),types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png'};
const server=http.createServer(async(req,res)=>{try{let file=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);if(file!==root&&!file.startsWith(root+path.sep))throw Error('outside');if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end()}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;fs.mkdirSync('docs/screenshots/judge-profiles',{recursive:true});
const b=await chromium.launch({headless:true}),context=await b.newContext({timezoneId:'America/Los_Angeles'}),page=await context.newPage(),errors=[],external=[],requests=[];
await context.route('https://static.cloudflareinsights.com/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
await context.route('https://api.19ib.ru/storage/**',r=>r.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="%2326382d"/></svg>'}));
context.on('request',r=>{requests.push(r.url());if(!r.url().startsWith(base+'/')&&!r.url().startsWith('data:')&&!r.url().startsWith('https://static.cloudflareinsights.com/')&&!r.url().startsWith('https://api.19ib.ru/storage/'))external.push(r.url())});page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url())});
try{
 await page.goto(base+'/');await page.waitForSelector('.app:not([hidden])');
 assert(!requests.some(u=>u.includes('/js/judge-profile.js')||u.includes('/js/judge-profile-model.js')||u.includes('/css/judge-profile.css')));checks.push('overview does not load profile code, CSS or prepared profile JSON');
 for(const width of [1440,1024,768,390,320]){
  await page.setViewportSize({width,height:960});await page.goto(base+'/judges/');await page.waitForSelector('[data-ranking-ready]');
  await page.screenshot({path:`docs/screenshots/judge-profiles/judges-${width}.png`});
  await page.locator('[data-judge-research-tab="4"]').click();await page.locator(`[data-fastest-judge="${testJudge.key}"]`).click();await page.waitForSelector('#judge-profile:not([hidden])');
  // Under the local CSP remote photos fail safely into the existing placeholder.
  // Wait for either a decoded image or that fallback, rather than racing onerror.
  await page.waitForFunction(()=>{const e=document.querySelector('.jp-avatar');return e&&(e.tagName!=='IMG'||(e.complete&&e.naturalWidth>0));});
  assert.equal(new URL(page.url()).searchParams.get('judge'),testJudge.key);
  assert((await page.locator('.jp-stat').first().innerText()).includes(testJudge.count.toLocaleString('ru-RU')));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`overflow ${width}`);
  await page.screenshot({path:`docs/screenshots/judge-profiles/profile-${width}.png`});
  assert.equal(await page.locator('#jp-search').getAttribute('placeholder'),'Имя артиста');assert.equal(await page.locator('#jp-order').inputValue(),'newest');
  const text=await page.locator('#judge-profile').innerText();for(const forbidden of ['Все сохранённые оценки:','Идентификатор судьи и источник','Публичный список судей','Снимок:','live-feed','Известные исправления','Архивный участник',testJudge.key])assert(!text.includes(forbidden),forbidden);
  assert.equal(await page.locator('#jp-revisions,[data-jp-view]').count(),0);assert.equal(await page.locator('#updated').textContent(),'');
  const iso=await page.locator('#jp-rows time').first().getAttribute('datetime');const expectedTime=new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(iso));assert.equal(await page.locator('#jp-rows time').first().innerText(),expectedTime);

  await choose(page,'jp-grade','1');assert((await page.locator('#jp-rows tr[data-jp-score]').count())>0);assert((await page.locator('#jp-rows tr[data-jp-score]').evaluateAll(es=>es.every(e=>e.dataset.jpScore==='1'))));
  const row=testJudge.rows.find(r=>r.score===1&&r.artistName);await page.locator('#jp-search').fill(row.artistName);assert(await page.locator(`[data-jp-user="${row.userId}"]`).count());
  await choose(page,'jp-order','oldest');assert.equal(new URL(page.url()).searchParams.get('order'),'oldest');
  const filteredUrl=page.url();await page.reload();await page.waitForSelector('#jp-search');assert.equal(await page.locator('#jp-search').inputValue(),row.artistName);assert.equal(await page.locator('#jp-grade').inputValue(),'1');assert.equal(page.url(),filteredUrl);assert.equal(await page.locator('#jp-order').inputValue(),'oldest');
  await page.locator('#jp-search').fill('');await choose(page,'jp-grade','all');await choose(page,'jp-order','newest');
  const detail=page.locator('.jp-comment-details').first();if(await detail.count()){await detail.locator('summary').click();assert(await detail.getAttribute('open')!==null);assert(await detail.locator('p').isVisible());await page.screenshot({path:`docs/screenshots/judge-profiles/comment-${width}.png`});}
  await page.locator('#jp-next').click();assert((await page.locator('#jp-page').innerText()).startsWith('Страница 2'));
  await choose(page,'jp-order','oldest');assert((await page.locator('#jp-page').innerText()).startsWith('Страница 1'));
  assert.deepEqual(await page.locator('#jp-rows [data-jp-user]').evaluateAll(es=>es.map(e=>e.dataset.jpUser)),sortScores(testJudge.rows,'oldest').slice(0,50).map(r=>r.userId));
  for(const n of ['2','3','4','5']){await choose(page,'jp-grade',n);assert(await page.locator('#jp-rows tr[data-jp-score]').evaluateAll((es,n)=>es.every(e=>e.dataset.jpScore===n),n));}
  await choose(page,'jp-grade','all');await page.locator('#jp-history-title').scrollIntoViewIfNeeded();await page.screenshot({path:`docs/screenshots/judge-profiles/filters-${width}.png`});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  // The custom picker may ellipsize its trigger; the selected option must
  // retain its full accessible label and fit inside the opened menu.
  const orderTrigger=page.locator('[data-select-id="jp-order"]');await orderTrigger.click();
  const selected=page.locator('[role=option][aria-selected=true]:visible');
  assert.equal(await selected.innerText(),await page.locator('#jp-order option:checked').textContent());
  assert(await selected.evaluate(e=>e.scrollWidth<=e.clientWidth));await page.keyboard.press('Escape');
  const height=await page.locator('.site-header').evaluate(e=>e.getBoundingClientRect().height);assert.equal(await page.locator('.site-header').evaluate(e=>e.getBoundingClientRect().top),0);assert(height>0);
  await page.locator('#jp-back').click();await page.waitForFunction(()=>!new URL(location.href).searchParams.has('judge'));
  assert(await page.locator('#judges.active').isVisible());
  checks.push(`width ${width}: real profile, avatar, grade/search/date sorting, direct reload, comments, pagination, sticky and return`);
 }

 // Every known judge opens at its permanent UUID and uses complete statistics.
 for(const p of known){await page.goto(`${base}/judges/?judge=${p.key}`);await page.waitForSelector('#jp-count');assert((await page.locator('.jp-stat').first().innerText()).includes(p.count.toLocaleString('ru-RU')));assert.equal(await page.locator('.jp-identity h2').innerText(),p.name);}
 checks.push('all grading judges open by UUID with exact complete counts');
 // Returning from a profile preserves the native judge filters and sort state.
 await page.setViewportSize({width:1440,height:960});await page.goto(base+'/judges/');await page.waitForSelector('[data-ranking-ready]');
 await page.locator('[data-ranking-group="veterans"]').click();await page.locator('[data-ranking-sort="activity"]').click();
 const sortText=await page.locator('[data-ranking-sort="activity"]').innerText();
 const link=page.locator('.ranking-name-button').nth(8);await link.scrollIntoViewIfNeeded();const pos=await page.evaluate(()=>scrollY);
 await link.click();await page.locator('dialog[open]').waitFor();await page.keyboard.press('Escape');
 assert(await page.locator('[data-ranking-group="veterans"]').getAttribute('aria-pressed')==='true');assert.equal(await page.locator('[data-ranking-sort="activity"]').innerText(),sortText);assert(Math.abs(await page.evaluate(()=>scrollY)-pos)<3);checks.push('native group, sort and scroll preserved on dialog return');
 // Both sort directions apply to all rows, not just a page.
 for(const order of ['newest','oldest']){
  await page.goto(`${base}/judges/?judge=${testJudge.key}&order=${order}`);await page.waitForSelector('#jp-next');const ids=[];
  for(;;){ids.push(...await page.locator('#jp-rows [data-jp-user]').evaluateAll(es=>es.map(e=>e.dataset.jpUser)));if(await page.locator('#jp-next').isDisabled())break;await page.locator('#jp-next').click()}
  assert.deepEqual(ids,sortScores(testJudge.rows,order).map(r=>r.userId));
 }
 checks.push('full pagination in both date directions without omissions');
 await page.goto(`${base}/judges/?judge=${testJudge.key}&view=revisions&order=oldest`);await page.waitForSelector('#jp-search');assert.equal(await page.locator('#jp-revisions,[data-jp-view]').count(),0);assert(!new URL(page.url()).searchParams.has('view'));checks.push('legacy revision URL falls back to ordinary scores');
 const forumPair=known.flatMap(p=>p.rows.map(s=>({p,s}))).find(x=>x.s.forumName);await page.goto(`${base}/judges/?judge=${forumPair.p.key}&judgeQ=${encodeURIComponent(forumPair.s.forumName)}&grade=${forumPair.s.score}&order=oldest`);await page.waitForSelector('#jp-search');assert(await page.locator(`[data-jp-user="${forumPair.s.userId}"]`).count());checks.push('forum nickname search still works with grade and date sorting');
 const zero=all.find(p=>!p.count);await page.goto(`${base}/judges/?judge=${zero.key}`);await page.waitForSelector('#jp-count');assert((await page.locator('#jp-count').innerText()).includes('0 из 0'));checks.push('public judge with zero known scores');
 await page.goto(base+'/judges/?judge=unknown');await page.waitForSelector('#judge-profile:not([hidden])');assert((await page.locator('#judge-profile').innerText()).includes('Судья не найден'));checks.push('unknown judge fallback');

 // Existing sections and controls still work with the preview module loaded.
 for(const width of [1440,320]){
  await page.setViewportSize({width,height:960});await page.goto(base+'/');await page.waitForSelector('.app:not([hidden])');
  assert((await page.locator('#index-main').innerText()).trim().length>0);
  assert(!requests.filter(u=>u.startsWith(base+'/')).slice(-5).some(u=>u.includes('judge-profiles-preview.json')));

  for(const id of ['dynamics','judges','forum-link']){await nav(page,id);await page.waitForSelector(`#${id}.active`)}
  const previous=await page.locator('body').getAttribute('data-room-light');await setHeaderLight(page,previous==='on'?'off':'on');assert.notEqual(await page.locator('body').getAttribute('data-room-light'),previous);await setHeaderLight(page,previous);
 }
 checks.push('all four native sections, live index and light switch at desktop/mobile');
 const missing=known.flatMap(p=>p.rows.map(s=>({p,s}))).find(x=>!x.s.artistName);
 await page.goto(`${base}/judges/?judge=${missing.p.key}&judgeQ=${missing.s.userId}`);await page.waitForSelector('#jp-rows tr[data-jp-user]');assert((await page.locator('#jp-rows').innerText()).includes('Имя неизвестно'));assert.equal(await page.locator('#jp-rows a[href*="19ib.ru/artist/"]').getAttribute('href'),'https://19ib.ru/artist/'+encodeURIComponent(missing.s.userId));checks.push('unknown archived artist keeps its exact UUID profile link');
 const noPhoto=known.find(p=>!p.avatarUrl);await page.goto(`${base}/judges/?judge=${noPhoto.key}`);await page.waitForSelector('.jp-avatar-empty');assert((await page.locator('.jp-identity').innerText()).includes('Фото не опубликовано'));checks.push('missing judge photo uses neutral placeholder');
 assert(!requests.some(u=>new URL(u).pathname.endsWith('/data/history.json')));checks.push('removed revision UI does not request history.json');
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 fs.writeFileSync('docs/screenshots/judge-profiles/results.json',JSON.stringify({passed:true,checks,errors,external,snapshot:main.exportedAt,counts:{participants:main.members.length,archived:main.archivedMembers.length,scores:all.reduce((n,p)=>n+p.count,0),gradingJudges:known.length}},null,2));console.log(JSON.stringify({passed:true,checks:checks.length,errors,external}));
}finally{await b.close();await new Promise(resolve=>server.close(resolve))}
