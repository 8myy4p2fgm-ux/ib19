import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile,mkdir,writeFile,realpath} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {Miniflare} from 'miniflare';
import {WebSocketServer} from 'ws';
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
const CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'";
async function keyfile(dir,name){const file=path.join(dir,name);try{return (await readFile(file,'utf8')).trim();}catch(e){if(e.code!=='ENOENT')throw e;const key=randomBytes(32).toString('hex');await writeFile(file,key,{mode:0o600,flag:'wx'});return key;}}
export async function startChat({port=8931,stateDir=path.join(root,'.chat-ws-local'),adminToken,networkSecret,enabled=true}={}){
 await mkdir(stateDir,{recursive:true,mode:0o700});
 adminToken??=await keyfile(stateDir,'admin.key');networkSecret??=await keyfile(stateDir,'network.key');
 let mf;const sockets=new WebSocketServer({noServer:true,maxPayload:4096});
 const server=http.createServer(async(req,res)=>{
  const headers={'Content-Security-Policy':CSP,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store','Referrer-Policy':'no-referrer'};
  try{
   if(req.headers.host!==new URL(url).host){res.writeHead(403,headers).end();return;}
   const u=new URL(req.url,url);
   if(u.pathname.startsWith('/api/chat/')){
    let size=0,parts=[];for await(const p of req){size+=p.length;if(size>4096){res.writeHead(413,headers).end();return;}parts.push(p);}
    const h=new Headers(req.headers);h.set('CF-Connecting-IP',req.socket.remoteAddress);h.delete('X-Chat-Network');
    const r=await mf.dispatchFetch(u.href,{method:req.method,headers:h,...(req.method==='POST'?{body:Buffer.concat(parts)}:{})});
    res.writeHead(r.status,{...headers,...Object.fromEntries(r.headers)}).end(await r.text());return;
   }
   if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,headers).end();return;}
   const pathname=decodeURIComponent(u.pathname);
   if(pathname==='/chat'){res.writeHead(302,{...headers,Location:'/chat/'}).end();return;}
   let file=pathname==='/chat/'?'chat/index.html':pathname.slice(1);
   const siteRoute=['/','/dynamics/','/judges/','/rappers/','/events/','/horo/'].includes(pathname);
   if(siteRoute)file=pathname==='/'?'index.html':pathname.slice(1)+'index.html';
   const snapshot=file==='data/rounds/r2-submissions.v1/snapshot.json';
   if(!siteRoute&&!snapshot&&!/^(chat|css|js|public-data|horo)\//.test(file))throw Error('Not public');
   if(file.split('/').some(p=>p.startsWith('.')||!p))throw Error('Not public');
   const base=siteRoute||snapshot||file.startsWith('horo/')||file.startsWith('public-data/')||/^js\/[\w-]+\.[a-f0-9]{16}\.js$/.test(file)?path.join(root,'dist'):root;
   const resolved=await realpath(path.join(base,file));if(!resolved.startsWith(base+path.sep))throw Error('Not public');
   let content=await readFile(resolved);
   if(siteRoute&&!/chat-nav(?:\.[a-f0-9]{16})?\.js/.test(content.toString()))content=Buffer.from(content.toString().replace('</head>','<link rel="stylesheet" href="/chat/nav.css"></head>').replace('</body>','<script type="module" src="/chat/nav.js"></script></body>'));
   if(siteRoute)content=Buffer.from(content.toString().replace('name="tuz19-chat-enabled" content="false"','name="tuz19-chat-enabled" content="true"'));
   const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.gif':'image/gif','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.json':'application/json'};
   res.writeHead(200,{...headers,'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(req.method==='HEAD'?undefined:content);
  }catch{res.writeHead(404,headers).end('Not found');}
 });
 server.maxConnections=110;server.requestTimeout=10000;server.headersTimeout=10000;
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
 const url=`http://127.0.0.1:${server.address().port}`;
 try{
  mf=new Miniflare({modules:true,scriptPath:fileURLToPath(new URL('./worker.mjs',import.meta.url)),compatibilityDate:'2026-07-01',durableObjects:{CHAT_ROOM:{className:'ChatRoom',useSQLite:true}},durableObjectsPersist:path.join(stateDir,'storage'),bindings:{ALLOWED_ORIGIN:url,ADMIN_TOKEN:adminToken,NETWORK_SECRET:networkSecret,CHAT_ENABLED:String(enabled)}});
  await mf.ready;
 }catch(error){server.close();throw error;}
 server.on('upgrade',async(req,socket,head)=>{
  try{
   if(req.headers.host!==new URL(url).host)throw Error('Invalid host');
   const h=new Headers(req.headers);h.set('CF-Connecting-IP',req.socket.remoteAddress);h.delete('X-Chat-Network');
   const response=await mf.dispatchFetch(new URL(req.url,url),{headers:h});
   if(response.status!==101||!response.webSocket){socket.end(`HTTP/1.1 ${response.status} Rejected\r\nConnection: close\r\n\r\n`);return;}
   sockets.handleUpgrade(req,socket,head,ws=>{
    const peer=response.webSocket;
    peer.addEventListener('message',e=>{if(ws.readyState===1)ws.send(e.data);});
    peer.addEventListener('close',e=>{if(ws.readyState===1)ws.close(e.code>=4000?e.code:1000);});
    peer.addEventListener('error',()=>ws.terminate());
    ws.on('message',(data,binary)=>{try{peer.send(binary?data:data.toString());}catch{ws.terminate();}});
    ws.on('close',()=>{try{peer.close(1000,'Transport closed');}catch{}});
    ws.on('error',()=>{try{peer.close(1011,'Transport error');}catch{}});
    peer.accept();
   });
  }catch{socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');}
 });
 return {url,mf,server,disconnect(){for(const ws of sockets.clients)ws.terminate();},async close(){for(const ws of sockets.clients)ws.terminate();sockets.close();server.closeAllConnections();await new Promise(r=>server.close(r));await mf.dispose();}};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const app=await startChat({port:Number(process.env.CHAT_PORT||8931),enabled:process.env.CHAT_ENABLED!=='false'});
 console.log(`Локальный CHAT-01: ${app.url}/chat/\nСекрет модерации: .chat-ws-local/admin.key (не публиковать)`);
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await app.close();process.exit(0);});
}
