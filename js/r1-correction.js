import {FIXED_R1_CONTRACT,fixedR1Contract} from './r1-fixed-contract.js';
// Synchronous SHA-256 keeps the existing synchronous official-view contract.
// Text is encoded exactly as UTF-8; comments are never trimmed or normalized.
export function sha256(text){
 const bytes=new TextEncoder().encode(text),size=Math.ceil((bytes.length+9)/64)*64,buffer=new Uint8Array(size);buffer.set(bytes);buffer[bytes.length]=128;
 const view=new DataView(buffer.buffer);view.setUint32(size-4,bytes.length*8>>>0);view.setUint32(size-8,Math.floor(bytes.length/0x20000000));
 const primes=[],roots=[];for(let n=2;primes.length<64;n++){if(primes.every(p=>n%p)){primes.push(n);roots.push((Math.cbrt(n)%1*2**32)>>>0);}}
 const h=primes.slice(0,8).map(p=>(Math.sqrt(p)%1*2**32)>>>0),w=new Uint32Array(64),rotr=(x,n)=>(x>>>n)|(x<<(32-n));
 for(let offset=0;offset<size;offset+=64){
  for(let i=0;i<16;i++)w[i]=view.getUint32(offset+i*4);
  for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2];w[i]=(w[i-16]+(rotr(a,7)^rotr(a,18)^(a>>>3))+w[i-7]+(rotr(b,17)^rotr(b,19)^(b>>>10)))>>>0;}
  let [a,b,c,d,e,f,g,k]=h;
  for(let i=0;i<64;i++){const t=(k+(rotr(e,6)^rotr(e,11)^rotr(e,25))+((e&f)^(~e&g))+roots[i]+w[i])>>>0,u=((rotr(a,2)^rotr(a,13)^rotr(a,22))+((a&b)^(a&c)^(b&c)))>>>0;k=g;g=f;f=e;e=(d+t)>>>0;d=c;c=b;b=a;a=(t+u)>>>0;}
  [a,b,c,d,e,f,g,k].forEach((v,i)=>h[i]=(h[i]+v)>>>0);
 }
 return h.map(v=>v.toString(16).padStart(8,'0')).join('');
}
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
export const contentHash=value=>sha256(JSON.stringify(stable(value)));
export const scoreFingerprint=score=>sha256(JSON.stringify([score.judgeName,score.score,score.scoredAt,sha256(score.comment)]));
export const eventFingerprint=(roundId,participantId,judgeId,score)=>sha256(JSON.stringify([roundId,participantId,judgeId,score.scoredAt,score.score,sha256(score.comment)]));

// Rule and source approvals are trusted code registry entries, never API fields.
export function correctOfficialScores(snapshot,person,data,rule,{sourceContract='full'}={}){
 const fail=why=>{throw new Error('Official correction requires review: '+why);};
 const state=rule.sourceStates.find(s=>s.runId===snapshot.metadata.runId);
 if(!state)fail('unapproved source run');
 let keys=['main','forum','metadata','history'];
 if(sourceContract===FIXED_R1_CONTRACT){
  const fixed=fixedR1Contract(snapshot,{roundId:rule.roundId,version:rule.policyVersion});
  keys=Object.keys(fixed.coreHashes);
  for(const key of keys)if(state.contentHashes[key]!==fixed.coreHashes[key])fail('fixed source registry mismatch: '+key);
 }else if(sourceContract!=='full')fail('unknown source contract');
 for(const key of keys)if(contentHash(snapshot[key])!==state.contentHashes[key])fail('source content mismatch: '+key);
 const identity=rule.cancelledEvent;
 if(rule.roundId!==identity.roundId||person.userId!==identity.participantId)fail('event round/participant');
 if(data.judgeIdentities.get(identity.judgeName)!==identity.judgeId||data.judges.filter(j=>j.userId===identity.judgeId&&j.name===identity.judgeName).length!==1)fail('judge identity');
 for(const s of person.scores)if(!data.judgeIdentities.has(s.judgeName))fail('unknown judge');
 const matches=person.scores.filter(s=>eventFingerprint(rule.roundId,person.userId,data.judgeIdentities.get(s.judgeName),s)===identity.fingerprint);
 if(matches.length!==(state.mode==='A'?1:0))fail('target cardinality');
 if(!['A','B'].includes(state.mode))fail('source mode');
 const valid=person.scores.filter(s=>!matches.includes(s));
 if(person.scores.length!==state.rawScoreCount||person.scoredCount!==state.rawScoreCount||valid.length!==rule.validScoreCount)fail('score count');
 const fingerprints=valid.map(scoreFingerprint).sort();
 if(JSON.stringify(fingerprints)!==JSON.stringify([...rule.survivorFingerprints].sort()))fail('survivor fingerprints');
 for(const expected of rule.survivorIdentities)if(data.judgeIdentities.get(expected.judgeName)!==expected.judgeId)fail('survivor judge identity');
 const original=matches[0]??rule.archivedCancelledScore;
 if(eventFingerprint(rule.roundId,person.userId,identity.judgeId,original)!==identity.fingerprint)fail('archived event identity');
 return {valid,sourceState:state.mode,audit:{...structuredClone(original),userId:person.userId,judgeId:identity.judgeId,roundId:rule.roundId,fingerprint:identity.fingerprint,policyVersion:rule.policyVersion,basis:rule.basis,officialDecisionAt:null,annulmentDecisionAt:null,sourcePresent:state.mode==='A',sourceSnapshot:{roundId:rule.roundId,runId:snapshot.metadata.runId,exportedAt:snapshot.metadata.exportedAt,selectionVersion:snapshot.metadata.selectionVersion},archiveSource:rule.archiveSource,label:state.mode==='A'?'Аннулирована по информации об официальном решении. Из исходного API пока не удалена':'Аннулирована по информации об официальном решении. Отсутствует в отдельно проверенном снимке; исходное событие сохранено в архиве'}};
}
