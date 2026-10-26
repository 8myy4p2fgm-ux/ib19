import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createOfficialR1View,createOfficialR1ViewForPolicy} from '../js/r1-official-view.js';
import {officialR1Policy,ZIPPY_R1_POLICY_V2_VERSION,ZIPPY_R1_POLICY_VERSION,ZIPPY_ID} from '../js/r1-official-policy.js';
import {sha256,contentHash} from '../js/r1-correction.js';
import {buildProfiles,pageScores} from '../js/judge-profile-model.js';
import {createRankingModel} from '../js/judge-ranking-model.js';
const root=new URL('../docs/data-candidates/r1-2026-10-22-194208/',import.meta.url),read=f=>JSON.parse(fs.readFileSync(new URL(f,root)));
const snapshot={main:read('19ib_all_judges_REPAIRED.json'),forum:read('forum_judges_export.json'),metadata:read('metadata.json'),history:read('history.json')};
const options={policyVersion:ZIPPY_R1_POLICY_V2_VERSION},v2=createOfficialR1View(snapshot,options),v1=createOfficialR1View(snapshot,{policyVersion:ZIPPY_R1_POLICY_VERSION}),judge='df69c076-dd85-4503-939f-12dc1ef397ba';
const control=JSON.parse(fs.readFileSync(new URL('../docs/diagnostics/data-02c-1/calculations.json',import.meta.url)));
const z=s=>s.main.quarantinedMembers.find(p=>p.userId===ZIPPY_ID);
function synthetic(mode='B'){
 const s=structuredClone(snapshot),p=structuredClone(officialR1Policy(ZIPPY_R1_POLICY_V2_VERSION));
 if(mode==='B'){z(s).scores=z(s).scores.filter(x=>x.judgeName!=='Игорь Кедо');z(s).scoredCount=5;}
 const run='2026-10-23T08:00:00.000Z';s.main.exportedAt=run;s.forum.exportedAt=run;
 Object.assign(s.metadata,{runId:run,exportedAt:run,forumExportedAt:run,lastSuccessfulAt:run});Object.assign(s.history.snapshots.at(-1),{exportedAt:run,observedAt:run});
 p.exceptions[0].sourceStates=[{mode,runId:run,rawScoreCount:mode==='B'?5:6,contentHashes:Object.fromEntries(Object.entries(s).map(([k,v])=>[k,contentHash(v)]))}];return {s,p};
}
test('SHA-256 matches standard implementation on UTF-8 and padding boundaries',()=>{
 for(const n of [0,1,55,56,63,64,65,128,1024])for(const text of ['a'.repeat(n),'Я🍊\n'.repeat(n)])assert.equal(sha256(text),createHash('sha256').update(text).digest('hex'));
});
test('A: v2 retains six raw scores, five valid and one exact audit record, without input mutation',()=>{
 const before=JSON.stringify(snapshot),again=createOfficialR1View(snapshot,options),D=again.data;
 assert.equal(z(snapshot).scores.length,6);assert.equal(D.byId.get(ZIPPY_ID).scores.length,5);assert.equal(D.byId.get(ZIPPY_ID).scoredCount,5);assert.equal(D.people.find(p=>p[0]===ZIPPY_ID)[3].length,5);
 assert.equal(D.events.filter(e=>e.userId===ZIPPY_ID).length,5);assert.deepEqual(D.ratingsReport,{total:3276,buckets:[0,0,0,0,0,3276]});assert.equal(D.sourceRatingsReport.buckets[6],1);assert.equal(D.annulledScores.length,1);assert.equal(D.annulledScores[0].judgeId,judge);assert.equal(D.annulledScores[0].annulmentDecisionAt,null);assert.equal(D.annulledScores[0].fingerprint,control.target.fingerprint);
 assert.equal(D.annulledScores[0].comment,z(snapshot).scores.find(s=>s.judgeName==='Игорь Кедо').comment);assert.equal(JSON.stringify(snapshot),before);assert.deepEqual(again.data,v2.data);
});
test('Controls, exclusive official pass, all 22 TUZ components/order and podium',()=>{
 assert.deepEqual(v2.analytics.outcomes(),control.controls.projectedAfterWithSpecialClassification);
 const outcome=v2.analytics.participantOutcome(ZIPPY_ID);assert.equal(outcome.scoreTotal,15);assert.equal(outcome.scoreMaximum,25);assert.equal(outcome.standardOutcome,null);assert.equal(outcome.classification,'special-official-pass');assert.equal(outcome.standardMathDiagnostic.status,'pass');
 for(const group of ['forum','veterans','reference']){
  assert.equal(v2.analytics.summary({group}).index,control.groups[group].afterIndex);
  assert.deepEqual(v2.analytics.rankJudges({group}),control.groups[group].judgeRows.map(r=>r.after));
  assert.deepEqual(v2.analytics.rankJudges({group}).map(j=>j.judge),v1.analytics.rankJudges({group}).map(j=>j.judge));
 }
});
test('History unchanged and v1 reproducible; identities and returned copies isolated',()=>{
 assert.deepEqual(v2.history.source,snapshot.history);assert.equal(v2.history.gradeRevisionsAdded,0);assert.equal(v2.history.policyAudit[0].officialDecisionAt,null);
 assert.notEqual(v2.snapshotKey,v1.snapshotKey);assert.equal(v2.correctionFingerprint,control.target.fingerprint);assert.equal(v1.analytics.participantOutcome(ZIPPY_ID).validScoreCount,6);assert.equal(v1.analytics.summary().index,control.groups.forum.beforeIndex);
 const oldData=v1.data,newData=v2.data;for(const [id,p]of oldData.byId)if(id!==ZIPPY_ID)assert.deepEqual(newData.byId.get(id),p);
 const altered=v2.data;altered.annulledScores.length=0;assert.equal(v2.data.annulledScores.length,1);
});
test('Active/profile archive statistics and independent audit pagination',()=>{
 const p=buildProfiles(v2.data).get(judge),old=buildProfiles(v1.data).get(judge);assert.equal(old.count,606);assert.equal(p.count,605);assert.equal(p.mean,control.judges.find(j=>j.judgeId===judge).after.mean);assert.deepEqual(p.distribution,[89,144,167,147,58]);assert.equal(p.auditRows.length,1);
 for(const size of [25,50])assert.equal(pageScores(p.rows,{query:ZIPPY_ID,pageSize:size}).total,0);
 assert.equal(v2.data.events.filter(e=>e.judge==='Игорь Кедо').length,604);
 const ranking=createRankingModel(v2);assert.equal(ranking.profile(judge).auditRows.length,1);
 for(const s of z(snapshot).scores.filter(s=>s.judgeName!=='Игорь Кедо'))assert.equal(buildProfiles(v2.data).get(v2.data.judgeIdentities.get(s.judgeName)).rows.filter(r=>r.userId===ZIPPY_ID).length,1);
});
test('Activity separates observed, valid, annulled and standard slots',()=>{
 const a=v2.activity();assert.equal(a.sourceObserved.count,16381);assert.equal(a.valid.count,16380);assert.equal(a.annulled.count,1);assert.equal(a.accounting.standardSlots,16380);assert.equal(a.accounting.additionalValidScores,0);assert.equal(a.accounting.standardCompletionPercent,100);
 assert.equal(a.valid.days.find(d=>new Date(d.t).toISOString()==='2026-10-18T21:00:00.000Z').count,742);assert.equal(a.valid.recent,6165);assert.equal(a.slots.completion,v1.activity().slots.completion);assert.equal(a.officialRoundCompletionConfirmed,false);
});
test('Fail closed on altered target fields, judge ID, survivor, missing and duplicate target or unapproved run',()=>{
 for(const mutate of [s=>z(s).scores[0].score=4,s=>z(s).scores[0].scoredAt='2026-10-19T10:40:38.795Z',s=>z(s).scores[0].comment+=' ',s=>s.main.judgeIdentities['Игорь Кедо']='unknown',s=>z(s).scores[1].comment+=' ',s=>{z(s).scores.shift();z(s).scoredCount=5;},s=>{z(s).scores.push(z(s).scores[0]);z(s).scoredCount=7;},s=>s.metadata.runId='unapproved']){const s=structuredClone(snapshot);mutate(s);assert.throws(()=>createOfficialR1View(s,options));}
});
test('B: only explicit trusted-code approval accepts exact five, preserves archived audit without subtracting twice',()=>{
 const {s,p}=synthetic();assert.throws(()=>createOfficialR1View(s,options),/unapproved/);
 const a=createOfficialR1ViewForPolicy(s,p),b=createOfficialR1ViewForPolicy(s,p);assert.deepEqual(a.data,b.data);assert.equal(a.data.events.length,16380);assert.equal(a.data.byId.get(ZIPPY_ID).scores.length,5);assert.equal(a.data.annulledScores[0].sourcePresent,false);assert.equal(a.activity().sourceObserved.count,16380);assert.equal(a.activity().valid.count,16380);assert.equal(a.activity().annulled.count,1);assert.equal(a.activity().annulled.sourcePresentCount,0);assert.deepEqual(a.analytics.outcomes(),v2.analytics.outcomes());assert.equal(a.analytics.summary().index,v2.analytics.summary().index);
 assert.throws(()=>createOfficialR1View(s,{policyVersion:ZIPPY_R1_POLICY_VERSION}));
 const bad=structuredClone(s);z(bad).scores[0].comment+='bad';assert.throws(()=>createOfficialR1ViewForPolicy(bad,p));
 p.exceptions[0].sourceStates[0].contentHashes.main=contentHash(bad.main);assert.throws(()=>createOfficialR1ViewForPolicy(bad,p),/survivor/);
 const present=synthetic('A');present.p.exceptions[0].sourceStates[0].mode='B';assert.throws(()=>createOfficialR1ViewForPolicy(present.s,present.p),/cardinality/);
});
