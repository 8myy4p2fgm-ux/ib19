import {partitionAnalytics} from '../js/analytics-selection.js';
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

const {main,forum}=partitionAnalytics(JSON.parse(await fs.readFile('data/19ib_all_judges_REPAIRED.json')),JSON.parse(await fs.readFile('data/forum_judges_export.json')));
const active=new Set(main.members.map(p=>p.userId));
const classify=p=>{const total=p.scores.reduce((n,s)=>n+s.score,0),remaining=Math.max(0,5-p.scores.length);return total+remaining>=15?'pass':total+remaining*5<15?'fail':'pending';};
const counts={pass:0,fail:0,pending:0};for(const p of main.members)counts[classify(p)]++;
const forumIds=new Set(forum.members.filter(p=>active.has(p.userId)).map(p=>p.userId));
const browser=await chromium.launch({headless:true}),errors=[];
try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:1000}});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/');await page.waitForSelector('.app:not([hidden])');
  await page.waitForSelector('#carrot-loader',{state:'detached'});
  let sum=0;
  for(const [status,suffix] of [['pass','passed'],['fail','failed'],['pending','pending']]){
   const value=await page.locator('#home-total-'+suffix).evaluate(e=>Number(e.firstChild.textContent.replace(/[^0-9]/g,'')));
   assert.equal(value,counts[status]);sum+=value;
  }
  assert.equal(sum,main.members.length);
  await page.goto(base+'/rappers/');await page.waitForSelector('.app:not([hidden])');
  for(const status of ['pass','fail','pending']){
   await page.locator('[data-fl-status="'+status+'"]').click();
   const actual=await page.locator('#fl-rows tr[data-fl-row]').evaluateAll(rows=>rows.map(r=>r.dataset.flRow).sort());
   const expected=main.members.filter(p=>forumIds.has(p.userId)&&classify(p)===status).map(p=>p.userId).sort();
   assert.deepEqual(actual,expected);
   const label={pass:'Прошёл',fail:'Вылетел',pending:'Гарантированно ждёт'}[status];
   assert.ok((await page.locator('#fl-rows .fl-status').allTextContents()).every(s=>s===label));
  }
  await page.close();
 }
 assert.deepEqual(errors,[]);console.log('Participant statuses: overview totals and rapper status filters passed at 1440/390 px.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
