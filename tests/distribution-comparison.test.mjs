import test from 'node:test';import assert from 'node:assert/strict';
import {distributionGroup,distributionComparison,getV58Research} from '../js/v58-research-model.js';
import {createOfficialR1View} from '../js/r1-official-view.js';
import {ZIPPY_R1_POLICY_V2_VERSION} from '../js/r1-official-policy.js';
import fs from 'node:fs';
const sample=values=>values.map(total=>({count:5,total}));
const close=(a,b,tolerance=1e-9)=>assert(Math.abs(a-b)<tolerance,`${a} ≠ ${b}`);
test('Truncated interval probabilities sum to N; boundary bins and pass use the same normalization',()=>{
 // For a symmetric N(15,10²) sample, all admissible bins have positive mass.
 const d=distributionGroup(sample([5,25]));close(d.mean,15);close(d.sd,10);
 close(d.bins.reduce((n,b)=>n+b.expected,0),2);
 for(let i=0;i<21;i++)close(d.bins[i].expected,d.bins[20-i].expected);
 const c=distributionComparison(d);assert.equal(c.actual,1);close(c.expected,d.bins.slice(10).reduce((n,b)=>n+b.expected,0));close(c.difference,c.actual-c.expected);
 assert(d.bins.every(b=>b.expected>0));assert(c.difference<0);
});
test('Threshold 15 is inclusive; incomplete rows affect neither parameters nor denominator',()=>{
 const rows=[...sample([5,14,15,25]),{count:4,total:20}],copy=JSON.stringify(rows),d=distributionGroup(rows);
 assert.equal(d.n,4);assert.equal(d.total,5);assert.equal(d.pass,2);assert.equal(d.fail,2);assert.equal(d.passShare,.5);close(d.mean,14.75);close(d.bins.reduce((s,b)=>s+b.expected,0),4);assert.equal(JSON.stringify(rows),copy);
});
test('Empty, single and constant samples expose unavailable model without fictional expected zeros',()=>{
 for(const rows of [[],sample([15]),sample([15,15])]){const d=distributionGroup(rows),c=distributionComparison(d);assert.equal(d.curve,false);assert(d.bins.every(b=>b.expected===null));assert.equal(c.expected,null);assert.equal(c.difference,null);}
 assert.equal(distributionComparison(distributionGroup([])).actual,null);
});
const read=f=>JSON.parse(fs.readFileSync('docs/data-candidates/r1-2026-10-22-194208/'+f));
const context=createOfficialR1View({main:read('19ib_all_judges_REPAIRED.json'),forum:read('forum_judges_export.json'),metadata:read('metadata.json'),history:read('history.json')},{policyVersion:ZIPPY_R1_POLICY_V2_VERSION});
test('Current approved sample: all three groups, factual counts preserved and comparison unrounded',()=>{
 const model=getV58Research(context);
 for(const [key,n,pass]of [['all',3276,2218],['forum',70,58],['veterans',28,28]]){
  const d=model.distributions[key],c=distributionComparison(d);assert.equal(d.n,n);assert.equal(d.pass,pass);close(d.bins.reduce((s,b)=>s+b.expected,0),n);close(c.actual-c.expected,c.difference);assert.notEqual(c.expected,Math.round(c.expected*10)/10);assert(c.difference>0);
  close(d.bins.reduce((s,b)=>s+b.expected/n,0),1);assert.equal(d.bins.find(b=>b.score===15).count,model.all.filter(p=>p.count===5&&p.total===15&&(key==='all'||key==='forum'&&p.forum&&!p.veteran||key==='veterans'&&p.veteran)).length);
 }
 close(distributionComparison(model.distributions.all).expected,2084.930541088632,1e-8);
});
