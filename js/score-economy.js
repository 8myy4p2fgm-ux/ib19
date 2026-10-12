import {participantStatus} from './general.js';
export function scoreEconomy(members){
 let pastPass=0,pastFail=0,future=0,ambiguous=0;
 for(const p of members){
  const scores=p.scores||[],current=participantStatus(scores);
  if(current.count>0&&current.remaining>0&&current.status!=='pending')future+=current.remaining;
  const dated=scores.map(s=>({...s,t:Date.parse(s.scoredAt)}));
  if(dated.some(s=>!Number.isFinite(s.t))||new Set(dated.map(s=>s.t)).size!==dated.length){ambiguous++;continue;}
  dated.sort((a,b)=>a.t-b.t);let decided=null;const prefix=[];
  for(const s of dated){
   if(decided==='pass')pastPass++;
   else if(decided==='fail')pastFail++;
   prefix.push(s);
   if(decided===null){const status=participantStatus(prefix).status;if(status!=='pending')decided=status;}
  }
 }
 const past=pastPass+pastFail;
 return {past,pastPass,pastFail,future,total:past+future,ambiguous};
}

