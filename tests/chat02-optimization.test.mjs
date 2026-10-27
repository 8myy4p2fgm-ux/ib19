import test from 'node:test';import assert from 'node:assert/strict';
import {ChatRoom} from '../backend/chat/worker.mjs';import {harness} from './chat02-support.mjs';
const LEASE=75000;
test('native heartbeats do not invoke JS or SQL; checkpoints preserve lease through constructor recreation',async()=>{
 const f=harness(ChatRoom),clock=Date.now;let now=clock();Date.now=()=>now;
 try{
  const a=f.socket();await f.send(a,{type:'join',nick:'Участник'});const token=a.deserializeAttachment().token;f.reset();
  for(let i=0;i<3;i++){now+=20000;await f.send(a,{type:'ping'});assert.equal(f.room.online().length,1);}
  assert.equal(f.metrics.handlerCalls,0);assert.equal(f.metrics.changedRows,0);assert.equal(f.metrics.alarmWrites,0);assert.equal(a.out.at(-1).type,'pong');
  f.recreate();assert.equal(f.room.online().length,1);assert.equal(f.room.online()[0].liveSeen,now);
  await f.room.alarm();assert.equal(f.room.one('SELECT seen FROM members WHERE token=?',token).seen,now);
  const checkpointWrites=f.metrics.changedRows;await f.room.alarm();assert.equal(f.metrics.changedRows,checkpointWrites);
  now+=74000;assert.equal(f.room.online().length,1);now+=1001;assert.equal(f.room.online().length,0);await f.room.alarm();assert.equal(f.room.one('SELECT active FROM members WHERE token=?',token).active,0);
 }finally{Date.now=clock;f.close();}
});
test('close persists the last true auto-response; abrupt runtime restart resumes same token and pending message once',async()=>{
 const clock=Date.now;let now=clock();Date.now=()=>now;const f=harness(ChatRoom);
 try{
  const a=f.socket();await f.send(a,{type:'join',nick:'Участник'});const token=a.deserializeAttachment().token;
  now+=60000;await f.send(a,{type:'ping'});await f.room.alarm();
  const message={type:'message',text:'Подтверждение потерялось',id:'restart-idempotence-0001'};await f.send(a,message);
  now+=20000;await f.send(a,{type:'ping'});await f.closeSocket(a);assert.equal(f.room.one('SELECT seen FROM members WHERE token=?',token).seen,now);
  now+=74000;assert.equal(f.room.online().length,1);now+=1001;assert.equal(f.room.online().length,0);
  // Abrupt restart after another active session checkpoint: transport/attachments gone.
  const b=f.socket('other-net');await f.send(b,{type:'join',nick:'Новый'});const t=b.deserializeAttachment().token;now+=60000;await f.send(b,{type:'ping'});await f.room.alarm();
  await f.send(b,{...message,id:'restart-idempotence-0002'});b.closed=true;f.times.clear();f.recreate();now+=1000;
  const c=f.socket('other-net');await f.send(c,{type:'join',nick:'Новый',token:t});await f.send(c,{...message,id:'restart-idempotence-0002'});
  assert.equal(c.deserializeAttachment().token,t);assert.equal(f.room.one("SELECT COUNT(*) AS n FROM messages WHERE client='restart-idempotence-0002'").n,1);assert.equal(f.room.one("SELECT COUNT(*) AS n FROM messages WHERE kind='system' AND nick='Новый'").n,1);
 }finally{Date.now=clock;f.close();}
});
test('same NAT keeps shared message rate, bans and non-heartbeat frame limits after hibernation',async()=>{
 const f=harness(ChatRoom);try{
  const a=f.socket('shared'),b=f.socket('shared');await f.send(a,{type:'join',nick:'Первый'});await f.send(b,{type:'join',nick:'Второй'});
  for(let i=0;i<8;i++)await f.send(i%2?a:b,{type:'message',text:'сообщение',id:'nat-shared-message-'+i});f.recreate();await f.send(a,{type:'message',text:'ещё',id:'nat-shared-message-009'});assert.match(a.out.at(-1).error,/часто/);
  for(let i=0;i<180;i++)await f.send(b,{type:'unknown'});assert.match(b.out.at(-1).error,/часто/);
  f.room.sql.exec('INSERT OR REPLACE INTO bans VALUES(?,?)','shared',Date.now()+3600000);f.recreate();await f.send(a,{type:'message',text:'обход',id:'nat-banned-message-0001'});assert.equal(f.room.one("SELECT COUNT(*) AS n FROM messages WHERE body='обход'").n,0);
 }finally{f.close();}
});


test('checkpoint captures the latest real activity even just before the minute boundary',async()=>{
 const f=harness(ChatRoom),clock=Date.now;let now=clock();Date.now=()=>now;try{
  const a=f.socket();await f.send(a,{type:'join',nick:'Граница'});const token=a.deserializeAttachment().token;
  now+=59000;await f.send(a,{type:'ping'});const actual=now;now+=1000;await f.room.alarm();assert.equal(f.room.one('SELECT seen FROM members WHERE token=?',token).seen,actual);
 }finally{Date.now=clock;f.close();}
});
