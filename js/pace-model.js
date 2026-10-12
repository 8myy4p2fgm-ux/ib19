import {DAY} from './config.js';
const OFFSET=3*3600000;
export function moscowDay(t){return Math.floor((t+OFFSET)/DAY)*DAY-OFFSET;}
export function paceModel({events,participants,scoresPerParticipant,asOf,deadline,historyComplete=true}){
 const target=participants*scoresPerParticipant;
 const byKey=new Map();let invalid=0;
 for(const e of events){
  const t=Number.isFinite(e.t)?e.t:Date.parse(e.scoredAt),judge=e.judge||e.judgeName;
  if(!e.userId||!judge||!Number.isFinite(t)){invalid++;continue;}if(t>asOf)continue;
  const key=JSON.stringify([e.userId,judge]),old=byKey.get(key);
  if(!old||t>old.t)byKey.set(key,{...e,t,judge});
 }
 const perPerson=new Map();
 const unique=[...byKey.values()].sort((a,b)=>a.t-b.t).filter(e=>{const n=perPerson.get(e.userId)||0;if(n>=scoresPerParticipant)return false;perPerson.set(e.userId,n+1);return true;});
 const done=unique.length,remaining=Math.max(0,target-done),first=unique[0]?.t??null,today=moscowDay(asOf),windowStart=today-7*DAY;
 const days=[];let cumulative=0;
 if(first!==null)for(let d=moscowDay(first);d<=today;d+=DAY){const count=unique.filter(e=>e.t>=d&&e.t<d+DAY).length;cumulative+=count;days.push({t:d,count,cumulative,partial:d===today});}
 const recent=unique.filter(e=>e.t>=windowStart&&e.t<today).length,rate=recent/7;
 const previousStart=windowStart-7*DAY;const previous=unique.filter(e=>e.t>=previousStart&&e.t<windowStart).length;const previousEnough=historyComplete&&invalid===0&&first!==null&&first<=previousStart;
 const enough=historyComplete&&invalid===0&&first!==null&&first<=windowStart;
 const limit=deadline?Date.parse(deadline):NaN,deadlineTime=Number.isFinite(limit)?limit:null;
 const daysLeft=deadlineTime===null?null:Math.max(0,(deadlineTime-asOf)/DAY),fullDays=daysLeft===null?null:Math.floor(daysLeft);
 const needRate=remaining===0?0:daysLeft>0?remaining/daysLeft:null;
 const completion=remaining===0?(unique.at(-1)?.t??asOf):null;
 const projected=remaining===0?null:enough&&rate>0?asOf+remaining/rate*DAY:null;
 const judgeCount=new Set(unique.map(e=>e.judge)).size;
 const ratio=remaining>0&&needRate!==null&&enough&&rate>0?needRate/rate:null;
 const requiredJudges=ratio!==null&&ratio>1?Math.ceil(judgeCount*ratio):null;
 const verdict=remaining===0?(deadlineTime===null?'Пока непонятно':completion<=deadlineTime?'Успевают':'Не успевают'):deadlineTime!==null&&deadlineTime<=asOf?'Не успевают':projected!==null&&deadlineTime!==null?(projected<=deadlineTime?'Успевают':'Не успевают'):'Пока непонятно';
 return {asOf,target,done,remaining,first,days,unique,recent,rate,previous,previousEnough,enough,windowStart,windowEnd:today,deadline:deadlineTime,daysLeft,fullDays,needRate,ratio,judgeCount,requiredJudges,projected,completion,verdict,invalid,historyComplete};
}
export function pacePlotRange(m){
 const start=moscowDay(m.first??m.asOf),cap=m.asOf+90*DAY;
 const horizon=Math.max(m.deadline??m.asOf,m.projected??m.asOf);
 const end=Math.max(m.asOf+DAY,Math.min(cap,horizon+(m.projected!==null?7*DAY:0)));
 return {start,end,forecastEnd:m.projected!==null?Math.min(m.projected,end):null,truncated:m.projected!==null&&m.projected>end,deadlineHidden:m.deadline!==null&&m.deadline>end};
}

