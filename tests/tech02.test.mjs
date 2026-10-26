import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createOfficialR1View} from '../js/r1-official-view.js';
import {R1_SOURCES,ACTIVE_R1_SOURCE} from '../js/r1-application.js';
import {getV58Research} from '../js/v58-research-model.js';
const source=R1_SOURCES[ACTIVE_R1_SOURCE],directory=new URL(source.directory,new URL('../js/r1-application.js',import.meta.url));
const raw=Object.fromEntries(Object.entries({main:'19ib_all_judges_REPAIRED.json',forum:'forum_judges_export.json',metadata:'metadata.json',history:'history.json'}).map(([key,file])=>[key,JSON.parse(fs.readFileSync(new URL(file,directory)))]));
test('Summary cache returns independent copies and keeps group/time validation',()=>{
 const c=createOfficialR1View(raw,{policyVersion:source.policyVersion}),a=c.analytics.summary(),b=c.analytics.summary();
 assert.deepEqual(a,b);a.judges[0].tuz=999;a.provenance.runId='tampered';assert.deepEqual(c.analytics.summary(),b);
 assert.throws(()=>c.analytics.summary({group:'r2'}));assert.throws(()=>c.analytics.summary({at:Infinity}));
 assert.equal(b.index,20.884382840066547);assert.equal(c.analytics.summary({group:'veterans'}).index,32.123232268736096);
});
test('Impact preparation yields, deduplicates concurrent work and matches the synchronous model exactly',async()=>{
 const c=createOfficialR1View(raw,{policyVersion:source.policyVersion}),r=getV58Research(c);let ticks=0;
 const timer=setInterval(()=>ticks++,0);
 try{
  const [a,b]=await Promise.all([r.prepareImpacts('rappers'),r.prepareImpacts('rappers')]);
  assert.strictEqual(a,b);assert.equal(a.length,70);assert(ticks>=10,'browser event-loop has opportunities between counterfactuals');
  assert.strictEqual(r.impacts().rappers,a);
  const fresh=getV58Research(createOfficialR1View(raw,{policyVersion:source.policyVersion}));assert.deepEqual(a,fresh.impacts().rappers);
  const judges=await r.prepareImpacts('judges');assert.equal(judges.length,22);assert.deepEqual(judges,fresh.impacts().judges);
 }finally{clearInterval(timer);}
});
