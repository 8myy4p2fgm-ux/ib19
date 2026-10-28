import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {assetVersion,versionModule,moduleReference} from './release-assets.mjs';
export const GRAPH_ROOT=new URL('../public-compat/graphs/',import.meta.url);
export const MAX_GRAPHS=16,MIN_SUPPORT_MS=7*86400000;
const digest=b=>createHash('sha256').update(b).digest('hex');
const validVersion=v=>typeof v==='string'&&/^[a-f0-9]{16}$/.test(v);
const check=(yes,message)=>{if(!yes)throw Error('JS graph: '+message);};
export async function currentGraph(){
 const config=JSON.parse(await fs.readFile('config/chat-ui.json','utf8'));
 const enabled=process.argv.includes('--chat-nav')||config.enabled===true;
 const entryHTML=(await fs.readFile('index.html','utf8')).replace('name="tuz19-chat-enabled" content="false"','name="tuz19-chat-enabled" content="'+enabled+'"');
 const chatHTML=await fs.readFile('chat/index.html','utf8'),sources=new Map();
 async function visit(file){
  if(sources.has(file))return;
  const source=await fs.readFile(file,'utf8');sources.set(file,source);
  for(const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*|\bnew\s+URL\(\s*)['"](\.[^'"]+\.js)['"]/g)){
   const local=path.posix.normalize(path.posix.join(path.posix.dirname(file),match[1]));
   check(/^js\/[\w-]+\.js$/.test(local),'unexpected source dependency '+local);await visit(local);
  }
 }
 for(const html of [entryHTML,chatHTML])for(const m of html.matchAll(/<script[^>]+src=["'](?:\.\/|\.\.\/)(js\/[^"']+)["']/g))await visit(m[1]);
 const compiler=(await Promise.all(['scripts/build.mjs','scripts/release-assets.mjs','scripts/js-graphs.mjs'].map(f=>fs.readFile(f,'utf8')))).join('');
 const version=assetVersion(entryHTML+'\nCHAT_ENTRY\n'+chatHTML,sources,compiler);
 const modules=Object.fromEntries([...sources].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([file,source])=>[file.replace(/\.js$/,'.'+version+'.js'),versionModule(source,version)]));
 return {entryHTML,chatHTML,sources,version,modules};
}
export function validateBundle(bundle,entry){
 check(bundle?.schema===1&&bundle.version===entry.version&&validVersion(bundle.version),'bundle version');
 check(bundle.modules&&typeof bundle.modules==='object'&&!Array.isArray(bundle.modules),'module map');
 const modules=Object.entries(bundle.modules);check(modules.length>0&&modules.length<=160,'module count');
 for(const [file,value]of modules){
  check(new RegExp('^js/[\\w-]+\\.'+entry.version+'\\.js$').test(file),'unsafe module path '+file);
  check(typeof value.source==='string'&&Buffer.byteLength(value.source)<=1024*1024&&digest(value.source)===value.sha256,'module checksum '+file);
  for(const match of value.source.matchAll(moduleReference)){
   const dependency=path.posix.normalize(path.posix.join(path.posix.dirname(file),match[3]));
   check(Object.hasOwn(bundle.modules,dependency),'missing or mixed-version dependency '+dependency);
  }
 }
 return new Map(modules.map(([file,value])=>[file,value.source]));
}
export async function readGraphs(root=GRAPH_ROOT){
 const registry=JSON.parse(await fs.readFile(new URL('manifest.json',root),'utf8'));
 check(registry.schema===1&&registry.maxGraphs===MAX_GRAPHS&&registry.minimumSupportDays===7&&Array.isArray(registry.graphs),'registry schema');
 check(registry.graphs.length>0&&registry.graphs.length<=MAX_GRAPHS,'capacity exceeded;review retirement,never auto-prune');
 check(validVersion(registry.currentVersion),'current version');
 const seen=new Set(),assets=new Map();
 for(const entry of registry.graphs){
  check(validVersion(entry.version)&&!seen.has(entry.version),'duplicate graph');seen.add(entry.version);
  check(entry.bundle===entry.version+'.json'&&/^[a-f0-9]{64}$/.test(entry.sha256),'bundle identity');
  check(Number.isFinite(Date.parse(entry.retainUntil))&&Number.isFinite(Date.parse(entry.preparedAt)),'support window');
  check(Date.parse(entry.retainUntil)-Date.parse(entry.preparedAt)>=MIN_SUPPORT_MS,'support window shorter than7days');
  const raw=await fs.readFile(new URL(entry.bundle,root));check(raw.length<=4*1024*1024&&digest(raw)===entry.sha256,'archive checksum '+entry.version);
  const bundle=JSON.parse(raw);for(const [file,source]of validateBundle(bundle,entry)){check(!assets.has(file),'asset collision');assets.set(file,source);}
 }
 check(seen.has(registry.currentVersion),'current graph missing');
 const names=await fs.readdir(root);check(names.every(f=>f==='manifest.json'||registry.graphs.some(e=>e.bundle===f)),'undeclared graph archive');
 return {registry,assets};
}
export async function requirePrepared(graph){
 const retained=await readGraphs();
 check(retained.registry.currentVersion===graph.version,'source graph not prepared;run npm run prepare:js andreview generated immutable assets');
 for(const [file,source]of Object.entries(graph.modules))check(retained.assets.get(file)===source,'current archive differs from source '+file);
 const active=retained.registry.graphs.find(e=>e.version===graph.version);
 const bundle=JSON.parse(await fs.readFile(new URL(active.bundle,GRAPH_ROOT),'utf8'));
 check(Object.keys(bundle.modules).length===Object.keys(graph.modules).length,'current module set differs');
 return retained;
}
export async function addGraph({version,modules,sourceRevision=null,sourceBase=null,root=GRAPH_ROOT,now=new Date()}={}){
 check(validVersion(version),'invalid version');
 await fs.mkdir(root,{recursive:true});let registry;
 let exists=true;try{await fs.access(new URL('manifest.json',root));}catch(e){if(e.code!=='ENOENT')throw e;exists=false;}
 if(exists)registry=(await readGraphs(root)).registry;else{check((await fs.readdir(root)).length===0,'orphan archives without registry');registry={schema:1,maxGraphs:MAX_GRAPHS,minimumSupportDays:7,currentVersion:version,graphs:[]};}
 const bundle={schema:1,version,modules:Object.fromEntries(Object.entries(modules).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([file,source])=>[file,{sha256:digest(source),source}]))};
 validateBundle(bundle,{version});const raw=JSON.stringify(bundle)+'\n',hash=digest(raw),existing=registry.graphs.find(e=>e.version===version);
 if(existing){check(existing.sha256===hash,'immutable graph cannot be rewritten');if(registry.currentVersion===version)return {version,added:false};const until=new Date(now.getTime()+MIN_SUPPORT_MS).toISOString();for(const e of registry.graphs)if([registry.currentVersion,version].includes(e.version)&&Date.parse(e.retainUntil)<Date.parse(until))e.retainUntil=until;registry.currentVersion=version;await fs.writeFile(new URL('manifest.json',root),JSON.stringify(registry,null,2)+'\n');return {version,added:false,activated:true};}
 check(registry.graphs.length<MAX_GRAPHS,'capacity exceeded;explicit retirement review required');
 const date=now.toISOString(),until=new Date(now.getTime()+MIN_SUPPORT_MS).toISOString();
 const old=registry.graphs.find(e=>e.version===registry.currentVersion);if(old&&Date.parse(old.retainUntil)<Date.parse(until))old.retainUntil=until;
 registry.graphs.push({version,bundle:version+'.json',sha256:hash,sourceRevision,sourceBase,preparedAt:date,retainUntil:until});registry.currentVersion=version;
 await fs.writeFile(new URL(version+'.json',root),raw,{flag:'wx'});
 await fs.writeFile(new URL('manifest.json',root),JSON.stringify(registry,null,2)+'\n');return {version,added:true};
}
export function retirementPlan(registry,versions,{now=new Date()}={}){
 check(Array.isArray(versions)&&versions.length>0,'specify retirement versions');
 return versions.map(version=>{const e=registry.graphs.find(e=>e.version===version);check(e&&version!==registry.currentVersion,'cannot retire current/unknown graph');check(now.getTime()>=Date.parse(e.retainUntil),'supported tabs still require graph '+version);return {version,bundle:e.bundle,sha256:e.sha256,retainUntil:e.retainUntil};});
}
