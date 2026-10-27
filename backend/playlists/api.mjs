import {parseSharedPayload} from '../../js/music-model.js';
export const MAX_PLAYLIST_BODY=96*1024;
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(v);
export const validShareId=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{22}$/.test(id);
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(status,body,extra={})=>new Response(JSON.stringify(body),{status,headers:{...headers,...extra}});
async function readBody(request){
 if(Number(request.headers.get('content-length'))>MAX_PLAYLIST_BODY)throw Object.assign(Error(),{status:413});
 const reader=request.body?.getReader();if(!reader)throw Object.assign(Error(),{status:400});
 let size=0,chunks=[];
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_PLAYLIST_BODY){await reader.cancel();throw Object.assign(Error(),{status:413});}chunks.push(value);}}
 finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw Object.assign(Error(),{status:400});}
}
function randomId(){const bytes=crypto.getRandomValues(new Uint8Array(16));return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');}
export function createPlaylistAPI({store,now=Date.now,newId=randomId,limits={},quota={}}){
 return async function handle(request,clientKey='loopback'){
  const url=new URL(request.url),match=url.pathname.match(/^\/api\/playlists\/([A-Za-z0-9_-]{22})$/);
  if(url.pathname!=='/api/playlists'&&!match)return json(404,{error:'Ссылка на плейлист не найдена.'});
  try{
   if(match){
    if(request.method!=='GET')return json(405,{error:'Метод не поддерживается.'},{Allow:'GET'});
    const record=await store.get(match[1]);if(!record)return json(404,{error:'Плейлист не найден или ссылка больше недоступна.'});
    return json(200,{id:record.id,createdAt:record.created_at,playlist:JSON.parse(record.payload)});
   }
   if(request.method!=='POST')return json(405,{error:'Метод не поддерживается.'},{Allow:'POST'});
   if(request.headers.get('origin')!==url.origin)return json(403,{error:'Создание ссылки разрешено только со страницы TUZ19.'});
   if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')return json(415,{error:'Требуется JSON.'});
   const body=await readBody(request);
   if(!body||!uuid(body.requestId)||Object.keys(body).some(k=>!['requestId','playlist'].includes(k)))return json(400,{error:'Некорректный запрос.'});
   let playlist;try{playlist=parseSharedPayload(body.playlist);}catch{return json(400,{error:'Некорректный плейлист: проверьте название и идентификаторы треков.'});}
   const payload=JSON.stringify({v:1,name:playlist.name,tracks:playlist.tracks.map(k=>k.split(':'))});
   const repeated=await store.byRequest(body.requestId);
   if(repeated)return repeated.payload===payload?json(200,{id:repeated.id}):json(409,{error:'Этот запрос уже использован для другого плейлиста.'});
   const stamp=now();if(!await store.allow(clientKey,stamp,limits))return json(429,{error:'Слишком много новых ссылок. Повторите позже.'},{'Retry-After':'60'});
   for(let attempt=0;attempt<3;attempt++){
    const id=newId();if(!validShareId(id))throw Error('Invalid generated ID');
    try{
     const inserted=await store.insert({id,requestId:body.requestId,payload,bytes:new TextEncoder().encode(payload).length,createdAt:new Date(stamp).toISOString()},quota);
     if(!inserted)return json(503,{error:'Хранилище новых ссылок заполнено. Локальный плейлист не изменён.'});
     return json(201,{id});
    }catch(error){
     const committed=await store.byRequest(body.requestId);
     if(committed)return committed.payload===payload?json(200,{id:committed.id}):json(409,{error:'Этот запрос уже использован для другого плейлиста.'});
     if(!await store.get(id))throw error;
    }
   }throw Error('ID collision');
  }catch(error){return json(error.status===413?413:error.status===400?400:503,{error:error.status===413?'Плейлист слишком большой: не больше 96 КиБ.':error.status===400?'Повреждённый JSON или неверная кодировка.':'Сервис ссылок временно недоступен. Локальный плейлист не изменён.'});}
 };
}
