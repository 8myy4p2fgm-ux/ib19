// Isolated CHAT-01 service. No data collector, external fetch, Cron or production routes.
const DAY=86400000, LEASE=75000, PAGE=100;
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const size=value=>new TextEncoder().encode(value).length;
const fold=value=>value.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{Cf}]/gu,'');
export function nickname(value){
 if(typeof value!=='string')throw Error('Введите ник.');
 const nick=value.normalize('NFKC').trim().replace(/ +/g,' ');
 if([...nick].length<2||[...nick].length>24||! /^[\p{L}\p{N} _.-]+$/u.test(nick))throw Error('Ник: 2–24 буквы, цифры, пробел, _ . -');
 const skeleton=fold(nick).replace(/[aceopxykmthbuisdnr]/g,c=>({a:'а',c:'с',e:'е',o:'о',p:'р',x:'х',y:'у',k:'к',m:'м',t:'т',h:'н',b:'в',u:'и',i:'и',s:'с',d:'д',n:'н',r:'р'}[c])).replace(/[0134]/g,c=>({'0':'о','1':'и','3':'е','4':'а'}[c]));
 if(/с[иiу]ст[еe]м[аa]?|адм[иi]н|аdm|system|moderator|модератор/.test(skeleton)||/admin|system|moderator/.test(fold(nick)))throw Error('Этот ник зарезервирован.');
 return nick;
}
const publicRow=r=>({id:r.id,kind:r.kind,nick:r.nick,body:r.body,ts:r.ts,deleted:!!r.deleted});
export class ChatRoom {
 constructor(ctx,env){
  this.ctx=ctx;this.env=env;this.sql=ctx.storage.sql;
  this.sql.exec(`CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY AUTOINCREMENT,kind TEXT,nick TEXT,body TEXT,ts INTEGER,session TEXT,client TEXT,deleted INTEGER DEFAULT 0,UNIQUE(session,client));
   CREATE INDEX IF NOT EXISTS messages_ts ON messages(ts);
   CREATE TABLE IF NOT EXISTS members(token TEXT PRIMARY KEY,nick TEXT,key TEXT,network TEXT,seen INTEGER,active INTEGER,expires INTEGER);
   CREATE INDEX IF NOT EXISTS members_key ON members(key,active);
   CREATE TABLE IF NOT EXISTS limits(key TEXT PRIMARY KEY,count INTEGER,expires INTEGER);
   CREATE TABLE IF NOT EXISTS bans(network TEXT PRIMARY KEY,expires INTEGER);
   CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT);`);
 }
 rows(query,...args){return [...this.sql.exec(query,...args)];}
 one(query,...args){return this.rows(query,...args)[0];}
 enabled(){return this.env.CHAT_ENABLED!=='false'&&this.one("SELECT value FROM settings WHERE key='enabled'")?.value!=='false';}
 limit(key,max,period){
  const now=Date.now(),r=this.one('SELECT * FROM limits WHERE key=?',key);
  if(r&&r.expires>now&&r.count>=max)throw Error('Слишком часто. Подождите немного.');
  this.sql.exec('INSERT OR REPLACE INTO limits VALUES(?,?,?)',key,r&&r.expires>now?r.count+1:1,r&&r.expires>now?r.expires:now+period);
 }
 send(ws,data){try{ws.send(JSON.stringify(data));}catch{/* Timeout owns presence cleanup. */}}
 sockets(){return this.ctx.getWebSockets();}
 broadcast(data){for(const ws of this.sockets())if(ws.deserializeAttachment()?.token)this.send(ws,data);}
 presence(){this.broadcast({type:'presence',users:this.rows('SELECT nick FROM members WHERE active=1 ORDER BY key').map(r=>r.nick)});}
 record(kind,nick,body,session=null,client=null){
  const r=this.one('INSERT INTO messages(kind,nick,body,ts,session,client) VALUES(?,?,?,?,?,?) RETURNING *',kind,nick,body,Date.now(),session,client);
  this.broadcast({type:'message',message:publicRow(r)});return r;
 }
 leave(token,explicit=false){
  const m=this.one('SELECT * FROM members WHERE token=? AND active=1',token);if(!m)return;
  this.sql.exec('UPDATE members SET active=0 WHERE token=?',token);
  this.record('system',m.nick,`${m.nick} ${explicit?'вышел из чата':'потерял соединение'}`);
  for(const s of this.sockets())if(s.deserializeAttachment()?.token===token){s.serializeAttachment({});s.close(4000,'Session ended');}
  this.presence();
 }
 cleanup(){
  const now=Date.now();
  this.sql.exec('DELETE FROM messages WHERE ts<=?',now-DAY);
  for(const m of this.rows('SELECT token FROM members WHERE active=1 AND seen<=?',now-LEASE))this.leave(m.token);
  this.sql.exec('DELETE FROM members WHERE active=0 AND expires<=?',now);
  this.sql.exec('DELETE FROM limits WHERE expires<=?',now);
  this.sql.exec('DELETE FROM bans WHERE expires<=?',now);
 }
 async schedule(){
  const now=Date.now(),oldest=this.one('SELECT MIN(ts) AS ts FROM messages')?.ts;
  const active=this.one('SELECT COUNT(*) AS n FROM members WHERE active=1').n||this.sockets().length;
  // One DO alarm, no Cron. Idle objects wake only for actual retained state expiry.
  const expiries=[oldest==null?null:oldest+DAY,this.one('SELECT MIN(expires) AS ts FROM members')?.ts,this.one('SELECT MIN(expires) AS ts FROM limits')?.ts,this.one('SELECT MIN(expires) AS ts FROM bans')?.ts].filter(x=>x!=null);
  if(active)expiries.push(now+15000);
  if(expiries.length){
   const existing=await this.ctx.storage.getAlarm();
   const next=Math.max(now+100,Math.min(...expiries));
   // Public reads and staggered heartbeats must never postpone a pending lease check.
   await this.ctx.storage.setAlarm(existing&&existing>now?Math.min(existing,next):next);
  }else await this.ctx.storage.deleteAlarm();
 }
 async alarm(){
  this.cleanup();
  for(const s of this.sockets()){const a=s.deserializeAttachment();if(!a?.token&&a?.opened<Date.now()-10000){s.serializeAttachment({});s.close(4000,'Join timeout');}}
  this.broadcast({type:'expire',before:Date.now()-DAY});await this.schedule();
 }
 async fetch(request){
  const url=new URL(request.url);
  if(url.pathname==='/api/chat/presence'){
   if(request.method!=='GET')return json({error:'Method not allowed'},405);
   if(!this.enabled())return json({error:'Чат временно отключён.'},503);
   try{this.limit('public:'+request.headers.get('X-Chat-Network'),30,60000);}catch(e){return json({error:e.message},429);}
   const updatedAt=Date.now();
   // Read leases directly. Public reads never join, renew or expire members and
   // never write system messages. The existing alarm owns timeout transitions.
   const users=this.rows('SELECT nick FROM members WHERE active=1 AND seen>? ORDER BY key',updatedAt-LEASE).map(row=>row.nick);
   await this.schedule();return json({count:users.length,users,updatedAt});
  }
  this.cleanup();
  if(url.pathname==='/api/chat/admin'){
   const expected=this.env.ADMIN_TOKEN;
   const supplied=request.headers.get('Authorization')||'';
   if(!expected||expected.length<24||!await equalSecret(supplied,`Bearer ${expected}`))return json({error:'Forbidden'},403);
   let data;try{data=await request.json();}catch{return json({error:'Bad JSON'},400);}
   if(data.action==='delete'&&Number.isSafeInteger(data.id)){
    this.sql.exec('UPDATE messages SET body=NULL,deleted=1 WHERE id=?',data.id);this.broadcast({type:'delete',id:data.id});
   }else if(data.action==='ban'&&Number.isSafeInteger(data.id)){
    const m=this.one('SELECT members.network FROM members JOIN messages ON messages.session=members.token WHERE messages.id=?',data.id);
    if(!m)return json({error:'User no longer available'},404);
    this.sql.exec('INSERT OR REPLACE INTO bans VALUES(?,?)',m.network,Date.now()+3600000);
    for(const row of this.rows('SELECT token FROM members WHERE network=? AND active=1',m.network))this.leave(row.token);
   }else if(data.action==='enabled'&&typeof data.value==='boolean'){
    this.sql.exec("INSERT OR REPLACE INTO settings VALUES('enabled',?)",String(data.value));
    if(!data.value)for(const m of this.rows('SELECT token FROM members WHERE active=1'))this.leave(m.token,true);
   }else return json({error:'Bad action'},400);
   await this.schedule();return json({ok:true});
  }
  if(!this.enabled())return json({error:'Чат временно отключён.'},503);
  if(url.pathname==='/api/chat/status')return json({enabled:true});
  if(url.pathname!=='/api/chat/socket'||request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return json({error:'Not found'},404);
  const network=request.headers.get('X-Chat-Network');
  try{this.limit('connect:'+network,20,60000);}catch(e){return json({error:e.message},429);}
  if(this.one('SELECT expires FROM bans WHERE network=?',network)?.expires>Date.now())return json({error:'Временная блокировка.'},403);
  if(this.sockets().length>=100||this.sockets().filter(s=>s.deserializeAttachment()?.network===network).length>=5)return json({error:'Слишком много соединений.'},429);
  const [client,server]=Object.values(new WebSocketPair());
  this.ctx.acceptWebSocket(server);server.serializeAttachment({network,opened:Date.now()});
  await this.schedule();return new Response(null,{status:101,webSocket:client});
 }
 async webSocketMessage(ws,raw){
  let a=ws.deserializeAttachment();
  try{
   if(typeof raw!=='string'||size(raw)>4096){ws.close(1009,'Frame too large');return;}
   this.limit('frames:'+a.network,180,60000);
   if(!this.enabled())throw Error('Чат временно отключён.');
   if(this.one('SELECT expires FROM bans WHERE network=?',a.network)?.expires>Date.now())throw Error('Временная блокировка.');
   const d=JSON.parse(raw);if(!d||typeof d!=='object')throw Error('Некорректный запрос.');
   if(d.type==='join'){
    if(a.token)throw Error('Вы уже в комнате.');
    this.limit('join:'+a.network,15,60000);this.cleanup();
    const nick=nickname(d.nick),key=fold(nick);
    let m=typeof d.token==='string'?this.one('SELECT * FROM members WHERE token=? AND expires>?',d.token,Date.now()):null;
    if(m&&m.key!==key)m=null;
    if(this.one('SELECT token FROM members WHERE key=? AND active=1 AND token!=?',key,m?.token||''))throw Error('Ник занят. Выберите другой.');
    const token=m?.token||crypto.randomUUID(),wasActive=!!m?.active;
    for(const s of this.sockets())if(s!==ws&&s.deserializeAttachment()?.token===token){s.serializeAttachment({});s.close(4001,'Reconnected elsewhere');}
    this.sql.exec('INSERT OR REPLACE INTO members VALUES(?,?,?,?,?,1,?)',token,nick,key,a.network,Date.now(),Date.now()+DAY);
    a={...a,token};ws.serializeAttachment(a);
    this.send(ws,{type:'joined',token,nick,heartbeat:20000});
    const items=this.rows('SELECT * FROM messages WHERE ts>? ORDER BY id DESC LIMIT ?',Date.now()-DAY,PAGE+1);
    this.send(ws,{type:'history',messages:items.slice(0,PAGE).reverse().map(publicRow),more:items.length>PAGE,initial:true});
    if(!wasActive)this.record('system',nick,`${nick} вошёл в чат`);
    this.presence();
   }else{
    const m=this.one('SELECT * FROM members WHERE token=? AND active=1',a.token||'');
    if(!m)throw Error('Войдите в чат.');
    if(m.seen<=Date.now()-LEASE){this.leave(m.token);throw Error('Соединение устарело. Войдите снова.');}
    this.sql.exec('UPDATE members SET seen=?,expires=? WHERE token=?',Date.now(),Date.now()+DAY,m.token);
    if(d.type==='ping')this.send(ws,{type:'pong'});
    else if(d.type==='leave')this.leave(m.token,true);
    else if(d.type==='history'){
     this.limit('history:'+a.network,30,60000);
     if(!Number.isSafeInteger(d.before)||d.before<1)throw Error('Некорректная граница истории.');
     const rows=this.rows('SELECT * FROM messages WHERE id<? AND ts>? ORDER BY id DESC LIMIT ?',d.before,Date.now()-DAY,PAGE+1);
     this.send(ws,{type:'history',messages:rows.slice(0,PAGE).reverse().map(publicRow),more:rows.length>PAGE});
    }else if(d.type==='sync'){
     if(!Number.isSafeInteger(d.after)||d.after<0)throw Error('Некорректный курсор.');
     this.limit('sync:'+a.network,60,60000);
     const rows=this.rows('SELECT * FROM messages WHERE id>? AND ts>? ORDER BY id LIMIT ?',d.after,Date.now()-DAY,PAGE+1);
     this.send(ws,{type:'sync',messages:rows.slice(0,PAGE).map(publicRow),more:rows.length>PAGE});
    }else if(d.type==='message'){
     if(typeof d.text!=='string'||!d.text.trim()||[...d.text].length>500||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(d.text)||typeof d.id!=='string'||! /^[\w-]{16,64}$/.test(d.id))throw Error('Сообщение: 1–500 символов.');
     const old=this.one('SELECT * FROM messages WHERE session=? AND client=?',m.token,d.id);
     if(old){this.send(ws,{type:'ack',id:d.id,message:publicRow(old)});return;}
     this.limit('send:'+a.network,8,10000);this.limit('minute:'+a.network,30,60000);
     const row=this.record('user',m.nick,d.text.trim(),m.token,d.id);this.send(ws,{type:'ack',id:d.id,message:publicRow(row)});
    }else throw Error('Неизвестная команда.');
   }
  }catch(e){this.send(ws,{type:'error',error:e instanceof SyntaxError?'Некорректный JSON.':e.message});}
  await this.schedule();
 }
 async webSocketClose(ws){ws.serializeAttachment({});await this.schedule();}
 async webSocketError(ws){try{ws.close(1011,'Transport error');}catch{}await this.webSocketClose(ws);}
}
async function equalSecret(a,b){
 const hash=async value=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
 const [x,y]=await Promise.all([hash(a),hash(b)]);let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];return diff===0;
}
export default {async fetch(request,env){
 const url=new URL(request.url),origin=request.headers.get('Origin');
 if(!url.pathname.startsWith('/api/chat/'))return new Response('Not found',{status:404});
 // No CORS fallback. The trusted proxy sets network identity; never trust client X-Chat-*.
 const publicRead=url.pathname==='/api/chat/presence'&&request.method==='GET';
 if(!env.ALLOWED_ORIGIN||!(origin===env.ALLOWED_ORIGIN||(publicRead&&!origin&&request.headers.get('Sec-Fetch-Site')==='same-origin')))return json({error:'Forbidden origin'},403);
 if(!['GET','POST'].includes(request.method))return json({error:'Method not allowed'},405);
 const declared=Number(request.headers.get('Content-Length')||0);if(declared>4096)return json({error:'Request too large'},413);
 let body;if(request.method==='POST'){
  const reader=request.body?.getReader();let total=0,chunks=[];
  if(reader)while(true){const {value,done}=await reader.read();if(done)break;total+=value.byteLength;if(total>4096){await reader.cancel();return json({error:'Request too large'},413);}chunks.push(value);}
  body=new Uint8Array(total);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.length;}
 }
 if(!env.NETWORK_SECRET)return json({error:'Chat not configured'},503);
 const ip=request.headers.get('CF-Connecting-IP');if(!ip)return json({error:'No network identity'},403);
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(env.NETWORK_SECRET+'|'+ip));
 const headers=new Headers(request.headers);headers.set('X-Chat-Network',Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join(''));
 return env.CHAT_ROOM.get(env.CHAT_ROOM.idFromName('common-room')).fetch(new Request(request.url,{method:request.method,headers,...(body?{body}:{} )}));
}};
