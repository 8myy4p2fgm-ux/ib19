import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=path.resolve('dist');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'};
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
const shots='docs/screenshots/room';await fs.mkdir(shots,{recursive:true});
try{
 for(const width of [1440,1024,768,390,320]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.goto(base);await page.waitForSelector('#carrot-loader',{state:'detached'});
  const header=page.locator('.site-header'),initial=await header.boundingBox();
  const mainY=await page.locator('.main').evaluate(e=>e.getBoundingClientRect().top+scrollY);
  const control=page.locator(width<=760?'.room-mobile-light':'.room-switch');
  assert.equal(await page.locator('#proto-panel,.proto-toggle,.wall-switch-photo').count(),0);
  assert.equal(await control.getAttribute('aria-checked'),'true');
  assert.equal(await header.evaluate(e=>getComputedStyle(e).position),'sticky');
  assert.equal(await page.locator('.site-header-inner').evaluate(e=>getComputedStyle(e).borderBottomWidth),'0px');
  assert.equal(await page.locator('.room-wall').evaluate(e=>getComputedStyle(e).position),'fixed');
  assert.equal(await page.locator('.room-off').evaluate(e=>getComputedStyle(e,'::before').backgroundImage),'none');
  if(width<=760){
   assert.equal(await page.locator('.room-switch').isVisible(),false);
   assert.match(await page.locator('.room-on').evaluate(e=>getComputedStyle(e,'::before').backgroundImage),/room-mobile-light-on/);
  }else{
   assert.equal(await page.locator('.room-mobile-light').isVisible(),false);
   assert.equal(await control.evaluate(e=>getComputedStyle(e).backgroundImage),'none');
   assert.equal(await control.evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');
   const box=await control.boundingBox();assert.ok(Math.abs(box.x+box.width/2-width*.9555)<1);
   assert.ok(Math.abs(box.y+box.height/2-width*.4135)<1);
  }
  await page.screenshot({path:`${shots}/${width}-on.png`});
  const value=await page.locator('#index-main').textContent();
  await control.click();assert.equal(await control.getAttribute('aria-checked'),'false');
  assert.match(await page.locator('.room-off').evaluate(e=>getComputedStyle(e,'::before').backgroundImage),/room-(?:mobile-)?light-off/);
  await page.waitForTimeout(600);await page.screenshot({path:`${shots}/${width}-off.png`});
  assert.equal(await page.locator('#index-main').textContent(),value);
  await control.focus();await page.keyboard.press('Space');assert.equal(await control.getAttribute('aria-checked'),'true');
  for(const y of [1,12,24,25,40,100,650,100,25,0]){
   await page.evaluate(y=>scrollTo(0,y),y);await page.waitForTimeout(30);
   assert.deepEqual(await header.boundingBox(),initial,`header dimensions and position ${width}/${y}`);
   assert.equal(await page.locator('.main').evaluate(e=>e.getBoundingClientRect().top+scrollY),mainY);
   assert.equal((await page.locator('.room-wall').boundingBox()).y,0);
  }
  for(const route of ['home','dynamics','judges','forum-link']){
   await page.locator(`.nav[data-tab="${route}"]`).click();await page.evaluate(()=>scrollTo(0,500));await page.waitForTimeout(50);
   assert.deepEqual(await header.boundingBox(),initial,`header unchanged on ${route}`);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  }
  await page.screenshot({path:`${shots}/${width}-scrolled.png`});
  await context.close();
 }
 const context=await browser.newContext({reducedMotion:'reduce'}),page=await context.newPage();
 await page.goto(base);await page.waitForSelector('.room-off',{state:'attached'});
 assert.equal(await page.locator('.room-off').evaluate(e=>getComputedStyle(e).transitionDuration),'0s');
 await context.close();assert.deepEqual(errors,[]);
 console.log('Room passed: five widths, stable header geometry in both scroll directions and all routes, baked desktop switch, mobile button, keyboard, live values and reduced motion.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
