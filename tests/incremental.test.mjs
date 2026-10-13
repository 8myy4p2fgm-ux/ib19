import test from 'node:test';import assert from 'node:assert/strict';
import {collect,createClient,retryAfterMs,validateSavedSnapshot} from '../scripts/collector.mjs';
import {loadState,collectionMode,stateFiles} from '../scripts/collection-state.mjs';
import {normalizeData} from '../js/data.js';import {updateHistory} from '../scripts/update-history.mjs';
import {unifiedAt} from '../js/calculations.js';import fs from 'node:fs';
const at='2026-10-13T12:00:00Z',s={judgeName:'A',score:4,comment:'Exact original\ncomment',scoredAt:'2026-10-09T12:00:00Z'};
const old={exportedAt:at,totalParticipants:2,members:['f','o'].map(userId=>({userId,scores:[structuredClone(s)],scoredCount:1,fetchedAt:at,current:true}))},forum={exportedAt:at,members:[{userId:'f',group:'OG',forum_name:'Author',scores:[s]}]};
const full={id:'r',judgesRequired:5,scoreScale:5,passThreshold:15,entries:old.members.map(p=>({userId:p.userId,score:4,scoredCount:1}))};
async function run({base=old,source=full,details={},mode='incremental',live,fail}={}){const paths=[];const batch=await collect({roundId:'r',concurrency:2,mode},structuredClone(base),structuredClone(forum),{now:()=> '2026-10-13T12:05:00Z',get:async path=>{paths.push(path);if(path.endsWith('/full'))return structuredClone(source);if(path.endsWith('/live'))return {progress:structuredClone(live||source.entries)};if(fail)throw new Error('interrupted');const id=path.split('/').at(-2);return {scores:structuredClone(details[id]||base.members.find(p=>p.userId===id)?.scores||[])};}});return {batch,paths};}
test('no new scores: exactly two summary reads, byte-equivalent details and real verification dates',async()=>{const {batch,paths}=await run();assert.equal(paths.length,2);assert.equal(batch.collection.updatedCards,0);assert.deepEqual(batch.main.members,old.members);assert.equal(updateHistory(old,batch.main,batch.forum,null,batch.main.exportedAt).revisions.length,0);});
test('one new score: only its card is requested',async()=>{const source=structuredClone(full);Object.assign(source.entries[0],{score:9,scoredCount:2});const {batch,paths}=await run({source,details:{f:[s,{...s,judgeName:'B',score:5}]}});assert.equal(paths.filter(p=>p.endsWith('/scores')).length,1);assert.equal(batch.main.members[0].scores.length,2);assert.equal(batch.main.members[1].fetchedAt,at);assert.equal(batch.collection.participantsWithNewScores,1);});
test('multiple changes: replace full arrays without duplicates',async()=>{const source=structuredClone(full);source.entries.forEach(e=>{e.scoredCount=2;e.score=9;});const {batch}=await run({source,details:{f:[s,{...s,judgeName:'B',score:5}],o:[s,{...s,judgeName:'B',score:5}]}});assert.equal(batch.collection.updatedCards,2);assert.equal(batch.collection.scoresAfter,4);});
test('new zero-score participant is fetched once; existing null zero remains cached',async()=>{const base=structuredClone(old);base.members[1].scores=[];base.members[1].scoredCount=0;const source=structuredClone(full);Object.assign(source.entries[1],{score:null,scoredCount:0});source.entries.push({userId:'new',score:null,scoredCount:0});const {batch,paths}=await run({base,source});assert.equal(paths.filter(p=>p.endsWith('/scores')).length,1);assert.equal(batch.main.totalParticipants,3);});
test('deleted score and changed total at unchanged count are safely replaced and recorded',async()=>{for(const [count,total,next]of [[0,null,[]],[1,2,[{...s,score:2}]]]){const source=structuredClone(full);Object.assign(source.entries[0],{scoredCount:count,score:total});const {batch}=await run({source,details:{f:next}});assert.deepEqual(batch.main.members[0].scores,next);assert.equal(updateHistory(old,batch.main,batch.forum,null,batch.main.exportedAt).revisions.length,1);}});
test('disappeared participant is archived, not discarded or declared disqualified',async()=>{const base={...old,totalParticipants:20,members:Array.from({length:20},(_,i)=>({userId:String(i),scoredCount:1,scores:[s],current:true}))};const source={...full,entries:base.members.slice(0,19).map(p=>({userId:p.userId,scoredCount:1,score:4}))};const {batch}=await run({base,source});assert.equal(batch.main.archivedMembers[0].userId,'19');assert.deepEqual(batch.main.archivedMembers[0].scores,[s]);});
test('partial, duplicate, damaged, moving roster or mismatching scores never produce a batch',async()=>{
 for(const source of [{...full,entries:[]},{...full,entries:[full.entries[0],full.entries[0]]},{...full,entries:[{...full.entries[0],scoredCount:'1'},full.entries[1]]}])await assert.rejects(run({source}));
 await assert.rejects(run({live:full.entries.slice(0,1)}),/roster changed/);
 const source=structuredClone(full);source.entries[0].score=5;await assert.rejects(run({source}),/reconciliation/);
 await assert.rejects(run({mode:'full',details:{f:[{...s,comment:undefined}]}}),/Invalid source score/);
});
test('interruption leaves caller snapshot unchanged; next attempt reuses last complete state',async()=>{const original=structuredClone(old);await assert.rejects(run({mode:'full',fail:true}),/interrupted/);assert.deepEqual(old,original);assert.equal((await run()).paths.length,2);});
test('full audit detects invisible comment correction; incremental does not reread it',async()=>{const {batch}=await run({mode:'full',details:{f:[{...s,comment:'Corrected'}]}});assert.equal(batch.collection.updatedCards,2);assert.equal(updateHistory(old,batch.main,batch.forum,null,batch.main.exportedAt).revisions[0].after.comment,'Corrected');});
test('invalid saved state fails before any API request',async()=>{const base=structuredClone(old);base.members[0].scores[0].scoredAt='bad';await assert.rejects(run({base}),/Invalid saved score/);});
test('valid Git state recovers missing/damaged files; no valid revision fails closed',async()=>{
 const state={main:old,forum,history:{revisions:[],snapshots:[{observedAt:at}]},metadata:{lastSuccessfulAt:at}};const values=[state.main,state.forum,state.history,state.metadata].map(JSON.stringify);
 const result=await loadState({read:async()=>'{broken',revisions:()=>['bad','good'],show:(revision,file)=>revision==='good'?values[stateFiles.indexOf(file)]:'invalid'});assert.equal(result.recoveredFrom,'good');assert.deepEqual(result.main,old);
 await assert.rejects(loadState({read:async()=>{throw new Error('missing');},revisions:()=>[],show:()=>''}),/restore validated data/);
});
test('weekly audit date carries forward across incremental and delayed runs',()=>{
 const metadata={lastSuccessfulAt:at};assert.equal(collectionMode(metadata,{now:Date.parse(at)+6*86400000}).mode,'incremental');assert.equal(collectionMode(metadata,{now:Date.parse(at)+7*86400000}).mode,'full');assert.equal(collectionMode({lastSuccessfulAt:'2026-10-20T11:55:00Z',collection:{lastFullAuditAt:at}},{now:Date.parse(at)+7*86400000}).mode,'full');assert.equal(collectionMode(metadata,{requested:'full'}).mode,'full');
});
function response(status,body={},retry){return {ok:status===200,status,headers:{get:()=>retry},json:async()=>body};}
test('429 Retry-After and 500 share cooldown, count retries; permanent 4xx not retried',async()=>{
 let time=100000,calls=0;const stats={},times=[];const get=createClient({apiBase:'https://test',requestIntervalMs:1000,retries:3,timeoutMs:100,maxDurationMs:120000},{clock:()=>time,sleep:async ms=>{time+=ms;},stats,fetchImpl:async()=>{times.push(time);return ++calls===1?response(429,{},'7'):calls===2?response(500):response(200,{ok:true});}});
 assert.deepEqual(await get('/x'),{ok:true});assert.equal(stats.errors429,1);assert.equal(stats.retries,2);assert.equal(stats.httpRequests,3);assert.ok(times[1]-times[0]>=7000);assert.ok(times[2]-times[1]>=4000);
 const bad=createClient({apiBase:'https://test',retries:3,requestIntervalMs:0},{fetchImpl:async()=>response(404),sleep:async()=>{}});await assert.rejects(bad('/x'),/404/);
 assert.equal(retryAfterMs('Wed, 21 Oct 2026 07:28:00 GMT',Date.parse('2026-10-21T07:27:00Z')),60000);
});
test('bounded retries and long Retry-After stop safely without ignoring server wait',async()=>{
 let time=0,calls=0;const config={apiBase:'https://test',retries:2,requestIntervalMs:0,maxDurationMs:100000};
 const get=createClient(config,{clock:()=>time,sleep:async n=>{time+=n;},fetchImpl:async()=>{calls++;return response(500);}});await assert.rejects(get('/x'),/500/);assert.equal(calls,3);
 const long=createClient({...config,maxDurationMs:10000},{clock:()=>0,sleep:async()=>assert.fail('must not wait beyond budget'),fetchImpl:async()=>response(429,{},'600')});await assert.rejects(long('/x'),/budget/);
});
test('shared throttle prevents concurrent request bursts',async()=>{let time=0;const starts=[];const get=createClient({apiBase:'https://test',requestIntervalMs:1000,retries:0,maxDurationMs:10000},{clock:()=>time,sleep:async ms=>{time+=ms;},fetchImpl:async()=>{starts.push(time);return response(200);}});await Promise.all([get('/a'),get('/b'),get('/c')]);assert.ok(starts[1]-starts[0]>=1000);assert.ok(starts[2]-starts[1]>=1000);});
test('production-shaped snapshot: reuse preserves all scores/comments, TUZ and normalized data',async()=>{
 const main=JSON.parse(fs.readFileSync('data/19ib_all_judges_REPAIRED.json')),meta=JSON.parse(fs.readFileSync('data/forum_judges_export.json'));
 validateSavedSnapshot(main);const source={...full,entries:main.members.map(p=>({userId:p.userId,scoredCount:p.scores.length,score:p.scores.length? p.scores.reduce((n,s)=>n+s.score,0):null}))};
 const result=await collect({roundId:'r'},main,meta,{now:()=>main.exportedAt,get:async path=>{if(path.endsWith('/full'))return source;if(path.endsWith('/live'))return {progress:source.entries};assert.fail('no card should be requested');}});
 assert.deepEqual(result.main,main);assert.deepEqual(result.forum,meta);const a=normalizeData(main,meta),b=normalizeData(result.main,result.forum);assert.deepEqual(a.events,b.events);
 const calc=d=>unifiedAt(d.events,d.metadata.size,5,Date.parse(main.exportedAt),{otherCount:d.people.length-d.metadata.size,historical:false});assert.deepEqual(calc(a),calc(b));
});
test('workflow serializes both publications and collectors; uses current branch state and guarded push',()=>{
 const wf=fs.readFileSync('.github/workflows/update-data.yml','utf8'),deploy=fs.readFileSync('.github/workflows/deploy.yml','utf8');for(const text of [wf,deploy]){assert.match(text,/group: ib19-publish/);assert.match(text,/cancel-in-progress: false/);}assert.match(wf,/cron: '\*\/5 \* \* \* \*'/);assert.match(wf,/workflow_dispatch:/);assert.match(wf,/fetch-depth: 0/);assert.match(wf,/git push origin HEAD:main/);assert.ok(wf.indexOf('npm run build')<wf.indexOf('git push origin'));assert.doesNotMatch(wf,/git push.*--force/);
});
