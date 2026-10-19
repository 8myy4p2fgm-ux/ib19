import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {partitionAnalytics} from '../js/analytics-selection.js';
import {normalizeData} from '../js/data.js';
const target='52385ac3-2e09-4df9-a04c-ca4348cf42d6',retained='0460e777-7403-40dd-8176-fd168c93a530';
const rawMain=JSON.parse(await fs.readFile('data/19ib_all_judges_REPAIRED.json')),rawForum=JSON.parse(await fs.readFile('data/forum_judges_export.json')),metadata=JSON.parse(await fs.readFile('data/metadata.json')),fixture=JSON.parse(await fs.readFile('tests/fixtures/excluded-participant-scores.json'));
for(const dataset of [rawMain,rawForum]){dataset.members.push(...(dataset.quarantinedMembers||[]));delete dataset.quarantinedMembers;}
rawMain.totalParticipants=rawMain.members.length;
const at=new Date(Math.max(Date.parse(rawMain.exportedAt),...fixture.scores.map(s=>Date.parse(s.scoredAt)))+60000).toISOString();rawMain.exportedAt=at;rawForum.exportedAt=at;
for(const dataset of [rawMain,rawForum]){const person=dataset.members.find(p=>p.userId===target);person.scores=structuredClone(fixture.scores);if(person.scoredCount!==undefined)person.scoredCount=fixture.scores.length;}
Object.assign(metadata,{runId:'local-exclusion-browser',exportedAt:at,forumExportedAt:at,lastSuccessfulAt:at});
const selected=partitionAnalytics(rawMain,rawForum),D=normalizeData(selected.main,selected.forum),good=rawMain.members.find(p=>p.userId===retained),judgeId=D.judgeIdentities.get(good.scores[0].judgeName);
assert(judgeId,'a known judge has graded the retained Zippy Kid');
const root=path.resolve('dist'),types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json'};
let shape='quarantine';
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://local'),dataset=shape==='quarantine'?selected:{main:rawMain,forum:rawForum};
 const data={'/data/19ib_all_judges_REPAIRED.json':dataset.main,'/data/forum_judges_export.json':dataset.forum,'/data/metadata.json':metadata};
 if(data[url.pathname]){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data[url.pathname]));return;}
 let file=path.resolve(root,'.'+url.pathname);if(file!==root&&!file.startsWith(root+path.sep))throw Error('outside');if((await fs.stat(file)).isDirectory())file=path.join(file,'index.html');res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));
}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true}),errors=[];
try{
 await fs.mkdir('docs/screenshots/temporary-exclusion',{recursive:true});
 for(shape of ['legacy-raw','quarantine'])for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:1000}});page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://static.cloudflareinsights.com/**',route=>route.fulfill({status:200,body:''}));
  await page.route('https://api.19ib.ru/storage/**',route=>route.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"/>'}));
  await page.goto(base+'/');await page.waitForSelector('.app:not([hidden])');await page.waitForSelector('#carrot-loader',{state:'detached'});
  const asNumber=async id=>page.locator('#'+id).evaluate(e=>Number(e.firstChild.textContent.replace(/[^0-9]/g,'')));
  assert.equal(await asNumber('required-scores'),D.people.length*5);assert.equal(await asNumber('scores-count'),D.events.length);
  assert.equal((await asNumber('home-total-passed'))+(await asNumber('home-total-failed'))+(await asNumber('home-total-pending')),D.people.length);
  const actual=await page.evaluate(async()=>{const {loadData}=await import('/js/data.js');const d=await loadData();return{ids:d.people.map(p=>p[0]),eventIds:[...new Set(d.events.map(s=>s.userId))],mapIds:[...d.byId.keys()],archiveIds:[...d.archivedById.keys()]};});
  assert(!actual.ids.includes(target));assert(!actual.eventIds.includes(target));assert(!actual.mapIds.includes(target));assert(!actual.archiveIds.includes(target));assert(actual.ids.includes(retained));
  await page.screenshot({path:`docs/screenshots/temporary-exclusion/${shape}-${width}-overview.png`});
  await page.goto(base+'/rappers/');await page.waitForSelector('#fl-rows');assert.equal(await page.locator('[data-fl-row="'+target+'"]').count(),0);await page.locator('#fl-search').fill('Zippy');assert.equal(await page.locator('[data-fl-row="'+target+'"]').count(),0);
  await page.goto(base+'/judges/?judge='+judgeId);await page.waitForSelector('#judge-profile:not([hidden])');await page.locator('#jp-search').fill('Zippy');
  assert.equal(await page.locator('[data-jp-user="'+target+'"]').count(),0);assert.equal(await page.locator('[data-jp-user="'+retained+'"]').count(),1);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:`docs/screenshots/temporary-exclusion/${shape}-${width}-judge.png`});await page.close();
 }
 assert.deepEqual(errors,[]);console.log('Temporary exclusion browser passed: raw/partitioned six-score snapshots, overview totals, rapper table, judge history, retained Zippy Kid, desktop/mobile.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
