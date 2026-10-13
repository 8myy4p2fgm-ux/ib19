import {createHash} from 'node:crypto';
function stable(value){if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));return value;}
const encode=value=>JSON.stringify(stable(value));
export const stateFingerprint=state=>createHash('sha256').update(encode(Object.fromEntries(['main','forum','history','metadata'].map(k=>[k,state[k]])))).digest('hex');
function meaningful(value){
 if(Array.isArray(value))return value.map(meaningful);
 if(!value||typeof value!=='object')return value;
 return Object.fromEntries(Object.entries(value).filter(([k])=>!['exportedAt','fetchedAt'].includes(k)).map(([k,v])=>[k,meaningful(v)]));
}
export function publicationChanged(state,batch,counts,source){
 return !!state.recoveredFrom||encode(meaningful(state.main))!==encode(meaningful(batch.main))||encode(meaningful(state.forum))!==encode(meaningful(batch.forum))||encode(state.metadata.counts)!==encode(counts)||encode(state.metadata.source)!==encode(source)||encode(state.metadata.directory)!==encode(batch.forum.directory);
}
export function compatibleCheck(state,report,now=Date.now()){
 return !!report&&['collected','unchanged'].includes(report.status)&&report.dataFingerprint===stateFingerprint(state)&&Number.isFinite(Date.parse(report.lastCheckedAt))&&Date.parse(report.lastCheckedAt)<=now;
}
