import {FIRST_ROUND_ID} from './round-context.js';
import {buildProfiles} from './judge-profile-model.js';

export const rankingColumns=Object.freeze([
 ['rank','Место'],['tuz','Итоговый ТУЗ'],['scorePoints','Благосклонность'],
 ['speedPoints','Внимание'],['respectPoints','Уважение'],['activity','Активность'],
 ['forum','Оценок группе'],['other','Оценок остальным']
].map(([key,label])=>Object.freeze({key,label})));
const compareNames=(a,b)=>a.judge.localeCompare(b.judge,'ru');
export function sortRanking(rows,key='tuz',direction=-1){
 if(!rankingColumns.some(c=>c.key===key)||![1,-1].includes(direction))throw new Error('Invalid ranking sort');
 return [...rows].sort((a,b)=>{
  const x=a[key],y=b[key],xf=Number.isFinite(x),yf=Number.isFinite(y);
  return xf&&yf?(x-y)*direction||compareNames(a,b):xf?-1:yf?1:compareNames(a,b);
 });
}
export function podiumRows(rows,mode='diamond'){
 return sortRanking(rows.filter(r=>Number.isFinite(r.tuz)),'tuz',mode==='rust'?1:-1).slice(0,3);
}
export function formatRankingNumber(value,{signed=true,integer=false}={}){
 if(!Number.isFinite(value))return '—';
 const sign=value>0&&signed?'+':value<0?'−':'';
 if(value!==0&&Math.abs(value)<.005)return sign+'<0,005';
 return sign+Math.abs(value).toLocaleString('ru-RU',{minimumFractionDigits:integer?0:2,maximumFractionDigits:integer?0:2});
}
export function createRankingModel(context){
 const data=context.data;
 if(context.roundId!==FIRST_ROUND_ID||data.updated!==context.exportedAt||data.snapshotMetadata?.runId!==context.runId)throw new Error('Unsupported ranking snapshot');
 const groups=new Map(['forum','veterans'].map(group=>[group,context.analytics.rankJudges({group})]));
 const veterans=[...data.metadata.values()].filter(p=>p.group==='Ветераны'||p.veteran===true).length;
 const sizes=new Map([['forum',data.metadata.size-veterans],['veterans',veterans]]);
 if(context.analytics.participantOutcome)data.participantOutcomes=new Map([...data.byId.keys()].map(id=>[id,context.analytics.participantOutcome(id)]));
 const profiles=buildProfiles(data);
 return Object.freeze({
  snapshotKey:context.snapshotKey,exportedAt:context.exportedAt,
  rows(group){if(!groups.has(group))throw new Error('Unsupported ranking group');return [...groups.get(group)];},
  groupSize(group){if(!sizes.has(group))throw new Error('Unsupported ranking group');return sizes.get(group);},
  profile(key){return profiles.get(key)??null;},
  profileKey(name){return data.judgeIdentities.get(name)??null;},
  metric(key,group){return this.rows(group).filter(r=>this.profileKey(r.judge)===key);}
 });
}
