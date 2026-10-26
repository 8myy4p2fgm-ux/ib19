import {config} from './config.js';
import {partitionAnalytics} from './analytics-selection.js';
export function normalizeData(rawMain,rawForum,options={}){
 const {main,forum,excluded}=partitionAnalytics(rawMain,rawForum,options);
 const errors=[],warnings=[];
 const fail=(condition,message)=>{if(!condition)errors.push(message)};
 fail(Array.isArray(main.members),'Основная выгрузка: отсутствует members');fail(Array.isArray(forum.members),'Список форума: отсутствует members');
 if(errors.length)throw new Error(errors.join('\n'));
 const end=Date.parse(main.exportedAt),forumEnd=Date.parse(forum.exportedAt);
 fail(Number.isFinite(end),'Некорректный exportedAt основной выгрузки');fail(Number.isFinite(forumEnd),'Некорректный exportedAt форума');
 const checkMembers=(members,label)=>{const ids=new Set();for(const p of members){fail(typeof p.userId==='string'&&p.userId.length>0,label+': отсутствует userId');fail(!ids.has(p.userId),label+': дублируется userId '+p.userId);ids.add(p.userId);fail(Array.isArray(p.scores),label+': нет scores '+p.userId);if(!Array.isArray(p.scores))continue;fail(p.scores.length<=config.scoresPerParticipant,label+': больше пяти оценок '+p.userId);if(p.scoredCount!==undefined)fail(p.scoredCount===p.scores.length,label+': scoredCount не совпадает '+p.userId);const judges=new Set();for(const s of p.scores){fail(typeof s.judgeName==='string'&&s.judgeName.trim(),label+': нет judgeName');fail(!judges.has(s.judgeName),label+': повторная оценка судьи '+p.userId);judges.add(s.judgeName);fail(Number.isInteger(s.score)&&s.score>=1&&s.score<=config.maxScore,label+': недопустимый score '+p.userId);if(!Number.isFinite(Date.parse(s.scoredAt)))warnings.push(label+': некорректный scoredAt '+p.userId+' / '+s.judgeName);fail(!Number.isFinite(Date.parse(s.scoredAt))||Date.parse(s.scoredAt)<=end,label+': оценка позже exportedAt '+p.userId);}}return ids;};
 fail(main.members.length>0,'Основная база пуста');for(const f of forum.members)if(rawForum.publicSchema!=='r1-public-v1')fail(typeof f.forum_name==='string'&&f.forum_name.trim(),'Отсутствует ник форумщика: '+f.userId);
 const ids=checkMembers(main.members,'Основная база');checkMembers(forum.members,'Форум');
 const archived=main.archivedMembers||[];fail(Array.isArray(archived),'Некорректный архив участников');
 const archivedIds=checkMembers(archived,'Архив');for(const id of archivedIds)fail(!ids.has(id),'UUID одновременно в текущем составе и архиве: '+id);
 if(main.totalParticipants!==undefined)fail(main.totalParticipants===main.members.length,'totalParticipants не совпадает с members');
 const byId=new Map(main.members.map(p=>[p.userId,p])),archivedById=new Map(archived.map(p=>[p.userId,p]));
 const artists=new Map([...main.members,...archived].map(p=>[p.userId,{
  artistName:typeof p.artistName==='string'&&p.artistName.trim()?p.artistName.trim():null,
  artistSlug:typeof p.artistSlug==='string'&&p.artistSlug.trim()?p.artistSlug.trim():null
 }]));
 for(const f of forum.members){const m=byId.get(f.userId)||archivedById.get(f.userId);fail(!!m||(f.current===false&&f.scores.length===0),'Форумщик отсутствует в базе и архиве: '+f.userId);if(m&&Array.isArray(m.scores)&&Array.isArray(f.scores)){for(const s of f.scores){const actual=m.scores.find(x=>x.judgeName===s.judgeName);fail(actual&&actual.score===s.score&&actual.scoredAt===s.scoredAt,'Несогласованные оценки источников: '+f.userId+' / '+s.judgeName);}}}
 const judges=main.judges||[],judgeIdentities=new Map(Object.entries(main.judgeIdentities||{}));
 fail(Array.isArray(judges),'Некорректный справочник судей');const judgeIds=new Set();
 if(Array.isArray(judges))for(const j of judges){fail(typeof j.userId==='string'&&!!j.userId&&!judgeIds.has(j.userId)&&typeof j.name==='string'&&!!j.name.trim(),'Некорректная идентичность судьи');judgeIds.add(j.userId);}
 for(const [name,id]of judgeIdentities)fail(!!name.trim()&&judgeIds.has(id),'Неизвестный UUID судьи в сопоставлении');
 if(errors.length)throw new Error(errors.slice(0,20).join('\n'));
 const referenceMetadata=new Map(forum.members.map(p=>[p.userId,p]));
 const metadata=new Map(forum.members.filter(p=>ids.has(p.userId)).map(p=>[p.userId,p]));
 const people=main.members.map(p=>{const f=metadata.get(p.userId);return [p.userId,rawForum.publicSchema==='r1-public-v1'?(artists.get(p.userId)?.artistName||''):f?.forum_name||'',f?.group||'',p.scores.map(s=>[s.judgeName,s.score,s.scoredAt])];});
 const events=main.members.flatMap(p=>p.scores.map(s=>({...s,userId:p.userId,forum:metadata.has(p.userId),judge:s.judgeName,t:Date.parse(s.scoredAt)}))).sort((a,b)=>(Number.isFinite(a.t)?a.t:Infinity)-(Number.isFinite(b.t)?b.t:Infinity));
 // Only this overview report includes current quarantined participants.
 // Keep their raw scores out of people, events and every analytics map.
 const ratingCounts=[...main.members,...(main.quarantinedMembers||[]).filter(p=>p.current!==false)].map(p=>p.scores.length);
 const ratingBuckets=Array.from({length:Math.max(config.scoresPerParticipant,...ratingCounts)+1},()=>0);
 for(const count of ratingCounts)ratingBuckets[count]++;
 const ratingsReport={total:ratingCounts.length,buckets:ratingBuckets};
 return {ratingsReport,excluded,judges,judgeIdentities,updated:main.exportedAt,people,events,metadata,referenceMetadata,byId,archivedById,artists,warnings,forumExportedAt:forum.exportedAt};
}
const readJSON=async (url,cache='default')=>{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),30000);
    try{
     const response=await fetch(url,{cache,priority:'high',signal:controller.signal});
     if(!response.ok)throw new Error('Не удалось загрузить '+url.pathname.split('/').pop()+': '+response.status);
     return await response.json();
    }finally{
     clearTimeout(timer);
    }
   };

// Retry a complete snapshot: never combine data from different published versions.
export async function loadData({validateMetadata=()=>{},dataRoot=new URL('../data/',import.meta.url),includeSource=false,includeHistory=includeSource,resource,validateResource}={}){
 if(includeHistory&&!includeSource)throw new Error('History requires a bound source snapshot');
 let lastError;
 for(let attempt=0;attempt<3;attempt++){
  try{
   if(resource){
    if(typeof validateResource!=='function')throw new Error('Resource validator required');
    return await validateResource(await readJSON(resource,attempt===0?'default':'no-store'));
   }
   const meta=await readJSON(new URL('metadata.json?check='+Date.now(),dataRoot),'no-store');
   validateMetadata(meta);
   const values=await Promise.all(['19ib_all_judges_REPAIRED.json','forum_judges_export.json',...(includeHistory?['history.json']:[])].map(file=>{
    const url=new URL(file,dataRoot);url.searchParams.set('v',meta.runId);return readJSON(url,attempt===0?'default':'no-store');
   }));
   if(values[0].exportedAt!==meta.exportedAt||(meta.forumExportedAt&&values[1].exportedAt!==meta.forumExportedAt)){
    lastError=new Error('Обновление данных ещё публикуется. Повторите загрузку.');
    if(attempt<2)await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));
    continue;
   }
   if(includeSource){
    const after=await readJSON(new URL('metadata.json?check='+Date.now(),dataRoot),'no-store');validateMetadata(after);
    if(JSON.stringify(after)!==JSON.stringify(meta))throw new Error('Source snapshot changed during read');
   }
   const D=normalizeData(values[0],values[1]);D.lastSuccessfulAt=meta.lastSuccessfulAt;D.snapshotMetadata=structuredClone(meta);
   if(includeSource)D.sourceSnapshot={main:values[0],forum:values[1],metadata:meta,history:values[2]};
   return D;
  }catch(error){
   lastError=error;
   if(attempt<2)await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));
  }
 }
 throw lastError;
}
