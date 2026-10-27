// Exact UUIDs only. Set enabled:false after the source has returned to five scores.
// Keeping the rule documents and validates already quarantined raw snapshots.
export const temporaryExclusionRules = Object.freeze([Object.freeze({
 userId:'52385ac3-2e09-4df9-a04c-ca4348cf42d6',
 enabled:true,
 reason:'Temporary exclusion: API 19ib.ru returns six scores while the first round requires five.',
 since:'2026-10-19'
})]);

export function partitionAnalytics(main,forum,{exclusionRules=temporaryExclusionRules,deferredComments=false}={}){
 const known=new Map(exclusionRules.map(rule=>[rule.userId,rule]));
 const active=new Set(exclusionRules.filter(rule=>rule.enabled).map(rule=>rule.userId));
 function partition(data,primary){
  // Leave malformed input to the existing schema validator.
  if(!Array.isArray(data.members))return data;
  if(primary&&data.totalParticipants!==undefined&&data.totalParticipants!==data.members.length)throw new Error('totalParticipants не совпадает с members');
  const saved=data.quarantinedMembers||[];
  if(!Array.isArray(saved)||saved.some(p=>!known.has(p.userId)))throw new Error('Unknown participant in temporary quarantine');
  const sections=[data.members,...(primary&&Array.isArray(data.archivedMembers)?[data.archivedMembers]:[]),saved];
  const ids=new Set();for(const rows of sections)for(const p of rows){if(ids.has(p.userId))throw new Error('Duplicate participant across source/quarantine: '+p.userId);ids.add(p.userId);}
  const members=data.members.filter(p=>!active.has(p.userId));
  const archived=primary&&Array.isArray(data.archivedMembers)?data.archivedMembers.filter(p=>!active.has(p.userId)):data.archivedMembers;
  const quarantinedMembers=[...saved,...data.members.filter(p=>active.has(p.userId)),...(primary&&Array.isArray(data.archivedMembers)?data.archivedMembers.filter(p=>active.has(p.userId)):[])];
  if(members.length===data.members.length&&(!Array.isArray(archived)||archived.length===data.archivedMembers.length))return data;
  return {...data,members,quarantinedMembers,...(primary?{totalParticipants:members.length,...(archived!==undefined?{archivedMembers:archived}:{})}:{})};
 }
 const selectedMain=partition(main,true),selectedForum=partition(forum,false);
 // Quarantine is raw storage, never an input to the five-slot analytics validator.
 // Validate its data quality independently; the existing analytics limit is unchanged.
 const rawRecords=new Map([...selectedMain.members,...(selectedMain.archivedMembers||[]),...(selectedMain.quarantinedMembers||[])].map(p=>[p.userId,p]));
 for(const [dataset,label]of [[selectedMain,'Карантин'],[selectedForum,'Карантин форума']])for(const p of dataset.quarantinedMembers||[]){
  if(!Array.isArray(p.scores)||(p.scoredCount!==undefined&&p.scoredCount!==p.scores.length))throw new Error(label+': inconsistent raw scoredCount '+p.userId);
  const judges=new Set();
  for(const s of p.scores){
   if(typeof s.judgeName!=='string'||!s.judgeName.trim()||judges.has(s.judgeName)||!Number.isInteger(s.score)||s.score<1||s.score>5||!(typeof s.comment==='string'||(deferredComments&&/^[a-f0-9]{64}$/.test(s.commentHash)))||!Number.isFinite(Date.parse(s.scoredAt)))throw new Error(label+': invalid raw score '+p.userId);
   if(Date.parse(s.scoredAt)>Date.parse(selectedMain.exportedAt))throw new Error(label+': оценка позже exportedAt '+p.userId);
   judges.add(s.judgeName);
  }
  if(dataset===selectedForum){
   const m=rawRecords.get(p.userId);
   if(!m&&!(p.current===false&&p.scores.length===0))throw new Error(label+': missing original raw participant '+p.userId);
   for(const s of p.scores){const original=m?.scores.find(x=>x.judgeName===s.judgeName);if(!original||original.score!==s.score||original.scoredAt!==s.scoredAt)throw new Error('Несогласованные оценки источников: '+p.userId+' / '+s.judgeName);}
  }
 }
 const excluded=(selectedMain.quarantinedMembers||[]).map(p=>({userId:p.userId,reason:known.get(p.userId).reason,scoredCount:p.scores.length}));
 return {main:selectedMain,forum:selectedForum,excluded};
}
