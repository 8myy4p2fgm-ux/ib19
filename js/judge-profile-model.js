// Local research prototype only. Source snapshots remain unchanged.
export function buildProfiles(D){
 const catalog=D.judges;
 const profiles=new Map();
 for(const j of catalog)profiles.set(j.userId,{...j,key:j.userId,rows:[]});
 for(const [current,map]of [[true,D.byId],[false,D.archivedById]])for(const p of map.values()){
  const artist=D.artists.get(p.userId)||{};
  for(const s of p.scores){
   const key=D.judgeIdentities.get(s.judgeName);if(!key)continue;
   if(!profiles.has(key))profiles.set(key,{key,userId:key,name:s.judgeName,rows:[]});
   profiles.get(key).rows.push({...s,userId:p.userId,artistName:artist.artistName||null,artistSlug:artist.artistSlug||null,trackId:p.trackId||null,current});
  }
 }
 for(const s of D.annulledScores||[]){
  const p=profiles.get(s.judgeId),artist=D.artists.get(s.userId)||{};
  if(p)(p.auditRows??=[]).push({...s,artistName:artist.artistName||null,artistSlug:artist.artistSlug||null});
 }
 for(const p of profiles.values()){
  for(const row of p.rows){const outcome=D.participantOutcomes?.get(row.userId);if(outcome?.officialOutcome)row.officialException={label:outcome.label,scoreTotal:outcome.scoreTotal,scoreMaximum:outcome.scoreMaximum};}
  p.rows=sortScores(p.rows);
  p.distribution=[1,2,3,4,5].map(n=>p.rows.filter(s=>s.score===n).length);
  p.count=p.rows.length;p.mean=p.count?p.rows.reduce((n,s)=>n+s.score,0)/p.count:null;
 }
 return profiles;
}
export function filterScores(rows,{query='',grade='all'}={}){
 const q=query.trim().toLocaleLowerCase('ru');
 return rows.filter(s=>(grade==='all'||s.score===Number(grade))&&(!q||[s.artistName].some(v=>v?.toLocaleLowerCase('ru').includes(q))));
}
export function sortScores(rows,order='newest'){
 const direction=order==='oldest'?1:-1;
 const times=new Map(rows.map(row=>[row,Date.parse(row.scoredAt)]));
 return [...rows].sort((a,b)=>(times.get(a)-times.get(b))*direction||a.userId.localeCompare(b.userId));
}
// Shared by the existing URL profile (50) and the ranking dialog (25).
export function pageScores(rows,{query='',grade='all',order='newest',page=1,pageSize=25}={}){
 if(!Number.isInteger(pageSize)||pageSize<1)throw new Error('Invalid score page size');
 const filtered=sortScores(filterScores(rows,{query,grade}),order),pages=Math.max(1,Math.ceil(filtered.length/pageSize));
 const current=Math.min(pages,Math.max(1,Number.isFinite(page)?Math.floor(page):1));
 return {rows:filtered.slice((current-1)*pageSize,current*pageSize),total:filtered.length,pages,page:current};
}
