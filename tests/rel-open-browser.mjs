// Focused REL-OPEN-01 navigation checks. No analytical result regression.
import fs from 'node:fs';import path from 'node:path';import http from 'node:http';import assert from 'node:assert/strict';import {chromium} from 'playwright';
const dir='docs/rel-open-01';fs.mkdirSync(dir,{recursive:true});
const root=path.resolve('dist'),mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'};
const server=http.createServer((req,res)=>{try{let file=path.join(root,new URL(req.url,'http://local').pathname);if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,b=await chromium.launch(),errors=[],checks=[];
async function ready(p){await p.locator('.app:not([hidden])').waitFor();await p.locator('#carrot-loader').waitFor({state:'detached'});await p.evaluate(()=>document.fonts.ready);}
try{for(const width of [1440,390]){
 const c=await b.newContext({viewport:{width,height:width===390?844:1000},reducedMotion:'reduce'});await c.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base);await ready(p);assert.equal(await p.locator('body').getAttribute('data-round'),'1');assert.equal(await p.locator('#round-select').inputValue(),'1');await p.screenshot({path:`${dir}/r1-${width}.png`,fullPage:true});
 await p.locator('#home [data-method]').first().click();await p.locator('#method-dialog[open]').waitFor();await p.keyboard.press('Escape');
 for(const [section,id]of [['dynamics','dynamics'],['judges','judges'],['rappers','forum-link'],['events','events-page'],['horo','horo']]){await p.goto(base+'/'+section+'/?round=1');await ready(p);await p.locator('#'+id+'.active').waitFor();const tabs=p.locator('#'+id+' .report-tabs[role=tablist] > [role=tab]');for(let i=0;i<await tabs.count();i++){await tabs.nth(i).click();await tabs.nth(i).waitFor();assert.equal(await tabs.nth(i).getAttribute('aria-selected'),'true');}assert.equal(await p.locator('.site-header .navs').getAttribute('hidden'),null);}
 checks.push({width,scenario:'R1 default, all sections and report tabs, methodology',status:'PASS'});
 async function round(value){let trigger=p.locator('[data-select-id="round-select"]');if(!await trigger.isVisible())await p.locator('.header-menu-toggle').click();await trigger.click();const option=p.locator('.site-select-round [role=option]').filter({hasText:value==='2'?'2-й отборочный':'1-й отборочный'});if(value==='2')assert.match(await option.innerText(),/Скоро/);await option.click();}
 await round('2');await p.locator('.r2-public').waitFor();assert.equal(new URL(p.url()).pathname,'/');assert.equal(await p.locator('.site-header .navs').isVisible(),false);await p.keyboard.press('Escape');await p.screenshot({path:`${dir}/r2-${width}.png`,fullPage:true});
 const targets=['/?round=2','/dynamics/?round=2&report=distribution','/judges/?round=2&report=verdict&judge=test','/rappers/?round=2&report=matrix&participant=test','/events/?round=2','/horo/?round=2','/#round/2/judges?report=tinder','/rappers/#round/2/participant?participant=test'];
 for(const target of targets){await p.goto(base+target);await ready(p);assert.equal(new URL(p.url()).search,'?round=2');assert.equal(new URL(p.url()).pathname,'/');assert.equal(await p.locator('.page.active').getAttribute('id'),'round-information');assert.equal(await p.locator('.r2-public h1').innerText(),'Второй отборочный');assert.equal(await p.locator('.page.active :is(table,svg,[role=tablist])').count(),0);assert.equal(await p.locator('.site-header .navs').isVisible(),false);assert.equal(await p.locator('.r2-public a').count(),1);}
 checks.push({width,scenario:'8 direct/legacy R2 URLs converge; no report UI',status:'PASS'});
 await p.locator('.r2-public a').click();await p.locator('#home.active').waitFor();assert.equal(await p.locator('#round-select').inputValue(),'1');assert.equal(await p.locator('.site-header .navs').getAttribute('hidden'),null);
 await round('2');await round('1');await p.locator('#home.active').waitFor();await p.goBack();await p.locator('.r2-public').waitFor();await p.reload();await ready(p);await p.locator('.r2-public').waitFor();
 checks.push({width,scenario:'return link, round picker, browser back and reload',status:'PASS'});
 await c.close();console.log('PASS REL-OPEN-01',width);
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(dir+'/checks.json',JSON.stringify({checks,javaScriptErrors:errors},null,2));
}finally{await b.close();await new Promise(r=>server.close(r));}
