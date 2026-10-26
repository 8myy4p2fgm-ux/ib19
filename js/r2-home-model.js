import {selectR2Submissions} from './r2-submissions.js';
// Submission projections; the optional cohort contains existing approved R1 pass statuses.
// No score recalculation, name matching or R2 advancement rules.
export function r2HomeData(info,reference=null){
 const entries=[...new Map(selectR2Submissions(info.entries).map(e=>[e.userId,e])).values()];
 const days=new Map();
 for(const e of entries){if(!e.submittedAt)continue;const day=new Date(Date.parse(e.submittedAt)+3*3600000).toISOString().slice(0,10);days.set(day,(days.get(day)||0)+1);}
 const groups={forum:{submitted:reference?0:null,admitted:null},veterans:{submitted:reference?0:null,admitted:null},other:{submitted:null,admitted:null}};
 let unclassified=0;
 for(const entry of entries){const group=reference?.get(entry.userId);if(group==='forum'||group==='veterans'){groups[group].submitted++;}else if(group==='other'){groups.other.submitted=(groups.other.submitted??0)+1;}else unclassified++;}
 const cohort=reference?.cohort;
 if(cohort){
  for(const g of Object.values(groups)){g.admitted=0;g.submitted=0;}
  for(const id of cohort){const group=reference.get(id);if(groups[group])groups[group].admitted++;}
  for(const entry of entries){const group=reference.get(entry.userId);if(cohort.has(entry.userId)&&groups[group])groups[group].submitted++;}
 }
 const admittedSubmitted=cohort?entries.filter(e=>cohort.has(e.userId)).length:null;
 return {submitted:entries.length,cohortCount:cohort?.size??null,admittedSubmitted,outsideCohort:cohort?entries.length-admittedSubmitted:null,waiting:cohort?cohort.size-admittedSubmitted:null,deadline:info.times.deadline,groups,unclassified,days:[...days].sort(([a],[b])=>a.localeCompare(b)).map(([day,count])=>({day,count}))};
}
export function r2GroupReference(value){
 if(!Array.isArray(value?.members))throw Error('Не найден справочник групп');
 const result=new Map();
 for(const member of value.members){if(typeof member.userId!=='string'||result.has(member.userId))throw Error('Неоднозначный UUID справочника');const group=member.group==='Ветераны'||member.veteran===true?'veterans':member.group==='Остальные'?'other':['OG','Форум'].includes(member.group)?'forum':null;result.set(member.userId,group);}
 return result;
}

// Project existing approved statuses; never derive a new threshold or methodology.
export function r2CohortReference(context){
 const data=context.data,reference=r2GroupReference({members:[...data.metadata.values()]});
 reference.cohort=new Set();
 for(const id of data.byId.keys()){
  if(!reference.has(id))reference.set(id,'other');
  if(context.analytics.participantOutcome(id).status==='pass')reference.cohort.add(id);
 }
 return reference;
}
