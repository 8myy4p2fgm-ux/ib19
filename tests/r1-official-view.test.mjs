import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createOfficialR1View} from '../js/r1-official-view.js';
import {officialR1Policy,STANDARD_R1_POLICY_VERSION,ZIPPY_R1_POLICY_VERSION,ZIPPY_ID} from '../js/r1-official-policy.js';
import {createRoundContext,FIRST_ROUND_ID} from '../js/round-context.js';
import {normalizeData} from '../js/data.js';
import {participantStatus} from '../js/general.js';
import {unifiedAt} from '../js/calculations.js';
import {createRankingModel} from '../js/judge-ranking-model.js';
import {buildProfiles} from '../js/judge-profile-model.js';
import {paceModel} from '../js/pace-model.js';
import {updateHistory,records} from '../scripts/update-history.mjs';

const root=new URL('../docs/data-candidates/r1-2026-10-22-194208/',import.meta.url);
const read=(name,dir=root)=>JSON.parse(fs.readFileSync(new URL(name,dir)));
const snapshot={main:read('19ib_all_judges_REPAIRED.json'),forum:read('forum_judges_export.json'),metadata:read('metadata.json'),history:read('history.json')};
const options={policyVersion:ZIPPY_R1_POLICY_VERSION};
const base=createRoundContext(snapshotWithoutHistory(snapshot));
const view=createOfficialR1View(snapshot,options);
const rawZippy=snapshot.main.quarantinedMembers.find(p=>p.userId===ZIPPY_ID);
function snapshotWithoutHistory({main,forum,metadata}){return {main,forum,metadata};}
const fingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

test('Reviewed policy has an exact round/UUID/count, provenance and no invented organizer date',()=>{
 const policy=officialR1Policy(ZIPPY_R1_POLICY_VERSION),rule=policy.exceptions[0];
 assert.equal(policy.roundId,FIRST_ROUND_ID);assert.equal(rule.roundId,FIRST_ROUND_ID);assert.equal(rule.participantId,ZIPPY_ID);
 assert.equal(rule.validScoreCount,6);assert.equal(rule.allScoresValid,true);assert.equal(rule.officialOutcome,'pass');
 assert.match(rule.basis,/DATA-02A/);assert.equal(rule.recordedOn,'2026-10-22');assert.equal(rule.officialDecisionAt,null);
 assert(Object.isFrozen(policy));assert(Object.isFrozen(rule));
 assert.throws(()=>officialR1Policy('unreviewed-version'),/Unsupported/);
 assert.throws(()=>officialR1Policy({version:ZIPPY_R1_POLICY_VERSION}),/Unsupported/);
});

test('Wrong round and mixed source metadata/history are rejected before admission',()=>{
 let bad=structuredClone(snapshot);bad.metadata.source.roundId='another-round';assert.throws(()=>createOfficialR1View(bad,options),/Unsupported/);
 bad=structuredClone(snapshot);bad.metadata.source.round.id='another-round';assert.throws(()=>createOfficialR1View(bad,options),/Incompatible/);
 bad=structuredClone(snapshot);bad.metadata.counts.scores++;assert.throws(()=>createOfficialR1View(bad,options),/count mismatch/);
 bad=structuredClone(snapshot);bad.history.snapshots.at(-1).selectionVersion='different';assert.throws(()=>createOfficialR1View(bad,options),/History/);
 bad=structuredClone(snapshot);bad.forum.exportedAt='2026-10-21T00:00:00.000Z';assert.throws(()=>createOfficialR1View(bad,options),/versions/);
});

test('An unrelated participant with six scores is never admitted',()=>{
 const bad=structuredClone(snapshot),person=bad.main.members[0];
 person.scores.push({...rawZippy.scores[0]});person.scoredCount=6;
 assert.throws(()=>createOfficialR1View(bad,options),/больше пяти/);
 const other=structuredClone(snapshot);other.main.quarantinedMembers[0].userId='00000000-0000-4000-8000-000000000001';
 assert.throws(()=>createOfficialR1View(other,options),/Unknown participant/);
});

test('Zippy requires exactly six scores; seven, five and duplicate judges fail closed',()=>{
 const bad=structuredClone(snapshot),person=bad.main.quarantinedMembers[0];
 const unused=bad.main.judges.find(j=>!person.scores.some(s=>s.judgeName===j.name));
 person.scores.push({...person.scores[0],judgeName:unused.name});person.scoredCount=7;
 assert.throws(()=>createOfficialR1View(bad,options),/count requires review/);
 person.scores.splice(0,2);person.scoredCount=5;assert.throws(()=>createOfficialR1View(bad,options),/count requires review/);
 const duplicate=structuredClone(snapshot);duplicate.main.quarantinedMembers[0].scores[0].judgeName=duplicate.main.quarantinedMembers[0].scores[1].judgeName;
 assert.throws(()=>createOfficialR1View(duplicate,options),/invalid raw score/);
});

test('Official admission rejects missing/archived participants and unverified judge identities',()=>{
 const bad=structuredClone(snapshot);bad.main.quarantinedMembers[0].current=false;
 assert.throws(()=>createOfficialR1View(bad,options),/present and current/);
 bad.main.archivedMembers.push(bad.main.quarantinedMembers.pop());
 assert.throws(()=>createOfficialR1View(bad,options),/present and current/);
 const unknown=structuredClone(snapshot);unknown.main.quarantinedMembers[0].scores[0].judgeName='Unverified judge';
 assert.throws(()=>createOfficialR1View(unknown,options),/Unknown official judge/);
});

test('Every original Zippy event and comment survives exactly once; forum membership stays exact',()=>{
 const D=view.data,z=D.byId.get(ZIPPY_ID),events=D.events.filter(e=>e.userId===ZIPPY_ID);
 assert.deepEqual(z,rawZippy);assert.equal(events.length,6);assert.equal(new Set(events.map(e=>e.judge)).size,6);
 for(const score of rawZippy.scores){const event=events.find(e=>e.judge===score.judgeName);for(const key of Object.keys(score))assert.deepEqual(event[key],score[key]);assert.equal(event.t,Date.parse(score.scoredAt));}
 assert.equal(D.people.length,3276);assert.equal(D.events.length,16381);
 assert.equal(new Set(D.events.map(e=>JSON.stringify([e.userId,e.judge]))).size,16381);
 assert(!D.metadata.has(ZIPPY_ID));assert(!D.referenceMetadata.has(ZIPPY_ID));assert.equal(D.metadata.size,98);
 assert(D.metadata.has('0460e777-7403-40dd-8176-fd168c93a530'),'Zippy Kid keeps his own forum UUID');
 assert(!view.selectGroup('reference').people.some(p=>p[0]===ZIPPY_ID));assert(!D.excluded.some(p=>p.userId===ZIPPY_ID));
});

test('Official pass is separate from standard mathematics, with future UI annotation ready',()=>{
 const outcome=view.analytics.participantOutcome(ZIPPY_ID);
 assert.equal(outcome.standardOutcome,null);assert.equal(outcome.standardOutcomeReason,'official-special-case');
 assert.equal(outcome.officialOutcome,'pass');assert.equal(outcome.status,'pass');assert.equal(outcome.validScoreCount,6);
 assert.equal(outcome.scoreTotal,18);assert.equal(outcome.scoreMaximum,30);assert(!('standard' in outcome));
 assert.equal(outcome.label,'6 действительных оценок · официальный проход');
 assert.deepEqual(view.analytics.outcomes(),{participants:3276,standardPasses:2217,specialOfficialPasses:1,totalPassed:2218,failed:1058,pending:0});
 assert.throws(()=>view.analytics.participantOutcome('unknown'),/outside/);
});

test('All 3275 ordinary participant results are unchanged',()=>{
 for(const person of snapshot.main.members){
  const result=view.analytics.participantOutcome(person.userId),expected=participantStatus(person.scores);
  assert.deepEqual(result.standard,expected);assert.equal(result.standardOutcome,expected.status);assert.equal(result.officialOutcome,null);
 }
});

test('Standard slots, actual scores and additional scores are independent; six factual events survive pace',()=>{
 const activity=view.activity(),{accounting,factual,slots}=activity;
 assert.deepEqual(accounting,{standardSlots:16380,creditedStandardSlots:16380,actualValidScores:16381,additionalValidScores:1,remainingStandardSlots:0,standardCompletionPercent:100});
 assert.equal(slots.target,16380);assert.equal(slots.done,16380);
 assert.equal(factual.count,16381);assert.equal(factual.events.filter(e=>e.userId===ZIPPY_ID).length,6);
 assert(factual.events.some(e=>e.userId===ZIPPY_ID&&e.judge==='Игорь Кедо'));
 assert.equal(factual.days.reduce((n,day)=>n+day.count,0),16381);assert.equal([...factual.judges.values()].reduce((n,count)=>n+count,0),16381);
 assert.equal(factual.days.at(-1).cumulative,16381);assert.equal(activity.officialRoundCompletionConfirmed,false);
 assert.equal(activity.snapshotKey,view.snapshotKey);
 for(let i=1;i<factual.events.length;i++)assert(factual.events[i].t>=factual.events[i-1].t);
 const otherEvents=factual.events.filter(e=>e.userId!==ZIPPY_ID);assert.deepEqual(otherEvents,base.data.events);
 const old=paceModel({events:base.data.events,participants:3275,scoresPerParticipant:5,asOf:Date.parse(base.exportedAt),deadline:snapshot.metadata.source.round.judgingDeadline});
 assert.deepEqual(createOfficialR1View(snapshot).activity().slots,old);
});

test('All six judges receive one score in totals, distributions, means and current+archived profiles',()=>{
 const D=view.data,B=base.data,oldProfiles=buildProfiles(B),profiles=buildProfiles(D);
 for(const score of rawZippy.scores){
  const id=D.judgeIdentities.get(score.judgeName),a=oldProfiles.get(id),b=profiles.get(id);
  assert.equal(b.count,a.count+1);assert.equal(b.distribution[score.score-1],a.distribution[score.score-1]+1);
  assert.equal(b.rows.filter(s=>s.userId===ZIPPY_ID).length,1);assert(Math.abs(b.mean-(a.mean*a.count+score.score)/(a.count+1))<1e-12);
 }
 assert.equal([...profiles.values()].reduce((n,p)=>n+p.count,0)-[...oldProfiles.values()].reduce((n,p)=>n+p.count,0),6);
 const affected=new Set(rawZippy.scores.map(s=>s.judgeName));
 for(const group of ['forum','veterans']){
  const before=base.analytics.rankJudges({group}),after=view.analytics.rankJudges({group});
  for(const a of before){const b=after.find(j=>j.judge===a.judge);assert.equal(b.activity,a.activity);assert.equal(b.respect,a.respect);if(!affected.has(a.judge))assert.equal(b.tuz,a.tuz);else {assert.equal(b.other,a.other+1);assert.notEqual(b.favor,a.favor);assert.notEqual(b.priority,a.priority);}}
 }
});

test('Unrounded TUZ matches the existing formula; all ranking orders and podiums stay unchanged',()=>{
 const expected={forum:20.884219934825552,veterans:32.123913245875045,reference:24.330174622725295};
 for(const [group,index]of Object.entries(expected)){
  const summary=view.analytics.summary({group}),selected=view.selectGroup(group);
  const direct=unifiedAt(selected.events,selected.forumCount,5,Date.parse(view.exportedAt),{otherCount:selected.otherCount,historical:false});
  assert.equal(summary.index,direct.index);assert.equal(summary.index,index);
  assert.deepEqual(view.analytics.rankJudges({group}).map(j=>j.judge),base.analytics.rankJudges({group}).map(j=>j.judge));
 }
 const original=createRankingModel(base),derived=createRankingModel(view);
 assert.notEqual(derived.snapshotKey,original.snapshotKey);
 for(const group of ['forum','veterans']){assert.deepEqual(derived.rows(group),view.analytics.rankJudges({group}));assert.deepEqual(derived.rows(group).slice(0,3).map(j=>j.judge),original.rows(group).slice(0,3).map(j=>j.judge));}
});

test('History is retained exactly; admission is a selection change, not six new grade revisions',()=>{
 assert.deepEqual(view.history.source,snapshot.history);assert.equal(view.history.gradeRevisionsAdded,0);assert.equal(view.history.sourceRewritten,false);
 const next={...structuredClone(snapshot.main),members:[...snapshot.main.members,rawZippy],quarantinedMembers:[],totalParticipants:3276};
 assert.deepEqual(new Map(records(snapshot.main).map(s=>[JSON.stringify([s.userId,s.judgeName]),s])),new Map(records(next).map(s=>[JSON.stringify([s.userId,s.judgeName]),s])));
 const simulated=updateHistory(snapshot.main,next,snapshot.forum,snapshot.history,'2026-10-22T20:30:00.000Z');
 assert.equal(simulated.revisions.length,snapshot.history.revisions.length);assert.deepEqual(simulated.snapshots.slice(0,-1),snapshot.history.snapshots);
 assert.equal(simulated.selectionChanges.length,snapshot.history.selectionChanges.length+1);
 assert.notEqual(view.history.selectionChange.from,view.history.selectionChange.to);
 const h=view.history.source,found=new Map(h.baseline.records.filter(s=>s.userId===ZIPPY_ID).map(s=>[s.judgeName,s]));
 for(const rev of h.revisions.filter(r=>JSON.parse(r.key)[0]===ZIPPY_ID)){assert.equal(rev.sourceScoredAt,rev.after?.scoredAt??null);assert(Date.parse(rev.after.scoredAt)<=Date.parse(rev.observedAt));found.set(rev.after.judgeName,rev.after);}
 for(const score of rawZippy.scores)assert.deepEqual(found.get(score.judgeName),{...score,userId:ZIPPY_ID});assert.equal(found.size,6);
});

test('Historical recalculations are labelled reconstructions and do not backdate the official decision',()=>{
 const at=Date.parse('2026-10-16T00:00:00Z'),summary=view.analytics.summary({at}),activity=view.activity({at});
 assert.equal(summary.provenance.kind,'reconstruction');assert.equal(summary.historical,true);assert.equal(summary.provenance.policyVersion,ZIPPY_R1_POLICY_VERSION);
 assert.equal(activity.provenance.kind,'reconstruction');assert.equal(activity.factual.events.filter(e=>e.userId===ZIPPY_ID).length,5);
 assert.equal(view.policy.exceptions[0].officialDecisionAt,null);assert.deepEqual(view.history.source,snapshot.history);
 assert.throws(()=>view.analytics.summary({at:Date.parse(view.exportedAt)+1}),/exceeds/);
 assert.throws(()=>view.activity({at:Infinity}),/exceeds/);assert.throws(()=>view.analytics.summary({group:'unknown'}),/Unknown/);
});

test('Policy versions have distinct identities and isolated data; no shared cache or input mutation',()=>{
 const input=structuredClone(snapshot),before=fingerprint(input),ordinary=createOfficialR1View(input),official=createOfficialR1View(input,options),again=createOfficialR1View(input,options);
 assert.equal(fingerprint(input),before);assert.notEqual(ordinary.snapshotKey,official.snapshotKey);assert.equal(official.snapshotKey,again.snapshotKey);
 assert.equal(ordinary.policyVersion,STANDARD_R1_POLICY_VERSION);assert.equal(official.policyVersion,ZIPPY_R1_POLICY_VERSION);
 assert.equal(ordinary.identity.selectionVersion,input.metadata.selectionVersion);assert.notEqual(official.identity.selectionVersion,input.metadata.selectionVersion);
 assert.equal(ordinary.data.events.length,16375);assert.equal(official.data.events.length,16381);
 const expected=official.analytics.summary().index;
 const exposed=official.data;exposed.events[0].score=1;exposed.byId.get(ZIPPY_ID).scores.pop();exposed.metadata.clear();
 official.history.source.revisions.length=0;official.policy.exceptions.length=0;official.selectGroup().events.length=0;
 input.main.quarantinedMembers[0].scores.length=0;input.metadata.source.round.judgingDeadline=null;
 assert.equal(official.analytics.summary().index,expected);assert.equal(again.analytics.summary().index,expected);
 assert.equal(official.analytics.participantOutcome(ZIPPY_ID).validScoreCount,6);assert.equal(official.history.source.revisions.length,snapshot.history.revisions.length);
 assert.equal(official.activity().slots.deadline,Date.parse(snapshot.metadata.source.round.judgingDeadline));
 assert.equal(ordinary.data.events.length,16375);
});

test('Without policy, old normalization and RoundContext remain unchanged; nothing activates in the app',t=>{
 const before=fingerprint(snapshot);let calls=0;t.mock.method(globalThis,'fetch',()=>{calls++;throw new Error('Network is forbidden');});
 const ordinary=createOfficialR1View(snapshot),legacy=createRoundContext(snapshotWithoutHistory(snapshot));
 assert.deepEqual(ordinary.data,legacy.data);assert.equal(legacy.analytics.participantStatus(snapshot.main.members[0].userId).status,participantStatus(snapshot.main.members[0].scores).status);
 assert.throws(()=>legacy.analytics.participantStatus(ZIPPY_ID),/outside/);assert(!normalizeData(snapshot.main,snapshot.forum).byId.has(ZIPPY_ID));
 for(const group of ['forum','veterans','reference']){const {provenance,...result}=ordinary.analytics.summary({group});assert.deepEqual(result,legacy.analytics.summary({group}));}
 const liveDir=new URL('../data/',import.meta.url),live={main:read('19ib_all_judges_REPAIRED.json',liveDir),forum:read('forum_judges_export.json',liveDir),metadata:read('metadata.json',liveDir)};
 const liveContext=createRoundContext(live);assert.equal(liveContext.runId,'2026-10-22T15:02:15.571Z');assert.equal(liveContext.data.events.length,16163);assert(!liveContext.data.byId.has(ZIPPY_ID));
 for(const name of ['app.js','round-context.js','data.js','judge-ranking-entry.js','pace-model.js'])assert(!fs.readFileSync(new URL('../js/'+name,import.meta.url),'utf8').includes('r1-official-'));
 assert.equal(calls,0);assert.equal(fingerprint(snapshot),before);
});

test('Candidate bytes and working baseline hashes still match the original manifests',()=>{
 const manifest=read('manifest.json'),sha=url=>createHash('sha256').update(fs.readFileSync(url)).digest('hex');
 for(const file of manifest.files)assert.equal(sha(new URL(file.path,root)),file.sha256,file.path);
 for(const [file,hash]of Object.entries(manifest.baseline.sha256))assert.equal(sha(new URL('../'+file,import.meta.url)),hash,file);
});
