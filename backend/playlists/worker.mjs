// Public API on the exact /api/playlists* route. No workers.dev/preview URL.
import {createPlaylistAPI} from './api.mjs';import {createPlaylistStore} from './store.mjs';
export default {async fetch(request,env){
 const unavailable=()=>Response.json({error:'Сервис ссылок временно недоступен. Локальный плейлист не изменён.'},{status:503,headers:{'Cache-Control':'no-store'}});
 try{
 if(!env.PLAYLIST_DB||typeof env.PLAYLIST_RATE_SECRET!=='string'||env.PLAYLIST_RATE_SECRET.length<32)return unavailable();
 const url=new URL(request.url);if(url.origin!=='https://tuz19.ru')return new Response('Not found',{status:404});
 // Cloudflare supplies this at the edge. Never trust a caller-provided custom IP header.
 const clientIP=request.headers.get('CF-Connecting-IP');if(!clientIP||clientIP.length>128)return unavailable();
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.PLAYLIST_RATE_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const digest=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(clientIP));
 const clientKey=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 return createPlaylistAPI({store:createPlaylistStore(env.PLAYLIST_DB)})(request,clientKey);
 }catch{return unavailable();}
}};
