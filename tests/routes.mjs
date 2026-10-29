import {isOfflinePresence,replyPresence}from './offline-presence-fixture.mjs';
import {nav} from './browser-support.mjs';
import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import '../scripts/build.mjs';

const root=path.resolve('dist');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'};
const server=http.createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);
  const sitePath=pathname.startsWith('/ib19/')?pathname.slice('/ib19'.length):pathname;
  let file=path.resolve(root,'.'+sitePath);
  if(file!==root&&!file.startsWith(root+path.sep))throw Error('outside');
  if((await fs.stat(file)).isDirectory())file=path.join(file,'index.html');
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
  res.end(await fs.readFile(file));
 }catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const cases=[['/','Главная'],['/dynamics/','Ход баттла'],['/judges/','Судьи'],['/rappers/','Реперы'],['/events/','События'],['/horo/','Хо-ро-шо. По форумному']];
const browser=await chromium.launch({headless:true});
const errors=[];
try{
 const page=await browser.newPage();
 page.on('pageerror',error=>errors.push(error.message));
 page.on('response',response=>{if(response.url().startsWith(base)&&response.status()>=400)errors.push(`${response.status()} ${response.url()}`);});
 await page.addInitScript(()=>{
  window.__pushes=0;
  const push=history.pushState;
  history.pushState=function(...args){window.__pushes++;return push.apply(this,args);};
 });
 for(const [url,title] of cases){
  await page.route('**/*',r=>isOfflinePresence(r)?replyPresence(r):new URL(r.request().url()).origin===base?r.continue():r.abort());const response=await page.goto(base+url,{waitUntil:'domcontentloaded'});
  assert.equal(response.status(),200,url);
  await page.waitForSelector('.app:not([hidden])');
  assert.equal(new URL(page.url()).pathname,url);
  assert.equal(await page.title(),`${title} — TUZ19`);
  assert.equal(await page.locator('#page-title').textContent(),title);
  assert.equal(await page.locator('script[data-cf-beacon]').count(),1);
  assert.equal(await page.locator('.site-header .nav').count(),6);
 }
 await page.route('**/*',r=>isOfflinePresence(r)?replyPresence(r):new URL(r.request().url()).origin===base?r.continue():r.abort());await page.goto(base+'/');
 await page.waitForSelector('#carrot-loader',{state:'detached'});
 await page.locator('a[data-report-kind="rappers"][data-report-id="participants"]').click();
 assert.equal(new URL(page.url()).pathname,'/rappers/');
 await page.goBack();assert.equal(new URL(page.url()).pathname,'/');
 await page.evaluate(()=>window.__pushes=0);
 await page.evaluate(()=>window.__marker=Symbol('same document'));
 for(const [url,title] of cases.slice(1,4)){
  await page.locator(`.nav[href="${url}"]`).click();
  assert.equal(new URL(page.url()).pathname,url);
  assert.equal(await page.title(),`${title} — TUZ19`);
  assert.equal(await page.evaluate(()=>typeof window.__marker),'symbol','navigation reloaded the page');
  assert.equal(await page.locator('#carrot-loader').count(),0);
 }
 assert.equal(await page.evaluate(()=>window.__pushes),3,'one pushState per menu click');
 await page.goBack();assert.equal(new URL(page.url()).pathname,'/judges/');assert.equal(await page.title(),'Судьи — TUZ19');
 await page.goForward();assert.equal(new URL(page.url()).pathname,'/rappers/');assert.equal(await page.title(),'Реперы — TUZ19');
 await page.reload();await page.waitForSelector('.app:not([hidden])');assert.equal(await page.title(),'Реперы — TUZ19');
 for(const [oldPath,newPath] of [
  ['overview','/'],['dynamics','/dynamics/'],['judges','/judges/'],['forum-link','/rappers/'],['events','/events/'],
  ['judge/example','/judges/'],['participant/example','/rappers/']
 ]){
  await page.route('**/*',r=>isOfflinePresence(r)?replyPresence(r):new URL(r.request().url()).origin===base?r.continue():r.abort());await page.goto(base+'/#/round/1/'+oldPath);
  await page.waitForSelector('.app:not([hidden])');
  assert.equal(new URL(page.url()).pathname,newPath,oldPath);
  assert.equal(new URL(page.url()).hash,'',oldPath);
 }
 await page.route('**/*',r=>isOfflinePresence(r)?replyPresence(r):new URL(r.request().url()).origin===base?r.continue():r.abort());await page.goto(base+'/#/round/1/events?type=pass');await page.waitForSelector('.app:not([hidden])');
 assert.equal(new URL(page.url()).pathname,'/events/');assert.equal(new URL(page.url()).search,'?type=pass');
 assert.equal(await page.locator('#event-type').inputValue(),'pass');
 await page.route('**/*',r=>isOfflinePresence(r)?replyPresence(r):new URL(r.request().url()).origin===base?r.continue():r.abort());await page.goto(base+'/ib19/rappers/');await page.waitForSelector('.app:not([hidden])');
 assert.equal(await page.title(),'Реперы — TUZ19');
 assert.equal(await page.locator('.nav[data-tab="judges"]').getAttribute('href'),'/ib19/judges/');
 await page.locator('.nav[data-tab="judges"]').click();assert.equal(new URL(page.url()).pathname,'/ib19/judges/');
 assert.deepEqual(errors,[]);
 console.log('Routes passed: six direct paths, SPA menu, history, reload, legacy links, assets, one Beacon.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
