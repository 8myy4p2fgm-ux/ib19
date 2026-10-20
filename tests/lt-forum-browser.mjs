import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve('dist');
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json'};
const server=http.createServer(async(req,res)=>{try{
 let file=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);
 if(file!==root&&!file.startsWith(root+path.sep))throw Error('outside');
 if((await fs.stat(file)).isDirectory())file=path.join(file,'index.html');
 res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));
}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true}),errors=[];
try{
 for(const width of [1440,375])for(const [id,name,slug,total] of [['efa254a2-623f-4850-81f7-b193a948330c','Эталон Этанола [ЛТ]','etalon-etanola-lt',23],['d6f9868b-d11c-42fe-8646-f2307fb96666','VladisLOVE [ЛТ]','vladislove-lt',16]]){
  const page=await browser.newPage({viewport:{width,height:900}});page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/rappers/');await page.waitForSelector('#fl-rows');
  await page.locator('#fl-search').fill(name);await page.locator('[data-fl-group="current"]').click();
  const row=page.locator('[data-fl-row="'+id+'"]');assert.equal(await row.count(),1);assert.equal(await page.locator('[data-fl-row]').count(),1);
  assert.equal(await row.locator('a').getAttribute('href'),'https://19ib.ru/artist/'+slug);
  assert.equal((await row.locator('[data-label="Баллы"]').innerText()).trim(),String(total));
  assert.equal((await row.locator('[data-label="Оценено"]').innerText()).trim(),'5 / 5');
  await page.locator('[data-fl-group="veterans"]').click();assert.equal(await row.count(),0);
  await page.locator('[data-fl-group="current"]').click();assert.equal(await row.count(),1);
  await page.close();
 }
 assert.deepEqual(errors,[]);console.log('Both LT Forum artists browser passed: exact UUID, Forum filter, five grades, correct totals, correct profile, not a veteran, desktop/mobile.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
