import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadR1ApplicationContext,ACTIVE_R1_SOURCE,R1_SOURCES} from '../js/r1-application.js';
import {createRankingModel} from '../js/judge-ranking-model.js';
import {createRoundContext} from '../js/round-context.js';
import {normalizeData} from '../js/data.js';
import {buildForumLink} from '../js/forum-link-model.js';
import {buildEvents} from '../js/analytics-v2.js';
import {ZIPPY_ID} from '../js/r1-official-policy.js';

const roots={candidate:new URL('../docs/data-candidates/r1-2026-10-22-194208/',import.meta.url),baseline:new URL('../data/',import.meta.url)};
const fixtures=Object.fromEntries(Object.entries(roots).map(([key,root])=>[key,Object.fromEntries(['metadata.json','19ib_all_judges_REPAIRED.json','forum_judges_export.json','history.json'].map(file=>[file,JSON.parse(fs.readFileSync(new URL(file,root)))]))]));
function mockRead(t,{change}={}){
 const requests=[];
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  const source=url.pathname.includes('/data-candidates/')?'candidate':'baseline',file=url.pathname.split('/').pop();requests.push({source,file,url:url.href});
  assert.equal(options.signal instanceof AbortSignal,true);assert.equal(url.protocol,'file:');
  let body=structuredClone(fixtures[source][file]);if(change)body=change(body,{source,file,requests})??body;
  return {ok:true,json:async()=>body};
 });return requests;
}

test('Local application loads one complete candidate through the existing bracketed loader',async t=>{
 const requests=mockRead(t),view=await loadR1ApplicationContext();
 assert.equal(ACTIVE_R1_SOURCE,'candidate');assert.equal(view.runId,R1_SOURCES.candidate.runId);assert.equal(view.policyVersion,'r1-official-zippy-v2');
 assert.deepEqual(requests.map(r=>r.file),['metadata.json','19ib_all_judges_REPAIRED.json','forum_judges_export.json','metadata.json']);
 assert(requests.every(r=>r.source==='candidate'));
 assert.deepEqual(view.analytics.outcomes(),{participants:3276,standardPasses:2217,specialOfficialPasses:1,totalPassed:2218,failed:1058,pending:0});
 assert.deepEqual(view.activity().accounting,{standardSlots:16380,creditedStandardSlots:16380,actualValidScores:16380,additionalValidScores:0,remainingStandardSlots:0,standardCompletionPercent:100});
 assert.equal(view.history.source,null);assert.equal(view.sourceContract,'r1-fixed-facts-v1');assert.equal(view.attributionUncertaintyIds().length,12);assert.equal(view.history.gradeRevisionsAdded,0);
});

test('Every screen can use the same identity, rankings, profiles and exact TUZ without another load',async t=>{
 const requests=mockRead(t),view=await loadR1ApplicationContext(),D=view.data;
 D.participantOutcomes=new Map([...D.byId.keys()].map(id=>[id,view.analytics.participantOutcome(id)]));
 const ranking=createRankingModel(view);assert.equal(ranking.snapshotKey,view.snapshotKey);
 assert.equal(view.analytics.summary().index,20.884382840066547);assert.equal(view.analytics.summary({group:'veterans'}).index,32.123232268736096);assert.equal(view.analytics.summary({group:'reference'}).index,24.33011397644815);
 const profiles=D.byId.get(ZIPPY_ID).scores.map(s=>ranking.profile(D.judgeIdentities.get(s.judgeName)).rows.filter(r=>r.userId===ZIPPY_ID));
 assert.equal(profiles.flat().length,5);assert(profiles.flat().every(s=>s.officialException.label==='5 действительных оценок · официальный проход'&&s.officialException.scoreTotal===15&&s.officialException.scoreMaximum===25));
 const people=buildForumLink(D);assert(!people.forum.some(p=>p.id===ZIPPY_ID));assert.equal(people.other.find(p=>p.id===ZIPPY_ID).status,'pass');
 assert(!buildEvents(D).some(e=>e.userId===ZIPPY_ID),'unknown official decision date must not be manufactured');
 assert.equal(view.activity().factual.events.filter(e=>e.userId===ZIPPY_ID).length,5);assert.equal(requests.length,4);
});

test('The final archive is the only application source; baseline is rejected without reads',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',()=>{calls++;throw Error('unexpected request');});
 assert.deepEqual(Object.keys(R1_SOURCES),['candidate']);await assert.rejects(loadR1ApplicationContext({source:'baseline'}),/Unsupported local/);assert.equal(calls,0);
});

test('Unknown source is rejected before reading or making any external request',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',()=>{calls++;throw Error('unexpected request');});
 await assert.rejects(loadR1ApplicationContext({source:'live-api'}),/Unsupported local/);assert.equal(calls,0);
});

test('Changed metadata during a read retries the whole source instead of mixing two runs',async t=>{
 const requests=mockRead(t,{change:(body,{file,requests})=>{
  if(file==='metadata.json'&&requests.filter(r=>r.file===file).length===2)body.runId='changed-mid-read';return body;
 }});
 const view=await loadR1ApplicationContext();assert.equal(view.runId,R1_SOURCES.candidate.runId);
 assert.equal(requests.filter(r=>r.file==='history.json').length,0);assert.equal(requests.filter(r=>r.file==='19ib_all_judges_REPAIRED.json').length,2);assert.equal(requests.filter(r=>r.file==='metadata.json').length,4);
});
