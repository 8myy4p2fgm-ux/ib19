import {tmpdir} from 'node:os';
import test from 'node:test';import assert from 'node:assert/strict';import {readFile,mkdtemp,rm} from 'node:fs/promises';import path from 'node:path';import {ChatRoom} from '../backend/chat/worker.mjs';import {harness} from './chat02-support.mjs';
test('P1-05: isolated preview artifact serves /chat, all assets and CSP without leaking source',async()=>{
 const {buildPreview}=await import('../backend/chat/build-preview.mjs');const dir=await mkdtemp(tmpdir()+'/chat06-preview-');try{
  const artifact=await buildPreview({outDir:dir+'/pack',siteDir:path.resolve('dist'),origin:'https://chat-preview.example.test'});const config=JSON.parse(await readFile(artifact.configPath,'utf8'));assert.deepEqual(config.routes,[]);assert(config.assets.directory);assert(!JSON.stringify(config).includes('tuz19.ru'));assert(!/ADMIN_TOKEN|NETWORK_SECRET/.test(JSON.stringify(config.vars)));assert.equal(config.vars.ALLOWED_ORIGIN,'https://chat-preview.example.test');
  const {default:preview}=await import('../backend/chat/preview-worker.mjs');const root=path.resolve(artifact.publicDir);const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.gif':'image/gif'};
  const env={ALLOWED_ORIGIN:'https://chat-preview.example.test',ASSETS:{async fetch(r){try{const u=new URL(r.url);const relative=u.pathname.endsWith('/')?u.pathname+'index.html':u.pathname;return new Response(await readFile(path.join(root,relative)),{headers:{'Content-Type':mime[path.extname(relative)]||'application/octet-stream'}});}catch{return new Response('Not found',{status:404});}}}};
  const r=await preview.fetch(new Request(env.ALLOWED_ORIGIN+'/chat/'),env);assert.equal(r.status,200);const html=await r.text();assert(html.includes('smiley-toggle'));assert(r.headers.get('Content-Security-Policy').includes('wss://chat-preview.example.test'));assert.equal((await preview.fetch(new Request(env.ALLOWED_ORIGIN+'/backend/chat/worker.mjs'),env)).status,404);
  for(const file of ['chat/client.js','chat/smilies/skald.gif','css/styles.css','js/room.js'])assert.equal((await preview.fetch(new Request(env.ALLOWED_ORIGIN+'/'+file),env)).status,200);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('P1-06: public health requests are bounded before expensive cleanup; bad admin/unknown do no SQL',async()=>{
 const f=harness(ChatRoom);try{
  const request=()=>f.room.fetch(new Request('https://local/api/chat/status',{headers:{'X-Chat-Network':'one-ip'}}));const codes=[];for(let i=0;i<100;i++)codes.push((await request()).status);assert(codes.includes(429));assert(codes.filter(s=>s===200).length<=60);
  f.reset();const bad=await f.room.fetch(new Request('https://local/api/chat/admin',{method:'POST',body:'{}'}));assert.equal(bad.status,403);assert.equal(f.metrics.statements,0);
  f.reset();assert.equal((await f.room.fetch(new Request('https://local/api/chat/unknown'))).status,404);assert.equal(f.metrics.statements,0);
 }finally{f.close();}
});
test('deletion journal survives object recreation, migrates old tombstones and expires with original message',async()=>{
 const f=harness(ChatRoom),clock=Date.now;let now=clock();Date.now=()=>now;try{
  const a=f.socket();await f.send(a,{type:'join',nick:'Проверка'});await f.send(a,{type:'message',id:'deletion-journal-message',text:'Удалить'});const id=f.room.one("SELECT id FROM messages WHERE kind='user'").id;
  f.room.sql.exec('UPDATE messages SET deleted=1,body=NULL WHERE id=?',id);f.room.sql.exec("DELETE FROM settings WHERE key='deletion_schema_v1'");f.recreate();assert.equal(f.room.one('SELECT COUNT(*) n FROM deletion_log').n,1);const high=f.room.head('deletion_log');f.recreate();assert.equal(f.room.head('deletion_log'),high);
  await f.send(a,{type:'sync',after:f.room.head('messages'),deletionsAfter:0,requestId:'probe'});assert.deepEqual(a.out.at(-1).deletedIds,[id]);assert.equal(a.out.at(-1).requestId,'probe');
  now+=86400001;await f.room.alarm();assert.equal(f.room.one('SELECT COUNT(*) n FROM deletion_log').n,0);assert.equal(f.room.head('deletion_log'),high);
 }finally{Date.now=clock;f.close();}
});
test('HTTP budget persists through recreation and denied repeated requests perform no SQL writes',async()=>{
 const f=harness(ChatRoom);try{const req=()=>f.room.fetch(new Request('https://local/api/chat/status',{headers:{'X-Chat-Network':'persistent'}}));for(let i=0;i<60;i++)assert.equal((await req()).status,200);f.recreate();assert.equal((await req()).status,429);f.reset();for(let i=0;i<100;i++)assert.equal((await req()).status,429);assert.equal(f.metrics.statements,0);}finally{f.close();}
});
test('legacy message-only sync is not trapped by more than 100 deletion markers',async()=>{
 const f=harness(ChatRoom);try{const ws=f.socket();await f.send(ws,{type:'join',nick:'Совместимость'});for(let i=0;i<150;i++)f.room.sql.exec('INSERT INTO deletion_log(message_id,expires) VALUES(?,?)',1000+i,Date.now()+86400000);await f.send(ws,{type:'sync',after:0});assert.equal(ws.out.at(-1).more,false);await f.send(ws,{type:'sync',after:0,deletionsAfter:0});assert.equal(ws.out.at(-1).more,true);assert.equal(ws.out.at(-1).deletedIds.length,100);}finally{f.close();}
});
