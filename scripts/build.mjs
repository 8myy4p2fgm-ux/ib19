import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {ACTIVE_R1_SOURCE,R1_SOURCES} from '../js/r1-application.js';

await fs.rm('dist',{recursive:true,force:true});
await fs.mkdir('dist',{recursive:true});
for(const file of ['index.html','css','data','horo'])await fs.cp(file,'dist/'+file,{recursive:true});
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
if(ACTIVE_R1_SOURCE==='candidate'){
 const directory=new URL(R1_SOURCES.candidate.directory,new URL('../js/r1-application.js',import.meta.url));
 const manifest=JSON.parse(await fs.readFile(new URL('manifest.json',directory),'utf8'));
 if(manifest.runId!==R1_SOURCES.candidate.runId)throw new Error('Candidate manifest run mismatch');
 const destination='dist/docs/data-candidates/r1-2026-10-22-194208';await fs.mkdir(destination,{recursive:true});
 for(const file of ['metadata.json','19ib_all_judges_REPAIRED.json','forum_judges_export.json','history.json','forum.csv']){
  const bytes=await fs.readFile(new URL(file,directory));
  if(createHash('sha256').update(bytes).digest('hex')!==manifest.files.find(entry=>entry.path===file)?.sha256)throw new Error('Candidate checksum mismatch: '+file);
  await fs.writeFile(destination+'/'+file,bytes);
 }
}
const html=await fs.readFile('index.html','utf8');
for(const [route,title] of [['dynamics','Судейские обхваты'],['judges','Судьи'],['rappers','Реперы'],['events','События'],['horo','Хо-ро-шо. По форумному']]){
 await fs.mkdir(`dist/${route}`,{recursive:true});
 await fs.writeFile(`dist/${route}/index.html`,html.replace('<title>Обзор — TUZ19</title>',`<title>${title} — TUZ19</title>`).replaceAll('="./','="../'));
}
await fs.writeFile('dist/.nojekyll','');
