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
