import {config} from './config.js';
export function normalizeData(main,forum){
 const errors=[],warnings=[];
 const fail=(condition,message)=>{if(!condition)errors.push(message)};
 fail(Array.isArray(main.members),'Основная выгрузка: отсутствует members');fail(Array.isArray(forum.members),'Список форума: отсутствует members');
 if(errors.length)throw new Error(errors.join('\n'));
 const end=Date.parse(main.exportedAt),forumEnd=Date.parse(forum.exportedAt);
 fail(Number.isFinite(end),'Некорректный exportedAt основной выгрузки');fail(Number.isFinite(forumEnd),'Некорректный exportedAt форума');
 const checkMembers=(members,label)=>{const ids=new Set();for(const p of members){fail(typeof p.userId==='string'&&p.userId.length>0,label+': отсутствует userId');fail(!ids.has(p.userId),label+': дублируется userId '+p.userId);ids.add(p.userId);fail(Array.isArray(p.scores),label+': нет scores '+p.userId);if(!Array.isArray(p.scores))continue;fail(p.scores.length<=config.scoresPerParticipant,label+': больше пяти оценок '+p.userId);if(p.scoredCount!==undefined)fail(p.scoredCount===p.scores.length,label+': scoredCount не совпадает '+p.userId);const judges=new Set();for(const s of p.scores){fail(typeof s.judgeName==='string'&&s.judgeName.trim(),label+': нет judgeName');fail(!judges.has(s.judgeName),label+': повторная оценка судьи '+p.userId);judges.add(s.judgeName);fail(Number.isInteger(s.score)&&s.score>=1&&s.score<=config.maxScore,label+': недопустимый score '+p.userId);if(!Number.isFinite(Date.parse(s.scoredAt)))warnings.push(label+': некорректный scoredAt '+p.userId+' / '+s.judgeName);fail(!Number.isFinite(Date.parse(s.scoredAt))||Date.parse(s.scoredAt)<=end,label+': оценка позже exportedAt '+p.userId);}}return ids;};
 fail(main.members.length>0,'Основная база пуста');for(const f of forum.members)fail(typeof f.forum_name==='string'&&f.forum_name.trim(),'Отсутствует ник форумщика: '+f.userId);
 const ids=checkMembers(main.members,'Основная база');checkMembers(forum.members,'Форум');
 if(main.totalParticipants!==undefined)fail(main.totalParticipants===main.members.length,'totalParticipants не совпадает с members');
 const byId=new Map(main.members.map(p=>[p.userId,p]));
 for(const f of forum.members){fail(ids.has(f.userId),'Форумщик отсутствует в базе: '+f.userId);const m=byId.get(f.userId);if(m&&Array.isArray(m.scores)&&Array.isArray(f.scores)){for(const s of f.scores){const actual=m.scores.find(x=>x.judgeName===s.judgeName);fail(actual&&actual.score===s.score&&actual.scoredAt===s.scoredAt,'Несогласованные оценки источников: '+f.userId+' / '+s.judgeName);}}}
 if(forum.members.length!==86)warnings.push('Размер списка форума изменился: '+forum.members.length+' вместо контрольных 86. Знаменатель охвата обновлён.');
 if(main.members.length!==3288)warnings.push('Размер основной базы отличается от контрольных 3288: '+main.members.length+'.');
 if(errors.length)throw new Error(errors.slice(0,20).join('\n'));
 const metadata=new Map(forum.members.map(p=>[p.userId,p]));
 const people=main.members.map(p=>{const f=metadata.get(p.userId);return [p.userId,f?.forum_name||'',f?.group||'',p.scores.map(s=>[s.judgeName,s.score,s.scoredAt])];});
 const events=main.members.flatMap(p=>p.scores.map(s=>({...s,userId:p.userId,forum:metadata.has(p.userId),judge:s.judgeName,t:Date.parse(s.scoredAt)}))).sort((a,b)=>(Number.isFinite(a.t)?a.t:Infinity)-(Number.isFinite(b.t)?b.t:Infinity));
 return {updated:main.exportedAt,people,events,metadata,byId,warnings,forumExportedAt:forum.exportedAt};
}
export async function loadData(){
 for(let attempt=0;attempt<3;attempt++){
  const metaResponse=await fetch(new URL('../data/metadata.json?check='+Date.now(),import.meta.url),{cache:'no-store'});if(!metaResponse.ok)throw new Error('Не удалось прочитать метаданные обновления');const meta=await metaResponse.json();
  const values=await Promise.all(['19ib_all_judges_REPAIRED.json','forum_judges_export.json'].map(async file=>{const url=new URL('../data/'+file,import.meta.url);url.searchParams.set('v',meta.runId);const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error('Не удалось загрузить '+file+': '+response.status);return response.json();}));
  if(values[0].exportedAt!==meta.exportedAt)continue;
  const D=normalizeData(...values);D.lastSuccessfulAt=meta.lastSuccessfulAt;return D;
 }
 throw new Error('Обновление данных ещё публикуется. Повторите загрузку.');
}
