import {tmpdir} from 'node:os';
// Test/local-only multi-worker runtime: no remote fetch, credentials or deployment.
import '../../scripts/local-network-guard.mjs';
import http from 'node:http';import path from 'node:path';import {fileURLToPath} from 'node:url';import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';import {randomBytes} from 'node:crypto';
import {Miniflare} from 'miniflare';import {WebSocketServer} from 'ws';
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
export async function startIntegratedChat({port=0,assetDir=path.join(root,'.chat-integration-artifacts/on'),gatewayEnabled=true}={}){
 const stateDir=await mkdtemp(tmpdir()+'/tuz19-chat-integrated-'),origin='https://tuz19.ru';
 const secrets={owner:randomBytes(32).toString('hex'),session:randomBytes(32).toString('hex'),admin:randomBytes(32).toString('hex'),network:randomBytes(32).toString('hex')};
 const fixtureDir=path.join(root,'.chat-integration-artifacts','runtime-'+randomBytes(8).toString('hex'));await mkdir(fixtureDir,{recursive:true});const gatewayFile=path.join(fixtureDir,'gateway-entry.mjs');
 await writeFile(gatewayFile,`import {createHandler} from '../../cloudflare/maintenance/worker.mjs';let enabled=${gatewayEnabled};export default {async fetch(r,env){const u=new URL(r.url);if(u.pathname==='/__fixture/gateway'){enabled=u.searchParams.get('enabled')==='true';return Response.json({ok:true});}return createHandler({upstream:q=>env.PAGES.fetch(q)})(r,{...env,CHAT_API_ENABLED:String(enabled)});}};`);
 const rollbackFile=path.join(fixtureDir,'gateway-rollback.mjs');await writeFile(rollbackFile,"import {createHandler} from '../../tests/fixtures/chat-integration/maintenance-baseline.mjs';export default {fetch(r,env){return createHandler({upstream:q=>env.PAGES.fetch(q)})(r,env);}}");
 const base=await readFile(path.join(root,'backend/chat/worker.mjs'),'utf8');
 const script=base.replace('export class ChatRoom','class BaseChatRoom')+`\nexport class ChatRoom extends BaseChatRoom{constructor(c,e){super(c,e);this.metrics={queries:0,writes:0,handlerCalls:0};const sql=this.sql;this.sql={exec:(q,...a)=>{const cursor=sql.exec(q,...a),rows=[...cursor];this.metrics.queries++;this.metrics.writes+=cursor.rowsWritten;return rows;}};}async fetch(r){const u=new URL(r.url);if(u.pathname==='/__fixture/revoke'){return super.fetch(new Request('https://tuz19.ru/api/chat/_gateway/revoke',{method:'POST',headers:{'X-Chat-Access-Until':u.searchParams.get('until'),'X-Chat-Access-Session':u.searchParams.get('session'),'X-Chat-Network':u.searchParams.get('network'),'X-Chat-Gateway-Action':'revoke'}}));}if(u.pathname==='/__fixture/alarm'){await this.alarm();return Response.json({ok:true});}if(u.pathname==='/__fixture/metrics'){const data={...this.metrics};this.metrics={queries:0,writes:0,handlerCalls:0};return Response.json(data);}return super.fetch(r);}async webSocketMessage(w,r){this.metrics.handlerCalls++;return super.webSocketMessage(w,r);}}`;
 const options={durableObjectsPersist:path.join(stateDir,'durable'),workers:[
 {name:'gateway',modules:true,modulesRoot:root,scriptPath:gatewayFile,compatibilityDate:'2026-07-01',serviceBindings:{CHAT_BACKEND:'chat-backend',PAGES:'pages'},bindings:{OWNER_PASSWORD:secrets.owner,SESSION_KEY:secrets.session},ratelimits:{LOGIN_LIMITER:{namespace_id:'1902',simple:{limit:5,period:60}}}},
 {name:'chat-backend',modules:true,script,compatibilityDate:'2026-07-01',durableObjects:{CHAT_ROOM:{className:'ChatRoom',useSQLite:true}},bindings:{ALLOWED_ORIGIN:origin,ADMIN_TOKEN:secrets.admin,NETWORK_SECRET:secrets.network,CHAT_ENABLED:'true',REQUIRE_GATEWAY_ACCESS:'true'}},
 {name:'pages',modules:true,script:'export default {fetch(r,env){return env.ASSETS.fetch(r)}}',compatibilityDate:'2026-07-01',assets:{directory:assetDir,binding:'ASSETS',routerConfig:{invoke_user_worker_ahead_of_assets:true,has_user_worker:true}}}
 ]};let mf=new Miniflare(options);await mf.ready;
 const sockets=new WebSocketServer({noServer:true,maxPayload:4096});let url;
 function headers(req){const h=new Headers(req.headers);h.set('CF-Connecting-IP',req.socket.remoteAddress);if(h.get('Origin')===url)h.set('Origin',origin);return h;}
 const server=http.createServer(async(req,res)=>{try{
  if(req.headers.host!==new URL(url).host||req.url.startsWith('/__fixture')){res.writeHead(404).end();return;}
  let length=0,parts=[];for await(const b of req){length+=b.length;if(length>4096){res.writeHead(413).end();return;}parts.push(b);}
  const r=await mf.dispatchFetch(new URL(req.url,origin),{method:req.method,redirect:'manual',headers:headers(req),...(req.method==='POST'?{body:Buffer.concat(parts)}:{})});
  const outgoing=new Headers(r.headers),location=outgoing.get('Location');
  if(location){const redirect=new URL(location,origin);if(redirect.origin!==origin){res.writeHead(503).end('External redirect blocked locally');return;}outgoing.set('Location',url+redirect.pathname+redirect.search+redirect.hash);}
  const policy=outgoing.get('Content-Security-Policy');
  if(policy)outgoing.set('Content-Security-Policy',policy.replaceAll('wss://tuz19.ru','ws://'+new URL(url).host));
  else if(outgoing.get('Content-Type')?.includes('text/html'))outgoing.set('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws://"+new URL(url).host+"; font-src 'self' data:; object-src 'none'; form-action 'self'; frame-ancestors 'none'");
  res.writeHead(r.status,Object.fromEntries(outgoing));res.end(Buffer.from(await r.arrayBuffer()));
 }catch{res.writeHead(503).end('Local runtime unavailable');}});
 await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));url=`http://127.0.0.1:${server.address().port}`;
 server.on('upgrade',async(req,socket,head)=>{try{
  const r=await mf.dispatchFetch(new URL(req.url,origin),{headers:headers(req)});if(r.status!==101||!r.webSocket){socket.end(`HTTP/1.1 ${r.status} Rejected\r\nConnection: close\r\n\r\n`);return;}
  sockets.handleUpgrade(req,socket,head,ws=>{const peer=r.webSocket;peer.addEventListener('message',e=>{if(ws.readyState===1)ws.send(e.data);});peer.addEventListener('close',e=>{if(ws.readyState===1)ws.close(e.code>=4000?e.code:1000);});peer.addEventListener('error',()=>ws.terminate());ws.on('message',(b,binary)=>{try{peer.send(binary?b:b.toString());}catch{ws.terminate();}});ws.on('close',()=>{try{peer.close(1000,'Transport closed');}catch{}});peer.accept();});
 }catch{socket.end('HTTP/1.1 503 Unavailable\r\nConnection: close\r\n\r\n');}});
 return {url,origin,secrets,get mf(){return mf;},async gatewayEnabled(value){const w=await mf.getWorker('gateway');await w.fetch(origin+'/__fixture/gateway?enabled='+value);},async fixture(action){const ns=await mf.getDurableObjectNamespace('CHAT_ROOM','chat-backend'),stub=ns.get(ns.idFromName('common-room'));return (await stub.fetch(origin+'/__fixture/'+action)).json();},async restart(){await mf.dispose();mf=new Miniflare(options);await mf.ready;},async rollbackGateway(){await mf.dispose();options.workers[0].scriptPath=rollbackFile;mf=new Miniflare(options);await mf.ready;},async restoreGateway(){await mf.dispose();options.workers[0].scriptPath=gatewayFile;mf=new Miniflare(options);await mf.ready;},disconnect(){for(const s of sockets.clients)s.terminate();},async close(){for(const s of sockets.clients)s.terminate();await new Promise(resolve=>sockets.close(resolve));await new Promise(resolve=>server.close(resolve));await mf.dispose();await rm(stateDir,{recursive:true,force:true});await rm(fixtureDir,{recursive:true,force:true});}};
}
