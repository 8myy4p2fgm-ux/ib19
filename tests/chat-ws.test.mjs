import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {ChatRoom,nickname} from '../backend/chat/worker.mjs';
const DAY=86400000;
function setup(){
 const db=new DatabaseSync(':memory:'),sockets=[];let alarm;
 const storage={sql:{exec(q,...args){const parts=q.split(';').filter(x=>x.trim());let result=[];for(const part of parts){const statement=db.prepare(part);result=statement.all(...(parts.length===1?args:[]));}return result;}},async getAlarm(){return alarm;},async setAlarm(t){alarm=t;},async deleteAlarm(){alarm=null;}};
 const ctx={storage,getWebSockets:()=>sockets};const env={ADMIN_TOKEN:'test-admin-token-at-least-32-chars',CHAT_ENABLED:'true'};
 const room=new ChatRoom(ctx,env);
 function socket(network='net-a'){let attachment={network,opened:Date.now()};const out=[];const s={out,send(raw){out.push(JSON.parse(raw));},serializeAttachment(a){attachment=a;},deserializeAttachment(){return attachment;},close(code){this.code=code;}};sockets.push(s);return s;}
 const send=(s,d)=>room.webSocketMessage(s,JSON.stringify(d));
 return {room,db,storage,ctx,env,socket,send,get alarm(){return alarm;},close(){db.close();}};
}
test('server nickname validation and reserved lookalikes',()=>{
 for(const n of ['Система','Администратор','Cиcтeмa','Aдминистратор','Адмuн','SYSTEM','Admin','s y s t e m','Модератор','Сиcтeма','x','a'.repeat(25),'<script>'])assert.throws(()=>nickname(n),n);
 assert.equal(nickname(' Борис Мурлок '),'Борис Мурлок');
});
test('join, collision, presence, realtime, explicit leave, idempotence and reconnect',async()=>{
 const f=setup();try{
  const a=f.socket(),b=f.socket('net-b');await f.send(a,{type:'join',nick:'Борис'});await f.send(b,{type:'join',nick:'Борис'});assert.match(b.out.at(-1).error,/занят/);
  await f.send(b,{type:'join',nick:'Мурлок'});assert.deepEqual(a.out.filter(x=>x.type==='presence').at(-1).users,['Борис','Мурлок']);
  const d={type:'message',text:'<img src=x onerror=alert(1)>',id:'unique-message-id-0001'};await f.send(a,d);await f.send(a,d);
  assert.equal(f.room.one("SELECT COUNT(*) AS n FROM messages WHERE kind='user'").n,1);assert.equal(b.out.filter(x=>x.type==='message'&&x.message.kind==='user').length,1);
  const token=a.deserializeAttachment().token;await f.room.webSocketClose(a);const c=f.socket();await f.send(c,{type:'join',nick:'Борис',token});
  assert.equal(f.room.one("SELECT COUNT(*) AS n FROM messages WHERE kind='system' AND nick='Борис'").n,1);
  await f.send(c,{type:'sync',after:0});assert(c.out.at(-1).messages.some(x=>x.body===d.text));
  await f.send(b,{type:'leave'});assert.equal(f.room.one("SELECT active FROM members WHERE nick='Мурлок'").active,0);assert(c.out.some(x=>x.message?.body==='Мурлок вышел из чата'));
 }finally{f.close();}
});
test('timeout, actual retention deletion of user/system records and scheduled idle cleanup',async()=>{
 const f=setup();const original=Date.now;let now=original();Date.now=()=>now;
 try{
  const a=f.socket(),b=f.socket('net-b');await f.send(a,{type:'join',nick:'Борис'});await f.send(b,{type:'join',nick:'Мурлок'});
  await f.send(a,{type:'message',text:'история',id:'retention-message-0001'});
  now+=74000;await f.room.alarm();assert.equal(f.room.one('SELECT COUNT(*) AS n FROM members WHERE active=1').n,2);
  await f.send(b,{type:'ping'});now+=2000;await f.room.alarm();assert.equal(f.room.one("SELECT active FROM members WHERE nick='Борис'").active,0);assert(b.out.some(x=>x.message?.body==='Борис потерял соединение'));
  now+=DAY+100000;await f.room.alarm();assert.equal(f.room.one('SELECT COUNT(*) AS n FROM messages WHERE ts<=?',now-DAY).n,0);
  now+=DAY+1;await f.room.alarm();assert.equal(f.room.one('SELECT COUNT(*) AS n FROM messages').n,0);
  assert.equal(f.room.one('SELECT COUNT(*) AS n FROM members').n,0);
 }finally{Date.now=original;f.close();}
});
test('100-record history, cursor catchup and database survives object recreation',async()=>{
 const f=setup();try{
  const a=f.socket();await f.send(a,{type:'join',nick:'Историк'});
  for(let i=0;i<230;i++)f.room.sql.exec("INSERT INTO messages(kind,nick,body,ts) VALUES('user','Автор',?,?)",'запись '+i,Date.now());
  await f.send(a,{type:'history',before:99999});let h=a.out.at(-1);assert.equal(h.messages.length,100);assert.equal(h.more,true);
  await f.send(a,{type:'history',before:h.messages[0].id});h=a.out.at(-1);assert.equal(h.messages.length,100);
  await f.send(a,{type:'history',before:h.messages[0].id});h=a.out.at(-1);assert.equal(h.messages.length,31);assert.equal(h.more,false);
  await f.send(a,{type:'sync',after:0});assert.equal(a.out.at(-1).messages.length,100);assert.equal(a.out.at(-1).more,true);
  const restored=new ChatRoom(f.ctx,f.env);assert.equal(restored.one('SELECT COUNT(*) AS n FROM messages').n,231);
 }finally{f.close();}
});
test('message/size/frame/frequency limits and no unauthenticated sending',async()=>{
 const f=setup();try{
  const a=f.socket();await f.send(a,{type:'message',text:'не вошёл',id:'message-not-joined'});assert.match(a.out.at(-1).error,/Войдите/);
  await f.send(a,{type:'join',nick:'Спамер'});await f.send(a,{type:'message',text:'x'.repeat(501),id:'too-long-message-0001'});assert.match(a.out.at(-1).error,/500/);
  for(let i=0;i<9;i++)await f.send(a,{type:'message',text:'сообщение',id:'rate-limit-message-'+i});assert.match(a.out.at(-1).error,/часто/);assert.equal(f.room.one("SELECT COUNT(*) AS n FROM messages WHERE kind='user'").n,8);
  await f.room.webSocketMessage(a,'x'.repeat(4097));assert.equal(a.code,1009);
 }finally{f.close();}
});
test('protected administration, deletion, network ban across sessions, independent switch',async()=>{
 const f=setup();try{
  const admin=data=>f.room.fetch(new Request('http://local/api/chat/admin',{method:'POST',headers:{Authorization:'Bearer '+f.env.ADMIN_TOKEN},body:JSON.stringify(data)}));
  assert.equal((await f.room.fetch(new Request('http://local/api/chat/admin',{method:'POST',body:'{}'}))).status,403);
  const a=f.socket();await f.send(a,{type:'join',nick:'Автор'});await f.send(a,{type:'message',text:'спам',id:'moderation-message-0001'});const id=f.room.one("SELECT id FROM messages WHERE kind='user'").id;
  assert.equal((await admin({action:'delete',id})).status,200);assert.equal(f.room.one('SELECT body FROM messages WHERE id=?',id).body,null);assert.equal(a.out.at(-1).type,'delete');
  await admin({action:'ban',id});const b=f.socket();await f.send(b,{type:'join',nick:'Другой'});assert.match(b.out.at(-1).error,/блокировка/);
  await admin({action:'enabled',value:false});assert.equal((await f.room.fetch(new Request('http://local/api/chat/status'))).status,503);
  await admin({action:'enabled',value:true});assert.equal((await f.room.fetch(new Request('http://local/api/chat/status'))).status,200);
 }finally{f.close();}
});

test('public presence: read-only leases, privacy, rate cap and no alarm starvation',async()=>{
 const f=setup();const original=Date.now;let now=original();Date.now=()=>now;
 const request=()=>f.room.fetch(new Request('http://local/api/chat/presence',{headers:{'X-Chat-Network':'spectator'}}));
 try{
  assert.deepEqual(await (await request()).json(),{count:0,users:[],updatedAt:now});
  assert.equal(f.room.one('SELECT COUNT(*) AS n FROM members').n,0);assert.equal(f.room.one('SELECT COUNT(*) AS n FROM messages').n,0);
  const a=f.socket();await f.send(a,{type:'join',nick:'А'.repeat(24)});const token=a.deserializeAttachment().token;
  const firstAlarm=f.alarm;now+=1000;await request();assert.equal(f.alarm,firstAlarm);
  const response=await (await request()).json();assert.deepEqual(Object.keys(response).sort(),['count','updatedAt','users']);assert.equal(response.count,1);assert.deepEqual(response.users,['А'.repeat(24)]);assert(!JSON.stringify(response).includes(token));assert(!JSON.stringify(response).includes('net-a'));
  const b=f.socket('net-b');await f.send(b,{type:'join',nick:'Мурлок'});assert.equal((await (await request()).json()).count,2);
  await f.send(b,{type:'leave'});assert.equal((await (await request()).json()).count,1);
  now+=75001;const before=f.room.one('SELECT COUNT(*) AS n FROM messages').n;assert.equal((await (await request()).json()).count,0);assert.equal(f.room.one('SELECT COUNT(*) AS n FROM messages').n,before);assert.equal(f.room.one('SELECT active FROM members WHERE token=?',token).active,1);
  await f.room.alarm();assert.equal(f.room.one('SELECT active FROM members WHERE token=?',token).active,0);
  for(let i=0;i<30;i++)await request();assert.equal((await request()).status,429);
 }finally{Date.now=original;f.close();}
});
