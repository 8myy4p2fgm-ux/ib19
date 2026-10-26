import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const forbidden=new Set(['forum_name','forumName','forumProfile','forum_profile_url','aliases','battle_name','battle_history']);
export async function checkPublicData(root){
 const errors=[],files=[];
 async function walk(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isSymbolicLink())throw Error('Symlink in public build: '+file);if(entry.isDirectory())await walk(file);else files.push(file);}}
 await walk(root);
 // Match the actual HTML entry/lazy module graph; unused JavaScript is not public.
 const modules=new Set();
 async function visit(relative){if(modules.has(relative))return;modules.add(relative);const source=await fs.readFile(path.join(root,relative),'utf8');for(const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*|\bnew\s+URL\(\s*)['"](\.[^'"]+\.js)['"]/g)){const next=path.posix.normalize(path.posix.join(path.posix.dirname(relative),match[1]));if(!next.startsWith('js/'))throw Error('Unexpected module path');await visit(next);}}
 const html=await fs.readFile(path.join(root,'index.html'),'utf8');for(const match of html.matchAll(/<script[^>]+src=["']\.\/(js\/[^"']+)["']/g))await visit(match[1]);
 const jsonFiles=new Set(['horo/content.json','public-data/r1/metadata.json','public-data/r1/19ib_all_judges_REPAIRED.json','public-data/r1/forum_judges_export.json','public-data/groups.json','data/rounds/r2-submissions.v1/snapshot.json']);
 function inspect(x,where){if(Array.isArray(x))x.forEach((v,i)=>inspect(v,where+'['+i+']'));else if(x&&typeof x==='object')for(const [k,v]of Object.entries(x)){if(forbidden.has(k))errors.push(where+'.'+k);inspect(v,where+'.'+k);}else if(typeof x==='string'&&/^[\s]*[\[{]/.test(x)){try{inspect(JSON.parse(x),where+'(JSON)');}catch{}}}
 for(const file of files){const relative=path.relative(root,file).split(path.sep).join('/');
  if(relative.endsWith('.js')&&!modules.has(relative))errors.push('Unreferenced JavaScript: '+relative);
  if(/\.(?:html|js|json)$/.test(relative)&&/https?:\/\/(?:www\.)?hip-hop\.ru\/forum\/id/i.test(await fs.readFile(file,'utf8')))errors.push('Forum account URL: '+relative);
  if(relative.endsWith('.json')){if(!jsonFiles.has(relative))errors.push('Unexpected JSON: '+relative);inspect(JSON.parse(await fs.readFile(file,'utf8')),relative);}
  else if(!/^(?:index\.html|\.nojekyll|(?:dynamics|judges|rappers|events|horo)\/index\.html|js\/[\w-]+\.js|horo\/media\/[\w-]+\.(?:png|webp)|css\/[\w./-]+\.(?:css|png|webp|jpg|jpeg|svg|woff2?|ttf))$/.test(relative))errors.push('Unexpected public file: '+relative);
 }
 for(const file of jsonFiles)if(!files.includes(path.join(root,file)))errors.push('Missing public resource: '+file);
 if(errors.length)throw Error('Public data boundary failed:\n'+errors.join('\n'));
 return {files:files.length,jsonFiles:jsonFiles.size,forbiddenFields:0};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(await checkPublicData(process.argv[2]||'dist'));
