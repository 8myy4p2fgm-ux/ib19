import test from 'node:test';import assert from 'node:assert/strict';
import {readPublicR1,splitPublicR1} from '../scripts/public-data.mjs';
import {joinR1Comments} from '../js/r1-comments-contract.js';
import {CORE_R1_CONTRACT} from '../js/r1-core-contract.js';
import {createOfficialR1View} from '../js/r1-official-view.js';
import {loadR1ApplicationContext} from '../js/r1-application.js';
import {contentHash} from '../js/r1-correction.js';
const {snapshot}=await readPublicR1(),{core,comments}=splitPublicR1(snapshot),policyVersion='r1-official-zippy-v2';
const view=s=>createOfficialR1View(s,{policyVersion,sourceContract:s.coreVersion?CORE_R1_CONTRACT:'r1-public-v1'});
test('Core/comments losslessly reproduce every original byte value, grade, comment and duplicate reference',()=>{
 const joined=joinR1Comments(core,comments);assert.deepEqual(joined,snapshot);
 assert.equal(JSON.stringify(core).includes('"comment":'),false);
 const all=[];for(const section of ['members','archivedMembers','quarantinedMembers'])for(const p of snapshot.main[section]||[])for(const s of p.scores)all.push(JSON.stringify([p.userId,s.judgeName,s.scoredAt]));
 assert.equal(new Set(all).size,all.length);assert.equal(comments.records.length,all.length);
 const full=view(snapshot),compact=view(core),a=compact.data,b=full.data;
 const stripped=rows=>rows.map(({comment,commentHash,...s})=>s);
 assert.deepEqual(stripped(a.events),stripped(b.events));assert.deepEqual(compact.analytics.outcomes(),full.analytics.outcomes());
 for(const group of ['forum','veterans'])assert.deepEqual(compact.analytics.summary({group}),full.analytics.summary({group}));
 assert.deepEqual(compact.activity({now:Date.parse(compact.exportedAt)}).factual.days,full.activity({now:Date.parse(full.exportedAt)}).factual.days);
});
test('Pinned core rejects changed version, round, score and membership before analytics',()=>{
 for(const change of [x=>x.coreVersion='other',x=>x.metadata.source.roundId='other',x=>x.main.members[0].scores[0].score=99,x=>x.forum.members[0].group='other',x=>x.commentsHash='0'.repeat(64)]){const bad=structuredClone(core);change(bad);assert.throws(()=>view(bad));}
});
test('Comments reject loss, duplicates, mismatched grade/timestamp, extra records and wrong round',()=>{
 for(const change of [x=>x.records.pop(),x=>x.records.push(x.records[0]),x=>x.records[0].score=99,x=>x.records[0].scoredAt='2000-01-01',x=>x.records[0].comment+='x',x=>x.roundId='other']){const bad=structuredClone(comments);change(bad);assert.throws(()=>joinR1Comments(core,bad));}
 for(const change of [x=>x.records.pop(),x=>x.records.push({...x.records[0],participantId:'unbound'}),x=>x.records[0].score=99]){const bad=structuredClone(comments);change(bad);assert.throws(()=>joinR1Comments({...core,commentsHash:contentHash(bad)},bad));}
});
test('Home requests only core; concurrent comments share one existing loader request; data remains isolated',async t=>{
 const urls=[];t.mock.method(globalThis,'fetch',async url=>{urls.push(url.pathname);return {ok:true,json:async()=>structuredClone(url.pathname.endsWith('core.json')?core:comments)};});
 const c=await loadR1ApplicationContext();assert.equal(urls.length,1);assert.equal(c.comments.ready,false);assert(c.data.events.every(s=>s.comment===undefined));
 const [a,b]=await Promise.all([c.comments.load(),c.comments.load()]);assert.equal(urls.length,2);assert.equal(c.comments.ready,true);assert.deepEqual(a.events,view(snapshot).data.events);
 a.events[0].comment='caller mutation';assert.notEqual(c.data.events[0].comment,a.events[0].comment);
 // Concurrent callers receive private data projections, not the same mutable object.
 assert.notStrictEqual(a,b);
});
test('Failed comments can be retried without refetching core or accepting partial comments',async t=>{
 let fail=true;const urls=[];t.mock.method(globalThis,'fetch',async url=>{urls.push(url.pathname);if(url.pathname.endsWith('comments.json')&&fail)return {ok:false,status:503};return {ok:true,json:async()=>structuredClone(url.pathname.endsWith('core.json')?core:comments)};});
 const c=await loadR1ApplicationContext();await assert.rejects(c.comments.load());assert.equal(c.comments.ready,false);assert(c.data.events.every(s=>s.comment===undefined));fail=false;await c.comments.load();assert.equal(c.comments.ready,true);assert.equal(urls.filter(x=>x.endsWith('core.json')).length,1);
});
