export function mergeSnapshot(old,forum,full,scoresById,observedAt,{verifiedIds}={}){
 if(!Array.isArray(full.entries)||full.entries.length<old.members.length*.9)throw new Error('Incomplete roster');if(full.judgesRequired!==5||full.scoreScale!==5||full.passThreshold!==15)throw new Error('Round rules changed; manual review required');
 const oldById=new Map([...(old.archivedMembers||[]),...old.members].map(p=>[p.userId,p])),ids=new Set(),members=[];
 for(const entry of full.entries){if(!entry.userId||ids.has(entry.userId))throw new Error('Invalid or duplicate entry ID');ids.add(entry.userId);const scores=scoresById.get(entry.userId);if(!Array.isArray(scores)||scores.length!==entry.scoredCount)throw new Error('Incomplete score response: '+entry.userId);for(const s of scores){if(typeof s.judgeName!=='string'||!s.judgeName.trim()||!Number.isInteger(s.score)||s.score<1||s.score>5||typeof s.comment!=='string'||!Number.isFinite(Date.parse(s.scoredAt)))throw new Error('Invalid source score: '+entry.userId);}const prev=oldById.get(entry.userId);members.push({...prev,userId:entry.userId,scores:scores.map(s=>{const previous=prev?.scores.find(x=>x.judgeName===s.judgeName);return {...previous,...s};}),scoredCount:scores.length,fetchedAt:!verifiedIds||verifiedIds.has(entry.userId)?observedAt:prev?.fetchedAt,current:true});}
 // Public API may omit removed participants. Preserve their grades/author identities, clearly mark absence.
 const archivedMembers=[...oldById.values()].filter(p=>!ids.has(p.userId)).map(p=>({...p,current:false,sourceAbsentSince:p.sourceAbsentSince||observedAt}));
 const main={...old,exportedAt:observedAt,totalParticipants:members.length,members,archivedMembers,errors:[]},byId=new Map([...archivedMembers,...members].map(p=>[p.userId,p]));
 const meta={...forum,exportedAt:observedAt,members:forum.members.map(p=>{const actual=byId.get(p.userId);return {...p,current:ids.has(p.userId),scores:structuredClone(actual?.scores||[]),...(p.scoredCount===undefined?{}:{scoredCount:actual?.scores.length||0})};}),errors:[]};const sourceRound=Object.fromEntries(Object.entries(full).filter(([key])=>key!=='entries'));return {main,forum:meta,sourceRound,absent:archivedMembers.map(p=>p.userId)};
}

export function validateSavedSnapshot(main) {
 if (!main || !Array.isArray(main.members) || !Number.isFinite(Date.parse(main.exportedAt)) || main.errors?.length) throw new Error('Invalid saved snapshot; restore a validated Git revision');
 const ids = new Set();
 for (const p of [...main.members, ...(main.archivedMembers || [])]) {
  if (!p.userId || ids.has(p.userId) || !Array.isArray(p.scores) || p.scoredCount !== p.scores.length) throw new Error('Invalid saved participant');
  ids.add(p.userId);const judges=new Set();
  for (const s of p.scores) {
   if (!s.judgeName?.trim() || judges.has(s.judgeName) || !Number.isInteger(s.score) || s.score<1 || s.score>5 || typeof s.comment!=='string' || !Number.isFinite(Date.parse(s.scoredAt))) throw new Error('Invalid saved score');
   judges.add(s.judgeName);
  }
 }
 if (main.totalParticipants !== undefined && main.totalParticipants !== main.members.length) throw new Error('Invalid saved participant count');
}
function validateEntries(entries) {
 if (!Array.isArray(entries)) throw new Error('Invalid source roster');
 const ids=new Set();
 for (const e of entries) {
  if (!e.userId || ids.has(e.userId) || !Number.isInteger(e.scoredCount) || e.scoredCount<0 || (e.score!=null && (!Number.isFinite(e.score)||e.score<0)) || (e.scoredCount>0 && !Number.isFinite(e.score))) throw new Error('Invalid source summary');
  if (e.scoredCount===0 && e.score!=null && e.score!==0) throw new Error('Invalid zero-score summary');
  ids.add(e.userId);
 }
}
const sum=scores=>scores.reduce((n,s)=>n+s.score,0);
const matches=(scores,entry)=>Array.isArray(scores)&&scores.length===entry.scoredCount&&(entry.score==null?entry.scoredCount===0:sum(scores)===entry.score);
export function retryAfterMs(value,now=Date.now()) {
 if (!value) return 0;
 const seconds=Number(value);if(Number.isFinite(seconds)&&seconds>=0)return seconds*1000;
 const date=Date.parse(value);return Number.isFinite(date)?Math.max(0,date-now):0;
}
export function createClient(config,{fetchImpl=fetch,sleep=ms=>new Promise(r=>setTimeout(r,ms)),clock=Date.now,stats={},onProgress=()=>{}}={}) {
 let gate=Promise.resolve(),last=-Infinity,cooldown=0;const started=clock(),deadline=started+(config.maxDurationMs??720000);
 Object.assign(stats,{httpRequests:0,errors429:0,retries:0});
 function budget(wait=0){if(clock()+wait>=deadline)throw new Error('Collection time budget exhausted; keeping last successful dataset');}
 async function throttle(start){const job=gate.then(async()=>{for(;;){budget();const wait=Math.max(0,(last+(config.requestIntervalMs??1000))-clock(),cooldown-clock());if(!wait)break;budget(wait);await sleep(wait);}last=clock();return {response:start()};});gate=job.catch(()=>{});return job;}
 return async path=>{
  let error;
  for(let attempt=0;attempt<=(config.retries??3);attempt++){
   let delay=0,retryable=true;
   try{
    const {response}=await throttle(()=>{stats.httpRequests++;return fetchImpl(config.apiBase+path,{signal:AbortSignal.timeout(Math.max(1,Math.min(config.timeoutMs??20000,deadline-clock()))),headers:{Accept:'application/json','User-Agent':'IB19-community-analytics/1.0'}});});
    const r=await response;
    if(!r.ok){
     if(r.status===429)stats.errors429++;
     retryable=r.status===429||r.status>=500||r.status===408;
     delay=Math.max(retryAfterMs(r.headers?.get('Retry-After'),clock()),(config.retryBaseMs??2000)*2**attempt);
     if(retryable)cooldown=Math.max(cooldown,clock()+delay);
     throw new Error('HTTP '+r.status+' '+path);
    }
    return await r.json();
   }catch(e){error=e;onProgress({stage:'request-error',path,attempt:attempt+1,error:e.message});if(!retryable||attempt===(config.retries??3))throw error;
    delay ||= (config.retryBaseMs??2000)*2**attempt;budget(delay);stats.retries++;cooldown=Math.max(cooldown,clock()+delay);
   }
  }
  throw error;
 };
}
export async function collect(config,old,forum,{get,now=()=>new Date().toISOString(),onProgress=()=>{},stats={}}={}) {
 validateSavedSnapshot(old);
 const started=Date.now(),transportStats=stats;const client=get||createClient(config,{stats:transportStats,onProgress});let logicalRequests=0;
 const read=async p=>{logicalRequests++;try{return await client(p);}catch(error){Object.assign(stats,{status:'failed',logicalRequests,durationMs:Date.now()-started});throw error;}};
 const path='/rounds/'+config.roundId,full=await read(path+'/full');
 if(full.id!==config.roundId)throw new Error('Wrong round');validateEntries(full.entries);
 if(full.entries.length<old.members.length*.9)throw new Error('Incomplete roster');
 if(full.judgesRequired!==5||full.scoreScale!==5||full.passThreshold!==15)throw new Error('Round rules changed; manual review required');
 const byId=new Map([...(old.archivedMembers||[]),...old.members].map(p=>[p.userId,p]));const scores=new Map(),verifiedIds=new Set();
 const changed=full.entries.filter(e=>!byId.has(e.userId)||!matches(byId.get(e.userId).scores,e));
 const pending=full.entries.filter(e=>config.mode==='full'?e.scoredCount>0||byId.get(e.userId)?.scores.length:changed.includes(e));
 for(const e of full.entries)scores.set(e.userId,byId.get(e.userId)?.scores||[]);
 async function load(entries){
  let i=0,completed=0,failed;onProgress({stage:'scores',total:entries.length,completed});
  const worker=async()=>{while(i<entries.length&&!failed){const e=entries[i++];try{const data=await read(path+'/entries/'+encodeURIComponent(e.userId)+'/scores');if(!Array.isArray(data.scores))throw new Error('Invalid scores '+e.userId);
   scores.set(e.userId,data.scores);verifiedIds.add(e.userId);stats.updatedCards=verifiedIds.size;completed++;if(completed%100===0||completed===entries.length)onProgress({stage:'scores',total:entries.length,completed});
  }catch(error){failed=error;}}};
  await Promise.all(Array.from({length:Math.max(1,Math.min(config.concurrency??2,2))},worker));if(failed)throw failed;
 }
 try{
  await load(pending);
  for(let pass=0;pass<(config.reconcilePasses??3);pass++){
   const live=await read(path+'/live');validateEntries(live.progress);
   const progress=new Map(live.progress.map(e=>[e.userId,e]));
   if(progress.size!==full.entries.length||full.entries.some(e=>!progress.has(e.userId)))throw new Error('Participant roster changed during read; keeping last successful dataset');
   const dirty=full.entries.filter(e=>!matches(scores.get(e.userId),progress.get(e.userId)));
   if(!dirty.length){
    for(const e of full.entries)Object.assign(e,{scoredCount:progress.get(e.userId).scoredCount,score:progress.get(e.userId).score});
    const batch=mergeSnapshot(old,forum,full,scores,now(),{verifiedIds});
    validateSavedSnapshot(batch.main);
    const baseline=2+full.entries.filter(e=>e.scoredCount>0||byId.get(e.userId)?.scores.length).length;
    Object.assign(stats,{mode:config.mode||'incremental',participants:full.entries.length,participantsWithNewScores:batch.main.members.filter(e=>e.scores.length>(byId.get(e.userId)?.scores.length||0)).length,changedParticipants:changed.length,updatedCards:verifiedIds.size,logicalRequests,httpRequests:get?logicalRequests:transportStats.httpRequests,errors429:transportStats.errors429||0,retries:transportStats.retries||0,durationMs:Date.now()-started,scoresBefore:old.members.reduce((n,p)=>n+p.scores.length,0),scoresAfter:batch.main.members.reduce((n,p)=>n+p.scores.length,0),fullBaselineRequests:baseline,requestReductionPercent:100*(1-(get?logicalRequests:transportStats.httpRequests)/baseline)});
    batch.collection=stats;return batch;
   }
   onProgress({stage:'reconcile',pass:pass+1,changed:dirty.length});
   if(pass+1<(config.reconcilePasses??3))await load(dirty);
  }
  throw new Error('Source changed during reconciliation; keeping last successful dataset');
 }catch(error){Object.assign(stats,{status:'failed',logicalRequests,...transportStats,durationMs:Date.now()-started});onProgress(stats);throw error;}
}
