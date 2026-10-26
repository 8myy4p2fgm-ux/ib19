import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {compareRankingJudges,signedComparisonBars,comparisonMetrics} from '../js/judge-comparison.js';import {createRankingModel} from '../js/judge-ranking-model.js';import {createOfficialR1View} from '../js/r1-official-view.js';import {ZIPPY_R1_POLICY_V2_VERSION} from '../js/r1-official-policy.js';
const read=f=>JSON.parse(fs.readFileSync('docs/data-candidates/r1-2026-10-22-194208/'+f));const context=createOfficialR1View({main:read('19ib_all_judges_REPAIRED.json'),forum:read('forum_judges_export.json'),metadata:read('metadata.json'),history:read('history.json')},{policyVersion:ZIPPY_R1_POLICY_V2_VERSION});const model=createRankingModel(context);
test('All judge pairs in both groups are exact projections of existing ranking rows keyed by confirmed identity',()=>{
 for(const group of ['forum','veterans']){const rows=model.rows(group),before=JSON.stringify(rows);assert.equal(rows.length,22);const ids=rows.map(r=>model.profileKey(r.judge));const byName=new Map(rows.map((row,i)=>[row.judge,ids[i]]));assert.equal(new Set(ids).size,22);assert(ids.every(Boolean));
 for(const a of rows)for(const b of rows){const c=compareRankingJudges(model,group,byName.get(a.judge),byName.get(b.judge));assert.deepEqual(c.a,a);assert.deepEqual(c.b,b);assert.equal(c.same,a.judge===b.judge);assert.equal(c.difference,Number.isFinite(a.tuz)&&Number.isFinite(b.tuz)?a.tuz-b.tuz:null);for(const metric of c.metrics){assert.equal(metric.a,a[metric.key]);assert.equal(metric.b,b[metric.key]);}assert.equal(c.metrics.length,comparisonMetrics.length);}
 assert.equal(JSON.stringify(model.rows(group)),before);}
 assert.throws(()=>compareRankingJudges(model,'forum','unknown','unknown'),/identity/);assert.throws(()=>model.rows('round2'));
});
test('Signed bars preserve negative direction, nulls and zero; no magnitude-only comparison',()=>{
 assert.deepEqual(signedComparisonBars(-10,5),[{left:0,width:50,value:-10},{left:50,width:25,value:5}]);assert.deepEqual(signedComparisonBars(0,null),[{left:50,width:0,value:0},null]);assert.deepEqual(signedComparisonBars(NaN,undefined),[null,null]);
 const unknownModel={rows:()=>[{judge:'A',tuz:null},{judge:'B',tuz:3}],profileKey:n=>n};assert.equal(compareRankingJudges(unknownModel,'forum','A','B').difference,null);
});
