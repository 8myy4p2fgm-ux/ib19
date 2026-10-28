import test from 'node:test';import assert from 'node:assert/strict';import {readFile,mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import {Miniflare} from '../backend/chat/node_modules/miniflare/dist/src/index.js';
let original=await readFile(new URL('../backend/chat/worker.mjs',import.meta.url),'utf8');
const corsSource=await readFile(new URL('../backend/chat/api-cors.mjs',import.meta.url),'utf8');
original=original.replace("import {preflight,withCors} from './api-cors.mjs';",corsSource.replaceAll('export function','function'));


// Private instrumentation bypasses only test routes; application ingress stays strict.
const base=original.replace('export default {async fetch','const productionWorker={async fetch')+`
export default {fetch(request,env){if(new URL(request.url).pathname.startsWith('/api/chat/test-'))return env.CHAT_ROOM.get(env.CHAT_ROOM.idFromName('common-room')).fetch(request);return productionWorker.fetch(request,env);}};
`;

const source=base.replace('export class ChatRoom','class BaseChatRoom')+`
export class ChatRoom extends BaseChatRoom {
 constructor(ctx,env){super(ctx,env);this.boot=crypto.randomUUID();this.metrics={sqlStatements:0,rowsWritten:0,rowsRead:0,handlerCalls:0};const sql=this.sql;this.sql={exec:(q,...args)=>{const cursor=sql.exec(q,...args),rows=[...cursor];if(/^\\s*(INSERT|UPDATE|DELETE)/i.test(q))this.metrics.sqlStatements++;this.metrics.rowsWritten+=cursor.rowsWritten;this.metrics.rowsRead+=cursor.rowsRead;return rows;}};}
 async fetch(request){const p=new URL(request.url).pathname;
  if(p==='/api/chat/test-metrics'){const result={...this.metrics,boot:this.boot};this.metrics={sqlStatements:0,rowsWritten:0,rowsRead:0,handlerCalls:0};return Response.json(result);}
  if(p==='/api/chat/test-recreate'){const restored=new BaseChatRoom(this.ctx,this.env);return Response.json({count:restored.online().length,timestamps:this.ctx.getWebSockets().map(ws=>this.ctx.getWebSocketAutoResponseTimestamp(ws)?.getTime()||0)});}
  if(p==='/api/chat/test-cost-units'){
   const sql=this.ctx.storage.sql;
   const m=[...sql.exec('SELECT token,seen FROM members LIMIT 1')][0];
   const checkpoint=sql.exec('UPDATE members SET seen=seen WHERE token=?',m.token);[...checkpoint];
   sql.exec("INSERT OR REPLACE INTO limits VALUES('cost-unit',1,0)");
   const cleanup=sql.exec("DELETE FROM limits WHERE key='cost-unit'");[...cleanup];
   return Response.json({checkpointRows:checkpoint.rowsWritten,expiredLimitRows:cleanup.rowsWritten});
  }
  if(p==='/api/chat/test-member'){const token=new URL(request.url).searchParams.get('token');return Response.json(this.one('SELECT seen,active FROM members WHERE token=?',token));}
  return super.fetch(request);
 }
 async webSocketMessage(ws,raw){this.metrics.handlerCalls++;return super.webSocketMessage(ws,raw);}
}`;
function client(ws){const items=[];const pending=[];ws.addEventListener('message',e=>{const data=JSON.parse(e.data);items.push(data);for(const p of [...pending])if(p.type===data.type){clearTimeout(p.timer);pending.splice(pending.indexOf(p),1);p.resolve(data);}});ws.accept();return {ws,items,request(data,type){const promise=new Promise((resolve,reject)=>{const p={type,resolve,timer:setTimeout(()=>reject(Error('Timeout waiting '+type)),4000)};pending.push(p);});ws.send(JSON.stringify(data));return promise;}};}
const results=[];
test('actual workerd: 10/50/100 sockets, zero heartbeat SQL, native timestamps, hibernation/restart and caps',async()=>{
 for(const n of [10,50,100]){
  const dir=await mkdtemp(path.join(tmpdir(),'chat02-runtime-'));const options={modules:true,script:source,compatibilityDate:'2026-07-01',durableObjects:{CHAT_ROOM:{className:'ChatRoom',useSQLite:true}},durableObjectsPersist:dir,bindings:{ALLOWED_ORIGIN:'http://chat.test',NETWORK_SECRET:'test-network-secret',ADMIN_TOKEN:'test-admin-token-32-characters-long'}};
  let mf=new Miniflare(options);const clients=[];
  const req=(p,ip='192.0.2.1')=>mf.dispatchFetch('http://chat.test/api/chat/'+p,{headers:{Origin:'http://chat.test','CF-Connecting-IP':ip}});
  async function open(ip){const response=await mf.dispatchFetch('http://chat.test/api/chat/socket',{headers:{Origin:'http://chat.test','CF-Connecting-IP':ip,Upgrade:'websocket'}});if(response.status!==101)return response;return client(response.webSocket);}
  try{
   for(let i=0;i<n;i++){const c=await open('192.0.2.'+(i+1));assert(c.ws);const joined=await c.request({type:'join',nick:'Участник '+i},'joined');c.token=joined.token;clients.push(c);}
   await req('test-metrics');
   await Promise.all(clients.map(c=>c.request({type:'ping'},'pong')));
   const pingMetrics=await (await req('test-metrics')).json();assert.equal(pingMetrics.handlerCalls,0);assert.equal(pingMetrics.rowsWritten,0);assert.equal(pingMetrics.sqlStatements,0);
   const restored=await (await req('test-recreate')).json();assert.equal(restored.count,n);assert(restored.timestamps.every(t=>t>0));
   let observedHibernation=null;
   if(n===10){
    const before=await (await req('test-metrics')).json();await new Promise(r=>setTimeout(r,12000));await clients[0].request({type:'ping'},'pong');const after=await (await req('test-metrics')).json();observedHibernation=before.boot!==after.boot;
   }
   await req('test-metrics');
   const msg={type:'message',text:'Доставка всем '+n,id:'workerd-load-message-'+n};await clients[0].request(msg,'ack');const messageMetrics=await (await req('test-metrics')).json();const writeUnits=await (await req('test-cost-units')).json();
   for(const c of clients)assert.equal(c.items.filter(x=>x.type==='message'&&x.message.body===msg.text).length,1);
   await clients[0].request(msg,'ack');assert.equal(clients.at(-1).items.filter(x=>x.type==='message'&&x.message.body===msg.text).length,1);
   for(let i=0;i<7;i++)await clients[0].request({...msg,id:'runtime-rate-message-'+i},'ack');assert.match((await clients[0].request({...msg,id:'runtime-rate-message-9'},'error')).error,/часто/);
   if(n===10){
    const nat=[];for(let i=0;i<5;i++){const c=await open('198.51.100.1');assert(c.ws);nat.push(c);}assert.equal((await open('198.51.100.1')).status,429);for(const c of nat)c.ws.close();
   }
   if(n===100)assert.equal((await open('203.0.113.1')).status,429);
   const token=clients[0].token;for(const c of clients)c.ws.close();await new Promise(r=>setTimeout(r,30));
   const saved=await (await req('test-member?token='+token)).json();assert(saved.seen>0);
   await mf.dispose();mf=new Miniflare(options);
   const reconnected=await open('192.0.2.1');const joined=await reconnected.request({type:'join',nick:'Участник 0',token},'joined');assert.equal(joined.token,token);await reconnected.request(msg,'ack');const history=reconnected.items.find(x=>x.type==='history');assert.equal(history.messages.filter(x=>x.body===msg.text&&x.kind==='user').length,8); // 1 original plus 7 distinct messages
   reconnected.ws.close();results.push({connections:n,heartbeat:pingMetrics,message:messageMetrics,writeUnits,constructorRestored:restored.count,observedNaturalHibernation:observedHibernation,restartSameToken:true,duplicateFanout:false});
  }finally{await mf.dispose();await rm(dir,{recursive:true,force:true});}
 }
 await mkdir('docs/diagnostics/chat02',{recursive:true});await writeFile('docs/diagnostics/chat02/runtime.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
});


test('actual workerd cursor billing counters: thirty baseline vs optimized heartbeats',async()=>{
 const baseline=await readFile(new URL('./fixtures/chat02/worker-before.mjs',import.meta.url),'utf8');
 const instrumentation=source.slice(source.indexOf('\nexport class ChatRoom extends BaseChatRoom'));
 const report={};
 for(const [name,script] of [['before',baseline.replace('export class ChatRoom','class BaseChatRoom')+instrumentation],['after',source]]){
  const dir=await mkdtemp(path.join(tmpdir(),'chat02-native-metric-'));
  const mf=new Miniflare({modules:true,script,compatibilityDate:'2026-07-01',durableObjects:{CHAT_ROOM:{className:'ChatRoom',useSQLite:true}},durableObjectsPersist:dir,bindings:{ALLOWED_ORIGIN:'http://chat.test',NETWORK_SECRET:'native-metric-secret'}});
  const headers={Origin:'http://chat.test','CF-Connecting-IP':'192.0.2.1'};
  try{
   const r=await mf.dispatchFetch('http://chat.test/api/chat/socket',{headers:{...headers,Upgrade:'websocket'}});assert.equal(r.status,101);const c=client(r.webSocket);await c.request({type:'join',nick:'Замер'},'joined');
   await mf.dispatchFetch('http://chat.test/api/chat/test-metrics',{headers});
   for(let i=0;i<30;i++)await c.request({type:'ping'},'pong');
   report[name]=await (await mf.dispatchFetch('http://chat.test/api/chat/test-metrics',{headers})).json();c.ws.close();
  }finally{await mf.dispose();await rm(dir,{recursive:true,force:true});}
 }
 assert.equal(report.before.sqlStatements,60);assert(report.before.rowsWritten>=60);assert.equal(report.after.sqlStatements,0);assert.equal(report.after.rowsWritten,0);assert.equal(report.after.rowsRead,0);assert.equal(report.after.handlerCalls,0);
 await mkdir('docs/diagnostics/chat02',{recursive:true});await writeFile('docs/diagnostics/chat02/native-heartbeat.json',JSON.stringify({heartbeats:30,...report},null,2));console.log(JSON.stringify(report,null,2));
});
