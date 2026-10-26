import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {validateRoundInformation,loadRoundInformation,R2_SOURCE_HASH} from '../js/round-information.js';
import {loadData} from '../js/data.js';
const submissionsFixture=JSON.parse(fs.readFileSync('data/rounds/r2-submissions.v1/snapshot.json'));
const fixture=JSON.parse(fs.readFileSync('data/rounds/r2-information.v1.json'));
test('R2 informational resource is bound to saved source, 256 places and unknown availability',()=>{
 assert.equal(createHash('sha256').update(fs.readFileSync('docs/diagnostics/r2-data-01/round2-full.json')).digest('hex'),R2_SOURCE_HASH);
 const result=validateRoundInformation(fixture);assert(Object.isFrozen(result));assert(Object.isFrozen(result.times));assert.equal(result.sourceParameters.advanceCount,256);assert.equal(result.unavailable.roster.count,null);assert.equal(result.provenance.browserRetrievedAt,null);assert.equal(result.capabilities.analytics,false);assert(!('analytics' in result));assert.notEqual(result,fixture);
});
test('Wrong IDs/schema/provenance/capabilities/unknown counts cannot become R2 information',()=>{
 for(const change of [x=>x.roundId='wrong',x=>x.schemaVersion=2,x=>x.resourceVersion='wrong',x=>x.provenance.sha256='wrong',x=>x.provenance.browserRetrievedAt=x.provenance.importedAt,x=>x.capabilities.analytics=true,x=>x.unavailable.roster.count=0,x=>x.sourceParameters.advanceCount=128,x=>x.times.deadline=null]){const x=structuredClone(fixture);change(x);assert.throws(()=>validateRoundInformation(x));}
});
test('R2 uses the existing transport with timeout signal and no R1 files or upstream API',async t=>{
 const urls=[];t.mock.method(globalThis,'fetch',async(url,options)=>{urls.push(url);assert(options.signal instanceof AbortSignal);return {ok:true,json:async()=>submissionsFixture};});
 const result=await loadRoundInformation();assert.equal(result.roundOrder,2);assert.equal(urls.length,1);assert(urls[0].pathname.endsWith('/data/rounds/r2-submissions.v1/snapshot.json'));
});
test('Informational retry repeats only R2 resource and rejects missing validators',async t=>{
 let count=0;t.mock.method(globalThis,'fetch',async()=>({ok:true,json:async()=>{count++;if(count===1)throw Error('local bad JSON');return submissionsFixture;}}));
 assert.equal((await loadRoundInformation()).roundOrder,2);assert.equal(count,2);
 await assert.rejects(loadData({resource:new URL('file:///missing')}),/validator/);assert.equal(count,2);
});
