import {isOfflinePresence,replyPresence}from './offline-presence-fixture.mjs';
// Local-only targeted behavior checks. Build first; never contacts production.
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import http from 'node:http';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve('dist'),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{try{let file=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!file.startsWith(root+path.sep)&&file!==root)throw Error();if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');res.setHeader('Content-Security-Policy',"default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self' data:; object-src 'none'; form-action 'none'");res.setHeader('Content-Type' ,types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch();
try{for(const width of [390,1440]){const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage(),errors=[],requests=[];await context.route('**/*',r=>isOfflinePresence(r)?replyPresence(r):new URL(r.request().url()).origin===base?r.continue():r.abort());page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
const ready=()=>page.waitForFunction(()=>!document.querySelector('.app').hidden&&!document.querySelector('#carrot-loader'));
await page.goto(base+'/?round=2');await ready();await page.locator('#round-information.active .r2-public').waitFor();assert(!requests.some(u=>u.includes('history.json')||u.includes('/public-data/r1/')),'R2 must not load R1 analytics');assert.equal(await page.locator('#home.active').count(),0);
await page.goto(base+'/judges/?round=1');await ready();await page.locator('.ranking-table tbody tr').first().waitFor();const rawCount=()=>requests.filter(u=>u.includes('/public-data/r1/')).length;
await page.locator('[data-ranking-group=veterans]').click();assert.equal(await page.locator('[data-ranking-group=veterans]').getAttribute('aria-pressed'),'true');const beforeSort=await page.locator('.ranking-table tbody tr').evaluateAll(es=>es.map(e=>e.dataset.rankingName));await page.locator('#ranking-sort-direction').click();assert.deepEqual(await page.locator('.ranking-table tbody tr').evaluateAll(es=>es.map(e=>e.dataset.rankingName)),beforeSort.toReversed());
const opener=page.locator('.ranking-name-button').first(),key=await opener.getAttribute('data-ranking-profile');await opener.click();const modal=page.locator('.judge-card-dialog[open]');await modal.waitFor();await modal.locator('.ranking-score').first().waitFor();assert.equal(await modal.locator('.ranking-score').count(),25);await modal.locator('#ranking-profile-grade').selectOption('5');assert((await modal.locator('.ranking-score').count())>0);assert.equal(await modal.locator('.ranking-score:not([data-score="5"])').count(),0);await modal.locator('#ranking-profile-reset').click();await modal.locator('#ranking-profile-next').click();assert.match(await modal.locator('#ranking-profile-page').innerText(),/^Страница 2 /);assert.equal(await modal.locator('.ranking-score').count(),25);await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(),0);
// Existing deep URLs now open the shared factual modal, with 25-row pagination.
const profileURL=base+'/judges/?round=1&judge='+key+'&jpPage=2';await page.goto(profileURL);await ready();await modal.waitFor();assert.match(await modal.locator('#ranking-profile-page').innerText(),/^Страница 2 /);assert.equal(await modal.locator('.ranking-score').count(),25);await page.goBack();await page.locator('.ranking-table tbody tr').first().waitFor();assert.equal(await page.locator('dialog[open]').count(),0);await page.goForward();await page.locator('.ranking-table tbody tr').first().waitFor();assert.equal(await page.locator('dialog[open]').count(),0);assert(!new URL(page.url()).searchParams.has('judge'));await page.locator('.ranking-name-button').first().click();await modal.waitFor();assert.equal(await modal.locator('.ranking-score').count(),25);await modal.locator('[data-ranking-close]').click();assert.equal(await page.locator('dialog[open]').count(),0);assert(!new URL(page.url()).searchParams.has('judge'));
for(const i of [2,3,4,5,0]){await page.locator(`[data-judge-research-tab="${i}"]`).click();await page.locator(`#int09-panel-${i}`).waitFor();}
await page.evaluate(()=>window.ib19Navigate('forum-link'));await page.locator('#forum-link.active .e6-rows').waitFor();const panel=page.locator('#rr-panel-1-0');await panel.locator('[data-group=forum]').click();assert.match(await panel.locator('.e6-results').innerText(),/из 75$/);const search=panel.locator('[data-field=search]');await search.fill('zzzz-no-match');assert.equal(await panel.locator('[data-person]').count(),0);await search.fill('');assert((await panel.locator('[data-person]').count())>0);
await page.locator('#forum-link [data-report-link]').click();await page.locator('.e6-cell').first().waitFor();await page.locator('.e6-cell').first().click();await page.locator('.e6-score-detail').first().waitFor();await page.keyboard.press('Escape');
await page.evaluate(()=>window.ib19Navigate('dynamics'));await page.locator('#dynamics.active [data-dynamics-tab]').first().waitFor();for(const i of [0,1,2,3]){await page.locator(`[data-dynamics-tab="${i}"]`).click();await page.locator(`#int08-report-${i}`).waitFor();}
// Each full document navigation above legitimately reloads R1. Same-document transitions must not.
const loadedBeforeSwitch=rawCount();
// Sequence guard must discard late R1/R2 transitions.
await page.evaluate(()=>{for(const n of ['2','1','2','1']){history.pushState(null,'','/dynamics/?round='+n);window.dispatchEvent(new PopStateEvent('popstate'));}});await page.waitForFunction(()=>document.body.dataset.round==='1'&&document.querySelector('#dynamics.active'));assert.equal(rawCount(),loadedBeforeSwitch);
assert(!requests.some(u=>u.includes('data-candidates')||u.includes('history.json')));assert.deepEqual(errors,[]);console.log(`PASS ${width}: R2 isolation, modal profiles25/paging, deep links/Back/Forward, filter/search, judge/dynamics tabs, matrix, rapid rounds`);await context.close();
// Failed or delayed resources must never reveal a half-initialized section.
for(const resource of ['css/dynamics-v58.css','js/dynamics-v58.js']){
 const c=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),p=await c.newPage();
 await c.route('**/*',r=>isOfflinePresence(r)?replyPresence(r):new URL(r.request().url()).origin===base?r.continue():r.abort());
 await p.goto(base+'/?round=1');await p.waitForFunction(()=>!document.querySelector('#carrot-loader'));
 let release,requested;const held=new Promise(r=>release=r),seen=new Promise(r=>requested=r);
 const resourcePattern=resource.startsWith('js/')?/\/js\/dynamics-v58(?:\.[a-f0-9]+)?\.js$/:/\/css\/dynamics-v58\.css$/;
 await p.route(resourcePattern,async r=>{requested();await held;await r.fulfill({status:503,body:'injected failure'});});
 await p.evaluate(()=>window.ib19Navigate('dynamics'));await seen;
 assert.equal(await p.locator('#dynamics.active').count(),0,'wait for resource readiness');release();
 await p.locator('.load-error').waitFor();assert.equal(await p.locator('#dynamics.active').count(),0);
 await p.unroute(resourcePattern);
 if(resource.startsWith('css'))await p.locator('.load-error button').click();else await p.reload();
 await p.locator('#dynamics.active [data-dynamics-tab]').first().waitFor();
 await c.close();
}
console.log(`PASS ${width}: CSS failure/retry, JS failure/reload, no early reveal`);
}}
finally{await browser.close();await new Promise(r=>server.close(r));}
