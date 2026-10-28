import {validateR1TrackSubmissions} from '../js/music-model.js';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createOfficialR1View} from '../js/r1-official-view.js';
import {FIXED_R1_CONTRACT} from '../js/r1-fixed-contract.js';
import {publicR1Contract} from '../js/r1-public-contract.js';
import {CORE_R1_CONTRACT,coreR1Contract} from '../js/r1-core-contract.js';
import {joinR1Comments} from '../js/r1-comments-contract.js';
import {sha256,contentHash} from '../js/r1-correction.js';
export const SOURCE_DIRECTORY=new URL('../docs/data-candidates/r1-2026-10-22-194208/',import.meta.url);
const pick=(value,keys)=>Object.fromEntries(keys.filter(k=>Object.hasOwn(value,k)).map(k=>[k,structuredClone(value[k])]));
export async function readPrivateR1(){return Object.fromEntries(await Promise.all(Object.entries({main:'19ib_all_judges_REPAIRED.json',forum:'forum_judges_export.json',metadata:'metadata.json'}).map(async([k,f])=>[k,JSON.parse(await fs.readFile(new URL(f,SOURCE_DIRECTORY),'utf8'))])));}
export function projectR1(source){
 // Validate the immutable source with its existing contract before deriving public bytes.
 createOfficialR1View(source,{policyVersion:'r1-official-zippy-v2',sourceContract:FIXED_R1_CONTRACT});
 const grade=s=>pick(s,['judgeName','score','scoredAt','comment']);
 const person=p=>({...pick(p,['userId','artistName','artistSlug','trackId','scoredCount','current','fetchedAt','sourceAbsentSince']),scores:p.scores.map(grade)});
 const main={...pick(source.main,['version','exportedAt','totalParticipants','judgeIdentities']),judges:source.main.judges.map(j=>pick(j,['userId','name','avatarUrl','bio']))};
 for(const key of ['members','archivedMembers','quarantinedMembers'])main[key]=(source.main[key]||[]).map(person);
 const member=p=>({...pick(p,['userId','group','veteran','current']),scores:(p.scores||[]).map(grade)});
 const forum={publicSchema:'r1-public-v1',exportedAt:source.forum.exportedAt,members:source.forum.members.map(member),quarantinedMembers:(source.forum.quarantinedMembers||[]).map(member)};
 const metadata=pick(source.metadata,['version','lastSuccessfulAt','exportedAt','runId','forumExportedAt','selectionVersion','counts']);
 metadata.source=pick(source.metadata.source,['apiBase','roundId','absentIds']);
 metadata.source.round=pick(source.metadata.source.round,['id','tournamentId','name','slug','topic','coverUrl','roundOrder','type','status','deadline','judgingDeadline','startedAt','judgesRequired','resultsPublished','maxParticipants','scoreScale','passThreshold','advanceCount','minDurationSec','maxDurationSec','judgingStartedAt','judgingStartsAt','createdAt','updatedAt','tournamentStatus','champion','maxScore','rubrics']);
 return {main,forum,metadata};
}
export function projectGroups(raw){return {members:raw.members.map(p=>pick(p,['userId','group','veteran','current']))};}
// Standard builds consume only the committed, immutable public projection.
// Private projection helpers above remain available for explicit archive checks.
export async function readPublicR1(){
 const root=new URL('../public-data/',import.meta.url),manifest=JSON.parse(await fs.readFile(new URL('manifest.json',root),'utf8'));
 const files=['r1/19ib_all_judges_REPAIRED.json','r1/forum_judges_export.json','r1/metadata.json','groups.json','r1/submissions.v1.json'];
 if(Object.keys(manifest).sort().join('|')!==[...files].sort().join('|'))throw Error('Unexpected public source manifest');
 const bytes=new Map();
 for(const file of files){const raw=await fs.readFile(new URL(file,root));if(createHash('sha256').update(raw).digest('hex')!==manifest[file])throw Error('Public source checksum mismatch: '+file);bytes.set(file,raw);}
 const snapshot=Object.fromEntries(['main','forum','metadata'].map((key,i)=>[key,JSON.parse(bytes.get(files[i]))]));
 publicR1Contract(snapshot,{roundId:snapshot.metadata.source.roundId,version:'r1-official-zippy-v2'},contentHash);
 const groups=JSON.parse(bytes.get('groups.json'));
 if(JSON.stringify(projectGroups(groups))!==JSON.stringify(groups))throw Error('Unexpected public group fields');
 validateR1TrackSubmissions(JSON.parse(bytes.get('r1/submissions.v1.json')),snapshot.metadata.source.roundId);
 return {snapshot,bytes};
}
export async function writePublicData(destination){
 const {snapshot,bytes}=await readPublicR1();await fs.mkdir(destination+'/r1',{recursive:true});
 for(const [file,raw]of bytes)await fs.writeFile(destination+'/'+file,raw);
 return Object.fromEntries(Object.entries(snapshot).map(([key,value])=>[key,contentHash(value)]));
}

// One lossless transport projection, derived only from the verified public bytes.
// No collector or private archive access is involved in ordinary builds.
export function splitPublicR1(snapshot){
 const core=structuredClone(snapshot),records=new Map();
 for(const source of [core.main,core.forum])for(const section of ['members','archivedMembers','quarantinedMembers'])for(const p of source[section]||[])for(const s of p.scores){
  const key=JSON.stringify([p.userId,s.judgeName,s.scoredAt]);
  const record={participantId:p.userId,judgeName:s.judgeName,scoredAt:s.scoredAt,score:s.score,comment:s.comment};
  if(records.has(key)&&JSON.stringify(records.get(key))!==JSON.stringify(record))throw Error('Conflicting public comment identity');
  records.set(key,record);if(section==='quarantinedMembers')s.commentHash=sha256(s.comment);delete s.comment;
 }
 const comments={schema:'r1-public-comments-v1',roundId:snapshot.metadata.source.roundId,runId:snapshot.metadata.runId,records:[...records.values()]};
 Object.assign(core,{coreVersion:CORE_R1_CONTRACT,commentsHash:contentHash(comments)});
 return {core,comments};
}
export async function writeSplitPublicData(destination){
 const {snapshot,bytes}=await readPublicR1(),split=splitPublicR1(snapshot);
 coreR1Contract(split.core,{roundId:snapshot.metadata.source.roundId,version:'r1-official-zippy-v2'},contentHash);
 // Prove the projection is reversible before publishing either part.
 const restored=joinR1Comments(split.core,split.comments);
 for(const key of ['main','forum','metadata'])if(contentHash(restored[key])!==contentHash(snapshot[key]))throw Error('Split projection changed public source: '+key);
 await fs.mkdir(destination+'/r1',{recursive:true});
 for(const [key,value]of Object.entries(split))await fs.writeFile(destination+'/r1/'+key+'.json',JSON.stringify(value));
 await fs.writeFile(destination+'/groups.json',bytes.get('groups.json'));
 // Exact, already approved public v1 bytes for clients with cached old JS.
 // They are not requested by the versioned Core frontend and are never regenerated.
 for(const [file,raw]of bytes)if(file.startsWith('r1/'))await fs.writeFile(destination+'/'+file,raw);
}
