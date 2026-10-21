import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {normalizeData} from '../js/data.js';
import {participantStatus} from '../js/general.js';

const root=process.cwd(),mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp'};
const require=createRequire(import.meta.url),{PNG}=require(path.join(root,'node_modules/playwright-core/lib/utilsBundle.js'));
const pixelmatch=require(path.join(root,'node_modules/playwright-core/lib/third_party/pixelmatch.js'));
const approved=await fs.readFile('docs/TUZ_V95_carrot_loader_preview.html','utf8');
const loaderReference='<!DOCTYPE html><html><head><meta charset="utf-8">'+[...approved.matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map(m=>m[0]).join('')+'</head><body>'+approved.match(/<div id="carrot-loader"[\s\S]*?<\/div>/)[0]+'</body></html>';
const server=http.createServer(async(req,res)=>{
 try{const name=new URL(req.url,'http://local').pathname;if(name==='/loader-reference.html'){res.setHeader('Content-Type','text/html');return res.end(loaderReference);}if(name==='/loader-fast.html'){res.setHeader('Content-Type','text/html');return res.end('<link rel="stylesheet" href="/css/styles.css"><div id="carrot-loader"><span class="carrot">🥕</span></div><script src="/js/loader.js"></script><script>window.ib19Loader.ready()</script>');}const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+path.sep))throw Error('outside');res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));}catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
const D=normalizeData(JSON.parse(await fs.readFile('data/19ib_all_judges_REPAIRED.json')),JSON.parse(await fs.readFile('data/forum_judges_export.json')));
const stats={pass:0,fail:0,pending:0},buckets=D.ratingsReport.buckets;
for(const p of D.people){stats[participantStatus(p[3]).status]++;}
const number=t=>Number(t.replace(/[^\d,−-]/g,'').replace(',','.').replace('−','-'));
const browser=await chromium.launch({headless:true});
const errors=[];
try{
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),ref=await context.newPage();
  // Hold data for the approved loader snapshot; its appearance is delayed by 300 ms.
  let release;const snapshotReady=new Promise(r=>release=r);
  await context.route('**/data/metadata.json?*',async route=>{await snapshotReady;await route.continue().catch(()=>{});});
  await ref.goto(base+'/loader-reference.html');await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForSelector('#carrot-loader.is-visible');await page.waitForTimeout(200);
  const dir='docs/screenshots/ui-reference';await fs.mkdir(dir,{recursive:true});
  const a=PNG.sync.read(await page.screenshot({path:`${dir}/project-${width}-loader.png`,animations:'disabled'})),b=PNG.sync.read(await ref.screenshot({path:`${dir}/reference-${width}-loader.png`,animations:'disabled'}));
  assert.equal(pixelmatch(a.data,b.data,null,width,900,{threshold:.1}),0,'loader reference '+width);release();await context.close();
 }
 // A ready application can settle before the 300 ms threshold without showing the carrot.
 {
  const page=await browser.newPage();
  await page.addInitScript(()=>{window.loaderShown=false;new MutationObserver(()=>{if(document.getElementById('carrot-loader')?.classList.contains('is-visible'))window.loaderShown=true;}).observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});});
  await page.goto(base+'/loader-fast.html');
  assert.equal(await page.locator('#carrot-loader').count(),0);
  assert.equal(await page.evaluate(()=>window.loaderShown),false);
  await page.close();
 }
 for(const scenario of ['normal','slow','transient','progressive','background-slow','background-error','error']){
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.addInitScript(()=>{
   window.loaderTimes={};
   new MutationObserver(()=>{const l=document.getElementById('carrot-loader');if(l?.classList.contains('is-visible')&&!window.loaderTimes.shown)window.loaderTimes.shown=performance.now();if(l?.classList.contains('is-hidden')&&!window.loaderTimes.fade)window.loaderTimes.fade=performance.now();}).observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  });
  let requestStarted=false,releaseSlow,releaseRoom,requestCount=0,roomRequests=0,failError=scenario==='error';
  const slowGate=new Promise(resolve=>{releaseSlow=resolve;}),roomGate=new Promise(resolve=>{releaseRoom=resolve;});
  await context.route('**/css/assets/room-*.webp',async route=>{roomRequests++;if(scenario==='background-error')return route.abort('failed');if(scenario==='background-slow'||scenario==='progressive'&&!route.request().url().includes('-preview'))await roomGate;await route.continue().catch(()=>{});});
  await context.route('**/data/metadata.json?*',async route=>{
   requestStarted=true;requestCount++;
   if(scenario==='transient'&&requestCount===1)return route.abort('connectionreset');
   if(scenario==='slow')await slowGate;
   if(failError)await route.fulfill({status:503,body:'unavailable'});else await route.continue();
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  if(scenario==='slow'){
   await page.waitForTimeout(600);assert.ok(requestStarted);
   assert.equal(await page.locator('.app').isVisible(),false);
   assert.equal(await page.locator('#carrot-loader.is-visible').count(),1,'slow data shows carrot');
   releaseSlow();
  }
  if(scenario==='error'){
   await page.locator('#load-state.load-error button').waitFor();
   assert.equal(await page.locator('#load-state h2').textContent(),'Сайт упал');
   assert.equal(await page.locator('#load-state p').textContent(),'Не удалось загрузить аналитику. Возможно, данные ещё обновляются.');
   assert.equal(await page.locator('#load-state button').textContent(),'Разбудить программиста');
   await page.waitForSelector('#carrot-loader',{state:'detached'});
   assert.equal(await page.locator('.app').isVisible(),false);
   await page.evaluate(()=>{window.retryMarker=17;});failError=false;
   await page.locator('#load-state button').focus();await page.keyboard.press('Enter');
   assert.equal(await page.locator('#load-state.load-pending').textContent(),'Загружаем аналитику…');
   await page.locator('.app:not([hidden])').waitFor();
   assert.equal(await page.evaluate(()=>window.retryMarker),17,'retry does not reload the document');
  }else await page.locator('.app:not([hidden])').waitFor();
  await page.waitForSelector('#carrot-loader',{state:'detached'});
  if(scenario==='background-slow'){
   assert.ok(roomRequests>0,'background starts in parallel');
   assert.equal(await page.locator('.room-wall.room-on-full-ready').count(),0,'analytics does not wait for background');
   releaseRoom();await page.locator('.room-wall.room-on-full-ready').waitFor();
  }
  if(scenario==='progressive'){
   await page.locator('.room-wall.room-on-preview-ready').waitFor();
   assert.equal(await page.locator('.room-wall.room-on-full-ready').count(),0,'small room image precedes full image');
   releaseRoom();await page.locator('.room-wall.room-on-full-ready').waitFor();
  }
  if(scenario==='background-error'){
   assert.ok(roomRequests>0,'failed background was attempted');
   assert.equal(await page.locator('.room-wall.room-on-full-ready').count(),0);
  }
  assert.ok(requestStarted,'fetch starts during startup');
  const timing=await page.evaluate(()=>window.loaderTimes);
  if(scenario==='slow')assert.ok(timing.shown&&timing.fade>=timing.shown,'carrot closes when slow data is ready');
  assert.ok(await page.locator('.app').isVisible());
  assert.equal(number(await page.locator('#home-total-size').textContent()),D.people.length);
  for(const [key,id] of [['pass','passed'],['fail','failed'],['pending','pending']])assert.equal(number(await page.locator('#home-total-'+id).evaluate(e=>e.firstChild.textContent)),stats[key]);
  const values=await page.locator('#home-ratings-list strong').allTextContents();assert.equal(values.length,buckets.length);
  values.forEach((v,i)=>{assert.equal(number(v.split('(')[0]),buckets[i]);assert.equal(number(v.split('(')[1]),Number((100*buckets[i]/D.ratingsReport.total).toFixed(1)));});
  assert.equal(buckets.reduce((a,b)=>a+b,0),D.ratingsReport.total);
  const decided=stats.pass+stats.fail;
  assert.equal(number(await page.locator('#home-position-pass-label').textContent()),Number((100*stats.pass/decided).toFixed(1)));
  assert.equal(number(await page.locator('#home-position-fail-label').textContent()),Number((100*stats.fail/decided).toFixed(1)));
  assert.equal(await page.locator('.home-groups-always tbody tr').count(),3);assert.equal(await page.locator('details.home-groups-details').count(),0);
  for(const route of ['dynamics','judges','rappers','']){await page.locator('.nav[href="/'+route+(route?'/':'')+'"]').click();assert.equal(await page.locator('#carrot-loader').count(),0);}
  console.log('Loader '+scenario+': ready, error recovery, and independent room lifecycle.');await context.close();
 }
 {
  const context=await browser.newContext({reducedMotion:'reduce'}),page=await context.newPage();
  let release;const gate=new Promise(resolve=>{release=resolve;});
  await context.route('**/data/metadata.json?*',async route=>{await gate;await route.continue().catch(()=>{});});
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('#carrot-loader.is-visible').waitFor();
  assert.equal(await page.locator('#carrot-loader .carrot').evaluate(e=>getComputedStyle(e).animationName),'none');
  assert.equal(await page.locator('#carrot-loader').evaluate(e=>getComputedStyle(e).transitionDuration),'0s');
  release();await page.locator('.app:not([hidden])').waitFor();await context.close();
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();await new Promise(r=>server.close(r));}
