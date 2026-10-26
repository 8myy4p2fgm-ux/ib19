import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {rapperR2Model} from '../js/rapper-report-model.js';
import {r2CohortReference,r2HomeData} from '../js/r2-home-model.js';
import {collectR2Submissions,loadR2State,compatibleR2Check,R2_ROUND,R2_FILES} from '../scripts/r2-submissions-collection.mjs';
test('cohort projects approved pass statuses by UUID; admission and submission stay separate',()=>{
 const context={data:{metadata:new Map([['a',{userId:'a',group:'Форум'}],['b',{userId:'b',group:'Ветераны'}]]),byId:new Map([['a',{}],['b',{}],['c',{}]])},analytics:{participantOutcome:id=>({status:id==='b'?'fail':'pass'})}};
 const ref=r2CohortReference(context);assert.deepEqual([...ref.cohort],['a','c']);
 const info={entries:[{userId:'a',name:'A',trackId:'track',submittedAt:null,submissionStatus:'submitted'},{userId:'b',name:'B',trackId:'other',submittedAt:null,submissionStatus:'submitted'}],times:{}};
 const data=r2HomeData(info,ref);assert.equal(data.submitted,2);assert.equal(data.admittedSubmitted,1);assert.equal(data.waiting,1);assert.equal(data.outsideCohort,1);assert.deepEqual(data.days,[]);assert.deepEqual(data.groups.forum,{submitted:1,admitted:1});assert.deepEqual(data.groups.other,{submitted:0,admitted:1});
});
test('pinned submissions phase rejects another round or phase and cannot recover from an R1 report',async()=>{
 const state=await loadR2State(),config={roundId:R2_ROUND,phase:'submissions'};
 for(const patch of [{roundId:'r1'},{phase:'judging'}])await assert.rejects(collectR2Submissions({...config,...patch},state,{get:()=>assert.fail('no upstream allowed')}));
 assert.equal(compatibleR2Check(state,{status:'unchanged',dataFingerprint:state.metadata.dataFingerprint,lastCheckedAt:new Date().toISOString(),phase:'judging',roundId:R2_ROUND}),false);
});
test('workflow commits exactly the R2 publication set; clock and deploy mechanism stay in place',async()=>{
 const w=await fs.readFile('.github/workflows/update-data-scheduled.yml','utf8'),line=w.split('\n').find(l=>l.trim().startsWith('git add '));
 assert.deepEqual(line.trim().slice(8).split(' '),R2_FILES.map(f=>'data/rounds/r2-submissions.v1/'+f));assert.match(w,/ref: main/);assert.match(w,/group: ib19-publish/);assert.match(w,/actions\/deploy-pages@v4/);assert.doesNotMatch(w,/git add data\/19ib/);
 const deploy=await fs.readFile('.github/workflows/deploy.yml','utf8');assert.match(deploy,/ref: main/);assert.match(deploy,/npm run test:release/);assert(deploy.indexOf('npm run build')<deploy.indexOf('npm run test:release:browser'));assert(!/^      - run: npm test$/m.test(deploy));
});
test('inconsistent full/live pair and judging scores fail without any publication',async()=>{
 const state=await loadR2State(),config={roundId:R2_ROUND,phase:'submissions'},calls=[];
 await assert.rejects(collectR2Submissions(config,state,{get:async p=>{calls.push(p);const value=JSON.parse(p.endsWith('/full')?state.snapshot.raw.full:state.snapshot.raw.live);if(p.endsWith('/live'))value.progress.pop();return value;}}));assert.equal(calls.length,4);
 await assert.rejects(collectR2Submissions(config,state,{get:async p=>{const value=JSON.parse(p.endsWith('/full')?state.snapshot.raw.full:state.snapshot.raw.live);if(value.entries)value.entries[0].scoredCount=1;return value;}}),/judging requires/);
});

test('R2 register projects submission information without judging totals or score counts',()=>{const model=rapperR2Model({submissions:[{userId:'a',name:'A',scoredCount:0,score:0,submittedAt:null}],topic:'T'},Object.assign(new Map(),{cohort:new Set(['a'])}));assert.equal(model.members[0].admitted,true);assert.equal(model.members[0].total,null);assert.equal(model.members[0].count,null);});
