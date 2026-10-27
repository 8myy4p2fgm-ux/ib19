import {validKey} from './music-model.js';
// Approved source; no discovery requests, MP3 mirror or arbitrary imported URLs.
export const MUSIC_MEDIA_CSP="media-src 'self' blob: https://api.19ib.ru https://bwqpl8kb2c.cdn.twcstorage.ru";
export function musicAudioEnabled(location){
 const url=new URL(location.href);
 return url.origin==='https://tuz19.ru'||(['localhost','127.0.0.1','[::1]'].includes(url.hostname)&&url.searchParams.get('audio')==='1');
}
export function createMusicSourceResolver(catalog){
 const known=new Map(catalog.filter(t=>t.confirmed&&validKey(t.key)&&t.key===t.roundId+':'+t.trackId).map(t=>[t.key,t.trackId]));
 return key=>known.has(key)?'https://api.19ib.ru/tracks/'+known.get(key)+'/stream':null;
}
