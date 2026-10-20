import {chromium} from 'playwright';import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const root=process.cwd(),require=createRequire(import.meta.url);const {PNG}=require(path.join(root,'node_modules/playwright-core/lib/utilsBundle.js'));const pixelmatch=require(path.join(root,'node_modules/playwright-core/lib/third_party/pixelmatch.js'));
import {config} from '../js/config.js';
const original=await fs.readFile('docs/IB19_V95_WHITE_TUZ_HEADING.html','utf8');
const overview=await fs.readFile('docs/TUZ_V95_overview_v6.html','utf8');
// The approved judge-name links are the only new presentation in the directory.
const profileReference=`<link rel="stylesheet" href="/ib19/css/judge-profile.css"><script type="module">
import {loadData} from '/ib19/js/data.js';
import {initializeJudgeProfiles} from '/ib19/js/judge-profile.js';
const data=await loadData();
await new Promise(resolve=>{const ready=()=>document.querySelector('#judge-heat-body')?resolve():setTimeout(ready,10);ready();});
initializeJudgeProfiles(data);
</script>`;
const statusSource=(await fs.readFile('js/general.js','utf8')).match(/export function participantStatus\(scores\)\{[\s\S]*?\n\}/)[0].replace('export ','');
// Apply the approved raster brand to runtime references; historical fixtures stay intact.
const approvedHoro=(await fs.readFile('index.html','utf8')).match(/<a class="nav nav-horo".*?<\/a>/)[0].replaceAll('="./','="/ib19/');
const approvedBrand=(await fs.readFile('index.html','utf8')).match(/<a class="site-brand .*?<\/a>/)[0].replaceAll('="./','="/ib19/');
// Data, status corrections and the approved brand are adapted; analytical UI stays intact.
function currentDataReference(original){
 // Match the approved zone-dependent index color without changing historical fixtures.
 original=original.replace('#home #index-main{color:#68D99A!important}','#home #index-main{--green:#68D99A}');
 const first=original.match(/<script>([\s\S]*?)<\/script>/)[1];
 let code=first.slice(first.indexOf('const module3=')).replaceAll('2026-10-18T23:59:00+03:00',config.deadline);
 code=code.replace(/const module18=\(\(\)=>\{[\s\S]*?\nreturn \{[^\n]*?\};\}\)\(\);/,"const module18={loadData:()=>import('/ib19/js/data.js').then(m=>m.loadData())};");
 // Apply the approved status correction to the runtime reference; keep historical files intact.
 code=code.replace(/function participantStatus\(scores\)\{[^\n]+\}/,()=>statusSource);
 return original.replace(first,code).replace('</nav>',approvedHoro+'</nav>').replace('</head>','<link rel="stylesheet" href="/ib19/css/horo.css"></head>').replace('</head>',profileReference+'</head>').replace(/<a class="site-brand .*?<\/a>/,()=>approvedBrand).replace('Прошли — набрали 15 баллов. Выбыли — уже не смогут набрать 15 с оставшимися оценками.','Прошли — гарантированно наберут не менее 15 баллов даже с единицами за оставшиеся оценки. Выбыли — не наберут 15 даже с пятёрками.').replace('</head>','<link rel="stylesheet" href="/ib19/css/site-wallpaper.css"><link rel="stylesheet" href="/ib19/css/logo-classic.css"><script type="module" src="/ib19/js/room.js"></script></head>');
}
// Apply the approved room and stable header to each reference; preserve all original layout,
// interaction and pixel comparisons.
const reference=currentDataReference(original),overviewReference=currentDataReference(overview),mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json'};
const server=http.createServer(async(req,res)=>{try{let name=decodeURIComponent(new URL(req.url,'http://local').pathname);if(name==='/reference.html'||name==='/overview-reference.html'){res.setHeader('Content-Type','text/html');return res.end(name==='/overview-reference.html'?overviewReference:reference);}if(!name.startsWith('/ib19/'))throw new Error('not found');name=name.slice('/ib19'.length);if(name==='/')name='/index.html';const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep))throw new Error('outside');res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,dir='docs/screenshots/ui-reference';await fs.mkdir(dir,{recursive:true});
const main=JSON.parse(await fs.readFile('data/19ib_all_judges_REPAIRED.json')),clock=Date.parse(main.exportedAt)+600000,errors=[],comparisons=[];const browser=await chromium.launch({headless:true});
async function shotPair(page,ref,width,label,keepPointer=false){
 // The approved deadline card can change the section height. Its responsive layout
 // is checked by pace-deadline-browser; retain activity values and bar heights here (SVG viewBoxes may differ).
 if(await page.locator('#dynamics').isVisible()){
  const activity=svg=>({bars:[...svg.querySelectorAll('rect')].map(n=>[n.getAttribute('y'),n.getAttribute('height')]),labels:[...svg.querySelectorAll('text')].map(n=>n.textContent)});
  assert.deepEqual(await page.locator('#pace-activity-chart').evaluate(activity),await ref.locator('#pace-activity-chart').evaluate(activity));
  assert.equal(await page.locator('#pace-remaining').textContent(),await ref.locator('#pace-remaining').textContent());
  assert.equal(await page.locator('#pace-current').textContent(),await ref.locator('#pace-current').textContent());
  await page.screenshot({path:`${dir}/project-${width}-${label}.png`,fullPage:true});
  return;
 }
 if(!keepPointer){await page.mouse.move(0,0);await ref.mouse.move(0,0);}
 // Fixed wallpaper must be captured at identical viewport scroll positions.
 const view=await page.evaluate(()=>({x:scrollX,y:scrollY,pointer:window.__uiPointer}));
 await ref.evaluate(v=>window.scrollTo({left:v.x,top:v.y,behavior:'instant'}),view);
 if(keepPointer&&view.pointer)await ref.mouse.move(view.pointer.x,view.pointer.y);
 assert.deepEqual(await ref.evaluate(()=>({x:scrollX,y:scrollY})),{x:view.x,y:view.y},'same screenshot viewport');await page.waitForTimeout(400);const a=await page.screenshot({path:`${dir}/project-${width}-${label}.png`,fullPage:true}),b=await ref.screenshot({path:`${dir}/reference-${width}-${label}.png`,fullPage:true});const x=PNG.sync.read(a),y=PNG.sync.read(b);assert.equal(x.width,y.width,`${label} width`);assert.equal(x.height,y.height,`${label} height`);const diff=new PNG({width:x.width,height:x.height});const count=pixelmatch(x.data,y.data,diff.data,x.width,x.height,{threshold:.1});if(count)await fs.writeFile(`${dir}/diff-${width}-${label}.png`,PNG.sync.write(diff));comparisons.push({width,label,pixels:count,total:x.width*x.height});assert.ok(count/(x.width*x.height)<.001,`visual mismatch ${width} ${label}: ${count} pixels`);}
async function openRoute(page,ref,route){await page.goto(base+'/ib19/#/round/1/'+route);await ref.goto(base+(route==='overview'?'/overview-reference.html':'/reference.html')+'#/round/1/'+route);await page.waitForSelector('.app:not([hidden])');await page.waitForSelector('#carrot-loader',{state:'detached'});await ref.waitForSelector('.app:not([hidden])');
 // Compare both pages after the decorative image has decoded and its fade is complete.
 await Promise.all([page,ref].map(tab=>tab.waitForSelector('.room-wall.room-on-full-ready')));
 await page.waitForTimeout(750);if(route==='judges')await Promise.all([page,ref].map(p=>p.waitForSelector('.jp-name-link')));}
try{for(const width of [1440,1024,768,390,320]){const context=await browser.newContext({viewport:{width,height:1000}});await context.addInitScript(time=>{Date.now=()=>time;window.addEventListener('pointermove',e=>{window.__uiPointer={x:e.clientX,y:e.clientY};});},clock);const page=await context.newPage(),ref=await context.newPage();page.on('pageerror',e=>errors.push({width,side:'project',error:e.message}));ref.on('pageerror',e=>errors.push({width,side:'reference',error:e.message}));
 for(const route of ['overview','dynamics','judges','forum-link']){await openRoute(page,ref,route);assert.equal(await page.locator('.site-header .nav').count(),5);assert.equal(await page.locator('script[data-cf-beacon]').count(),1);for(const id of ['index-main','home-passed','home-failed','home-pending','home-veteran-avg','pace-current','pace-remaining'])assert.equal(await page.locator('#'+id).evaluate(e=>e.firstChild?.textContent),await ref.locator('#'+id).evaluate(e=>e.firstChild?.textContent),id);await shotPair(page,ref,width,route);const overflow=await page.evaluate(()=>document.documentElement.scrollWidth),baseline=await ref.evaluate(()=>document.documentElement.scrollWidth);assert.ok(overflow<=baseline+1,`new page overflow ${width} ${route}`);}
 // Reference collapsible group and insight notes: opening, Escape/outside close, graph tooltip.
 await openRoute(page,ref,'overview');for(const p of [page,ref]){await p.locator('details.group-info summary').click();assert.equal(await p.locator('details.group-info').getAttribute('open'),'');}await shotPair(page,ref,width,'group-open');for(const p of [page,ref]){await p.keyboard.press('Escape');assert.equal(await p.locator('details.group-info').getAttribute('open'),null);await p.locator('.home-method-link, #home .method-open').first().click();await p.waitForSelector('#method-dialog[open]');}await shotPair(page,ref,width,'method-open');for(const p of [page,ref])await p.keyboard.press('Escape');
 for(const p of [page,ref]){const r=await p.locator('#chart-main').boundingBox();await p.mouse.move(r.x+r.width*.6,r.y+r.height*.4);await p.waitForSelector('.chart-tip.home-chart-tip',{state:'visible'});}assert.equal(await page.locator('.chart-tip').textContent(),await ref.locator('.chart-tip').textContent());
 // Verdict/forecast and collapsible facts stay driven by the production data.
 await openRoute(page,ref,'dynamics');for(const p of [page,ref])await p.locator('.pace-insight summary').click();await shotPair(page,ref,width,'facts-open');for(const p of [page,ref]){await p.locator('.pace-insight summary').click();await p.locator('#pace-judge-toggle').click();}await shotPair(page,ref,width,'judge-picker');for(const p of [page,ref]){await p.locator('#pace-judge-options button').nth(1).click();await p.locator('#pace-judge-toggle').click();await p.locator('#pace-judge-close').click();assert.equal(await p.locator('#pace-judge-current').textContent(),'Все судьи');}
 // Both judge groups, stable sorting, focus tooltip and exact hover styles.
 await openRoute(page,ref,'judges');for(const p of [page,ref]){await p.locator('[data-heat-tip]').first().focus();await p.waitForSelector('.chart-tip',{state:'visible'});}assert.equal(await page.locator('.chart-tip').textContent(),await ref.locator('.chart-tip').textContent());for(const p of [page,ref]){await p.keyboard.press('Escape');await p.locator('[data-judge-tuz-group="former"]').click();}await shotPair(page,ref,width,'veteran-rating');for(const p of [page,ref]){await p.locator('[data-judge-tuz-group="current"]').click();await p.locator('[data-tuz-sort="activity"]').focus();await p.keyboard.press('Enter');}assert.equal(await page.locator('#tuz-judge-body').textContent(),await ref.locator('#tuz-judge-body').textContent());for(const p of [page,ref])await p.locator('#tuz-judge-body tr').first().hover();await shotPair(page,ref,width,'judge-row-hover',true);
 // Matrix comments, three-step sorting, groups, search, reset and external profile links.
 await openRoute(page,ref,'forum-link');for(const p of [page,ref]){await p.locator('#fl-search').fill('Easy Choose');assert.equal(await p.locator('[data-fl-row]').count(),1);await p.locator('[data-fl-reset]').click();assert.equal(await p.locator('#fl-search').inputValue(),'');assert.equal(await p.locator('[data-fl-open-profile]').count(),0);for(let j=0;j<3;j++)await p.locator('[data-fl-sort-judge]').first().click();await p.locator('[data-fl-group="veterans"]').click();}assert.equal(await page.locator('#fl-rows').textContent(),await ref.locator('#fl-rows').textContent());await shotPair(page,ref,width,'forum-filter');for(const p of [page,ref]){await p.locator('[data-fl-group="all"]').click();await p.locator('[data-fl-cell]').first().hover();}await shotPair(page,ref,width,'matrix-hover',true);for(const p of [page,ref]){await p.locator('[data-fl-cell]').first().click();await p.waitForSelector('.fl-full-score-dialog[open]');}await shotPair(page,ref,width,'comment-open');for(const p of [page,ref])await p.locator('[data-score-close]').click();
 // The reference has a dead [data-fl-open] row trigger. The site keeps its existing
 // participant dialog, reached via a row click without adding a new visible button.
 await page.locator('[data-fl-row] td').first().click();await page.waitForSelector('.fl-participant-dialog[open]');await page.keyboard.press('Escape');assert.match(await page.locator('.fl-profile-link').first().getAttribute('href'),/^https:\/\/19ib\.ru\/artist\//);
 await context.close();}
 assert.deepEqual(errors,[]);await fs.writeFile(`${dir}/comparison.json`,JSON.stringify(comparisons,null,2));console.log('UI reference passed: five widths, all four routes, real current data, pixel comparisons, dialogs, expansions, tooltips, filters, sorts, navigation and one analytics script.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
