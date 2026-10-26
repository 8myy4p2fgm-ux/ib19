import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {hourBins} from '../js/dynamics-hours.js';import {createOfficialR1View} from '../js/r1-official-view.js';import {ZIPPY_R1_POLICY_V2_VERSION} from '../js/r1-official-policy.js';
test('Moscow hourly counts use half-open boundaries, preserve events and support empty judge selections',()=>{
 const events=[{t:Date.parse('2026-10-21T20:59:59.999Z'),judge:'A'},{t:Date.parse('2026-10-21T21:00:00Z'),judge:'A'},{t:Date.parse('2026-10-22T02:59:59.999Z'),judge:'B'},{t:NaN,judge:'B'}],before=structuredClone(events);
 const bins=hourBins(events);assert.equal(bins.length,24);assert.equal(bins[23],1);assert.equal(bins[0],1);assert.equal(bins[5],1);assert.equal(bins.reduce((a,b)=>a+b),3);assert.equal(hourBins(events,'A').reduce((a,b)=>a+b),2);assert.deepEqual(hourBins(events,'absent'),Array(24).fill(0));assert.deepEqual(events,before);
});
test('Official R1 hourly totals include exactly valid events and preserve all source objects',()=>{
 const read=f=>JSON.parse(fs.readFileSync('docs/data-candidates/r1-2026-10-22-194208/'+f));
 const source={main:read('19ib_all_judges_REPAIRED.json'),forum:read('forum_judges_export.json'),metadata:read('metadata.json'),history:read('history.json')};
 const before=JSON.stringify(source),view=createOfficialR1View(source,{policyVersion:ZIPPY_R1_POLICY_V2_VERSION}),activity=view.activity();
 const bins=hourBins(activity.factual.events),judges=[...new Set(activity.factual.events.map(e=>e.judge))];assert.equal(bins.reduce((a,b)=>a+b),16380);assert.equal(judges.length,22);const combined=Array(24).fill(0);for(const judge of judges)hourBins(activity.factual.events,judge).forEach((n,i)=>combined[i]+=n);assert.deepEqual(combined,bins);assert.equal(activity.sourceObserved.count,16381);assert.equal(activity.annulled.count,1);assert.equal(JSON.stringify(source),before);
});
