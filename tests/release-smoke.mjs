// Narrow release smoke test: routes/resources, not a regression of R1 analytics.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
const root=path.resolve('dist'),types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png'};
const server=http.createServer((req,res)=>{try{const pathname=new URL(req.url,'http://local').pathname;let file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep)&&file!==root)throw Error('outside');if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch(),errors=[],badResponses=[];
try{
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
  await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));page.on('response',r=>{if(r.status()>=400)badResponses.push([r.status(),r.url()]);});
  for(const route of ['/','/dynamics/','/judges/','/rappers/','/events/','/horo/']){
   await page.goto(base+route+'?round=1',{waitUntil:'domcontentloaded'});
   await page.locator('.app:not([hidden])').waitFor();await page.locator('#carrot-loader').waitFor({state:'detached'});
   await page.locator('.page.active').waitFor();assert.equal(await page.locator('#round-select').inputValue(),'1');assert(await page.locator('.page.active').count()>0);
  }
  for(const route of ['/','/dynamics/','/judges/','/rappers/','/events/','/horo/']){
   await page.goto(base+route+'?round=2&report=matrix',{waitUntil:'domcontentloaded'});
   await page.locator('.r2-public').waitFor();await page.locator('#carrot-loader').waitFor({state:'detached'});
   assert.equal(await page.locator('#round-select').inputValue(),'2');
   assert.equal(new URL(page.url()).pathname,'/');assert.equal(new URL(page.url()).search,'?round=2');
   assert.equal(await page.locator('.site-header .navs').isVisible(),false);
   assert.equal(await page.locator('.page.active').getAttribute('id'),'round-information');
   assert.equal(await page.locator('.r2-public h1').innerText(),'Второй отборочный');
   assert.equal(await page.locator('.page.active :is(table,svg,[role=tablist])').count(),0);
  }
  await page.locator('.r2-public a').click();await page.locator('#home.active').waitFor();
  await page.locator('.page.active').waitFor();assert.equal(await page.locator('#round-select').inputValue(),'1');
  assert.equal(await page.locator('.site-header .navs').getAttribute('hidden'),null);
  await context.close();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(badResponses,[]);
 console.log('PASS: six R1 sections, unified public R2 routes and return to R1; mobile/desktop; no browser or resource errors.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
