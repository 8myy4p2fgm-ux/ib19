import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Miniflare} from '../backend/chat/node_modules/miniflare/dist/src/index.js';
let original=await readFile(new URL('../backend/chat/worker.mjs',import.meta.url),'utf8');
const corsSource=await readFile(new URL('../backend/chat/api-cors.mjs',import.meta.url),'utf8');
original=original.replace("import {preflight,withCors} from './api-cors.mjs';",corsSource.replaceAll('export function','function'));


// Private instrumentation bypasses only test routes; application ingress stays strict.
const base=original.replace('export default {async fetch','const productionWorker={async fetch')+`
export default {fetch(request,env){if(new URL(request.url).pathname.startsWith('/api/chat/test-'))return env.CHAT_ROOM.get(env.CHAT_ROOM.idFromName('common-room')).fetch(request);return productionWorker.fetch(request,env);}};
`;

// This storage probe is injected only into a temporary test Worker. It is never
// present in the actual application module or any publishable artifact.
const script=base.replace('export class ChatRoom','class BaseChatRoom')+`
export class ChatRoom extends BaseChatRoom {
 async fetch(request){
  if(new URL(request.url).pathname==='/api/chat/test-seed'){
   this.sql.exec("INSERT INTO messages(kind,nick,body,ts) VALUES('user','Тест','expired user',?)",Date.now()-86400001);
   this.sql.exec("INSERT INTO messages(kind,nick,body,ts) VALUES('system','Тест','expired system',?)",Date.now()-86400001);
   this.sql.exec("INSERT INTO messages(kind,nick,body,ts) VALUES('user','Тест','fresh',?)",Date.now());
   await this.alarm();
   return Response.json({old:this.one('SELECT COUNT(*) AS n FROM messages WHERE ts<=?',Date.now()-86400000).n,fresh:this.one(\"SELECT COUNT(*) AS n FROM messages WHERE body='fresh'\").n,alarm:await this.ctx.storage.getAlarm()});
  }
  if(new URL(request.url).pathname==='/api/chat/test-alarm'){this.sql.exec("INSERT INTO members VALUES('alarm-token','Alarm','alarm','net',?,1,?)",Date.now()-76000,Date.now()+86400000);await this.ctx.storage.setAlarm(Date.now()+100);return Response.json({ok:true});}
  if(new URL(request.url).pathname==='/api/chat/test-active')return Response.json({n:this.one('SELECT COUNT(*) AS n FROM members WHERE active=1').n,alarm:await this.ctx.storage.getAlarm(),now:Date.now()});
  if(new URL(request.url).pathname==='/api/chat/test-count')return Response.json({fresh:this.one(\"SELECT COUNT(*) AS n FROM messages WHERE body='fresh'\").n});
  return super.fetch(request);
 }
}`;
test('actual Miniflare SQLite DO: alarm deletion, persistence, Origin, request and connection caps',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'chat-runtime-'));
 const options={modules:true,script,compatibilityDate:'2026-07-01',durableObjects:{CHAT_ROOM:{className:'ChatRoom',useSQLite:true}},durableObjectsPersist:dir,bindings:{ALLOWED_ORIGIN:'http://chat.test',ADMIN_TOKEN:'runtime-admin-key-32-characters-long',NETWORK_SECRET:'test-network-secret'}};
 let mf=new Miniflare(options);const sockets=[];
 const request=(p,init={})=>mf.dispatchFetch('http://chat.test/api/chat/'+p,{...init,headers:{Origin:'http://chat.test','CF-Connecting-IP':'192.0.2.1',...init.headers}});
 try{
  assert.equal((await request('status',{headers:{Origin:'https://evil.example'}})).status,403);
  const publicResponse=await mf.dispatchFetch('http://chat.test/api/chat/presence',{headers:{'Sec-Fetch-Site':'same-origin','CF-Connecting-IP':'192.0.2.1'}});assert.equal(publicResponse.status,200);assert.deepEqual(Object.keys(await publicResponse.json()).sort(),['count','updatedAt','users']);
  assert.equal((await request('presence',{headers:{Origin:'https://evil.example'}})).status,403);
  assert.equal((await request('presence',{method:'POST',body:'{}'})).status,405);
  assert.equal((await request('admin',{method:'POST',body:'x'.repeat(4097)})).status,413);
  const retention=await (await request('test-seed')).json();assert.equal(retention.old,0);assert.equal(retention.fresh,1);assert(retention.alarm>Date.now());
  for(let i=0;i<5;i++){const r=await request('socket',{headers:{Upgrade:'websocket'}});assert.equal(r.status,101);r.webSocket.accept();sockets.push(r.webSocket);}
  assert.equal((await request('socket',{headers:{Upgrade:'websocket'}})).status,429);
  for(const s of sockets)s.close();await request('test-alarm');await new Promise(r=>setTimeout(r,1000));assert.equal((await (await request('test-active')).json()).n,0);await mf.dispose();mf=new Miniflare(options);
  assert.equal((await (await request('test-count')).json()).fresh,1);
 }finally{await mf.dispose();await rm(dir,{recursive:true,force:true});}
});
