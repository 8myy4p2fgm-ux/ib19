import {chromium} from 'playwright';import assert from 'node:assert/strict';
const base=process.env.IB19_PUBLIC_URL||'https://8myy4p2fgm-ux.github.io/ib19/';const browser=await chromium.launch({headless:true});const errors=[];
try{
 for(const width of [1440,390,320]){
  const page=await browser.newPage({viewport:{width,height:1000}});page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)errors.push('HTTP '+r.status()+' '+r.url());});
  await page.goto(base,{waitUntil:'networkidle'});await page.waitForSelector('.app:not([hidden])');assert.equal(await page.locator('.site-header .nav').count(),4);assert.match(await page.locator('#updated').textContent(),/МСК/);
  for(const route of ['overview','dynamics','judges','forum-link']){await page.goto(base+'#/round/1/'+route);await page.waitForSelector('.app:not([hidden])');assert.ok((await page.locator('body').textContent()).length>1000);}
  await page.locator('#fl-search').fill('Xanynadzuka');assert.equal(await page.locator('[data-fl-row]').count(),1);await page.locator('#fl-search').fill('');await page.locator('[data-fl-cell]').first().click();await page.waitForSelector('.fl-full-score-dialog[open]');await page.locator('[data-score-close]').click();await page.locator('[data-fl-open-profile]').first().click();await page.waitForSelector('.fl-participant-dialog[open]');await page.keyboard.press('Escape');
  console.log(JSON.stringify({width,updated:await page.locator('#updated').textContent(),index:await page.locator('#index-main').textContent()}));await page.close();
 }
 assert.deepEqual(errors,[]);console.log('Public HTTPS browser checks passed.');
}finally{await browser.close();}
