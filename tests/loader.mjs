import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {normalizeData} from '../js/data.js';
import {participantStatus} from '../js/general.js';

const root=process.cwd(),mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json'};
const require=createRequire(import.meta.url),{PNG}=require(path.join(root,'node_modules/playwright-core/lib/utilsBundle.js'));
const pixelmatch=require(path.join(root,'node_modules/playwright-core/lib/third_party/pixelmatch.js'));
const approved=await fs.readFile('docs/TUZ_V95_carrot_loader_preview.html','utf8');
const loaderReference='<!DOCTYPE html><html><head><meta charset="utf-8">'+[...approved.matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map(m=>m[0]).join('')+'</head><body>'+approved.match(/<div id="carrot-loader"[\s\S]*?<\/div>/)[0]+'</body></html>';
const server=http.createServer(async(req,res)=>{
 try{const name=new URL(req.url,'http://local').pathname;if(name==='/loader-reference.html'){res.setHeader('Content-Type','text/html');return res.end(loaderReference);}const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+path.sep))throw Error('outside');res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));}catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
const D=normalizeData(JSON.parse(await fs.readFile('data/19ib_all_judges_REPAIRED.json')),JSON.parse(await fs.readFile('data/forum_judges_export.json')));
const stats={pass:0,fail:0,pending:0},buckets=Array(6).fill(0);
for(const p of D.people){stats[participantStatus(p[3]).status]++;buckets[Math.min(5,p[3].length)]++;}
const number=t=>Number(t.replace(/[^\d,−-]/g,'').replace(',','.').replace('−','-'));
const browser=await chromium.launch({headless:true});
const errors=[];
try{
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),ref=await context.newPage();
  // Linux may take more than two seconds to prepare an emoji screenshot.
  // Hold data only for this visual snapshot; real lifecycle timing is tested below.
  let release;const snapshotReady=new Promise(r=>release=r);
  await context.route('**/data/metadata.json?*',async route=>{await snapshotReady;await route.continue().catch(()=>{});});
  await ref.goto(base+'/loader-reference.html');await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForSelector('#carrot-loader .carrot');
  const dir='docs/screenshots/ui-reference';await fs.mkdir(dir,{recursive:true});
  const a=PNG.sync.read(await page.screenshot({path:`${dir}/project-${width}-loader.png`,animations:'disabled'})),b=PNG.sync.read(await ref.screenshot({path:`${dir}/reference-${width}-loader.png`,animations:'disabled'}));
  assert.equal(pixelmatch(a.data,b.data,null,width,900,{threshold:.1}),0,'loader reference '+width);release();await context.close();
 }
 for(const scenario of ['fast','slow','error']){
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.addInitScript(()=>{
   window.loaderTimes={};
   new MutationObserver(()=>{const l=document.getElementById('carrot-loader');if(l&&!window.loaderTimes.start)window.loaderTimes.start=performance.now();if(l?.classList.contains('is-hidden')&&!window.loaderTimes.fade)window.loaderTimes.fade=performance.now();}).observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  });
  let requestStarted=false,releaseSlow;
  const slowGate=new Promise(resolve=>{releaseSlow=resolve;});
  await context.route('**/data/metadata.json?*',async route=>{
   requestStarted=true;
   if(scenario==='slow')await slowGate;
   if(scenario==='error')await route.fulfill({status:503,body:'unavailable'});else await route.continue();
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#carrot-loader',{state:'visible'});
  const style=await page.locator('#carrot-loader .carrot').evaluate(e=>{const c=getComputedStyle(e);return {size:c.fontSize,duration:c.animationDuration,iteration:c.animationIterationCount};});
  assert.deepEqual(style,{size:'68px',duration:'1s',iteration:'infinite'});
  await page.waitForTimeout(1100);assert.ok(requestStarted,'fetch starts during loader');
  // DOMContentLoaded may already be late on a busy runner: anchor to loader start,
  // and retain the unconditional fade-start minimum-duration assertion below.
  const observed=await page.evaluate(()=>({elapsed:performance.now()-window.loaderTimes.start,hidden:document.getElementById('carrot-loader')?.classList.contains('is-hidden')??true}));
  if(observed.elapsed<1985)assert.equal(observed.hidden,false,'not dismissed early');
  if(scenario==='slow'){await page.waitForFunction(()=>performance.now()-window.loaderTimes.start>=2100);assert.equal(await page.locator('#carrot-loader.is-hidden').count(),0,'still waiting for slow data after 2 seconds');releaseSlow();}
  await page.waitForSelector('#carrot-loader',{state:'detached'});
  const timing=await page.evaluate(()=>window.loaderTimes);assert.ok(timing.fade-timing.start>=1985,JSON.stringify(timing));
  if(scenario==='error'){assert.match(await page.locator('#load-state').textContent(),/Не удалось подготовить аналитику/);assert.ok(await page.locator('#load-state button').isVisible());}
  else{
   assert.ok(await page.locator('.app').isVisible());
   assert.equal(number(await page.locator('#home-total-size').textContent()),D.people.length);
   for(const [key,id] of [['pass','passed'],['fail','failed'],['pending','pending']])assert.equal(number(await page.locator('#home-total-'+id).evaluate(e=>e.firstChild.textContent)),stats[key]);
   const values=await page.locator('#home-ratings-list strong').allTextContents();assert.equal(values.length,6);
   values.forEach((v,i)=>{assert.equal(number(v.split('(')[0]),buckets[i]);assert.equal(number(v.split('(')[1]),Number((100*buckets[i]/D.people.length).toFixed(1)));});
   assert.equal(buckets.reduce((a,b)=>a+b,0),D.people.length);
   const decided=stats.pass+stats.fail;
   assert.equal(number(await page.locator('#home-position-pass-label').textContent()),Number((100*stats.pass/decided).toFixed(1)));
   assert.equal(number(await page.locator('#home-position-fail-label').textContent()),Number((100*stats.fail/decided).toFixed(1)));
   assert.equal(await page.locator('.home-groups-always tbody tr').count(),3);assert.equal(await page.locator('details.home-groups-details').count(),0);
   for(const route of ['dynamics','judges','rappers','']){await page.locator('.nav[href="/'+route+(route?'/':'')+'"]').click();assert.equal(await page.locator('#carrot-loader').count(),0);}
   await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('#carrot-loader',{state:'detached'});const reloadTiming=await page.evaluate(()=>window.loaderTimes);assert.ok(reloadTiming.fade-reloadTiming.start>=1985,JSON.stringify(reloadTiming));
  }
  console.log('Loader '+scenario+': parallel data, minimum 2 seconds, correct ready/error state.');await context.close();
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();await new Promise(r=>server.close(r));}
