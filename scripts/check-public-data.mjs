import {createHash} from 'node:crypto';
import {SMILIES} from '../js/chat-smilies-catalog.js';
import {readGraphs} from './js-graphs.mjs';
import {legacyAssets} from './release-assets.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const forbidden=new Set(['forum_name','forumName','forumProfile','forum_profile_url','aliases','battle_name','battle_history']);
export async function checkPublicData(root,{graphRoot}={}){
 const errors=[],files=[];
 async function walk(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isSymbolicLink())throw Error('Symlink in public build: '+file);if(entry.isDirectory())await walk(file);else files.push(file);}}
 await walk(root);
 // Match the actual HTML entry/lazy module graph; unused JavaScript is not public.
 const modules=new Set();
 async function visit(relative){if(modules.has(relative))return;modules.add(relative);const source=await fs.readFile(path.join(root,relative),'utf8');for(const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*|\bnew\s+URL\(\s*)['"](\.[^'"]+\.js(?:\?v=[a-f0-9]{16})?)['"]/g)){const next=path.posix.normalize(path.posix.join(path.posix.dirname(relative),match[1].split('?')[0]));if(!next.startsWith('js/'))throw Error('Unexpected module path');await visit(next);}}
 for(const entry of ['index.html','chat/index.html']){const html=await fs.readFile(path.join(root,entry),'utf8');for(const match of html.matchAll(/<script[^>]+src=["'](?:\.\/|\.\.\/)(js\/[^"']+)["']/g))await visit(match[1].split('?')[0]);}
 const versions=new Set([...modules].map(f=>f.match(/\.([a-f0-9]{16})\.js$/)?.[1]).filter(Boolean));
 if(versions.size>1)throw Error('Mixed public module graph versions');
 if(versions.size){const version=[...versions][0];
  for(const file of [...modules]){const alias=file.replace(/\.[a-f0-9]{16}\.js$/,'.js');if(alias===file)throw Error('Unversioned dependency in public module graph: '+file);if(!Object.hasOwn(legacyAssets,alias)&&await fs.readFile(path.join(root,file),'utf8')!==await fs.readFile(path.join(root,alias),'utf8'))throw Error('Legacy alias differs from versioned module: '+alias);modules.add(alias);}
  for(const [file,expected]of Object.entries(legacyAssets)){const raw=await fs.readFile(path.join(root,file));if(createHash('sha256').update(raw).digest('hex')!==expected)throw Error('Legacy module checksum mismatch: '+file);modules.add(file);}
  for(const file of Object.keys(legacyAssets)){const source=await fs.readFile(path.join(root,file),'utf8');for(const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bnew\s+URL\(\s*)['"](\.[^'"]+\.js)['"]/g)){const next=path.posix.normalize(path.posix.join(path.posix.dirname(file),match[1]));if(!modules.has(next))throw Error('Unresolved legacy dependency: '+next);}}
 }
 const retained=await readGraphs(graphRoot);
 if(versions.size&&![...versions].every(v=>v===retained.registry.currentVersion))throw Error('Active graph is not the prepared current version');
 for(const [file,source]of retained.assets){if(await fs.readFile(path.join(root,file),'utf8')!==source)throw Error('Retained JS checksum mismatch: '+file);modules.add(file);}
 const chatFiles=new Map(SMILIES.map(s=>['chat/smilies/'+s.file,s]));
 const jsonFiles=new Set(['horo/content.json','public-data/r1/submissions.v1.json','public-data/r1/core.json','public-data/r1/comments.json','public-data/r1/metadata.json','public-data/r1/19ib_all_judges_REPAIRED.json','public-data/r1/forum_judges_export.json','public-data/groups.json','data/rounds/r2-submissions.v1/snapshot.json']);
 function inspect(x,where){if(Array.isArray(x))x.forEach((v,i)=>inspect(v,where+'['+i+']'));else if(x&&typeof x==='object')for(const [k,v]of Object.entries(x)){if(forbidden.has(k))errors.push(where+'.'+k);inspect(v,where+'.'+k);}else if(typeof x==='string'&&/^[\s]*[\[{]/.test(x)){try{inspect(JSON.parse(x),where+'(JSON)');}catch{}}}
 for(const file of files){const relative=path.relative(root,file).split(path.sep).join('/');
  if(relative.endsWith('.js')&&!modules.has(relative))errors.push('Unreferenced JavaScript: '+relative);
  if(/\.(?:html|js|json)$/.test(relative)&&/https?:\/\/(?:www\.)?hip-hop\.ru\/forum\/id/i.test(await fs.readFile(file,'utf8')))errors.push('Forum account URL: '+relative);
  if(relative.endsWith('.json')){if(!jsonFiles.has(relative))errors.push('Unexpected JSON: '+relative);inspect(JSON.parse(await fs.readFile(file,'utf8')),relative);}
  else if(chatFiles.has(relative)){const s=chatFiles.get(relative);if(createHash('sha256').update(await fs.readFile(file)).digest('hex')!==s.sha256)errors.push('Smiley checksum mismatch: '+relative);}
  else if(!/^(?:chat\/(?:index\.html|view\.html|style\.css|nav\.css)|index\.html|\.nojekyll|(?:dynamics|judges|rappers|events|horo)\/index\.html|js\/[\w-]+(?:\.[a-f0-9]{16})?\.js|horo\/media\/[\w-]+\.(?:png|webp)|css\/[\w./-]+\.(?:css|png|webp|jpg|jpeg|svg|woff2?|ttf))$/.test(relative))errors.push('Unexpected public file: '+relative);
 }
 for(const file of chatFiles.keys())if(!files.includes(path.join(root,file)))errors.push('Missing smiley: '+file);
 for(const file of jsonFiles)if(!files.includes(path.join(root,file)))errors.push('Missing public resource: '+file);
 if(errors.length)throw Error('Public data boundary failed:\n'+errors.join('\n'));
 return {files:files.length,jsonFiles:jsonFiles.size,forbiddenFields:0};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(await checkPublicData(process.argv[2]||'dist'));
