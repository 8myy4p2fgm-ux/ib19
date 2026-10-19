import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {loadData,normalizeData} from '../js/data.js';
const main=JSON.parse(await fs.readFile(new URL('../data/19ib_all_judges_REPAIRED.json',import.meta.url)));
const forum=JSON.parse(await fs.readFile(new URL('../data/forum_judges_export.json',import.meta.url)));
const meta={runId:'test',exportedAt:main.exportedAt,forumExportedAt:forum.exportedAt,lastSuccessfulAt:main.exportedAt};
for(const failure of ['metadata-network','body-network','http-503','mismatch'])test('Loading recovers from '+failure,async t=>{
 let attempts=0,failed=false;
 t.mock.method(globalThis,'fetch',async (url,options)=>{
  const name=url.pathname.split('/').pop();
  if(name==='metadata.json'){
   assert.equal(options.cache,'no-store');
   attempts++;
   if(failure==='metadata-network'&&attempts===1)throw new TypeError('Failed to fetch');
   return {ok:true,json:async()=>meta};
  }
  assert.equal(options.cache,attempts===1?'default':'no-store');
  if(name==='19ib_all_judges_REPAIRED.json'&&!failed){
   failed=true;
   if(failure==='body-network')return {ok:true,json:async()=>{throw new TypeError('connection closed')}};
   if(failure==='http-503')return {ok:false,status:503};
   if(failure==='mismatch')return {ok:true,json:async()=>({...main,exportedAt:'2000-01-01T00:00:00Z'})};
  }
  return {ok:true,json:async()=>name==='forum_judges_export.json'?forum:main};
 });
 const result=await loadData();assert.equal(attempts,2);assert.equal(result.people.length,normalizeData(main,forum).people.length);assert.equal(result.updated,main.exportedAt);
});
test('Persistent failures stop after three attempts',async t=>{
 let attempts=0;t.mock.method(globalThis,'fetch',async()=>{attempts++;throw new TypeError('Failed to fetch')});
 await assert.rejects(loadData(),/Failed to fetch/);assert.equal(attempts,3);
});

test('Loading works without AbortSignal.timeout and clears completed request timers',async t=>{
 const descriptor=Object.getOwnPropertyDescriptor(AbortSignal,'timeout');
 Object.defineProperty(AbortSignal,'timeout',{...descriptor,value:undefined});
 t.after(()=>Object.defineProperty(AbortSignal,'timeout',descriptor));
 const timers=new Set(),schedule=globalThis.setTimeout,cancel=globalThis.clearTimeout;
 t.mock.method(globalThis,'setTimeout',(callback,delay)=>{
  const timer=schedule(callback,delay);if(delay===30000)timers.add(timer);return timer;
 });
 t.mock.method(globalThis,'clearTimeout',timer=>{assert.ok(timers.delete(timer));cancel(timer);});
 let requests=0;
 t.mock.method(globalThis,'fetch',async(url,{signal})=>{
  requests++;assert.ok(signal instanceof AbortSignal);assert.equal(signal.aborted,false);
  const name=url.pathname.split('/').pop();
  return {ok:true,json:async()=>name==='metadata.json'?meta:name==='forum_judges_export.json'?forum:main};
 });
 const result=await loadData();
 assert.equal(requests,3);assert.equal(result.updated,main.exportedAt);assert.equal(timers.size,0);
});

const flush=()=>new Promise(resolve=>setImmediate(resolve));
for(const stage of ['request','body'])test('30-second '+stage+' timeout retries with the existing delays',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 let attempts=0;const signals=[];
 t.mock.method(globalThis,'fetch',async(url,{signal})=>{
  const name=url.pathname.split('/').pop();
  if(name==='metadata.json'){
   attempts++;signals.push(signal);
   if(attempts<3){
    const stalled=()=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}));
    return stage==='request'?stalled():{ok:true,json:stalled};
   }
   return {ok:true,json:async()=>meta};
  }
  return {ok:true,json:async()=>name==='forum_judges_export.json'?forum:main};
 });
 const loading=loadData();await flush();
 for(const delay of [500,1000]){
  const attempt=attempts;
  t.mock.timers.tick(29999);assert.equal(signals.at(-1).aborted,false);
  t.mock.timers.tick(1);assert.equal(signals.at(-1).aborted,true);await flush();
  t.mock.timers.tick(delay-1);await flush();assert.equal(attempts,attempt);
  t.mock.timers.tick(1);await flush();assert.equal(attempts,attempt+1);
 }
 const result=await loading;
 assert.equal(result.updated,main.exportedAt);assert.equal(attempts,3);
 t.mock.timers.tick(30000);assert.equal(signals[2].aborted,false,'successful request timer is cleared');
});

test('Persistent timeouts stop after three attempts and release their timers',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const signals=[];
 t.mock.method(globalThis,'fetch',async(url,{signal})=>{
  signals.push(signal);
  return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}));
 });
 const rejected=assert.rejects(loadData(),{name:'AbortError'});
 for(const delay of [500,1000,0]){
  t.mock.timers.tick(30000);await flush();
  if(delay){t.mock.timers.tick(delay);await flush();}
 }
 await rejected;assert.equal(signals.length,3);assert.ok(signals.every(signal=>signal.aborted));
 t.mock.timers.tick(60000);assert.equal(signals.length,3);
});

for(const failure of ['network','http-503','json'])test('Request timers are cleared after '+failure+' errors',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const signals=[];
 t.mock.method(globalThis,'fetch',async(url,{signal})=>{
  signals.push(signal);
  if(failure==='network')throw new TypeError('Failed to fetch');
  if(failure==='http-503')return {ok:false,status:503};
  return {ok:true,json:async()=>{throw new SyntaxError('Invalid JSON');}};
 });
 const rejected=assert.rejects(loadData(),failure==='network'?/Failed to fetch/:failure==='http-503'?/503/:/Invalid JSON/);
 await flush();
 for(const delay of [500,1000]){t.mock.timers.tick(delay);await flush();}
 await rejected;assert.equal(signals.length,3);
 t.mock.timers.tick(30000);assert.ok(signals.every(signal=>!signal.aborted),'failed request timers are cleared');
});
