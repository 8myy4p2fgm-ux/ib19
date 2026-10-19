import {unifiedAt} from '../js/calculations.js';
import {createHash} from 'node:crypto';
export const key=s=>JSON.stringify([s.userId,s.judgeName]);
export const records=main=>[...main.members,...(main.archivedMembers||[]),...(main.quarantinedMembers||[])].flatMap(p=>p.scores.map(s=>({...s,userId:p.userId})));
export function selectionVersion(main,forum){
 const participantIds=main.members.map(p=>p.userId).sort(),directory=forum.members.map(p=>({userId:p.userId,group:p.group,forum_name:p.forum_name})).sort((a,b)=>a.userId.localeCompare(b.userId));
 return {id:createHash('sha256').update(JSON.stringify([participantIds,directory])).digest('hex'),methodology:'V108 unchanged',participantIds,directory};
}
function indicesFor(main,forum){
 const active=new Set(main.members.map(p=>p.userId)),reference=forum.members.filter(p=>active.has(p.userId));
 const groups={forum:new Set(reference.filter(p=>p.group!=='Ветераны'&&!p.veteran).map(p=>p.userId)),veterans:new Set(reference.filter(p=>p.group==='Ветераны'||p.veteran===true).map(p=>p.userId))},indices={};
 for(const [name,ids]of Object.entries(groups)){const events=main.members.flatMap(p=>p.scores.map(s=>({...s,userId:p.userId,judge:s.judgeName,forum:ids.has(p.userId)}))),model=unifiedAt(events,ids.size,5,Date.parse(main.exportedAt),{otherCount:main.members.length-ids.size,historical:false});indices[name]={index:model.index,favor:model.favor,attention:Number.isFinite(model.priority)?model.priority*.25:null,respect:model.respect};}
 return indices;
}
export function updateHistory(old,next,forum,history,observedAt,{previousForum=forum}={}){
 const previous=records(old),current=records(next);const before=new Map(previous.map(s=>[key(s),s])),after=new Map(current.map(s=>[key(s),s]));
 const result=structuredClone(history||{version:1,baseline:{exportedAt:old.exportedAt,records:previous,notice:'Current snapshot, not an edit log. scoredAt is source time; initial discovery time is unknown.'},revisions:[],snapshots:[]});
 const changes=[];for(const k of new Set([...before.keys(),...after.keys()])){const a=before.get(k)||null,b=after.get(k)||null;if(JSON.stringify(a)!==JSON.stringify(b))changes.push({id:createHash('sha256').update(JSON.stringify([k,a,b])).digest('hex'),observedAt,sourceScoredAt:b?.scoredAt??null,key:k,before:a,after:b});}
 // Same transition can recur after a correction reversal, so dedup by observation + transition, not score alone.
 const known=new Set(result.revisions.map(s=>s.observedAt+'|'+s.id));for(const change of changes)if(!known.has(change.observedAt+'|'+change.id))result.revisions.push(change);
 const prior=selectionVersion(old,previousForum),selection=selectionVersion(next,forum);
 result.selectionVersions||=[];result.selectionChanges||=[];
 for(const version of [prior,selection])if(!result.selectionVersions.some(s=>s.id===version.id))result.selectionVersions.push(version);
 for(const snapshot of result.snapshots)if(!snapshot.selectionVersion)snapshot.selectionVersion=prior.id;
 const indices=indicesFor(next,forum);
 if(prior.id!==selection.id&&!result.selectionChanges.some(s=>s.observedAt===observedAt&&s.to===selection.id)){
  const previousIds=new Set(prior.participantIds),sameGradesBefore={...next,members:[...next.members,...(next.archivedMembers||[])].filter(p=>previousIds.has(p.userId))};
  result.selectionChanges.push({observedAt,from:prior.id,to:selection.id,reason:'Changed participant roster or author CSV; not a change in judging attitude',sameGradesComparison:{before:indicesFor(sameGradesBefore,previousForum),after:indices}});
 }
 if(!result.snapshots.some(s=>s.observedAt===observedAt))result.snapshots.push({observedAt,exportedAt:next.exportedAt,scores:next.members.reduce((n,p)=>n+p.scores.length,0),selectionVersion:selection.id,indices});return result;
}
