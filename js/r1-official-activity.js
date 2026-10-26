import {DAY,config} from './config.js';
import {moscowDay,paceModel} from './pace-model.js';

// Input is the adapter's validated, unique event stream. Slot forecasts and
// actual activity are explicitly separate: the latter never caps valid scores.
export function officialR1Activity({events,members,asOf,deadline,now=asOf,sourceObservedEvents,annulledEvents}){
 if(!Number.isFinite(asOf)||!Number.isFinite(now))throw new Error('Invalid activity time');
 const actualEvents=events.filter(e=>e.t<=asOf).map(e=>({...e}));
 const slots=paceModel({events:actualEvents,participants:members.length,scoresPerParticipant:config.scoresPerParticipant,asOf,deadline,now});
 const today=moscowDay(asOf),windowStart=today-7*DAY,days=[],judges=new Map(),counts=new Map();
 for(const event of actualEvents){
  judges.set(event.judge,(judges.get(event.judge)||0)+1);
  counts.set(event.userId,(counts.get(event.userId)||0)+1);
 }
 let cumulative=0;
 const first=actualEvents[0]?.t;
 if(first!==undefined)for(let day=moscowDay(first);day<=today;day+=DAY){
  const count=actualEvents.filter(e=>e.t>=day&&e.t<day+DAY).length;cumulative+=count;
  days.push({t:day,count,cumulative,partial:day===today});
 }
 const credited=[...counts.values()].reduce((n,count)=>n+Math.min(count,config.scoresPerParticipant),0);
 const additional=[...counts.values()].reduce((n,count)=>n+Math.max(0,count-config.scoresPerParticipant),0);
 const recent=actualEvents.filter(e=>e.t>=windowStart&&e.t<today).length;
 const factual={events:actualEvents,count:actualEvents.length,days,judges,recent,rate:recent/7,windowStart,windowEnd:today};
 const source=sourceObservedEvents?.filter(e=>e.t<=asOf);
 const cancelled=annulledEvents?.filter(e=>Date.parse(e.scoredAt)<=asOf);
 return {
  ...(source?{sourceObserved:{events:source,count:source.length},valid:factual,annulled:{events:cancelled,count:cancelled.length,sourcePresentCount:cancelled.filter(e=>e.sourcePresent).length}}:{}),
  slots,
  factual,
  accounting:{standardSlots:members.length*config.scoresPerParticipant,creditedStandardSlots:credited,actualValidScores:actualEvents.length,additionalValidScores:additional,remainingStandardSlots:slots.remaining,standardCompletionPercent:slots.target?credited/slots.target*100:0},
  officialRoundCompletionConfirmed:false
 };
}
