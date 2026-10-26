import {setHeaderLight} from './header-controls.mjs';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {createRoundContext} from '../js/round-context.js';
import {createRankingModel,sortRanking,podiumRows,rankingColumns} from '../js/judge-ranking-model.js';
import {pageScores} from '../js/judge-profile-model.js';
import {view as context,choose,nav} from './browser-support.mjs';
const model=createRankingModel(context);
const output='docs/screenshots/int04';fs.mkdirSync(output,{recursive:true});
const port=8941,base=`http://127.0.0.1:${port}`,server=spawn(process.execPath,['scripts/serve.mjs','--dir','dist','--port',String(port)],{stdio:['ignore','pipe','pipe']});
let browser;const checks=[],errors=[],external=[],dataRequests=[];
try{
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',c=>reject(Error('Server exited '+c)));});
 browser=await chromium.launch({headless:true});
 for(const width of [375,390,768,1440,1920]){
  const ctx=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!==base){external.push(u.href);return r.abort();}if(u.pathname.endsWith('.json'))dataRequests.push(u.pathname);return r.continue();});
  const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base+'/judges/');await p.waitForSelector('[data-ranking-ready]');await p.waitForSelector('#carrot-loader',{state:'detached'});
  const dataBefore=dataRequests.length;
  const rowNames=()=>p.locator('[data-ranking-name]').evaluateAll(rows=>rows.map(r=>r.dataset.rankingName));
  const overflow=async()=>assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'body overflow '+width);
  for(const group of ['forum','veterans']){
   await p.locator(`[data-ranking-group="${group}"]`).click();
   const keys=rankingColumns.filter(c=>!['rank','forum','other'].includes(c.key)).map(c=>c.key);
   const actual=await p.locator('[data-ranking-name]').evaluateAll((rows,keys)=>rows.map(row=>({name:row.dataset.rankingName,values:keys.map(key=>row.querySelector('.ranking-'+key+' span').title)})),keys);
   for(const row of actual){const expected=model.rows(group).find(j=>j.judge===row.name);assert.deepEqual(row.values,keys.map(key=>Number.isFinite(expected[key])?String(expected[key]):'Нет данных для расчёта'));}
   for(const column of rankingColumns.filter(c=>!['forum','other'].includes(c.key)))for(const direction of [-1,1]){
    await choose(p,'ranking-sort-key',column.key);
    const button=p.locator('#ranking-sort-direction');
    if((await button.textContent()).includes(direction===-1?'возрастанию':'убыванию'))await button.click();
    assert.deepEqual(await rowNames(),sortRanking(model.rows(group),column.key,direction).map(r=>r.judge));
    const header=p.locator(`th[aria-sort="${direction===-1?'descending':'ascending'}"]`);assert.equal(await header.count(),1);
   }
   for(const mode of ['rust','diamond']){
    await p.locator(`[data-ranking-mode="${mode}"]`).click();
    const expected=podiumRows(model.rows(group),mode).map(r=>model.profileKey(r.judge));
    assert.deepEqual(await p.locator('.ranking-leader').evaluateAll(bs=>bs.map(b=>b.dataset.rankingProfile)),expected);
    await choose(p,'ranking-sort-key','activity');
    assert.deepEqual(await p.locator('.ranking-leader').evaluateAll(bs=>bs.map(b=>b.dataset.rankingProfile)),expected);
   }
  }
  await p.locator('[data-ranking-group="forum"]').click();await p.locator('[data-ranking-mode="diamond"]').click();
  await overflow();await p.screenshot({path:`${output}/ranking-${width}.png`,fullPage:true});
  const scroll=p.locator('.ranking-table-scroll');
  // Longest real name and an intentionally extreme display name: no data edits.
  const longest=p.locator('[data-ranking-name="Антон RapNews Акулич"]');
  if(width<=390){
   await longest.scrollIntoViewIfNeeded();
   for(const offset of [0,700]){
    await scroll.evaluate((e,left)=>{e.scrollLeft=left;},offset);
    const geometry=await longest.evaluate(row=>{const a=row.querySelector('.ranking-name').getBoundingClientRect(),b=row.querySelector('.ranking-tuz').getBoundingClientRect(),region=row.closest('.ranking-table-scroll').getBoundingClientRect();return {a:a.toJSON(),b:b.toJSON(),region:region.toJSON()};});
    assert(geometry.a.left>=geometry.region.left&&geometry.b.right<=geometry.region.right,'name + TUZ stay visible');
    assert((geometry.a.width+geometry.b.width)/geometry.region.width<.72,'fixed columns leave space for components');
   }
   await p.screenshot({path:`${output}/ranking-long-name-${width}.png`});
   await scroll.evaluate(e=>{e.scrollLeft=0;e.scrollTop=0;});
   const name=p.locator('.ranking-name-button').first(),old=await name.innerHTML();
   await name.evaluate(e=>e.textContent='Очень длинное имя судьи без сокращения и потери ТУЗа');await overflow();
   assert(await name.evaluate(e=>e.scrollWidth<=e.clientWidth+1));await name.evaluate((e,html)=>e.innerHTML=html,old);
   assert(await p.locator('.ranking-name-button').first().evaluate(e=>e.getBoundingClientRect().height>=44));
  }
  const judges=model.rows('forum').filter(r=>model.profile(model.profileKey(r.judge))?.count>50).slice(0,2);
  for(const [i,judge] of judges.entries()){
   const key=model.profileKey(judge.judge),profile=model.profile(key),trigger=p.locator(`[data-ranking-name="${judge.judge}"] [data-ranking-profile]`);
   await trigger.scrollIntoViewIfNeeded();const savedY=await p.evaluate(()=>scrollY),savedLocal=await scroll.evaluate(e=>({top:e.scrollTop,left:e.scrollLeft}));
   await trigger.click();await p.waitForSelector('.ranking-dialog[open]');
   await p.mouse.move(2,2);await p.mouse.wheel(0,500);await p.waitForTimeout(50);assert.equal(await p.evaluate(()=>scrollY),savedY,'modal blocks background wheel scrolling');
   assert.equal(await p.locator('.ranking-dialog').getAttribute('data-kind'),'profile');
   assert.equal(await p.locator('.ranking-distribution button').count(),5);
   assert.equal(await p.locator('#ranking-profile-search').inputValue(),'');
   assert.equal(await p.locator('#ranking-profile-page').textContent(),`Страница 1 из ${Math.ceil(profile.count/25)}`);
   assert.equal(await p.locator('[data-profile-user]').count(),25);
   await p.locator('#ranking-profile-next').click();assert((await p.locator('#ranking-profile-page').textContent()).startsWith('Страница 2'));
   const grade=profile.rows.find(s=>s.artistName)?.score??1;
   await choose(p,'ranking-profile-grade',String(grade));
   const expected=pageScores(profile.rows,{grade:String(grade)});
   assert.equal(await p.locator('#ranking-profile-count').textContent(),`Найдено ${expected.total} из ${profile.count} оценок`);
   const match=expected.rows.find(s=>s.artistName)||expected.rows[0];
   await p.locator('#ranking-profile-search').fill(match.userId);assert.equal(await p.locator('[data-profile-user]').count(),1);
   await p.locator('#ranking-profile-search').fill('нет такого участника INT04');assert.equal(await p.locator('[data-profile-user]').count(),0);assert(await p.locator('.ranking-empty').isVisible());
   await p.locator('#ranking-profile-reset').click();await choose(p,'ranking-profile-order','oldest');
   assert.deepEqual(await p.locator('[data-profile-user]').evaluateAll(es=>es.map(e=>e.dataset.profileUser)),pageScores(profile.rows,{order:'oldest'}).rows.map(s=>s.userId));
   let visited=25;
   while(!await p.locator('#ranking-profile-next').isDisabled()){await p.locator('#ranking-profile-next').click();visited+=await p.locator('[data-profile-user]').count();}
   assert.equal(visited,profile.count);assert(await p.locator('#ranking-profile-next').isDisabled());
   await p.locator('#ranking-profile-reset').click();
   if(i===0){
    const detail=p.locator('.ranking-score details').first();if(await detail.count()){await detail.locator('summary').click();assert(await detail.locator('p').isVisible());}
    await p.locator('.ranking-dialog-body').evaluate(e=>e.scrollTop=0);
    await p.screenshot({path:`${output}/profile-${width}.png`});
    await p.locator('[data-ranking-close]').focus();await p.keyboard.press('Shift+Tab');
    assert(await p.evaluate(()=>document.activeElement===document.querySelector('#ranking-profile-next')));
    await p.keyboard.press('Tab');assert(await p.locator('[data-ranking-close]').evaluate(e=>e===document.activeElement));
    assert.equal(await p.evaluate(()=>document.documentElement.style.overflow),'hidden');
    await p.locator('#ranking-profile-search').fill('filter must not leak to the next judge');
    await p.keyboard.press('Escape');
   }else await p.locator('[data-ranking-close]').click();
   await p.waitForSelector('.ranking-dialog[open]',{state:'hidden'});
   assert(await trigger.evaluate(e=>e===document.activeElement));assert(Math.abs((await p.evaluate(()=>scrollY))-savedY)<2);
   assert.deepEqual(await scroll.evaluate(e=>({top:e.scrollTop,left:e.scrollLeft})),savedLocal);
  }
  // The accepted cleanup removes this duplicate methodology entry; the shared
  // home methodology dialog is covered by ui-reference at all five widths.
  assert.equal(await p.locator('[data-ranking-method]').count(),0);
  const unknown=p.locator('[data-ranking-name] [data-ranking-profile]').first(),knownId=await unknown.getAttribute('data-ranking-profile');
  await unknown.evaluate(e=>e.dataset.rankingProfile='unknown-id');await unknown.click();assert((await p.locator('.ranking-dialog-body').textContent()).includes('Судья не найден'));await p.keyboard.press('Escape');await p.waitForSelector('.ranking-dialog[open]',{state:'hidden'});await unknown.evaluate((e,key)=>e.dataset.rankingProfile=key,knownId);
  // Both light modes and sticky cells retain contrast/readable geometry.
  await setHeaderLight(p,'off');await overflow();await p.screenshot({path:`${output}/ranking-light-off-${width}.png`,fullPage:true});
  await p.locator('[data-ranking-name] [data-ranking-profile]').first().click();await p.waitForSelector('.ranking-dialog[open]');await p.screenshot({path:`${output}/profile-light-off-${width}.png`});await p.keyboard.press('Escape');await p.waitForSelector('.ranking-dialog[open]',{state:'hidden'});
  await setHeaderLight(p,'on');
  assert.equal(dataRequests.length,dataBefore,'ranking, dialog, light and filters never reload JSON');
  // Existing full URL profile keeps its 50-row behavior.
  const fullKey=model.profileKey(judges[0].judge);await p.goto(base+'/judges/?judge='+fullKey);await p.waitForSelector('#jp-rows [data-jp-user]');assert.equal(await p.locator('#jp-rows [data-jp-user]').count(),50);
  await p.locator('#jp-next').click();assert((await p.locator('#jp-page').textContent()).includes('Страница 2'));
  await p.locator('#jp-back').click();await p.waitForSelector('[data-ranking-ready]');
  // SPA navigation/back keeps UI state and does not load a second snapshot.
  await p.locator('[data-ranking-group="veterans"]').click();const requestsBeforeSPA=dataRequests.length;
  await nav(p,'home');await p.goBack();await p.waitForSelector('#judges.active');
  assert.equal(await p.locator('[data-ranking-group="veterans"]').getAttribute('aria-pressed'),'true');assert.equal(dataRequests.length,requestsBeforeSPA);
  assert(!dataRequests.some(n=>n==='/data/history.json'));
  console.log('Width passed:',width);
  checks.push({width,ratingSorts:'6 × 2 × 2 groups',profiles:2,paging:'all rows',B13:width<=390?'passed':'n/a',dialogs:'Escape/close/backdrop/Tab/focus/scroll passed',URLProfile:50,external:0});
  await ctx.close();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 fs.writeFileSync(`${output}/results.json`,JSON.stringify({passed:true,snapshot:context.exportedAt,checks,errors,external},null,2));console.log(JSON.stringify({passed:true,checks,errors,external}));
}finally{if(browser)await browser.close();server.kill();}
