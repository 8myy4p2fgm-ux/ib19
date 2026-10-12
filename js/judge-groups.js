// Events are produced only after normalizeData validates IDs and source agreement.
export function judgeGroups(events,veteranIds){
 const judges=new Map();
 for(const s of events){
  if(!judges.has(s.judge))judges.set(s.judge,{name:s.judge,count:0,sum:0,forum:{count:0,sum:0},veteran:{count:0,sum:0},other:{count:0,sum:0}});
  const r=judges.get(s.judge),key=s.forum?'forum':veteranIds.has(s.userId)?'veteran':'other',g=r[key];
  r.count++;r.sum+=s.score;g.count++;g.sum+=s.score;
 }
 return [...judges.values()].map(r=>({...r,mean:r.sum/r.count,...Object.fromEntries(['forum','veteran','other'].map(k=>[k,{...r[k],mean:r[k].count?r[k].sum/r[k].count:null}]))})).sort((a,b)=>a.mean-b.mean||a.name.localeCompare(b.name,'ru'));
}

