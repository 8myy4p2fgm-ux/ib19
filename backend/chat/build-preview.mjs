import {readFile,writeFile,mkdir,cp,readdir,lstat} from 'node:fs/promises';
import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
import {checkPublicData} from '../../scripts/check-public-data.mjs';
import {SMILIES} from '../../chat/smilies-catalog.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
export async function buildPreview({outDir,siteDir=path.join(root,'dist'),origin}){
 const u=new URL(origin);if(u.protocol!=='https:'||u.origin!==origin||/(^|\.)tuz19\.ru$/i.test(u.hostname))throw Error('Explicit isolated HTTPS preview origin required');
 outDir=path.resolve(outDir);siteDir=path.resolve(siteDir);
 if(outDir===siteDir||siteDir.startsWith(outDir+path.sep)||outDir.startsWith(siteDir+path.sep))throw Error('Separate output directory required');
 await checkPublicData(siteDir);await mkdir(outDir,{recursive:false});const publicDir=path.join(outDir,'public');await cp(siteDir,publicDir,{recursive:true,errorOnExist:true});
 for(const file of ['index.html','dynamics/index.html','judges/index.html','rappers/index.html','events/index.html','horo/index.html']){const p=path.join(publicDir,file);const text=await readFile(p,'utf8');if(/chat-nav(?:\.[a-f0-9]{16})?\.js/.test(text))continue;await writeFile(p,text.replace('</head>','<link rel="stylesheet" href="/chat/nav.css"></head>').replace('</body>','<script type="module" src="/chat/nav.js"></script></body>'));}
 const files=['index.html','client.js','style.css','nav.js','nav.css','public-presence.js','smilies.js','smilies-catalog.js',...SMILIES.map(s=>'smilies/'+s.file)];
 await mkdir(path.join(publicDir,'chat/smilies'),{recursive:true});
 for(const file of new Set(files)){if(file==='index.html')continue;if(!/^[\w./-]+$/.test(file)||file.includes('..'))throw Error('Invalid asset');const source=path.join(root,'chat',file);if(!(await lstat(source)).isFile())throw Error('Invalid asset type');await cp(source,path.join(publicDir,'chat',file));}
 for(const file of ['worker.mjs','preview-worker.mjs','api-cors.mjs'])await cp(path.join(root,'backend/chat',file),path.join(outDir,file));
 const config={name:'tuz19-chat-preview',main:'preview-worker.mjs',compatibility_date:'2026-07-01',workers_dev:true,preview_urls:true,routes:[],assets:{directory:'./public',binding:'ASSETS',run_worker_first:true},durable_objects:{bindings:[{name:'CHAT_ROOM',class_name:'ChatRoom'}]},migrations:[{tag:'v1',new_sqlite_classes:['ChatRoom']}],vars:{ALLOWED_ORIGIN:origin,CHAT_ENABLED:'true'}};
 const configPath=path.join(outDir,'wrangler.jsonc');await writeFile(configPath,JSON.stringify(config,null,2)+'\n');
 const manifest={};async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())await walk(f);else manifest[path.relative(publicDir,f)]=createHash('sha256').update(await readFile(f)).digest('hex');}}await walk(publicDir);await writeFile(path.join(outDir,'assets-manifest.json'),JSON.stringify(manifest,null,2));
 return {configPath,publicDir,files:Object.keys(manifest).length};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){console.log(await buildPreview({outDir:process.argv[2],origin:process.argv[3]}));}
