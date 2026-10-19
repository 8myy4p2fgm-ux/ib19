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
   profiles.get(key).rows.push({...s,userId:p.userId,artistName:artist.artistName||null,artistSlug:artist.artistSlug||null,forumName:D.referenceMetadata.get(p.userId)?.forum_name||null,trackId:p.trackId||null,current});
  }
 }
 for(const p of profiles.values()){
  p.rows.sort((a,b)=>Date.parse(b.scoredAt)-Date.parse(a.scoredAt)||a.userId.localeCompare(b.userId));
  p.distribution=[1,2,3,4,5].map(n=>p.rows.filter(s=>s.score===n).length);
  p.count=p.rows.length;p.mean=p.count?p.rows.reduce((n,s)=>n+s.score,0)/p.count:null;
 }
 return profiles;
}
export function filterScores(rows,{query='',grade='all'}={}){
 const q=query.trim().toLocaleLowerCase('ru');
 return rows.filter(s=>(grade==='all'||s.score===Number(grade))&&(!q||[s.artistName,s.forumName,s.userId].some(v=>v?.toLocaleLowerCase('ru').includes(q))));
}
export function sortScores(rows,order='newest'){
 const direction=order==='oldest'?1:-1;
 return [...rows].sort((a,b)=>(Date.parse(a.scoredAt)-Date.parse(b.scoredAt))*direction||a.userId.localeCompare(b.userId));
}
