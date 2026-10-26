import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {selectForumRows} from '../js/forum-link-model.js';
import {selectMatrixRows} from '../js/matrix-selection.js';
const out='docs/diagnostics/rappers-integration',base='http://127.0.0.1:9264',pages=['participants','matrix','tuz-impact'];
import {ACTIVE_R1_SOURCE,R1_SOURCES} from '../js/r1-application.js';
import {createOfficialR1View} from '../js/r1-official-view.js';
import {rapperR1Model,rapperR2Model} from '../js/rapper-report-model.js';
import {validateR2Submissions} from '../js/r2-submissions.js';
import {r2GroupReference} from '../js/r2-home-model.js';
const source=R1_SOURCES[ACTIVE_R1_SOURCE],directory=new URL(source.directory,new URL('../js/r1-application.js',import.meta.url)),raw={};
for(const [key,file]of Object.entries({main:'19ib_all_judges_REPAIRED.json',forum:'forum_judges_export.json',metadata:'metadata.json',history:'history.json'}))raw[key]=JSON.parse(await fs.readFile(new URL(file,directory),'utf8'));
const r1=rapperR1Model(createOfficialR1View(raw,{policyVersion:source.policyVersion}));
const r2=rapperR2Model(validateR2Submissions(JSON.parse(await fs.readFile('data/rounds/r2-submissions.v1/snapshot.json','utf8'))),r2GroupReference(JSON.parse(await fs.readFile('data/forum_judges_export.json','utf8'))));
const data={rounds:{1:r1,2:r2}},byId=new Map(r1.members.map(p=>[p.id,p]));
const top=[...r1.impacts].sort((a,b)=>b.impact-a.impact)[0],person=byId.get(top.id),veteran=r1.members.find(p=>p.veteran),results=[],errors=[],external=[],shots=[];
await fs.mkdir(out+'/screenshots',{recursive:true});const server=spawn(process.execPath,['scripts/serve.mjs','--dir','dist','--port','9264']);
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});
const browser=await chromium.launch();
async function filters(page,open=true){const button=page.locator('.e6-filter-toggle');if(await button.isVisible()&&(await button.getAttribute('aria-expanded')==='true')!==open)await button.click();}
async function pick(page,id,value){
 if(id==='round-select'){
  await page.locator('.header-polished').waitFor();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const button=page.locator('[data-select-id="round-select"]');if(!await button.isVisible())await page.locator('.header-menu-toggle').click();
  const label=await page.locator('#'+id).evaluate((e,value)=>[...e.options].find(o=>o.value===value).textContent,value);
  await button.click();await page.getByRole('option',{name:label,exact:true}).click();await page.waitForURL(url=>url.searchParams.get('round')===value);
 }else await page.locator('[data-field="'+id.replace('e6-','')+'"]').selectOption(value);
}
async function shot(page,name){await page.evaluate(()=>new Promise(resolve=>{scrollTo({top:0,behavior:'instant'});requestAnimationFrame(()=>requestAnimationFrame(resolve));}));await page.screenshot({path:`${out}/screenshots/${name}.png`,fullPage:!await page.locator('.page.active .rr-panel:not([hidden]) .rr-dialog').evaluate(e=>e.open)});shots.push(name);}
async function ready(page){const round=new URL(page.url()).searchParams.get('round')||'1';await page.locator('.page.active .rr-panel:not([hidden]) .rr-report[data-ready=true][data-round="'+round+'"]').waitFor();}
async function contextFor(width){const context=await browser.newContext({viewport:{width,height:1000},hasTouch:width<=768,reducedMotion:'reduce'});await context.addInitScript(()=>localStorage.setItem('tuz19-room-light','on'));await context.route('**/*',route=>{if(!route.request().url().startsWith(base)){external.push(route.request().url());return route.abort();}return route.continue();});return context;}
async function visit(context,page,round,extra=''){const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(`${base}/rappers/?round=${round}&report=${page}${extra}`);await ready(p);await p.locator('#carrot-loader').waitFor({state:'detached'});return p;}
async function noOverflow(p,label){const delta=await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth);assert.ok(delta<=1,`${label}: overflow ${delta}`);}
try{
 for(const width of [320,375,390,768,1024,1440,1920]){
  const context=await contextFor(width);
  for(const round of [1,2])for(const name of pages){
   const p=await visit(context,name,round),report=p.locator('.page.active .rr-panel:not([hidden]) .rr-report');
   for(const light of ['on','off']){
    if(light==='off')await p.locator('.room-switch').evaluate(e=>e.click());await p.locator(`.room-${light}-full-ready`).waitFor();await noOverflow(p,`${name} ${round} ${width} ${light}`);
    assert.equal(await report.getAttribute('data-round'),String(round));
    assert.equal(await p.locator('.page.active h1').textContent(),'Реперы');
    assert.ok(!/selectionVersion|r1-official|2026-10-22|scoredAt|Строки:|Выбранный судья:/.test(await report.innerText()));
    if([390,1440].includes(width))await shot(p,`${name}-r${round}-${width}-${light}`);
    results.push({width,page:name,round,light,overflow:0});
   }
   if(name==='participants'){
    assert.equal(await p.locator('.e6-summary-count strong').textContent(),round===1?'98':String(r2.members.length));
    if(round===2){assert.equal(await p.locator('[data-person]').count(),Math.min(20,r2.members.length));while(await p.locator('.e6-more').count()&&await p.locator('.e6-more').isVisible())await p.locator('.e6-more').click();assert.equal(await p.locator('[data-person]').count(),r2.members.length);assert.deepEqual((await p.locator('[data-person]').evaluateAll(es=>es.map(e=>e.dataset.person))).sort(),r2.members.map(m=>m.id).sort());assert.ok(!/Прошёл|Вылетел|ожидают решения/.test(await report.innerText()));assert.equal(await p.locator('.e6-outcome-bar').count(),0);}
    else{
     await p.locator('[data-group="veterans"]').click();assert.match(await p.locator('.e6-results').textContent(),/из 28/);
     await filters(p);await pick(p,'e6-status','fail');assert.equal(await p.locator('[data-person]').count(),r1.members.filter(x=>x.veteran&&x.status==='fail').length);
     await p.locator('[data-reset]').click();await pick(p,'e6-sort','alpha');
     assert.deepEqual(await p.locator('[data-person]').evaluateAll(es=>es.map(e=>e.dataset.person)),selectForumRows(r1.members,{sort:'alpha'}).slice(0,20).map(x=>x.id));
     await pick(p,'e6-sort','trul');assert.deepEqual(await p.locator('[data-person]').evaluateAll(es=>es.map(e=>e.dataset.person)),selectForumRows(r1.members,{sort:'trul'}).slice(0,20).map(x=>x.id));await filters(p,false);
     await p.locator('[data-field="search"]').fill('невозможный-поиск-exp06');assert.equal(await p.locator('[data-person]').count(),0);await p.locator('.e6-empty').waitFor();
     await p.locator('[data-field="search"]').fill(person.name);assert.equal(await p.locator('[data-person]').count(),1);
    }
    const target=round===1?person:data.rounds[2].members[0];if(round===2)await p.locator('[data-field="search"]').fill(target.name);
    const trigger=p.locator('[data-person]').first();if(width<=768)await trigger.tap();else{await trigger.focus();await p.keyboard.press('Enter');}
    const host=width<=850?p.locator('.page.active .rr-panel:not([hidden]) .rr-dialog'):p.locator('.e6-person-aside');await host.waitFor({state:'visible'});assert.equal(await host.locator('[data-detail-id]').getAttribute('data-detail-id'),target.id);
    if(round===1){assert.equal(await host.locator('.e6-grades details').count(),person.scores.length);await host.locator('.e6-grades summary').first().click();assert.equal(await host.locator('.e6-comment').first().textContent(),person.scores[0].comment.trim()||'Комментария нет.');}
    if(target.profile)assert.equal(await host.locator('a[href*="19ib.ru/artist/"]').getAttribute('href'),target.profile);
    if([390,1440].includes(width))await shot(p,`participants-r${round}-${width}-selected`);
    if(width<=850){await p.keyboard.press('Escape');assert.ok(await trigger.evaluate(e=>e===document.activeElement));}else await p.locator('.e6-inline-close').click();
   }
   if(name==='matrix'){
    if(round===2){assert.equal(await p.locator('.e6-cell').count(),0);assert.match(await report.innerText(),/нет состава судей/);}
    else{
     const drawn=await p.locator('.e6-cell').evaluateAll(es=>es.map(e=>({p:e.dataset.p,j:e.dataset.j,v:e.textContent})));
     for(const c of drawn){const j=r1.judges.find(j=>j.id===c.j),score=byId.get(c.p).scores.find(s=>s.judgeName===j.name);assert.equal(c.v,String(score?.score??'—'));}
     assert.equal(await p.locator('.e6-score-aside:visible').count(),0);
     await p.locator('[data-field="search"]').fill(person.name);const grade=person.scores[0],j=r1.judges.find(j=>j.name===grade.judgeName);await pick(p,'e6-judge',j.id);
     const b=p.locator('.e6-cell').first();await b.hover();assert.equal(await p.locator('.e6-matrix-row.is-row').count(),1);assert.ok(await p.locator('.is-col').count()>=2);
     if(width<=768)await b.tap();else{await b.focus();await p.keyboard.press('Enter');}
     const host=width<=900?p.locator('.page.active .rr-panel:not([hidden]) .rr-dialog'):p.locator('.e6-score-aside');await host.waitFor({state:'visible'});assert.equal(await host.locator('.e6-grade-large').textContent(),String(grade.score));assert.equal(await host.locator('.e6-comment').textContent(),grade.comment.trim()||'Комментария нет.');
     if([390,1440].includes(width))await shot(p,`matrix-r1-${width}-selected`);
     if(width<=900)await p.keyboard.press('Escape');else await p.locator('.e6-inline-close').click();
     // Blank cells are unknown, never zero.
     const missing=r1.judges.find(j=>!person.scores.some(s=>s.judgeName===j.name));await pick(p,'e6-judge',missing.id);assert.equal(await p.locator('.e6-cell').textContent(),'—');await p.locator('.e6-cell').click();assert.equal(await host.locator('.e6-grade-large').textContent(),'—');assert.match(await host.innerText(),/Оценка этого судьи отсутствует/);if(width<=900)await p.keyboard.press('Escape');else await p.locator('.e6-inline-close').click();
     await filters(p);await p.locator('[data-reset]').click();await filters(p,false);assert.equal(await p.locator('[data-field="judge"]').inputValue(),'all');assert.equal(await p.locator('.e6-cell').count(),98*22);
     const first=p.locator('.e6-cell').first();await first.focus();await p.keyboard.press('ArrowRight');assert.equal(await p.evaluate(()=>document.activeElement.dataset.c),'1');
     await p.locator('[data-sort-judge]').first().click();const js=r1.judges[0];assert.deepEqual(await p.locator('[data-row]').evaluateAll(es=>es.map(e=>e.dataset.row)),selectMatrixRows(r1.members,{query:'',group:'all',status:'all',matrixSort:'score',judgeSort:js.name,judgeDirection:'desc'}).map(x=>x.id));
     const sticky=await p.locator('.e6-matrix-scroll').evaluate(e=>{e.scrollLeft=500;e.scrollTop=180;const a=e.getBoundingClientRect(),head=e.querySelector('.e6-matrix-header').getBoundingClientRect(),name=e.querySelector('.e6-matrix-row .e6-matrix-person').getBoundingClientRect();return {head:head.top-a.top,name:name.left-a.left,scroll:e.scrollLeft};});assert.ok(sticky.scroll>0);assert.ok(Math.abs(sticky.head-1)<2);assert.ok(Math.abs(sticky.name-1)<2);
     await noOverflow(p,'matrix selected and scrolled');
    }
   }
   if(name==='tuz-impact'){
    if(round===2){assert.equal(await p.locator('.e6-impact-values,.e6-now-marker').count(),0);assert.match(await report.innerText(),/второго раунда ещё не рассчитан/);}
    else{
     assert.equal(await p.locator('.e6-impact-row[data-impact]').count(),70);
     for(const r of r1.impacts){await p.locator(`.e6-impact-row[data-impact="${r.id}"]`).click();const state=await p.locator('.e6-impact-scene').evaluate(e=>({...e.dataset}));assert.equal(state.id,r.id);assert.equal(Number(state.base),r1.base);assert.equal(Number(state.without),r.without);assert.equal(Number(state.impact),r.impact);const printed=n=>(n>0?'+':n<0?'−':'')+new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(Math.abs(n));assert.deepEqual(await p.locator('.e6-impact-values strong').allTextContents(),[printed(r1.base),printed(r.without)]);const domain=[r1.base,...r1.impacts.map(x=>x.without)],lo=Math.floor(Math.min(...domain)*2)/2,hi=Math.ceil(Math.max(...domain)*2)/2,x=n=>60+(n-lo)/(hi-lo)*480;assert.ok(Math.abs(Number(await p.locator('.e6-now-marker').getAttribute('data-x'))-x(r1.base))<1e-9);assert.ok(Math.abs(Number(await p.locator('.e6-without-marker').getAttribute('data-x'))-x(r.without))<1e-9);assert.match(await p.locator('.e6-impact-delta p').textContent(),r.impact>0?/был бы ниже/:r.impact<0?/был бы выше/:/не изменился/);}
     await p.locator('[data-order="negative"]').click();assert.equal(await p.locator('.e6-impact-row[data-impact]').first().getAttribute('data-impact'),[...r1.impacts].sort((a,b)=>a.impact-b.impact)[0].id);
     await p.locator('.e6-impact-row[data-impact]').first().focus();await p.keyboard.press('ArrowDown');assert.ok(await p.locator('.e6-impact-row[data-impact]').nth(1).evaluate(e=>e===document.activeElement));
     await p.locator('.e6-components summary').click();assert.equal(await p.locator('.e6-components dd').count(),5);
     if([390,1440].includes(width))await shot(p,`tuz-impact-r1-${width}-negative`);
     await p.locator('[data-field="impact-search"]').fill('невозможный-поиск-exp06');assert.equal(await p.locator('.e6-impact-row[data-impact]').count(),0);await p.locator('.e6-empty').waitFor();
    }
   }
   await noOverflow(p,`${name} interactions`);await p.close();
  }
  // Cross-report identity stays within the existing application route.
  if([390,1440].includes(width)){
   const p=await visit(context,'participants',1,'&participant='+person.id);if(width<=850)await p.keyboard.press('Escape');
   await p.locator('[data-rapper-tab="1"]').click();await ready(p);assert.equal(await p.locator('.page.active .rr-panel:not([hidden]) .rr-report').getAttribute('data-participant'),person.id);assert.equal(await p.locator('[data-row]').count(),1);
   await p.locator('[data-rapper-tab="2"]').click();await ready(p);assert.equal(await p.locator('.e6-impact-scene').getAttribute('data-id'),person.id);
   await p.goto(`${base}/rappers/?round=1&report=tuz-impact&participant=${veteran.id}`);await ready(p);assert.equal(await p.locator('.e6-impact-values:visible').count(),0);assert.match(await p.locator('.e6-impact-scene').innerText(),/не рассчитывается/);
   await pick(p,'round-select','2');await ready(p);assert.equal(await p.locator('.page.active .rr-panel:not([hidden]) .rr-report').getAttribute('data-round'),'2');assert.equal(await p.locator('.page.active .rr-panel:not([hidden]) .rr-report').getAttribute('data-participant'),'');await p.close();
  }
  console.log('PASS live rappers',width);await context.close();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 await fs.writeFile(out+'/browser-results.json',JSON.stringify({passed:true,results,errors,external,screenshots:shots,impactStates:70*7},null,2));
 console.log(JSON.stringify({passed:true,roundViewportLightStates:results.length,impactStates:490,screenshots:shots.length,errors,external}));
}finally{await browser.close();server.kill();}
