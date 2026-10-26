import {buildProfiles} from './judge-profile-model.js';

// The context is already round-bound and excludes annulled scores. Include
// archived participants exactly as the existing judge profiles do.
export function fastestSeriesForContext(context,windowSize=15){
 const events=[];
 for(const profile of buildProfiles(context.data).values())for(const score of profile.rows){
  events.push({roundId:context.roundId,judgeId:profile.key,judgeName:profile.name,userId:score.userId,scoredAt:score.scoredAt});
 }
 return fastestSeries(events,context.roundId,windowSize);
}
export function fastestSeries(events,roundId,windowSize=15){
 if(!Number.isInteger(windowSize)||windowSize<2)throw new RangeError('Invalid series size');
 if(typeof roundId!=='string'||!roundId)return [];
 const groups=new Map();
 for(const event of events){
  if(event.roundId!==roundId||event.annulled===true||!event.judgeId||typeof event.scoredAt!=='string'||!event.scoredAt.trim())continue;
  const time=Date.parse(event.scoredAt);if(!Number.isFinite(time))continue;
  if(!groups.has(event.judgeId))groups.set(event.judgeId,[]);
  groups.get(event.judgeId).push({...event,time});
 }
 const rows=[];
 for(const [judgeId,scores]of groups){
  scores.sort((a,b)=>a.time-b.time||String(a.userId).localeCompare(String(b.userId),'en'));
  if(scores.length<windowSize)continue;
  let start=0,duration=Infinity;
  for(let i=0;i<=scores.length-windowSize;i++){
   const elapsed=scores[i+windowSize-1].time-scores[i].time;
   if(elapsed<duration){start=i;duration=elapsed;}
  }
  rows.push({judgeId,judgeName:scores[0].judgeName,roundId,intervalMs:duration/(windowSize-1),durationMs:duration,start:scores[start].scoredAt,end:scores[start+windowSize-1].scoredAt,count:scores.length,series:scores.slice(start,start+windowSize)});
 }
 return rows.sort((a,b)=>a.durationMs-b.durationMs||(a.judgeId<b.judgeId?-1:a.judgeId>b.judgeId?1:0));
}
export function formatFastestInterval(ms){
 if(!Number.isFinite(ms)||ms<0)return '—';
 const seconds=ms/1000;
 if(seconds<60)return (seconds>0&&seconds<.05?'<0,1':seconds.toLocaleString('ru-RU',{maximumFractionDigits:1}))+' сек.';
 const rounded=Math.round(seconds);return Math.floor(rounded/60)+' мин '+rounded%60+' сек.';
}
