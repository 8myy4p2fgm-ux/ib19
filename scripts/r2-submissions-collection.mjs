// Phase adapter of the existing update entrypoint. No CLI, schedule or score requests.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createClient} from './collector.mjs';
import {validateR2Submissions} from '../js/r2-submissions.js';
export const R2_ROUND='235f6600-5224-4adf-bbcc-a220f4572251';
export const R2_PHASE='submissions';
export const R2_DIRECTORY='data/rounds/r2-submissions.v1';
export const R2_FILES=['full.raw.json','live.raw.json','snapshot.json','history.json','metadata.json','manifest.json'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const encode=value=>JSON.stringify(value,null,2)+'\n';
const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;
export const submissionFingerprint=model=>hash(JSON.stringify(stable({roundId:model.roundId,name:model.name,topic:model.topic,times:Object.fromEntries(Object.entries(model.times).filter(([k])=>k!=='updatedAt')),entries:model.entries.map(({userId,slug,name,trackId,submittedAt,durationSec,hasLyrics,submissionStatus})=>({userId,slug,name,trackId,submittedAt,durationSec,hasLyrics,submissionStatus})).sort((a,b)=>a.userId.localeCompare(b.userId))})));
export async function assertR1Archive(root='.'){
 const lock=await read(path.join(root,'scripts/r1-archive-lock.json'));
 for(const [file,digest]of Object.entries(lock.files))if(hash(await fs.readFile(path.join(root,file)))!==digest)throw Error('R1 archive changed: '+file);
}
export async function loadR2State(root='.'){
 const directory=path.join(root,R2_DIRECTORY),snapshot=await read(path.join(directory,'snapshot.json'));
 const model=validateR2Submissions(snapshot),metadata=await read(path.join(directory,'metadata.json')),history=await read(path.join(directory,'history.json')),manifest=await read(path.join(directory,'manifest.json'));
 if(metadata.roundId!==R2_ROUND||metadata.phase!==R2_PHASE||metadata.dataFingerprint!==submissionFingerprint(model)||metadata.runId!==snapshot.importedAt||history.roundId!==R2_ROUND||history.phase!==R2_PHASE||!Array.isArray(history.revisions))throw Error('Inconsistent saved R2 state');
 for(const name of R2_FILES.filter(f=>f!=='manifest.json')){
  const bytes=await fs.readFile(path.join(directory,name)),entry=manifest.files?.[name];
  if(entry?.sha256!==hash(bytes)||entry.bytes!==bytes.length)throw Error('Incomplete R2 publication: '+name);
 }
 return {snapshot,model,metadata,history};
}
export function compatibleR2Check(state,report,now=Date.now()){
 return !!report&&['collected','unchanged'].includes(report.status)&&report.roundId===R2_ROUND&&report.phase===R2_PHASE&&report.dataFingerprint===state.metadata.dataFingerprint&&Number.isFinite(Date.parse(report.lastCheckedAt))&&Date.parse(report.lastCheckedAt)>=Date.parse(state.metadata.lastSuccessfulAt)&&Date.parse(report.lastCheckedAt)<=now;
}
function submissionsOnly(full,live){
 if(full.judgingStartedAt||full.resultsPublished||[...(full.entries||[]),...(live.progress||[])].some(e=>(e.scoredCount??0)>0||(e.score??0)>0||e.advanced===true))throw Error('R2 judging requires separate authorization; keeping submissions snapshot');
}
export function snapshotFromResponses(full,live,observedAt){
 submissionsOnly(full,live);
 const raw={full:JSON.stringify(full),live:JSON.stringify(live)},sources={};
 for(const key of ['full','live'])sources[key]={url:`https://api.19ib.ru/rounds/${R2_ROUND}/${key}`,sha256:hash(raw[key]),bytes:Buffer.byteLength(raw[key]),retrievedAt:observedAt};
 return {schemaVersion:1,resourceVersion:'r2-submissions-v1',kind:'round-submissions',roundId:R2_ROUND,snapshotId:sources.full.sha256+':'+sources.live.sha256,importedAt:observedAt,sources,raw};
}
export async function collectR2Submissions(config,state,{get,now=()=>new Date().toISOString(),stats={},onProgress=()=>{}}={}){
 if(config.roundId!==R2_ROUND||config.phase!==R2_PHASE)throw Error('Only pinned R2 submissions collection is enabled');
 const request=get||createClient(config,{stats,onProgress}),base='/rounds/'+R2_ROUND;
 // Retry a mismatched pair once, never fall back to R1 or individual score cards.
 let snapshot,model;
 for(let attempt=0;attempt<2;attempt++){
  const full=await request(base+'/full'),live=await request(base+'/live');
  snapshot=snapshotFromResponses(full,live,now());
  try{model=validateR2Submissions(snapshot);break;}catch(error){if(attempt)throw error;}
 }
 if(state.model.entries.length&&model.entries.length<state.model.entries.length*.9)throw Error('Incomplete R2 roster; keeping last successful submissions');
 const fingerprint=submissionFingerprint(model),changed=fingerprint!==state.metadata.dataFingerprint;
 const previous=new Map(state.model.entries.map(e=>[e.userId,e])),current=new Map(model.entries.map(e=>[e.userId,e]));
 const facts=e=>e?Object.fromEntries(['userId','slug','name','trackId','submittedAt','durationSec','hasLyrics','submissionStatus'].map(k=>[k,e[k]])):null;
 const revisions=[];
 for(const id of new Set([...previous.keys(),...current.keys()])){
  const before=facts(previous.get(id)),after=facts(current.get(id));
  if(JSON.stringify(stable(before))!==JSON.stringify(stable(after)))revisions.push({userId:id,observedAt:snapshot.importedAt,before,after});
 }
 return {changed,snapshot,model,history:{...state.history,revisions:[...state.history.revisions,...revisions]},metadata:{schemaVersion:1,roundId:R2_ROUND,phase:R2_PHASE,runId:snapshot.importedAt,lastSuccessfulAt:snapshot.importedAt,dataFingerprint:fingerprint},newRevisions:revisions.length};
}
export async function saveR2State(root,result){
 const directory=path.join(root,R2_DIRECTORY),stage=path.join(directory,'.staging');
 const files={'full.raw.json':result.snapshot.raw.full,'live.raw.json':result.snapshot.raw.live,'snapshot.json':encode(result.snapshot),'history.json':encode(result.history),'metadata.json':encode(result.metadata)};
 if(Buffer.byteLength(files['history.json'])>20*1024*1024)throw Error('R2 history exceeded limit; no history is removed automatically');
 const manifest={kind:'R2 submissions publication',roundId:R2_ROUND,phase:R2_PHASE,runId:result.snapshot.importedAt,files:Object.fromEntries(Object.entries(files).map(([name,bytes])=>[name,{sha256:hash(bytes),bytes:Buffer.byteLength(bytes)}]))};
 files['manifest.json']=encode(manifest);
 await fs.mkdir(stage,{recursive:true});
 try{
  for(const [name,bytes]of Object.entries(files))await fs.writeFile(path.join(stage,name),bytes);
  // Runner-local staging; only a complete, validated runner may commit or deploy.
  for(const name of R2_FILES)await fs.rename(path.join(stage,name),path.join(directory,name));
 }finally{await fs.rm(stage,{recursive:true,force:true});}
}
