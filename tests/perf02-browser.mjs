// Local-only targeted behavior checks. Build first; never contacts production.
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import http from 'node:http';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve('dist'),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{try{let file=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!file.startsWith(root+path.sep)&&file!==root)throw Error();if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');res.setHeader('Content-Security-Policy',"default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self' data:; object-src 'none'; form-action 'none'");res.setHeader('Content-Type' ,types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch();
try{for(const width of [390,1440]){const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage(),errors=[],requests=[];await context.route(u=>u.origin!==base,r=>r.abort());page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
const ready=()=>page.waitForFunction(()=>!document.querySelector('.app').hidden&&!document.querySelector('#carrot-loader')&&!!document.querySelector('.page.active'));
await page.goto(base+'/?round=2');await ready();await page.locator('.r2-public').waitFor();assert(!requests.some(u=>u.includes('/public-data/')||u.includes('/data/')),'public R2 must not load datasets');assert(!requests.some(u=>u.includes('history.json')),'R2 cohort must not load history');assert.equal(await page.locator('#home.active').count(),0);assert.equal(await page.locator('#round-information.active').count(),1);
await page.goto(base+'/judges/?round=1');await ready();await page.locator('[data-ranking-ready=true]').waitFor();const rawCount=()=>requests.filter(u=>u.includes('/public-data/r1/')).length;
await page.locator('[data-ranking-group=veterans]').click();assert.equal(await page.locator('[data-ranking-group=veterans]').getAttribute('aria-pressed'),'true');await page.locator('#ranking-sort-direction').click();
await page.locator('[data-ranking-profile]').first().click();await page.locator('dialog[open]').waitFor();assert.equal(await page.locator('#ranking-profile-rows [data-profile-user]').count(),25);await page.evaluate(()=>{const s=document.querySelector('#ranking-profile-grade');s.value='5';s.dispatchEvent(new Event('change'));});assert(await page.locator('#ranking-profile-rows').innerText());await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(),0);
const key=await page.locator('[data-ranking-profile]').first().getAttribute('data-ranking-profile');const profileURL='/judges/?round=1&judge='+key;
await page.goto(base+profileURL);await ready();await page.locator('.judge-card-dialog[open]').waitFor();assert.equal(await page.locator('.ranking-score').count(),25);await page.locator('#ranking-profile-next').click();assert.match(await page.locator('#ranking-profile-page').innerText(),/2/);await page.keyboard.press('Escape');assert.equal(await page.locator('#judges.active').count(),1);await page.goBack();await ready();await page.goForward();await ready();assert.equal(await page.locator('#judges.active').count(),1);
for(const i of [2,3,4,5,0]){await page.locator(`[data-judge-research-tab="${i}"]`).click();await page.locator(`#int09-panel-${i}`).waitFor({state:"visible"});assert.equal(await page.locator(`#int09-panel-${i}`).isVisible(),true);}
await page.evaluate(()=>window.ib19Navigate('forum-link'));await page.locator('#forum-link.active .e6-rows').waitFor();await page.locator('#rr-panel-1-0 [data-group=forum]').click();const search=page.locator('#rr-panel-1-0 [data-field=search]');await search.fill('zzzz-no-match');assert.equal(await page.locator('#rr-panel-1-0 [data-person]').count(),0);await search.fill('');assert(await page.locator('#rr-panel-1-0 [data-person]').count()>0);
await page.locator('.rr-mode-link a').click();await page.locator('.e6-cell').first().waitFor();await page.locator('.e6-cell').first().click();await page.locator('.e6-score-detail').waitFor();assert(await page.locator('.e6-score-detail').count()>0);await page.keyboard.press('Escape');
await page.evaluate(()=>window.ib19Navigate('dynamics'));await page.locator('#dynamics.active [data-dynamics-tab]').first().waitFor();for(const i of [0,1,2,3]){await page.locator(`[data-dynamics-tab="${i}"]`).click();assert(await page.locator(`#int08-report-${i}`).isVisible());}
// Each full document navigation above legitimately reloads R1. Same-document transitions must not.
const loadedBeforeSwitch=rawCount();
// Sequence guard must discard late R1/R2 transitions.
await page.evaluate(()=>{for(const n of ['2','1','2','1']){const s=document.querySelector('#round-select');s.value=n;s.dispatchEvent(new Event('change'));}});await page.waitForFunction(()=>document.body.dataset.round==='1'&&document.querySelector('#home.active'));assert.equal(rawCount(),loadedBeforeSwitch);
assert(!requests.some(u=>u.includes('data-candidates')||u.includes('history.json')));assert.deepEqual(errors,[]);console.log(`PASS ${width}: R2 isolation, unified profile paging, links/Back/Forward, filter/search, judge/dynamics tabs, matrix, rapid rounds`);await context.close();
// Failed or delayed resources must never reveal a half-initialized section.
for(const resource of ['css/dynamics-v58.css','js/dynamics-v58.js']){
 const c=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),p=await c.newPage();
 await c.route(u=>u.origin!==base,r=>r.abort());
 await p.goto(base+'/?round=1');await p.locator('#home.active').waitFor();
 let release,requested;const held=new Promise(r=>release=r),seen=new Promise(r=>requested=r);
 const resourceMatch=u=>resource.startsWith('js/')?/\/js\/dynamics-v58(?:\.[a-f0-9]{16})?\.js$/.test(u.pathname):u.pathname.endsWith('/'+resource);
 await p.route(resourceMatch,async r=>{requested();await held;await r.fulfill({status:503,body:'injected failure'});});
 await p.evaluate(()=>window.ib19Navigate('dynamics'));await seen;
 assert.equal(await p.locator('#dynamics.active').count(),0,'wait for resource readiness');release();
 await p.locator('.load-error').waitFor();assert.equal(await p.locator('#dynamics.active').count(),0);
 await p.unroute(resourceMatch);
 if(resource.startsWith('css'))await p.locator('.load-error button').click();else await p.reload();
 await p.locator('#dynamics.active [data-dynamics-tab]').first().waitFor();
 await c.close();
}
console.log(`PASS ${width}: CSS failure/retry, JS failure/reload, no early reveal`);
}}
finally{await browser.close();await new Promise(r=>server.close(r));}
