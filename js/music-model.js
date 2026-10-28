import {contentHash} from './r1-correction.js';
// PLAY-03: presentation only. Official R1 outcomes own all score totals.
export const MUSIC_STORAGE_KEY='tuz19.playlists.v1';
export const MAX_SHARE_URL=2000;
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(v);
export const trackKey=(roundId,trackId)=>roundId+':'+trackId;
export const validKey=k=>typeof k==='string'&&k.length===73&&uuid(k.slice(0,36))&&uuid(k.slice(37))&&k[36]===':';
// First release: playlists/queue only; audio source remains disabled.
export const localMusicEnabled=host=>['localhost','127.0.0.1','[::1]','tuz19.ru'].includes(host);
export const R1_SUBMISSIONS_HASH='8237322095164ded57176de3c2a9cc4337af417f0ee349ad2028a2ccc44c9f80';
export function validateR1TrackSubmissions(value,roundId){
 if(value?.schema!=='r1-public-submissions-v1'||value.roundId!==roundId||contentHash(value)!==R1_SUBMISSIONS_HASH)throw Error('Некорректные даты сдачи R1');
 const dates=new Map();
 for(const row of value.records){
  const key=JSON.stringify([row.userId,row.trackId]);
  if(dates.has(key)||!uuid(row.userId)||!uuid(row.trackId)||(row.submittedAt!==null&&!Number.isFinite(Date.parse(row.submittedAt))))throw Error('Некорректная дата или идентификатор трека R1');
  dates.set(key,row.submittedAt);
 }
 return dates;
}
const timestamp=value=>{const time=typeof value==='string'?Date.parse(value):NaN;return Number.isFinite(time)?time:null;};
export function createCatalog(context,r2=null,r1Dates=new Map()){
 const D=context.data;
 const group=id=>{const m=D.referenceMetadata.get(id);return m?(m.veteran||m.group==='Ветераны'?'veterans':'forum'):'other';};
 const rows=[...D.byId.values()].filter(p=>uuid(p.trackId)).map(p=>{
  const result=context.analytics.participantOutcome(p.userId),submittedAt=r1Dates.get(JSON.stringify([p.userId,p.trackId]))??null;
  return {key:trackKey(context.roundId,p.trackId),roundId:context.roundId,trackId:p.trackId,round:1,userId:p.userId,name:p.artistName||p.userId,slug:p.artistSlug,group:group(p.userId),total:result.validScoreCount?result.scoreTotal:null,count:result.validScoreCount,required:context.rules.scoresPerParticipant,duration:null,submittedAt,submittedTime:timestamp(submittedAt),confirmed:true};
 });
 for(const p of r2?.submissions??[])if(uuid(p.trackId))rows.push({key:trackKey(r2.roundId,p.trackId),roundId:r2.roundId,trackId:p.trackId,round:2,userId:p.userId,name:p.name,slug:p.slug,group:group(p.userId),total:null,count:0,required:null,duration:p.durationSec,submittedAt:p.submittedAt??null,submittedTime:timestamp(p.submittedAt),confirmed:true});
 if(new Set(rows.map(p=>p.key)).size!==rows.length)throw Error('Повтор идентификатора трека');
 return rows;
}
const names=(a,b)=>a.name.localeCompare(b.name,'ru')||a.key.localeCompare(b.key);
export function selectTracks(rows,{query='',round='all',group='all',complete=false,order='desc'}={}){
 const q=query.trim().toLocaleLowerCase('ru');
 return rows.filter(p=>(round==='all'||String(p.round)===round)&&(group==='all'||p.group===group)&&(!complete||(p.required!==null&&p.count>=p.required))&&(!q||p.name.toLocaleLowerCase('ru').includes(q))).sort((a,b)=>{
  if(order==='newest'||order==='oldest'){
   const at=a.submittedTime,bt=b.submittedTime;
   if(at==null||bt==null)return (at==null)-(bt==null)||names(a,b);
   return (order==='newest'?-1:1)*(at-bt)||names(a,b);
  }
  if(order==='alpha')return names(a,b);
  if(a.total===null||b.total===null)return (a.total===null)-(b.total===null)||names(a,b);
  return (order==='asc'?1:-1)*(a.total-b.total)||names(a,b);
 });
}
// Snapshot the complete selected catalog, independently of visible pagination.
export function catalogQueue(rows,filters,key){
 const keys=[...new Set(selectTracks(rows,filters).filter(t=>t.confirmed&&validKey(t.key)).map(t=>t.key))];
 const index=keys.indexOf(key);return index<0?[]:keys.slice(index);
}
const isName=s=>typeof s==='string'&&s.trim().length>0&&s.trim().length<=120;
export function validPlaylist(p,{local=true}={}){
 return !!p&&typeof p==='object'&&p.v===1&&isName(p.name)&&(!local||(typeof p.id==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(p.id)))&&Array.isArray(p.tracks)&&p.tracks.length<=1000&&p.tracks.every(validKey)&&new Set(p.tracks).size===p.tracks.length;
}
export function loadPlaylists(storage){
 try{const raw=storage.getItem(MUSIC_STORAGE_KEY);if(raw===null)return {lists:[],warning:''};if(raw.length>2_000_000)throw Error();const data=JSON.parse(raw);if(data?.v!==1||!Array.isArray(data.lists)||data.lists.length>100||!data.lists.every(p=>validPlaylist(p))||new Set(data.lists.map(p=>p.id)).size!==data.lists.length)throw Error();return {lists:structuredClone(data.lists),warning:''};}
 catch{return {lists:[],warning:'Хранилище недоступно или повреждено. Изменения пока сохраняются только в этой вкладке.'};}
}
export function savePlaylists(storage,lists){
 if(lists.length>100||!lists.every(p=>validPlaylist(p))||new Set(lists.map(p=>p.id)).size!==lists.length)return 'Достигнут лимит плейлистов или треков.';
 try{const raw=JSON.stringify({v:1,lists:lists.map(p=>({v:1,id:p.id,name:p.name.trim(),tracks:p.tracks}))});if(raw.length>2_000_000)return 'Достигнут лимит локального хранения (2 млн символов). Изменения останутся только в этой вкладке.';storage.setItem(MUSIC_STORAGE_KEY,raw);return '';}
 catch{return 'Не удалось сохранить: хранилище недоступно или заполнено. Изменения останутся только в этой вкладке.';}
}
export function addUnique(list,key){if(!validKey(key))throw Error('Некорректный трек');if(list.includes(key))return [...list];if(list.length>=1000)throw Error('Не больше 1000 треков');return [...list,key];}
export function moveItem(list,index,delta){const copy=[...list],to=index+delta;if(index>=0&&index<list.length&&to>=0&&to<list.length)[copy[index],copy[to]]=[copy[to],copy[index]];return copy;}
export function shuffleItems(list,random=Math.random){const copy=[...list];for(let i=copy.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}return copy;}
export function parseSharedPayload(data){
 if(!data||typeof data!=='object'||Object.keys(data).some(k=>!['v','name','tracks'].includes(k))||data.v!==1||!Array.isArray(data.tracks)||data.tracks.length>1000||data.tracks.some(p=>!Array.isArray(p)||p.length!==2||!p.every(uuid)))throw Error('Некорректный формат плейлиста.');
 const p={v:1,name:data.name,tracks:data.tracks.map(pair=>trackKey(...pair))};if(!validPlaylist(p,{local:false}))throw Error('Некорректный плейлист.');return {v:1,name:p.name.trim(),tracks:[...p.tracks]};
}
export function sharedPlaylistPayload(playlist){
 if(!validPlaylist(playlist,{local:false}))throw Error('Некорректный плейлист');
 return {v:1,name:playlist.name.trim(),tracks:playlist.tracks.map(key=>key.split(':'))};
}
export function shareURL(playlist,base){
 if(!validPlaylist(playlist))throw Error('Некорректный плейлист');
 const data=sharedPlaylistPayload(playlist);
 const bytes=new TextEncoder().encode(JSON.stringify(data));let binary='';for(const b of bytes)binary+=String.fromCharCode(b);
 const url=new URL(base);url.search='';url.hash='';url.searchParams.set('music','playlists');url.searchParams.set('list',btoa(binary).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,''));
 if(url.href.length>MAX_SHARE_URL)throw Error('Плейлист слишком большой для ссылки (лимит 2000 символов). Разделите его на несколько плейлистов.');return url.href;
}
export function readShared(input){
 const url=new URL(input),all=url.searchParams.getAll('list');if(!all.length)return null;
 if(url.href.length>MAX_SHARE_URL||all.length!==1)throw Error('Ссылка слишком длинная или неоднозначная.');
 const encoded=all[0];if(!/^[A-Za-z0-9_-]+$/.test(encoded))throw Error('Повреждённая ссылка на плейлист.');
 try{const binary=atob(encoded.replaceAll('-','+').replaceAll('_','/')),data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(binary,c=>c.charCodeAt(0))));
 return parseSharedPayload(data);
 }catch{throw Error('Повреждённая ссылка или неподдерживаемый формат плейлиста.');}
}
