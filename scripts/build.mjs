import fs from 'node:fs/promises';
import {checkPublicData} from './check-public-data.mjs';
import {writePublicData} from './public-data.mjs';

await fs.rm('dist',{recursive:true,force:true});
await fs.mkdir('dist',{recursive:true});
for(const file of ['index.html','css'])await fs.cp(file,'dist/'+file,{recursive:true});
// Horo has an explicit content resource and only its referenced media.
const horo=JSON.parse(await fs.readFile('horo/content.json','utf8'));
await fs.mkdir('dist/horo/media',{recursive:true});await fs.copyFile('horo/content.json','dist/horo/content.json');
for(const file of new Set(horo.images.flatMap(image=>[image.src,...(image.frames||[])]))){
 if(!/^media\/[\w-]+\.(png|webp)$/.test(file))throw Error('Unexpected Horo media path');
 await fs.copyFile('horo/'+file,'dist/horo/'+file);
}
// Publish only the module graph reachable from HTML entry scripts, including
// literal lazy imports. Fail closed on unresolved local dependencies.
const entryHTML=await fs.readFile('index.html','utf8'),reachable=new Set();
async function visit(file){
 if(reachable.has(file))return;reachable.add(file);
 const source=await fs.readFile(file,'utf8');
 for(const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*|\bnew\s+URL\(\s*)['"](\.[^'"]+\.js)['"]/g)){
  const url=new URL(match[1],new URL(file,new URL('../',import.meta.url)));
  const local=decodeURIComponent(url.pathname.slice(new URL('../',import.meta.url).pathname.length));
  if(!local.startsWith('js/'))throw Error('Unexpected module dependency: '+local);
  await visit(local);
 }
}
for(const match of entryHTML.matchAll(/<script[^>]+src=["']\.\/(js\/[^"']+)["']/g))await visit(match[1]);
await fs.mkdir('dist/js',{recursive:true});
for(const file of [...reachable].sort())await fs.copyFile(file,'dist/'+file);
// Original high-resolution logo remains in source; published UI uses DPR2 PNG.
await fs.rm('dist/css/assets/tuz-drawn.webp',{force:true});
console.log('Runtime modules:',reachable.size);
await writePublicData('dist/public-data');
// The only raw public resource needed by R2; never copy the entire data tree.
await fs.mkdir('dist/data/rounds/r2-submissions.v1',{recursive:true});
await fs.copyFile('data/rounds/r2-submissions.v1/snapshot.json','dist/data/rounds/r2-submissions.v1/snapshot.json');
const html=await fs.readFile('index.html','utf8');
for(const [route,title] of [['dynamics','Судейские обхваты'],['judges','Судьи'],['rappers','Реперы'],['events','События'],['horo','Хо-ро-шо. По форумному']]){
 await fs.mkdir(`dist/${route}`,{recursive:true});
 await fs.writeFile(`dist/${route}/index.html`,html.replace('<title>Обзор — TUZ19</title>',`<title>${title} — TUZ19</title>`).replaceAll('="./','="../'));
}
await fs.writeFile('dist/.nojekyll','');

console.log('Public boundary:',await checkPublicData('dist'));
