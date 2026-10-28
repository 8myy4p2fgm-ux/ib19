import {apiURL} from './api-config.js';
import {readShared,parseSharedPayload,sharedPlaylistPayload,MAX_SHARE_URL} from './music-model.js';
const idPattern=/^[A-Za-z0-9_-]{22}$/;
const failure=(message,{retryable=false,status=0}={})=>Object.assign(Error(message),{retryable,status});
export function shortShareId(input){
 const url=new URL(input),ids=url.searchParams.getAll('share');if(!ids.length)return null;
 if(ids.length!==1||url.searchParams.has('list')||url.href.length>MAX_SHARE_URL||!idPattern.test(ids[0]))throw failure('Повреждённая или неоднозначная короткая ссылка.');return ids[0];
}
export function createMusicShareClient({base=new URL('../',import.meta.url),fetchImpl=(...args)=>fetch(...args),timeoutMs=10000,newRequestId=()=>crypto.randomUUID()}={}){
 const origin=new URL(base),endpoint=apiURL('api/playlists',origin),publications=new Map();
 async function request(url,{signal,...options}={}){
  const controller=new AbortController(),abort=()=>controller.abort();
  if(signal?.aborted)controller.abort();else signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(abort,timeoutMs);
  try{
   // Public API uses no cookies, including on a separate API hostname.
   const response=await fetchImpl(url,{...options,signal:controller.signal,credentials:'omit',cache:'no-store'});
   const text=await response.text();if(new TextEncoder().encode(text).length>100*1024)throw failure('Некорректный ответ сервиса ссылок.');
   let data;try{data=JSON.parse(text);}catch{throw failure('Сервис коротких ссылок недоступен. Локальный плейлист не изменён.',{retryable:true});}
   if(!response.ok)throw failure(typeof data.error==='string'?data.error:'Не удалось получить плейлист.',{status:response.status,retryable:response.status>=500||response.status===429});
   return data;
  }catch(error){
   if(signal?.aborted)throw Object.assign(Error('Загрузка отменена'),{name:'AbortError'});
   if(error&&typeof error==='object'&&'retryable'in error)throw error;
   throw failure('Не удалось связаться с сервисом ссылок. Локальный плейлист не изменён. Повторите попытку.',{retryable:true});
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
 }
 return {
  async publish(playlist){
   // Freeze the payload before the first await. Retries keep the same requestId.
   const payload=sharedPlaylistPayload(playlist),key=JSON.stringify(payload);
   let entry=publications.get(key);if(!entry){entry={requestId:newRequestId()};publications.set(key,entry);}
   if(entry.url)return entry.url;if(entry.pending)return entry.pending;
   entry.pending=(async()=>{const data=await request(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:entry.requestId,playlist:payload})});
    if(!idPattern.test(data.id??''))throw failure('Сервис вернул некорректную ссылку.');
    const url=new URL(origin);url.search='';url.hash='';url.searchParams.set('music','playlists');url.searchParams.set('share',data.id);entry.url=url.href;return entry.url;
   })().finally(()=>entry.pending=null);return entry.pending;
  },
  async load(input,{signal}={}){
   const id=shortShareId(input);if(id===null)return readShared(input);
   const data=await request(apiURL('api/playlists/'+id,origin),{signal});
   if(data.id!==id)throw failure('Сервис вернул другой плейлист.');
   try{return parseSharedPayload(data.playlist);}catch{throw failure('Сервис вернул повреждённый плейлист.');}
  }
 };
}
