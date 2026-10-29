import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRoundContext,loadRoundContext,FIRST_ROUND_ID} from '../js/round-context.js';
import {normalizeData} from '../js/data.js';
import {generalAt,participantStatus} from '../js/general.js';
import {rankPersonalV4} from '../js/personal.js';

const read=name=>JSON.parse(fs.readFileSync(new URL('../docs/data-candidates/r1-2026-10-22-194208/'+name,import.meta.url)));
const main=read('19ib_all_judges_REPAIRED.json'),forum=read('forum_judges_export.json'),metadata=read('metadata.json');
const source={main,forum,metadata};
const secondRound='235f6600-5224-4adf-bbcc-a220f4572251';
function fixture(){
 const p=structuredClone(main.members.find(p=>forum.members.some(f=>f.userId===p.userId&&f.group==='OG')));
 const f=structuredClone(forum.members.find(f=>f.userId===p.userId));
 return {main:{version:1,exportedAt:main.exportedAt,totalParticipants:1,members:[p]},forum:{exportedAt:forum.exportedAt,members:[f]},metadata:structuredClone(metadata)};
}

test('First-round context preserves baseline outcomes, TUZ, selections and identities',()=>{
 const ctx=createRoundContext(source),D=normalizeData(main,forum);
 assert.equal(ctx.roundId,FIRST_ROUND_ID);assert.equal(ctx.runId,metadata.runId);assert.equal(ctx.exportedAt,main.exportedAt);
 assert.deepEqual([ctx.rules.scoresPerParticipant,ctx.rules.minScore,ctx.rules.maxScore,ctx.rules.passScore],[5,1,5,15]);
 assert.equal(ctx.data.people.length,3275);assert.equal(ctx.data.events.length,16375);
 const counts={pass:0,fail:0,pending:0};
 for(const p of D.byId.values()){
  const actual=ctx.analytics.participantStatus(p.userId);
  assert.deepEqual(actual,participantStatus(p.scores));counts[actual.status]++;
 }
 assert.deepEqual(counts,{pass:2217,fail:1058,pending:0});
 for(const [group,n,expected] of [['forum',70,20.88681255323298],['veterans',28,32.123957385283475]]){
  const ids=new Set([...D.metadata].filter(([,p])=>(p.group==='Ветераны'||p.veteran===true)===(group==='veterans')).map(([id])=>id));
  const scores=D.events.map(e=>({...e,forum:ids.has(e.userId)})),at=Date.parse(D.updated),start=scores.find(e=>Number.isFinite(e.t))?.t;
  const baseline=generalAt(scores,ids.size,D.people.length-ids.size,start,at,{historical:false});
  assert.equal(ctx.selectGroup(group).people.length,n);
  assert.deepEqual(ctx.analytics.summary({group}),baseline);
  assert.deepEqual(ctx.analytics.rankJudges({group}),rankPersonalV4(baseline.judges));
  assert.ok(Math.abs(baseline.index-expected)<1e-12);
 }
 assert.equal(ctx.selectGroup('reference').people.length,98);
 assert.deepEqual(ctx.data.excluded,D.excluded);assert.equal(ctx.data.excluded[0].scoredCount,6);
 assert.equal(ctx.data.ratingsReport.total,3276);assert.equal(ctx.data.ratingsReport.buckets[6],1);
 assert.deepEqual(ctx.data.judges,D.judges);assert.deepEqual(ctx.data.judgeIdentities,D.judgeIdentities);
 assert.deepEqual(ctx.data.metadata,D.metadata);assert.deepEqual(ctx.data.referenceMetadata,D.referenceMetadata);
 assert.deepEqual(ctx.data.archivedById,D.archivedById);
 assert.throws(()=>ctx.analytics.participantStatus(ctx.data.excluded[0].userId),/outside round analytics/);
});

for(const [label,change] of [
 ['missing',s=>delete s.metadata],['null',s=>s.metadata=null],
 ['version',s=>s.metadata.version=2],['runId',s=>s.metadata.runId=''],
 ['export date',s=>s.metadata.exportedAt='broken'],['forum date',s=>delete s.metadata.forumExportedAt],
 ['last success',s=>s.metadata.lastSuccessfulAt=null],['missing source',s=>delete s.metadata.source],
 ['other source round',s=>s.metadata.source.roundId=secondRound],
 ['nested round',s=>s.metadata.source.round.id=secondRound],
 ['seven judges',s=>s.metadata.source.round.judgesRequired=7],
 ['ten-point scale',s=>s.metadata.source.round.scoreScale=10],
 ['threshold',s=>s.metadata.source.round.passThreshold=null],
 ['main version mismatch',s=>s.main.exportedAt='2026-10-21T15:02:15.571Z'],
 ['forum version mismatch',s=>s.forum.exportedAt='2026-10-21T15:02:15.571Z']
])test('Context rejects '+label,()=>{
 const s=fixture();change(s);assert.throws(()=>createRoundContext(s),/metadata|round|snapshot/);
});

test('Unsupported round is rejected before normalization or network; no global cache',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;throw new Error('unexpected fetch');});
 assert.throws(()=>createRoundContext(source,{roundId:secondRound}),/Unsupported round/);
 await assert.rejects(loadRoundContext({roundId:secondRound}),/Unsupported round/);assert.equal(calls,0);
 const first=createRoundContext(fixture()),sameVersion=createRoundContext(fixture()),s=fixture();
 s.metadata.runId='another-run';const next=createRoundContext(s);
 assert.notEqual(first.snapshotKey,next.snapshotKey);assert.equal(first.snapshotKey,sameVersion.snapshotKey);
 assert.notEqual(first.data,sameVersion.data);assert.notEqual(first.data.byId,sameVersion.data.byId);
 assert.notEqual(first.analytics.summary(),first.analytics.summary(),'computed results are not shared mutable cache entries');
 const id=s.main.members[0].userId,original=next.analytics.participantStatus(id).total;
 const replacement=s.main.members[0].scores[0].score===1?5:1;
 first.data.byId.get(id).scores[0].score=replacement; s.main.members[0].scores[0].score=replacement;
 assert.equal(next.analytics.participantStatus(id).total,original,'other contexts and caller-owned raw input are isolated');
 assert.throws(()=>next.analytics.summary({at:Date.parse(next.exportedAt)+1}),/exceeds/);
 assert.throws(()=>next.analytics.summary({group:'round2'}),/Unknown analytics group/);
});

test('Unbound history and derived files cannot masquerade as verified snapshot data',async()=>{
 const history=read('history.json'),before=JSON.stringify(history);
 assert.throws(()=>createRoundContext({...source,history}),/Unverified history/);
 assert.throws(()=>createRoundContext({...source,derived:{runId:metadata.runId}}),/Unverified history\/derived/);
 await assert.rejects(loadRoundContext({history}),/Unverified history/);
 assert.equal(createRoundContext(source).history.supported,false);
 assert.equal(JSON.stringify(history),before);
});

test('Context uses existing loader: three static requests per attempt, with retry of the whole snapshot',async t=>{
 let attempts=0;const requests=[];
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  assert.equal(url.origin,new URL('../js/data.js',import.meta.url).origin);
  assert.ok(options.signal instanceof AbortSignal);
  const name=url.pathname.split('/').pop();requests.push(name);
  if(name==='metadata.json'){attempts++;return {ok:true,json:async()=>metadata};}
  assert.equal(url.searchParams.get('v'),metadata.runId);
  assert.equal(options.cache,attempts===1?'default':'no-store');
  return {ok:true,json:async()=>name==='forum_judges_export.json'?forum:attempts===1?{...main,exportedAt:'2000-01-01T00:00:00Z'}:main};
 });
 const ctx=await loadRoundContext();assert.equal(ctx.runId,metadata.runId);assert.equal(attempts,2);
 assert.deepEqual(requests,['metadata.json','19ib_all_judges_REPAIRED.json','forum_judges_export.json','metadata.json','19ib_all_judges_REPAIRED.json','forum_judges_export.json']);
});

test('Invalid metadata never triggers body requests and fails after existing retry limit',async t=>{
 let calls=0;t.mock.timers.enable({apis:['setTimeout']});
 t.mock.method(globalThis,'fetch',async url=>{
  assert.match(url.pathname,/metadata.json$/);calls++;return {ok:true,json:async()=>({})};
 });
 const rejected=assert.rejects(loadRoundContext(),/Invalid round snapshot metadata/);
 const flush=()=>new Promise(resolve=>setImmediate(resolve));await flush();
 for(const delay of [500,1000]){t.mock.timers.tick(delay);await flush();}
 await rejected;assert.equal(calls,3);
});

test('Concurrent loads keep different versions isolated without a shared cache',async t=>{
 const first=fixture(),second=fixture(),later='2026-10-23T15:02:15.571Z';
 second.metadata.runId='next-version';second.metadata.exportedAt=later;second.metadata.forumExportedAt=later;second.metadata.lastSuccessfulAt=later;
 second.main.exportedAt=later;second.forum.exportedAt=later;
 const score=second.main.members[0].scores[0];score.score=score.score===1?5:1;
 second.forum.members[0].scores.find(s=>s.judgeName===score.judgeName).score=score.score;
 let calls=0;
 t.mock.method(globalThis,'fetch',async url=>{
  const name=url.pathname.split('/').pop();
  if(name==='metadata.json')return {ok:true,json:async()=>++calls===1?first.metadata:second.metadata};
  const snapshot=url.searchParams.get('v')===first.metadata.runId?first:second;
  return {ok:true,json:async()=>name==='forum_judges_export.json'?snapshot.forum:snapshot.main};
 });
 const [a,b]=await Promise.all([loadRoundContext(),loadRoundContext()]);
 assert.equal(a.runId,first.metadata.runId);assert.equal(b.runId,second.metadata.runId);
 assert.equal(a.data.updated,first.metadata.exportedAt);assert.equal(b.data.updated,later);
 assert.notEqual(a.snapshotKey,b.snapshotKey);
 assert.notEqual(a.analytics.participantStatus(first.main.members[0].userId).total,b.analytics.participantStatus(first.main.members[0].userId).total);
});
