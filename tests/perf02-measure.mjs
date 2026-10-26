// Local laboratory benchmark; use the same environment and server for both revisions.
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=process.env.PERF_ROOT||path.resolve('dist'),phase=process.argv[2]||'before',runs=Number(process.argv[3]||1),out=process.env.PERF_OUTPUT||path.resolve('docs/diagnostics/perf-02/measurements');fs.mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer((q,r)=>{try{let f=path.resolve(root,'.'+new URL(q.url,'http://localhost').pathname);if(!f.startsWith(root+'/')&&f!==root)throw Error();if(fs.statSync(f).isDirectory())f=path.join(f,'index.html');r.setHeader('Content-Security-Policy',"default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self' data:; object-src 'none'; form-action 'none'");r.setHeader('Content-Type' ,types[path.extname(f)]||'application/octet-stream');r.setHeader('Cache-Control',f.endsWith('.json')?'public, max-age=600':'public, max-age=600');r.end(fs.readFileSync(f));}catch{r.writeHead(404);r.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true}),results=[];
try{for(const width of [1440,390])for(let run=0;run<runs;run++){
 const ctx=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block'}),page=await ctx.newPage(),cdp=await ctx.newCDPSession(page),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await cdp.send('Network.enable');await cdp.send('Network.setBlockedURLs',{urls:['https://*']});await cdp.send('Emulation.setCPUThrottlingRate',{rate:width===390?4:1});await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:40,downloadThroughput:10*1024*1024/8,uploadThroughput:10*1024*1024/8});
 await page.addInitScript(()=>{window.perfLong=[];new PerformanceObserver(l=>window.perfLong.push(...l.getEntries().map(e=>({start:e.startTime,ms:e.duration})))).observe({type:'longtask',buffered:true});});
 await cdp.send('Profiler.enable');await cdp.send('Profiler.start');
 const row={width,run,ops:[],errors};
 async function metrics(name,start){const m=await page.evaluate(start=>({ms:performance.now()-start,long:window.perfLong.filter(e=>e.start>=start),heap:performance.memory?.usedJSHeapSize}),start);row.ops.push({name,...m});console.log(width,name,Math.round(m.ms));fs.writeFileSync(`${out}/${phase}-progress.json`,JSON.stringify(row,null,2));}
 for(const name of ['cold','warm']){await page.goto(base+'/?round=1',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('.app')?.hidden===false&&document.querySelector('#home.active')&&!document.querySelector('#carrot-loader'),{},{timeout:120000});await metrics(name,0);row[name+'Resources']=await page.evaluate(()=>performance.getEntriesByType('resource').map(r=>({url:r.name.split(location.origin)[1],transfer:r.transferSize,decoded:r.decodedBodySize,type:r.initiatorType})));}
 async function op(name,action,ready,arg){const t=await page.evaluate(()=>{window.perfReaction=null;return performance.now();});await page.evaluate(action,arg);await page.evaluate(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{window.perfReaction=performance.now();})));if(ready)await page.waitForFunction(ready,{},{timeout:120000});await page.waitForFunction(()=>window.perfReaction!==null);await metrics(name,t);row.ops.at(-1).reaction=(await page.evaluate(()=>window.perfReaction))-t;}
 await op('judges',()=>window.ib19Navigate('judges'),()=>document.querySelector('#judges.active [data-ranking-ready]'));
 await op('ranking-group',()=>document.querySelector('[data-ranking-group=veterans]').click());
 await op('ranking-sort',()=>document.querySelector('#ranking-sort-direction').click());
 await op('judge-profile',()=>document.querySelector('[data-ranking-profile]').click(),()=>document.querySelector('dialog[open]'));await page.keyboard.press('Escape');
 // Explicit actions carry their values via string interpolation only for fixed numeric IDs.
 for(const i of [2,3,4,5,0,2])await op('judge-tab-'+i,i=>document.querySelector(`[data-judge-research-tab="${i}"]`).click(),null,i);
 await op('rappers',()=>window.ib19Navigate('forum-link'),()=>document.querySelector('#forum-link.active .e6-rows'));
 await op('participant-filter',()=>document.querySelector('#rr-panel-1-0 [data-group=forum]').click());
 await op('matrix',()=>document.querySelector('[data-rapper-tab="1"]').click(),()=>document.querySelector('.e6-cell'));
 await op('matrix-cell',()=>document.querySelector('.e6-cell').click());await page.keyboard.press('Escape');
 await op('impact-first',()=>document.querySelector('[data-rapper-tab="2"]').click(),()=>document.querySelector('#rr-panel-1-2 [data-ready=true]'));
 await op('matrix-return',()=>document.querySelector('[data-rapper-tab="1"]').click());
 await op('impact-return',()=>document.querySelector('[data-rapper-tab="2"]').click(),()=>document.querySelector('#rr-panel-1-2 [data-ready=true]'));
 await op('dynamics',()=>window.ib19Navigate('dynamics'),()=>document.querySelector('#dynamics.active [data-dynamics-tab]'));
 for(const i of [1,2,3,0,2])await op('dynamics-tab-'+i,i=>document.querySelector(`[data-dynamics-tab="${i}"]`).click(),null,i);
 await op('home-return',()=>window.ib19Navigate('overview'),()=>document.querySelector('#home.active'));
 await op('judges-return',()=>window.ib19Navigate('judges'),()=>document.querySelector('#judges.active'));
 await op('r2',()=>{const s=document.querySelector('#round-select');s.value='2';s.dispatchEvent(new Event('change'));},()=>document.querySelector('#round-information.active'));
 await op('r2-home',()=>window.ib19Navigate('overview'),()=>document.querySelector('#round-information.active [data-groups-ready=true]'));
 await op('r2-judges',()=>window.ib19Navigate('judges'),()=>document.querySelector('#round-information.active'));
 await op('r1-return',()=>{const s=document.querySelector('#round-select');s.value='1';s.dispatchEvent(new Event('change'));},()=>document.querySelector('#judges.active'));
 row.resources=await page.evaluate(()=>performance.getEntriesByType('resource').map(r=>({url:r.name.split(location.origin)[1],transfer:r.transferSize,decoded:r.decodedBodySize})));row.long=await page.evaluate(()=>window.perfLong);const {profile}=await cdp.send('Profiler.stop');fs.writeFileSync(`${out}/${phase}-${width}-${run}.cpuprofile`,JSON.stringify(profile));results.push(row);await ctx.close();fs.writeFileSync(`${out}/${phase}.json`,JSON.stringify(results,null,2));
}}finally{await browser.close();server.close();}
