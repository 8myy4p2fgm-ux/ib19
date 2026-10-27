import api from './worker.mjs';
export {ChatRoom} from './worker.mjs';
export default {async fetch(request,env){
 const url=new URL(request.url);
 if(url.pathname.startsWith('/api/chat/'))return api.fetch(request,env);
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 if(url.pathname==='/chat')return new Response(null,{status:302,headers:{Location:'/chat/'}});
 let name;try{name=decodeURIComponent(url.pathname);}catch{return new Response('Not found',{status:404});}
 if(name.split('/').some(p=>p.startsWith('.'))||!(/^\/(?:chat\/|css\/|js\/|public-data\/|horo\/|data\/rounds\/r2-submissions\.v1\/snapshot\.json$|(?:dynamics|judges|rappers|events)\/$)/.test(name)||name==='/'))return new Response('Not found',{status:404});
 const response=await env.ASSETS.fetch(request),headers=new Headers(response.headers);
 const origin=new URL(env.ALLOWED_ORIGIN);
 headers.set('Content-Security-Policy',`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' wss://${origin.host}; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'`);
 headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','no-referrer');headers.set('Cache-Control','no-cache');
 return new Response(response.body,{status:response.status,headers});
}};
