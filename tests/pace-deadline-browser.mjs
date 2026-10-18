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

const browser=await chromium.launch({headless:true});
const limit=Date.parse('2026-10-18T23:59:00+03:00');
const dir='docs/screenshots/pace-deadline';await fs.mkdir(dir,{recursive:true});
const errors=[];
try{
 for(const width of [1440,1024,768,390,320]){
  const page=await browser.newPage({viewport:{width,height:1000}});
  page.on('pageerror',e=>{errors.push(e.message);console.log('pageerror',e.message);});
  await page.addInitScript(t=>{window.testNow=t;Date.now=()=>window.testNow;},limit-500);
  await page.goto(base+'/dynamics/');
  await page.waitForSelector('#carrot-loader',{state:'detached'});
  await page.waitForSelector('#pace-finish-chart');
  assert.equal(await page.locator('#pace-needed-label').textContent(),'Нужно в день');
  assert.equal(await page.locator('#pace-needed').textContent(),'да все уже');
  assert.notEqual(await page.locator('#deadline-countdown-value').textContent(),'Дедлайн прошёл');
  for(const offset of [0,86400000,7*86400000]){
   await page.evaluate(t=>{window.testNow=t;},limit+offset);
   await page.waitForTimeout(1100);
   assert.equal(await page.locator('#pace-needed-label').textContent(),'Прогноз завершения');
   assert.equal(await page.locator('#deadline-countdown-value').textContent(),'Дедлайн прошёл');
   assert.doesNotMatch(await page.locator('#pace-needed').textContent(),/NaN|Infinity|Invalid/);
  }
  const labels=await page.locator('#pace-finish-chart').evaluate(svg=>[...svg.querySelectorAll('.pace-deadline-bottom,.pace-finish-date-tick')].map(n=>{const b=n.getBBox();return {x:b.x,y:b.y,w:b.width,h:b.height};}));
  assert.equal(labels.length,2);
  const [a,b]=labels;assert.ok(a.y>=b.y+b.h||b.y>=a.y+a.h,'date labels do not overlap');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(overflow){console.log('overflow',width,await page.evaluate(()=>[...document.querySelectorAll('#dynamics *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>({tag:e.tagName,id:e.id,cls:e.className,right:e.getBoundingClientRect().right})).slice(0,20)));}assert.equal(overflow,false,'overflow at '+width);
  const chartWidth=await page.locator('#pace-finish-chart').evaluate(e=>e.viewBox.baseVal.width);
  for(const label of labels)assert.ok(label.x>=0&&label.x+label.w<=chartWidth,'label inside chart');
  await page.locator('#dynamics').screenshot({path:dir+'/'+width+'-after.png'});
  const fixtures=await page.evaluate(async limit=>{
   const {createPacePage}=await import('/js/pace-page.js');
   const {config}=await import('/js/config.js');
   const DAY=86400000,results=[];
   for(const kind of ['equal','near','late','complete','zero','missing']){
    const asOf=limit-DAY+(kind==='near'?60000:0);
    let events=Array.from({length:8},(_,i)=>({userId:String(i),judge:'A',t:asOf-(8-i)*DAY}));
    if(kind==='zero')events=events.slice(0,1).map(e=>({...e,t:asOf-10*DAY}));
    if(kind==='missing')events.push({userId:'missing',judge:'A'});
    const people=Array(kind==='complete'?8:kind==='late'?50:9).fill({});
    const fixture=document.querySelector('#dynamics').cloneNode(true);document.body.appendChild(fixture);
    const $=id=>fixture.querySelector('#'+id)||document.getElementById(id);
    createPacePage({D:{events,people,updated:new Date(asOf).toISOString(),byId:new Map()},config:{...config,scoresPerParticipant:1},$,fmt:(n,d=0)=>n.toLocaleString('ru-RU',{maximumFractionDigits:d}),attachChartTip:()=>{}});
    const labels=[...$('pace-finish-chart').querySelectorAll('.pace-deadline-bottom,.pace-finish-date-tick')].map(n=>{const b=n.getBBox();return {y:b.y,h:b.height};});
    results.push({kind,value:$('pace-needed').textContent,svg:$('pace-finish-chart').innerHTML,labels});
    fixture.remove();
   }
   return results;
  },limit);
  for(const result of fixtures){
   assert.doesNotMatch(result.svg,/NaN|Infinity/);
   if(result.kind==='complete')assert.equal(result.value,'Завершено');
   else if(['zero','missing'].includes(result.kind))assert.equal(result.value,'Недостаточно данных');
   else{assert.equal(result.labels.length,2);const [a,b]=result.labels;assert.ok(a.y>=b.y+b.h||b.y>=a.y+a.h,result.kind+' labels');}
  }
  await page.close();
 }
 assert.deepEqual(errors,[]);
 console.log('Deadline browser: boundary transition, day/week after, five widths, labels and overflow passed.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
