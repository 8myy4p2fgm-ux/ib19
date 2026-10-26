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
  await page.locator('[data-field="search"]').fill('Кот Форумчанина');
  assert.equal(await page.locator('[data-person]').count(),1);
  await page.locator('[data-person]').click();
  const host=page.locator(width<=850?'.rr-dialog[open]':'.e6-person-aside');
  assert.match(await host.innerText(),/K_Slim/);assert.equal(await host.locator('a[href*="19ib.ru/artist/"]').getAttribute('href'),'https://19ib.ru/artist/kot-forumchanina');
  if(width<=850)await page.keyboard.press('Escape');else await page.locator('.e6-inline-close').click();
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
  assert.equal(await unknown.textContent(),'Имя неизвестно');
  assert.equal(await unknown.getAttribute('href'),'https://19ib.ru/artist/'+example.unknown);
  assert.equal(await unknown.getAttribute('aria-label'),'Имя неизвестно. Профиль участника на 19ib.ru');
  assert.equal(await unknown.getAttribute('rel'),'noopener noreferrer');
  await unknown.focus();assert.equal(await unknown.evaluate(e=>e===document.activeElement),true);
  assert.equal(await page.locator('#artist-unsafe').textContent(),'<img src=x onerror=alert(1)>');
  assert.equal(await page.locator('#identity-render-check img').count(),0);
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('Artist names passed: desktop/mobile artist labels, separate K_Slim nickname, slug links, accessible UUID fallback and safe text.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
