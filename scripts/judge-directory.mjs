const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function judgeDirectory(previous={},source){
 if(!Array.isArray(source)||!source.length)throw new Error('Invalid public judge directory');
 const incoming=new Map();
 for(const j of source){
  if(!uuid.test(j.userId)||typeof j.name!=='string'||!j.name.trim()||incoming.has(j.userId))throw new Error('Invalid or duplicate judge identity');
  incoming.set(j.userId,{userId:j.userId,name:j.name.trim(),avatarUrl:typeof j.avatarUrl==='string'&&j.avatarUrl.trim()?j.avatarUrl.trim():null,bio:typeof j.bio==='string'&&j.bio.trim()?j.bio.trim():null});
 }
 const all=new Map((previous.judges||[]).map(j=>[j.userId,j]));for(const [id,j]of incoming)all.set(id,j);
 const judges=[...all.values()].sort((a,b)=>a.userId.localeCompare(b.userId)),names=new Map();
 for(const j of judges){if(!names.has(j.name))names.set(j.name,[]);names.get(j.name).push(j.userId);}
 const identities={};
 // Keep only previously observed UUID/name associations, never fuzzy aliases.
 for(const [name,id]of Object.entries(previous.judgeIdentities||{}))if(all.has(id)&&!names.has(name))identities[name]=id;
 for(const [name,ids]of names)if(ids.length===1)identities[name]=ids[0];
 return {judges,judgeIdentities:identities};
}
