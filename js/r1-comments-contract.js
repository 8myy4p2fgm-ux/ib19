import {contentHash,sha256} from './r1-correction.js';
import {gradeKey,CORE_R1_CONTRACT} from './r1-core-contract.js';
export function joinR1Comments(core,comments){
 if(core.coreVersion!==CORE_R1_CONTRACT||comments?.schema!=='r1-public-comments-v1'||comments.roundId!==core.metadata.source.roundId||comments.runId!==core.metadata.runId||contentHash(comments)!==core.commentsHash)throw Error('Incompatible R1 comments');
 const records=new Map();
 for(const r of comments.records){const key=gradeKey(r.participantId,r.judgeName,r.scoredAt);if(records.has(key)||typeof r.comment!=='string')throw Error('Duplicate/invalid R1 comment');records.set(key,r);}
 const snapshot=structuredClone({main:core.main,forum:core.forum,metadata:core.metadata}),used=new Set();
 for(const source of [snapshot.main,snapshot.forum])for(const section of ['members','archivedMembers','quarantinedMembers'])for(const p of source[section]||[])for(const s of p.scores){
  const key=gradeKey(p.userId,s.judgeName,s.scoredAt),r=records.get(key);
  if(!r||r.score!==s.score||(s.commentHash&&sha256(r.comment)!==s.commentHash))throw Error('R1 comment does not match grade');
  s.comment=r.comment;delete s.commentHash;used.add(key);
 }
 if(used.size!==records.size)throw Error('Unbound R1 comment');
 return snapshot;
}
