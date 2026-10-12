import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {parseForumCSV,applyForumDirectory} from '../scripts/forum-directory.mjs';import {mergeSnapshot} from '../scripts/collector.mjs';import {updateHistory,records} from '../scripts/update-history.mjs';import {normalizeData} from '../js/data.js';import {judgingProgress} from '../js/judging-progress.js';import {buildForumLink} from '../js/forum-link-model.js';import {paceModel} from '../js/pace-model.js';
const at='2026-10-12T19:23:44.104Z',grade={judgeName:'J',score:4,comment:'Keep history',scoredAt:'2026-09-01T12:00:00Z'};
const old={exportedAt:at,totalParticipants:20,members:Array.from({length:20},(_,i)=>({userId:String(i),scoredCount:1,current:true,scores:[{...grade}]}))};
const forum={exportedAt:at,members:[{userId:'0',group:'OG',forum_name:'Absent author',scores:[grade],manual:'Keep'},{userId:'1',group:'Ветераны',forum_name:'Veteran',scores:[grade]}]};
const round={id:'round',scoreScale:5,judgesRequired:5,passThreshold:15,entries:old.members.slice(1).map(p=>({userId:p.userId,scoredCount:1}))};
const scoreMap=new Map(old.members.map(p=>[p.userId,p.scores]));
test('CSV preserves 94 distinct author UUIDs, 65 OG and 29 veterans',()=>{
 const rows=parseForumCSV(fs.readFileSync('tests/fixtures/forum-20261012.csv','utf8'));assert.equal(rows.length,94);assert.equal(rows.filter(p=>p.group==='OG').length,65);assert.equal(rows.filter(p=>p.group==='Ветераны').length,29);assert.equal(new Set(rows.map(p=>p.userId)).size,94);
 assert.throws(()=>parseForumCSV('wrong,header\n'),/columns/);assert.throws(()=>parseForumCSV(fs.readFileSync('tests/fixtures/forum-20261012.csv','utf8')+'OG,Duplicate,839120d8-4a8c-41af-ad23-c4bf07f921db\n'),/duplicate/);
 const uid='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';assert.equal(parseForumCSV(`\uFEFFgroup,forum_name,userId\r\nOG,"Name, with ""quotes""",${uid}\r\n`)[0].forum_name,'Name, with "quotes"');
});
test('only current UUIDs feed all denominators, statuses, matrix and forecast',()=>{
 const b=mergeSnapshot(old,forum,round,scoreMap,at),D=normalizeData(b.main,b.forum),p=judgingProgress(b.main.members),model=buildForumLink(D);
 assert.equal(b.main.totalParticipants,19);assert.equal(D.people.length,19);assert.equal(D.referenceMetadata.size,2);assert.equal(D.metadata.size,1);assert.equal(model.forum.length,1);assert.equal(model.other.length,18);assert.equal(model.veterans.length,1);assert.equal(p.required,95);assert.equal(p.credited,19);assert.equal(p.remaining,76);assert.equal(p.percent,20);
 assert.equal(model.forumStats.passed+model.forumStats.failed+model.forumStats.pending,1);assert.equal(model.otherStats.total+model.forumStats.total,D.people.length);
 const pace=paceModel({events:D.events,participants:D.people.length,scoresPerParticipant:5,asOf:Date.parse(at),deadline:'2026-10-18T23:59:00+03:00'});assert.equal(pace.target,95);assert.equal(pace.done,19);
 assert.equal(b.main.archivedMembers[0].scores[0].comment,grade.comment);assert.equal(b.forum.members[0].manual,'Keep');
});
test('disappearance, a new UUID and reappearance are handled without losing archived grades',()=>{
 const b=mergeSnapshot(old,forum,round,scoreMap,at);const nextRound={...round,entries:[...round.entries,{userId:'new',scoredCount:0}]};const scores=new Map([...scoreMap,['new',[]]]);const next=mergeSnapshot(b.main,b.forum,nextRound,scores,at);assert.equal(next.main.members.length,20);assert.equal(next.main.archivedMembers.length,1);
 const restored=mergeSnapshot(next.main,next.forum,{...nextRound,entries:[...nextRound.entries,{userId:'0',scoredCount:1}]},scores,at);assert.equal(restored.main.members.length,21);assert.equal(restored.main.archivedMembers.length,0);assert.equal(restored.forum.members[0].current,true);assert.deepEqual(restored.main.members.find(p=>p.userId==='0').scores,[grade]);
});
test('archiving is a selection change, not grade deletion, and old snapshots remain intact',()=>{
 const baseline=updateHistory(old,old,forum,null,at),oldIndices=structuredClone(baseline.snapshots[0].indices),b=mergeSnapshot(old,forum,round,scoreMap,at);const later='2026-10-12T20:00:00Z';b.main.exportedAt=later;
 const h=updateHistory(old,b.main,b.forum,baseline,later,{previousForum:forum});assert.equal(h.revisions.length,0);assert.equal(records(b.main).length,records(old).length);assert.equal(h.selectionChanges.length,1);assert.deepEqual(h.snapshots[0].indices,oldIndices);assert.notEqual(h.snapshots[0].selectionVersion,h.snapshots[1].selectionVersion);
 const again=updateHistory(b.main,b.main,b.forum,h,later,{previousForum:b.forum});assert.equal(again.selectionChanges.length,1);assert.equal(again.snapshots.length,2);
});
test('CSV is authoritative only for membership and names; author extras survive',()=>{
 const d=applyForumDirectory(forum,[{userId:'0',group:'Ветераны',forum_name:'Renamed'},{userId:'new',group:'OG',forum_name:'New author'}]);assert.equal(d.members.length,2);assert.equal(d.members[0].manual,'Keep');assert.equal(d.members[0].veteran,true);assert.equal(d.members[0].forum_name,'Renamed');assert.deepEqual(d.members[0].scores,[grade]);assert.equal(d.members[1].scores.length,0);
});

test('editable production CSV is valid without freezing its future size',()=>{const rows=parseForumCSV(fs.readFileSync('data/forum.csv','utf8'));assert.ok(rows.length>0);assert.equal(new Set(rows.map(p=>p.userId)).size,rows.length);assert.ok(rows.every(p=>['OG','Ветераны'].includes(p.group)));});
