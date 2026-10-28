// One versioned API policy; no runtime/query-string override or credentials.
export function apiBaseFor(site=new URL('../',import.meta.url)){
 const url=new URL(site);
 if(url.origin==='https://tuz19.ru')return new URL('https://api.tuz19.ru/');
 if(['localhost','127.0.0.1','[::1]'].includes(url.hostname)&&['http:','https:'].includes(url.protocol))return new URL('/',url);
 throw Error('Unsupported API site origin');
}
export function apiURL(path,site){
 if(!/^api\/(?:chat\/[a-z-]+|playlists(?:\/[A-Za-z0-9_-]{22})?)$/.test(path))throw Error('Unsupported API path');
 return new URL(path,apiBaseFor(site));
}
export function chatSocketURL(site){const url=apiURL('api/chat/socket',site);url.protocol=url.protocol==='https:'?'wss:':'ws:';return url.href;}
