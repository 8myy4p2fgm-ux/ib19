import {chromium} from 'playwright';
import {createOfficialR1View} from '../js/r1-official-view.js';
import os from 'node:os';
import fs from 'node:fs';import http from 'node:http';import path from 'node:path';import assert from 'node:assert/strict';
const output=process.env.REL01_OUTPUT||path.join(os.tmpdir(),'tuz-rel01-compatible-smoke'),root=path.resolve('dist');fs.mkdirSync(output+'/screenshots',{recursive:true});
const snapshot=Object.fromEntries(Object.entries({main:'19ib_all_judges_REPAIRED.json',forum:'forum_judges_export.json',metadata:'metadata.json'}).map(([key,file])=>[key,JSON.parse(fs.readFileSync(path.join(root,'public-data/r1',file),'utf8'))]));
const data=createOfficialR1View(snapshot,{policyVersion:'r1-official-zippy-v2',sourceContract:'r1-public-v1'}).data;
const person=[...data.metadata.keys()].map(id=>data.byId.get(id)).find(p=>p?.scores.some(s=>s.comment?.trim()));const score=person.scores.find(s=>s.comment?.trim()),judgeId=data.judgeIdentities.get(score.judgeName);
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'};
const csp="default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self' data:; object-src 'none'; form-action 'none'";
const server=http.createServer((q,r)=>{try{let u=new URL(q.url,'http://localhost').pathname;if(u.startsWith('/ib19/'))u=u.slice(5);let f=path.resolve(root,'.'+decodeURIComponent(u));if(f!==root&&!f.startsWith(root+'/'))throw Error();if(fs.statSync(f).isDirectory())f=path.join(f,'index.html');r.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream','Content-Security-Policy':csp,'Cache-Control':'no-store'});r.end(fs.readFileSync(f));}catch{r.writeHead(404);r.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch(),results=[];
try{for(const width of [390,1440]){
 const ctx=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});await ctx.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{window.cspErrors=[];document.addEventListener('securitypolicyviolation',e=>window.cspErrors.push({directive:e.violatedDirective,blocked:e.blockedURI}));});
 // Direct URLs and navigation at a non-root Pages basePath.
 for(const route of ['?round=1','judges/?round=1','rappers/?round=1','dynamics/?round=1','events/?round=1','horo/','?round=2']){
  await page.goto(base+'/ib19/'+route);await page.waitForFunction(()=>document.querySelector('.app')?.hidden===false&&!document.querySelector('#carrot-loader'));
  await page.waitForFunction(()=>!document.querySelector('.load-error:not([hidden])'));
  assert.equal(await page.locator('.page.active').count(),1);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow '+route);
  assert.deepEqual(await page.evaluate(()=>window.cspErrors.filter(e=>!['https://static.cloudflareinsights.com/beacon.min.js','https://www.youtube.com'].includes(e.blocked))),[],'Unexpected CSP '+route);
 }
 // R1/R2 preview screenshots, both lights, at the production root basePath.
 for(const round of [1,2]){
  await page.goto(base+'/?round='+round);await page.waitForFunction(()=>!document.querySelector('#carrot-loader')&&!document.querySelector('.app').hidden);
  if(round===2)await page.locator('.r2-public').waitFor();
  for(const light of ['on','off']){await page.evaluate(light=>{if(document.body.dataset.roomLight!==light)document.querySelector('.room-switch').click();},light);await page.screenshot({path:output+`/screenshots/${width}-r${round}-${light}.png`,fullPage:true});}
  assert.deepEqual(await page.evaluate(()=>window.cspErrors.filter(e=>!['https://static.cloudflareinsights.com/beacon.min.js','https://www.youtube.com'].includes(e.blocked))),[]);
 }
 await page.goto(base+'/rappers/?round=1&report=matrix&judge='+encodeURIComponent(judgeId));const cell=page.locator(`.e6-cell[data-p="${person.userId}"][data-j="${judgeId}"]`);await cell.waitFor();await cell.scrollIntoViewIfNeeded();await cell.click();
 const comment=page.locator('.e6-score-detail:visible .e6-comment');await comment.waitFor();assert.equal(await comment.textContent(),score.comment.trim());
 if(width<=900){await page.locator('dialog[open]').waitFor();await page.keyboard.press('Escape');}else await page.locator('.e6-inline-close').click();
 await page.waitForFunction(({p,j})=>document.activeElement?.dataset.p===p&&document.activeElement?.dataset.j===j,{p:person.userId,j:judgeId});
 assert.deepEqual(errors,[]);results.push({width,basePath:'/ib19/',directRoutes:7,lights:['on','off'],errors,commentExact:true,focusRestored:true,unexpectedCspErrors:[],expectedLocalCspBlocks:['https://static.cloudflareinsights.com/beacon.min.js','https://www.youtube.com']});await ctx.close();
}fs.writeFileSync(output+'/extra-smoke.json',JSON.stringify(results,null,2));console.log('PASS390/1440: root and /ib19/, 7 direct URLs, both rounds, both lights, no unexpected CSP/JS errors; external analytics/video intentionally blocked by local CSP');}
finally{await browser.close();await new Promise(r=>server.close(r));}
