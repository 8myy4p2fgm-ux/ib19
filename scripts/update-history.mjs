import {unifiedAt} from '../js/calculations.js';
import {createHash} from 'node:crypto';
export const key=s=>JSON.stringify([s.userId,s.judgeName]);
export const records=main=>main.members.flatMap(p=>p.scores.map(s=>({...s,userId:p.userId})));
export function updateHistory(old,next,forum,history,observedAt){
 const previous=records(old),current=records(next);const before=new Map(previous.map(s=>[key(s),s])),after=new Map(current.map(s=>[key(s),s]));
 const result=structuredClone(history||{version:1,baseline:{exportedAt:old.exportedAt,records:previous,notice:'Current snapshot, not an edit log. scoredAt is source time; initial discovery time is unknown.'},revisions:[],snapshots:[]});
 const changes=[];for(const k of new Set([...before.keys(),...after.keys()])){const a=before.get(k)||null,b=after.get(k)||null;if(JSON.stringify(a)!==JSON.stringify(b))changes.push({id:createHash('sha256').update(JSON.stringify([k,a,b])).digest('hex'),observedAt,sourceScoredAt:b?.scoredAt??null,key:k,before:a,after:b});}
 // Same transition can recur after a correction reversal, so dedup by observation + transition, not score alone.
 const known=new Set(result.revisions.map(s=>s.observedAt+'|'+s.id));for(const change of changes)if(!known.has(change.observedAt+'|'+change.id))result.revisions.push(change);
 const groups={forum:new Set(forum.members.filter(p=>p.group!=='Ветераны'&&!p.veteran).map(p=>p.userId)),veterans:new Set(forum.members.filter(p=>p.group==='Ветераны'||p.veteran===true).map(p=>p.userId))},indices={};
 for(const [name,ids]of Object.entries(groups)){const events=current.map(s=>({...s,judge:s.judgeName,forum:ids.has(s.userId)})),model=unifiedAt(events,ids.size,5,Date.parse(next.exportedAt),{otherCount:next.members.length-ids.size,historical:false});indices[name]={index:model.index,favor:model.favor,attention:Number.isFinite(model.priority)?model.priority*.25:null,respect:model.respect};}
 if(!result.snapshots.some(s=>s.observedAt===observedAt))result.snapshots.push({observedAt,exportedAt:next.exportedAt,scores:current.length,indices});return result;
}
