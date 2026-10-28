import test from 'node:test';import assert from 'node:assert/strict';
import {apiBaseFor,apiURL,chatSocketURL} from '../js/api-config.js';
import {createMusicShareClient} from '../js/music-share.js';
import chat from '../backend/chat/worker.mjs';import playlists from '../backend/playlists/worker.mjs';
import {createPlaylistAPI} from '../backend/playlists/api.mjs';
const site='https://tuz19.ru',api='https://api.tuz19.ru',req=(path,method='GET',headers={},body)=>new Request(api+path,{method,headers:{Origin:site,...headers},...(body?{body}:{} )});
test('one API config separates site links, HTTPS/WSS, loopback and rejects arbitrary destinations',()=>{
 assert.equal(apiBaseFor(site).href,api+'/');assert.equal(apiURL('api/chat/presence',site).href,api+'/api/chat/presence');assert.equal(chatSocketURL(site),'wss://api.tuz19.ru/api/chat/socket');assert.equal(chatSocketURL('http://127.0.0.1:8888/'),'ws://127.0.0.1:8888/api/chat/socket');assert.throws(()=>apiBaseFor('https://evil.test/'));for(const p of ['//evil.test','api/chat/../admin','api/playlists?x'])assert.throws(()=>apiURL(p,site));
});
test('public playlist URLs stay on site; API GET/POST omit credentials and retries preserve IDs',async()=>{
 const id='a'.repeat(22),calls=[],playlist={v:1,id:'local',name:'Тест',tracks:['c3c5b2f7-9d61-4ffc-8f97-f1b50156d59c:00000000-0000-4000-8000-000000000001']};
 const client=createMusicShareClient({base:site+'/',fetchImpl:async(u,o)=>{calls.push([u.href,o]);return Response.json({id,playlist:{v:1,name:playlist.name,tracks:playlist.tracks.map(x=>x.split(':'))}});}});
 assert.equal(await client.publish(playlist),site+'/?music=playlists&share='+id);assert.equal((await client.load(site+'/?music=playlists&share='+id)).name,playlist.name);assert.deepEqual(calls.map(x=>x[0]),[api+'/api/playlists',api+'/api/playlists/'+id]);assert(calls.every(x=>x[1].credentials==='omit'));
});
test('chat exact CORS, preflight, host, auth, error responses and existing room identity',async()=>{
 let dispatched=0;const env={API_ORIGIN:api,ALLOWED_ORIGIN:site,ADMIN_TOKEN:'a'.repeat(32),NETWORK_SECRET:'fixture',CHAT_ROOM:{idFromName(n){assert.equal(n,'common-room');return n;},get(){return {fetch(){dispatched++;return Response.json({users:[],count:0,updatedAt:1});}};}}};
 const pre=await chat.fetch(req('/api/chat/admin','OPTIONS',{'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type, authorization'}),env);assert.equal(pre.status,204);assert.equal(dispatched,0);assert.equal(pre.headers.get('Access-Control-Allow-Origin'),site);assert.equal(pre.headers.get('Access-Control-Allow-Credentials'),null);
 for(const headers of [{Origin:'https://evil.test'},{'Access-Control-Request-Headers':'x-evil'},{'Access-Control-Request-Method':'DELETE'}]){const r=await chat.fetch(req('/api/chat/admin','OPTIONS',{'Access-Control-Request-Method':'POST',...headers}),env);assert.equal(r.status,403);assert.equal(r.headers.get('Access-Control-Allow-Origin'),null);}
 assert.equal((await chat.fetch(req('/api/chat/admin','POST',{},'{}'),env)).status,403);assert.equal(dispatched,0);
 assert.equal((await chat.fetch(new Request('https://evil.test/api/chat/status',{headers:{Origin:site}}),env)).status,404);
 for(const path of ['/api/chat/presence','/api/chat/socket']){const wrong=await chat.fetch(req(path,'GET',{Origin:'https://evil.test'}),env);assert.equal(wrong.status,403);assert.equal(wrong.headers.get('Access-Control-Allow-Origin'),null);}
 const r=await chat.fetch(req('/api/chat/presence','GET',{'CF-Connecting-IP':'127.0.0.1'}),env);assert.equal(r.status,200);assert.equal(dispatched,1);assert.equal(r.headers.get('Access-Control-Allow-Origin'),site);assert.match(r.headers.get('Vary'),/Origin/);
 const error=await chat.fetch(req('/api/chat/status'),env);assert.equal(error.status,403);assert.equal(error.headers.get('Access-Control-Allow-Origin'),site);
});
test('playlist edge rejects invalid origins/hosts/preflights; readable failures and no credential CORS',async()=>{
 const env={API_ORIGIN:api,ALLOWED_ORIGIN:site};
 const r=await playlists.fetch(req('/api/playlists','OPTIONS',{'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}),env);assert.equal(r.status,204);assert.equal(r.headers.get('Access-Control-Allow-Origin'),site);assert.equal(r.headers.get('Access-Control-Allow-Credentials'),null);
 for(const h of [{Origin:'https://evil.test'},{'Access-Control-Request-Headers':'authorization'},{'Access-Control-Request-Method':'PUT'}])assert.equal((await playlists.fetch(req('/api/playlists','OPTIONS',{'Access-Control-Request-Method':'POST',...h}),env)).status,403);
 assert.equal((await playlists.fetch(new Request('https://evil.test/api/playlists'),env)).status,404);
 const error=await playlists.fetch(req('/api/playlists','POST',{'Content-Type':'application/json'},'{}'),env);assert.equal(error.status,503);assert.equal(error.headers.get('Access-Control-Allow-Origin'),site);
});
test('cross-origin playlist POST preserves validation, idempotency, quota and existing IDs',async()=>{
 let row,insertions=0;const store={byRequest:async()=>row,allow:async()=>true,insert:async(r)=>{row={...r,created_at:r.createdAt};insertions++;return true;},get:async()=>row};
 const handle=createPlaylistAPI({store,allowedOrigin:site,newId:()=> 'a'.repeat(22)}),body=JSON.stringify({requestId:'00000000-0000-4000-8000-000000000001',playlist:{v:1,name:'Тест',tracks:[['c3c5b2f7-9d61-4ffc-8f97-f1b50156d59c','00000000-0000-4000-8000-000000000001']]}});
 assert.equal((await handle(req('/api/playlists','POST',{'Content-Type':'application/json'},body))).status,201);assert.equal((await handle(req('/api/playlists','POST',{'Content-Type':'application/json'},body))).status,200);assert.equal(insertions,1);assert.equal((await handle(req('/api/playlists','POST',{'Content-Type':'application/json',Origin:api},body))).status,403);assert.equal((await handle(req('/api/playlists/'+'a'.repeat(22)))).status,200);
});

test('operator uses exact API host with site Origin and never sends a MAINT cookie',async()=>{
 const {controlChat}=await import('../backend/chat/operator.mjs'),fs=await import('node:fs/promises'),{tmpdir}=await import('node:os');const dir=await fs.mkdtemp(tmpdir()+'/recovery-operator-'),file=dir+'/operator.json',calls=[];
 try{await fs.writeFile(file,JSON.stringify({origin:api,access:'public',adminToken:'a'.repeat(32)}),{mode:0o600});const r=await controlChat({action:'on',credentialsFile:file,fetchImpl:async(url,options)=>{calls.push([url,options]);return Response.json({ok:true});}});assert.equal(r.enabled,true);assert.deepEqual(calls.map(x=>x[0]),[api+'/api/chat/admin',api+'/api/chat/status']);assert(calls.every(x=>x[1].headers.Origin===site&&!('Cookie'in x[1].headers)));}finally{await fs.rm(dir,{recursive:true,force:true});}
});
