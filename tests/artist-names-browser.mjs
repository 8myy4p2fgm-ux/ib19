import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=path.resolve('dist'),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp'};
const server=http.createServer(async(req,res)=>{
 try{
  let file=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);
  if(file!==root&&!file.startsWith(root+path.sep))throw Error('outside');
  if((await fs.stat(file)).isDirectory())file=path.join(file,'index.html');
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));
 }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true});
try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/rappers/');await page.locator('.app:not([hidden])').waitFor();
  await page.locator('#fl-search').fill('Кот Форумчанина');
  assert.equal(await page.locator('[data-fl-row]').count(),1);
  const forumLink=page.locator('[data-fl-row] .fl-profile-link');
  assert.match(await forumLink.textContent(),/K_Slim/);assert.equal(await forumLink.getAttribute('href'),'https://19ib.ru/artist/kot-forumchanina');
  const example=await page.evaluate(async()=>{
   const [{normalizeData},{artistNameElement}]=await Promise.all([import('/js/data.js'),import('/js/artist-identity.js')]);
   const [main,forum]=await Promise.all(['19ib_all_judges_REPAIRED.json','forum_judges_export.json'].map(async f=>(await fetch('/data/'+f)).json()));
   const D=normalizeData(main,forum),ordinary=main.members.find(p=>!D.metadata.has(p.userId));
   const unknown='00000000-0000-0000-0000-000000000000',unsafe='unsafe-test';
   D.artists.set(unsafe,{artistName:'<img src=x onerror=alert(1)>',artistSlug:'unsafe/name'});
   const host=document.createElement('div');host.id='identity-render-check';
   for(const [id,userId] of [['ordinary',ordinary.userId],['forum','66caebea-d33d-4ff6-951c-91ed9d93c4be'],['unknown',unknown],['unsafe',unsafe]]){
    const link=artistNameElement(D,userId);link.id='artist-'+id;host.append(link);
   }
   document.body.append(host);
   return {ordinaryId:ordinary.userId,ordinaryName:ordinary.artistName,ordinarySlug:ordinary.artistSlug,unknown};
  });
  assert.equal(await page.locator('#artist-ordinary').textContent(),example.ordinaryName);
  assert.equal(await page.locator('#artist-ordinary').getAttribute('href'),'https://19ib.ru/artist/'+encodeURIComponent(example.ordinarySlug));
  assert.equal(await page.locator('#artist-forum').textContent(),'Кот Форумчанина');
  const unknown=page.locator('#artist-unknown');
  const summary=unknown.locator('summary');
  assert.equal(await summary.textContent(),'Имя неизвестно');assert.match(await summary.getAttribute('aria-label'),new RegExp(example.unknown));
  assert.equal(await unknown.locator('code').isVisible(),false);
  await summary.focus();await page.keyboard.press('Enter');
  assert.equal(await unknown.locator('code').isVisible(),true);assert.equal(await unknown.locator('code').textContent(),'UUID: '+example.unknown);
  await summary.click();assert.equal(await unknown.locator('code').isVisible(),false);
  assert.equal(await page.locator('#artist-unsafe').textContent(),'<img src=x onerror=alert(1)>');
  assert.equal(await page.locator('#identity-render-check img').count(),0);
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('Artist names passed: desktop/mobile artist labels, separate K_Slim nickname, slug links, accessible UUID fallback and safe text.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
