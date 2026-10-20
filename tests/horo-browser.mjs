import {chromium} from 'playwright';
import fs from 'node:fs/promises';import http from 'node:http';import path from 'node:path';import assert from 'node:assert/strict';
const root=path.resolve('dist'),types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp'};
const server=http.createServer(async(req,res)=>{try{let file=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);if(file!==root&&!file.startsWith(root+path.sep))throw Error('outside');if((await fs.stat(file)).isDirectory())file=path.join(file,'index.html');res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true}),errors=[],checks=[];await fs.mkdir('docs/screenshots/horo',{recursive:true});
try{
 const context=await browser.newContext();
 await context.route('https://www.youtube.com/**',r=>r.fulfill({status:200,contentType:'text/html',body:'<p>YouTube embed</p>'}));
 await context.route('https://static.cloudflareinsights.com/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)errors.push(r.status()+' '+r.url())});
 for(const width of [1440,1024,768,390,320]){
  await page.setViewportSize({width,height:1000});await page.goto(base+'/');await page.waitForSelector('.app:not([hidden])');
  const oldHeight=await page.locator('.site-header').evaluate(e=>e.getBoundingClientRect().height);
  await page.locator('.nav-horo').click();await page.waitForSelector('#horo.active .horo-note');
  assert.equal(new URL(page.url()).pathname,'/horo/');assert.equal(await page.locator('#page-title').innerText(),'Хо-ро-шо. По форумному');
  assert(!await page.locator('.round-picker-row').isVisible());assert.equal(await page.locator('.horo-note').count(),6);assert.equal(await page.locator('.horo-note[open]').count(),0);
  assert(!(await page.locator('#horo').innerText()).includes('баттл глазами тех, кто всё это читает'));
  await page.locator('.nav-horo img').evaluate(e=>e.decode());
  const nav=await page.locator('.nav-horo').evaluate(e=>{const r=e.getBoundingClientRect(),i=e.querySelector('img').getBoundingClientRect(),line=getComputedStyle(e,'::after');return {imageWidth:i.width,imageHeight:i.height,inside:i.top>=r.top&&i.bottom<=r.bottom,space:r.bottom-i.bottom,bottom:parseFloat(line.bottom),height:parseFloat(line.height),active:e.getAttribute('aria-current')};});
  assert(nav.inside);assert(nav.space>=nav.bottom+nav.height-1);assert.equal(nav.active,'page');
  assert.equal(await page.locator('.site-header').evaluate(e=>e.getBoundingClientRect().height),oldHeight);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow '+width);
  await page.screenshot({path:`docs/screenshots/horo/page-${width}.png`});
  for(const note of await page.locator('.horo-note').all()){await note.locator('summary').click();assert(await note.getAttribute('open')!==null);assert((await note.locator('.horo-note-body').innerText()).length>100);}
  assert.equal(await page.locator('.horo-note[open]').count(),6);
  for(const summary of await page.locator('.horo-note summary').all())await summary.click();
  const iframe=page.locator('.horo-video iframe');assert.equal(await iframe.getAttribute('src'),'https://www.youtube.com/embed/tWDkspm4rAk');assert.equal(await iframe.getAttribute('loading'),'lazy');assert(await iframe.getAttribute('allowfullscreen')!==null);
  assert.equal(await page.locator('.horo-gallery .horo-image').count(),12);
  const columns=await page.locator('.horo-gallery').evaluate(e=>getComputedStyle(e).columnCount);assert.equal(columns,width>850?'2':'1');
  await page.locator('.horo-series').click();await page.waitForSelector('dialog.horo-lightbox[open]');
  assert.deepEqual(await page.locator('.horo-view-series img').evaluateAll(es=>es.map(e=>new URL(e.src).pathname.split('/').pop())),['comic-14.png','comic-13.png','comic-12.png']);
  await Promise.all((await page.locator('.horo-view-series img').all()).map(i=>i.evaluate(e=>e.decode())));
  if(width<500)assert(await page.locator('.horo-view-scroll').evaluate(e=>e.scrollWidth>e.clientWidth));
  await page.locator('.horo-zoom').click();assert.equal(await page.locator('.horo-zoom').getAttribute('aria-pressed'),'true');
  await page.screenshot({path:`docs/screenshots/horo/story-${width}.png`});await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(),0);
  await page.locator('.horo-image').first().click();await page.locator('.horo-close').click();assert.equal(await page.locator('dialog[open]').count(),0);
  await page.reload();await page.waitForSelector('.horo-note');assert.equal(await page.locator('.horo-note[open]').count(),0);
  await page.evaluate(()=>scrollTo(0,900));assert(Math.abs((await page.locator('.site-header').boundingBox()).y)<1);
  for(const [url,id]of [['/dynamics/','dynamics'],['/judges/','judges'],['/rappers/','forum-link'],['/events/','events-page']]){await page.goto(base+url);await page.waitForSelector('#'+id+'.active');assert.equal(await page.locator('.nav-horo').count(),1);assert(await page.locator('.round-picker-row').isVisible());}
  checks.push('width '+width+': route, menu, stable header, summaries, lazy embed, gallery, story, zoom, Escape, reload, other sections');
 }
 assert.deepEqual(errors,[]);await fs.writeFile('docs/screenshots/horo/results.json',JSON.stringify({passed:true,checks,errors},null,2));console.log('Horo browser: '+checks.length+' widths passed');
}finally{await browser.close();await new Promise(r=>server.close(r))}
