import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=path.resolve('dist');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp'};
const server=http.createServer(async(req,res)=>{
 try{
  let file=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);
  if(file!==root&&!file.startsWith(root+path.sep))throw Error('outside');
  if((await fs.stat(file)).isDirectory())file=path.join(file,'index.html');
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));
 }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true}),errors=[];
const shots='docs/screenshots/logo';await fs.mkdir(shots,{recursive:true});
try{
 for(const width of [1440,1024,768,390,320]){
  const page=await browser.newPage({viewport:{width,height:1000}});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.goto(base);await page.waitForSelector('.app:not([hidden])');
  const mark=page.locator('.tuz-classic-mark');await mark.evaluate(e=>e.decode());
  assert.deepEqual(await page.locator('.tuz-brand-caption span').allTextContents(),['судейство','19-го независимого']);
  const expected=width>1279?[116,46]:width>1100?[110,44]:width>760?[100,40]:[75,30];
  const box=await mark.boundingBox();assert.deepEqual([box.width,box.height],expected);
  assert(await mark.evaluate(e=>e.naturalWidth===232&&e.currentSrc.endsWith('/css/assets/tuz-drawn-232.png')));
  const geometry=await page.evaluate(()=>{
   const r=s=>{const b=document.querySelector(s).getBoundingClientRect();return {x:b.x,y:b.y,right:b.right,bottom:b.bottom}};
   return {brand:r('.site-brand'),nav:r('.navs'),meta:r('.header-meta'),light:innerWidth<=760?r('.room-mobile-light'):null,overflow:document.documentElement.scrollWidth>innerWidth+1};
  });
  const overlap=(a,b)=>a.x<b.right-.5&&a.right>b.x+.5&&a.y<b.bottom-.5&&a.bottom>b.y+.5;
  assert(!geometry.overflow,`overflow ${width}`);
  for(const other of [geometry.nav,geometry.meta,geometry.light].filter(Boolean))assert(!overlap(geometry.brand,other),`brand overlap ${width}`);
  const before=await page.locator('.site-header').boundingBox();
  await page.evaluate(()=>scrollTo(0,900));const after=await page.locator('.site-header').boundingBox();
  assert(Math.abs(after.y)<1,`sticky ${width}`);assert.equal(after.height,before.height);
  await page.locator('.site-header').screenshot({path:`${shots}/header-${width}.png`});
  for(const [url,id]of [['/dynamics/','dynamics'],['/judges/','judges'],['/rappers/','forum-link']]){
   await page.goto(base+url);await page.waitForSelector(`#${id}.active`);await page.locator('.tuz-classic-mark').evaluate(e=>e.decode());
  }
  await page.locator('.site-brand').click();await page.waitForSelector('#home.active');
  await page.close();
 }
 assert.deepEqual(errors,[]);console.log('Raster logo: five widths, sticky geometry and built route links passed');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
