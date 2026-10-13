import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {validateSavedSnapshot} from './collector.mjs';
import {validateData} from './validate-data.mjs';
export const stateFiles=['19ib_all_judges_REPAIRED.json','forum_judges_export.json','history.json','metadata.json'];
export function validateState({main,forum,history,metadata}) {
 validateSavedSnapshot(main);validateData(main,forum);
 if(main.exportedAt!==forum.exportedAt||main.exportedAt!==metadata.lastSuccessfulAt||!Array.isArray(history.revisions)||!Array.isArray(history.snapshots)||history.snapshots.at(-1)?.observedAt!==main.exportedAt)throw new Error('Inconsistent saved state');
}
export async function loadState({read=file=>fs.readFile('data/'+file,'utf8'),revisions=()=>execFileSync('git',['log','-20','--format=%H','--','data'],{encoding:'utf8'}).trim().split('\n'),show=(revision,file)=>execFileSync('git',['show',revision+':data/'+file],{encoding:'utf8',maxBuffer:64*1024*1024,stdio:['ignore','pipe','ignore']})}={}) {
 const decode=texts=>{const [main,forum,history,metadata]=texts.map(t=>JSON.parse(t));const state={main,forum,history,metadata};validateState(state);return state;};
 try{return decode(await Promise.all(stateFiles.map(read)));}catch(error){
  for(const revision of revisions())try{return {...decode(stateFiles.map(f=>show(revision,f))),recoveredFrom:revision};}catch{}
  throw new Error('No coherent saved state: restore validated data from Git before collecting. '+error.message);
 }
}
export function collectionMode(metadata,{requested='auto',now=Date.now()}={}) {
 if(!['auto','incremental','full'].includes(requested))throw new Error('Unknown collection mode');
 // Legacy metadata describes a complete collection. Carry this date forward once;
 // never reset the audit clock on incremental runs.
 const lastFullAuditAt=metadata.collection?.lastFullAuditAt||metadata.lastSuccessfulAt;
 const full=requested==='full'||(requested==='auto'&&(!Number.isFinite(Date.parse(lastFullAuditAt))||now-Date.parse(lastFullAuditAt)>=7*86400000));
 return {mode:full?'full':'incremental',lastFullAuditAt};
}
