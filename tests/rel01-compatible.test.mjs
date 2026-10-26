import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {readPublicR1} from '../scripts/public-data.mjs';
import {createOfficialR1View} from '../js/r1-official-view.js';
import {r2CohortReference,r2HomeData} from '../js/r2-home-model.js';
import {primeR2GroupReference,loadR2GroupReference} from '../js/r2-group-reference.js';
import {validateR2Submissions} from '../js/r2-submissions.js';
const {snapshot}=await readPublicR1();const context=createOfficialR1View(snapshot,{policyVersion:'r1-official-zippy-v2',sourceContract:'r1-public-v1'});
const source=JSON.parse(await fs.readFile('data/rounds/r2-submissions.v1/snapshot.json','utf8')),info=validateR2Submissions(source);
test('R2 admission reuses exactly the existing R1 pass UUIDs with no data mutations',()=>{
 const data=context.data,before=structuredClone(data),reference=r2CohortReference(context,data);
 const expected=[...data.byId.keys()].filter(id=>context.analytics.participantOutcome(id).status==='pass');assert.deepEqual([...reference.cohort],expected);assert.deepEqual(data,before);
 const home=r2HomeData(info,reference),submitted=info.submissions.filter(e=>reference.cohort.has(e.userId));assert.equal(home.admittedSubmitted,submitted.length);assert.equal(home.waiting,expected.length-submitted.length);
 for(const [group,g]of Object.entries(home.groups)){assert.equal(g.admitted,expected.filter(id=>reference.get(id)===group).length);assert.equal(g.submitted,submitted.filter(e=>reference.get(e.userId)===group).length);}
});
test('Already loaded public R1 primes the existing cohort promise without extra requests',async t=>{
 t.mock.method(globalThis,'fetch',()=>assert.fail('unnecessary JSON reload'));
 primeR2GroupReference(context,context.data);const a=await loadR2GroupReference(),b=await loadR2GroupReference();assert.strictEqual(a,b);assert(a.cohort.size>0);
});
test('R2 source bytes and unknown timestamps retain production submission semantics',()=>{
 const before=structuredClone(source),a=validateR2Submissions(source);assert.deepEqual(source,before);
 assert.equal(a.confirmedSubmissionCount,JSON.parse(source.raw.full).entries.filter(e=>e.trackId).length);
 assert.equal(a.roundOrder,2);assert.equal(a.capabilities.analytics,false);assert.equal(a.capabilities.judges,false);
 const unknown={...a,entries:[{...a.entries[0],submittedAt:null}]};assert.equal(r2HomeData(unknown).submitted,1);assert.deepEqual(r2HomeData(unknown).days,[]);
});
