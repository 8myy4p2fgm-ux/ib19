import {sha256} from './r1-correction.js'; // Shared pure UTF-8 hash, no R1 data or formulas.
const ROUND='235f6600-5224-4adf-bbcc-a220f4572251',TOURNAMENT='9345a642-d1fb-4ac7-aebc-b59f2628170b';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(v);
const date=v=>{if(typeof v!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(v)||!Number.isFinite(Date.parse(v)))return false;const canonical=v.includes('.')?v.replace(/\.(\d{1,3})Z$/,(_,ms)=>'.'+ms.padEnd(3,'0')+'Z'):v.replace('Z','.000Z');return new Date(v).toISOString()===canonical;};
const check=(yes,why)=>{if(!yes)throw Error('Некорректный снимок сдач R2: '+why);};
const freeze=o=>{if(o&&typeof o==='object'){Object.values(o).forEach(freeze);Object.freeze(o);}return o;};
const nullable=(v,predicate)=>v==null||predicate(v);
export function validateR2Submissions(value){
 check(value?.schemaVersion===1&&value.resourceVersion==='r2-submissions-v1'&&value.kind==='round-submissions'&&value.roundId===ROUND,'версия или раунд');check(date(value.importedAt),'время импорта');
 const parsed={};for(const key of ['full','live']){const src=value.sources?.[key],raw=value.raw?.[key];check(typeof raw==='string'&&src?.url===`https://api.19ib.ru/rounds/${ROUND}/${key}`&&src.sha256===sha256(raw)&&src.bytes===new TextEncoder().encode(raw).length,'происхождение '+key);check(src.retrievedAt===null||date(src.retrievedAt),'время получения '+key);parsed[key]=JSON.parse(raw);}
 check(value.snapshotId===value.sources.full.sha256+':'+value.sources.live.sha256,'версия снимка');
 const {full,live}=parsed;
 check(full.id===ROUND&&full.tournamentId===TOURNAMENT&&full.roundOrder===2&&full.type==='solo','идентичность /full');
 check(typeof full.name==='string'&&full.name.trim()&&typeof full.topic==='string'&&full.topic.trim()&&['pending','active','judging','finished'].includes(full.status)&&typeof full.resultsPublished==='boolean','описание');
 check(full.judgesRequired===7&&full.scoreScale===10&&full.maxScore===70&&full.advanceCount===256,'правила требуют отдельной проверки');
 for(const key of ['deadline','judgingStartsAt','judgingDeadline','startedAt','judgingStartedAt','updatedAt'])check(nullable(full[key],date),'дата '+key);
 check(Array.isArray(full.entries)&&Array.isArray(full.feed)&&Array.isArray(live.progress)&&Array.isArray(live.feed),'массивы');
 const progress=new Map();for(const p of live.progress){check(uuid(p.userId)&&!progress.has(p.userId),'UUID /live');progress.set(p.userId,p);}
 const ids=new Set(),tracks=new Set();
 const entries=full.entries.map(e=>{
  check(uuid(e.userId)&&!ids.has(e.userId),'UUID участника');ids.add(e.userId);check(typeof e.name==='string'&&e.name.trim(),'имя');
  check(nullable(e.trackId,uuid),'trackId');if(e.trackId){check(!tracks.has(e.trackId),'повтор trackId');tracks.add(e.trackId);}
  check(nullable(e.slug,v=>typeof v==='string'&&!!v.trim()),'slug');check(nullable(e.submittedAt,date),'submittedAt');
  check(nullable(e.durationSec,v=>Number.isFinite(v)&&v>=0),'durationSec');check(nullable(e.hasLyrics,v=>typeof v==='boolean'),'hasLyrics');
  check(nullable(e.scoredCount,v=>Number.isInteger(v)&&v>=0&&v<=full.judgesRequired),'scoredCount');check(nullable(e.score,v=>Number.isFinite(v)&&v>=0&&v<=full.maxScore),'score');check(nullable(e.advanced,v=>typeof v==='boolean'),'advanced');
  const p=progress.get(e.userId);check(!!p,'нет UUID в /live');for(const k of ['score','scoredCount','advanced'])if(Object.hasOwn(e,k)&&Object.hasOwn(p,k))check((e[k]??null)===(p[k]??null),'несогласованный '+k);
  return {userId:e.userId,slug:e.slug??null,name:e.name,trackId:e.trackId??null,submittedAt:e.submittedAt??null,durationSec:e.durationSec??null,hasLyrics:e.hasLyrics??null,scoredCount:e.scoredCount??null,score:e.score??null,advanced:e.advanced??null,submissionStatus:e.trackId?'submitted':'unknown'};
 });check(progress.size===ids.size,'лишние UUID /live');
 const submissions=selectR2Submissions(entries);
 return freeze({kind:'round-submissions',resourceVersion:value.resourceVersion,snapshotId:value.snapshotId,roundId:ROUND,tournamentId:TOURNAMENT,roundOrder:2,name:full.name,topic:full.topic,status:full.status,resultsPublished:full.resultsPublished,
  sourceParameters:Object.fromEntries(['judgesRequired','scoreScale','maxScore','advanceCount','passThreshold','minDurationSec','maxDurationSec'].map(k=>[k,full[k]??null])),
  times:Object.fromEntries(['deadline','judgingStartsAt','judgingDeadline','startedAt','judgingStartedAt','updatedAt'].map(k=>[k,full[k]??null])),
  provenance:{importedAt:value.importedAt,sources:structuredClone(value.sources)},capabilities:{information:true,submissions:true,roster:false,analytics:false,judges:false},
  entries,submissions,confirmedSubmissionCount:submissions.length,rosterCount:null,waitingCount:null,feedCount:full.feed.length,liveFeedCount:live.feed.length});
}
// Every resource is a complete replacement of the observed subset, never a merge.
export function selectR2Submissions(entries,{query='',order='asc'}={}){
 const q=String(query).trim().toLocaleLowerCase('ru');
 return entries.filter(e=>e.submissionStatus==='submitted'&&(!q||e.name.toLocaleLowerCase('ru').includes(q))).sort((a,b)=>(order==='desc'?-1:1)*((a.submittedAt?Date.parse(a.submittedAt):Infinity)-(b.submittedAt?Date.parse(b.submittedAt):Infinity))||a.userId.localeCompare(b.userId));
}
