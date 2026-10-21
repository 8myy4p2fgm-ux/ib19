import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {temporaryExclusionRules,partitionAnalytics} from '../js/analytics-selection.js';
import {normalizeData} from '../js/data.js';
import {validateData} from '../scripts/validate-data.mjs';
import {collect,mergeSnapshot,validateSavedSnapshot} from '../scripts/collector.mjs';
import {applyForumDirectory} from '../scripts/forum-directory.mjs';
import {records,updateHistory} from '../scripts/update-history.mjs';
import {judgingProgress} from '../js/judging-progress.js';
import {paceModel} from '../js/pace-model.js';
import {buildForumLink} from '../js/forum-link-model.js';
import {buildProfiles} from '../js/judge-profile-model.js';
import {unifiedAt} from '../js/calculations.js';
const excluded='52385ac3-2e09-4df9-a04c-ca4348cf42d6',retained='0460e777-7403-40dd-8176-fd168c93a530',ordinary='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const at='2026-10-19T10:32:10.772Z',later='2026-10-19T19:30:00.000Z';
const details=JSON.parse(fs.readFileSync('tests/fixtures/excluded-participant-scores.json')).scores;
const previous=details.filter(s=>s.judgeName!=='Игорь Кедо');
const member=(userId,scores,artistName)=>({userId,scores:structuredClone(scores),scoredCount:scores.length,artistName,current:true,fetchedAt:at});
const main={exportedAt:at,totalParticipants:3,members:[member(excluded,previous,'Zippy'),member(retained,previous,'Zippy Kid'),member(ordinary,previous.slice(0,2),'Ordinary')],archivedMembers:[]};
const forum={exportedAt:at,members:[{...member(excluded,previous,'Zippy'),forum_name:'Zippy kid',group:'OG',manual:'Preserve exact author fields'},{...member(ordinary,previous.slice(0,2),'Ordinary'),forum_name:'Other',group:'OG'}]};
const round=(scores=details)=>({id:'r',judgesRequired:5,scoreScale:5,passThreshold:15,entries:main.members.map(p=>({userId:p.userId,scoredCount:p.userId===excluded?scores.length:p.scores.length,score:(p.userId===excluded?scores:p.scores).reduce((n,s)=>n+s.score,0)}))});
const merged=(scores=details,base=main,directory=forum,exclusionRules=temporaryExclusionRules)=>mergeSnapshot(base,directory,round(scores),new Map(main.members.map(p=>[p.userId,p.userId===excluded?scores:p.scores])),later,{exclusionRules,verifiedIds:new Set([excluded])});
const run=(base=main,directory=forum,scores=details,exclusionRules=temporaryExclusionRules)=>{
 const paths=[],logs=[];
 const promise=collect({roundId:'r'},base,directory,{now:()=>later,exclusionRules,onProgress:log=>logs.push(log),get:async path=>{paths.push(path);if(path.endsWith('/full'))return round(scores);if(path.endsWith('/live'))return{progress:round(scores).entries};if(path.endsWith('/'+excluded+'/scores'))return{scores};assert.fail('Unexpected source request '+path);}});
 return{promise,paths,logs};
};

test('one exact UUID is configured; the other Zippy Kid is retained',()=>{
 assert.deepEqual(temporaryExclusionRules.filter(r=>r.enabled).map(r=>r.userId),[excluded]);
 const copy=structuredClone({main,forum}),view=partitionAnalytics(main,forum);
 assert.deepEqual(view.main.members.map(p=>p.userId),[retained,ordinary]);assert.equal(view.main.totalParticipants,2);
 assert.equal(view.main.members[0],main.members[1]);assert.equal(view.main.quarantinedMembers[0],main.members[0]);
 assert.deepEqual({main,forum},copy);
});
test('all six raw grades and author metadata survive; every other participant is unchanged',()=>{
 assert.equal(details.length,6);assert.equal(new Set(details.map(s=>s.judgeName)).size,6);
 const batch=merged();assert.deepEqual(batch.main.quarantinedMembers[0].scores,details);assert.deepEqual(batch.forum.quarantinedMembers[0].scores,details);
 assert.equal(batch.forum.quarantinedMembers[0].manual,forum.members[0].manual);
 for(const id of [retained,ordinary])assert.deepEqual(batch.main.members.find(p=>p.userId===id),main.members.find(p=>p.userId===id));
 validateSavedSnapshot(batch.main);assert.equal(validateData(batch.main,batch.forum).participants,2);
});
test('tables, judge histories, TUZ, progress and forecast use the same filtered sample',()=>{
 const batch=merged(),D=normalizeData(batch.main,batch.forum),manual=normalizeData({...main,members:main.members.filter(p=>p.userId!==excluded),totalParticipants:2},{...forum,members:forum.members.filter(p=>p.userId!==excluded)},{exclusionRules:[]});
 assert(!D.byId.has(excluded));assert(!D.archivedById.has(excluded));assert(!D.artists.has(excluded));assert(!D.referenceMetadata.has(excluded));assert(D.byId.has(retained));
 assert(D.events.every(s=>s.userId!==excluded));assert.deepEqual(D.events,manual.events);
 const rows=buildForumLink(D);assert.equal(rows.forum.length+rows.other.length,2);assert(![...rows.forum,...rows.other].some(r=>r.id===excluded));
 const calc=d=>unifiedAt(d.events,d.metadata.size,5,Date.parse(later),{otherCount:d.people.length-d.metadata.size,historical:false});
 assert.deepEqual(calc(D),calc(manual));
 const progress=judgingProgress([...D.byId.values()]);assert.equal(progress.required,10);assert.equal(progress.placed,7);assert.equal(progress.remaining,3);assert.equal(progress.percent,70);
 const pace=paceModel({events:D.events,participants:D.people.length,scoresPerParticipant:5,asOf:Date.parse(later),deadline:'2026-10-22T23:59:00+03:00'});assert.equal(pace.target,10);assert.equal(pace.done,7);assert.equal(pace.remaining,3);
 const judges=[...new Set(D.events.map(s=>s.judgeName))].map((name,i)=>({userId:'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),name}));
 const profiles=buildProfiles({...D,judges,judgeIdentities:new Map(judges.map(j=>[j.name,j.userId]))});
 const grades=[...profiles.values()].flatMap(j=>j.rows);assert.equal(grades.length,7);assert(grades.every(s=>s.userId!==excluded));
});
test('six grades for any other UUID still fail global validation',()=>{
 for(const id of [retained,ordinary]){
  const batch=merged(),p=batch.main.members.find(p=>p.userId===id);p.scores=structuredClone(details);p.scoredCount=6;
  assert.throws(()=>validateData(batch.main,batch.forum),/больше пяти оценок/);
 }
 const batch=merged();batch.main.quarantinedMembers.push({...batch.main.members[0]});assert.throws(()=>validateData(batch.main,batch.forum),/Unknown participant/);
});
test('duplicate source/quarantine UUIDs and invalid raw scores remain errors',()=>{
 const batch=merged();batch.main.quarantinedMembers.push(batch.main.quarantinedMembers[0]);assert.throws(()=>validateData(batch.main,batch.forum),/Duplicate participant/);
 const invalid=merged();invalid.main.quarantinedMembers[0].scores[0].score=0;assert.throws(()=>validateSavedSnapshot(invalid.main),/Invalid saved score/);
});
test('collection accepts real six-grade response and emits the exclusion UUID and reason',async()=>{
 const {promise,paths,logs}=run(),batch=await promise;assert.equal(paths.length,3);validateData(batch.main,batch.forum);
 assert.equal(batch.collection.participants,2);assert.equal(batch.collection.sourceParticipants,3);
 const log=logs.find(x=>x.stage==='temporary-exclusion');assert.equal(log.userId,excluded);assert.equal(log.scoredCount,6);assert.match(log.reason,/six scores/);
});
test('next incremental run reuses quarantine without losing raw grades or author metadata',async()=>{
 const first=await run().promise;
 const directory=applyForumDirectory(first.forum,forum.members.map(({userId,group,forum_name})=>({userId,group,forum_name})));
 assert.equal(directory.members.find(p=>p.userId===excluded).manual,forum.members[0].manual);
 const second=run(first.main,directory),next=await second.promise;assert.equal(second.paths.length,2);
 assert.deepEqual(next.main.quarantinedMembers,first.main.quarantinedMembers);assert.deepEqual(next.main.members,first.main.members);assert.equal(next.forum.quarantinedMembers[0].manual,forum.members[0].manual);
});
test('history preserves original five and records the sixth as an addition, not deletions',()=>{
 const batch=merged(),history=updateHistory(main,batch.main,batch.forum,null,later,{previousForum:forum});
 assert.equal(records(batch.main).length,records(main).length+1);assert.equal(history.revisions.length,1);
 assert.equal(history.revisions[0].after.judgeName,'Игорь Кедо');assert.equal(history.revisions[0].before,null);
 assert.equal(history.selectionChanges.length,1);assert(!history.selectionVersions.at(-1).participantIds.includes(excluded));assert.equal(history.snapshots.at(-1).scores,7);
});
test('disappeared excluded participant remains in raw quarantine and not archived analytics',()=>{
 const batch=merged(),nextRound=round();nextRound.entries=nextRound.entries.filter(p=>p.userId!==excluded);
 const next=mergeSnapshot(batch.main,batch.forum,nextRound,new Map(main.members.map(p=>[p.userId,p.scores])),later);
 assert.equal(next.main.quarantinedMembers.length,1);assert.equal(next.main.quarantinedMembers[0].current,false);assert.equal(next.main.archivedMembers.length,0);
 assert.deepEqual(next.main.quarantinedMembers[0].scores,details);
});
test('disable one rule after source repair to restore the participant with metadata and five grades',async()=>{
 const first=await run().promise,disabled=temporaryExclusionRules.map(r=>({...r,enabled:false}));
 assert.equal(validateData(first.main,first.forum,{exclusionRules:disabled}).participants,2,'saved quarantine remains valid while the source is re-read');
 const {promise}=run(first.main,first.forum,previous,disabled),restored=await promise;
 const D=normalizeData(restored.main,restored.forum,{exclusionRules:disabled});assert.equal(D.people.length,3);assert(D.byId.has(excluded));assert(D.byId.has(retained));
 assert.equal(restored.main.quarantinedMembers.length,0);assert.equal(restored.forum.quarantinedMembers.length,0);assert.equal(D.metadata.get(excluded).manual,forum.members[0].manual);
 assert.deepEqual(D.byId.get(excluded).scores,previous);assert.equal(validateData(restored.main,restored.forum,{exclusionRules:disabled}).participants,3);
 const h=updateHistory(first.main,restored.main,restored.forum,null,later);assert(h.revisions.some(r=>r.before?.judgeName==='Игорь Кедо'&&r.after===null),'source correction remains in revision history');
});

test('raw quarantine quality checks retain strict timestamps, scores and cross-source consistency',()=>{
 const future=merged();future.main.quarantinedMembers[0].scores[0].scoredAt='2099-01-01T00:00:00Z';assert.throws(()=>validateData(future.main,future.forum),/оценка позже exportedAt/);
 const invalid=merged();invalid.main.quarantinedMembers[0].scores[0].score=0;assert.throws(()=>validateData(invalid.main,invalid.forum),/invalid raw score/);
 const mismatch=merged();mismatch.forum.quarantinedMembers[0].scores[0].score=1;assert.throws(()=>validateData(mismatch.main,mismatch.forum),/Несогласованные оценки/);
});

test('only the ratings report includes six-score quarantine, once, from raw or partitioned data',()=>{
 const batch=merged(),rawMain={...main,exportedAt:later,members:[...batch.main.members,...batch.main.quarantinedMembers]},rawForum={...forum,exportedAt:later,members:[...batch.forum.members,...batch.forum.quarantinedMembers]};
 const expected={total:3,buckets:[0,0,1,0,0,1,1]};
 for(const D of [normalizeData(batch.main,batch.forum),normalizeData(rawMain,rawForum)]){
  assert.deepEqual(D.ratingsReport,expected);
  assert.equal(D.people.length,2);assert.equal(D.events.length,7);assert(!D.byId.has(excluded));
 }
 const gone=structuredClone(batch);gone.main.quarantinedMembers[0].current=false;
 assert.deepEqual(normalizeData(gone.main,gone.forum).ratingsReport,{total:2,buckets:[0,0,1,0,0,1]});
});
