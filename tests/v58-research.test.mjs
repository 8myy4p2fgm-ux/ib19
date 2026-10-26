import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createOfficialR1View} from '../js/r1-official-view.js';import {ZIPPY_R1_POLICY_V2_VERSION,ZIPPY_ID} from '../js/r1-official-policy.js';
import {getV58Research,compatiblePairs,dissentRows,uncertaintyIds,fateSteps,pipelineRows,distributionGroup} from '../js/v58-research-model.js';import {generalAt} from '../js/general.js';
const read=f=>JSON.parse(fs.readFileSync('docs/data-candidates/r1-2026-10-22-194208/'+f)),context=createOfficialR1View({main:read('19ib_all_judges_REPAIRED.json'),forum:read('forum_judges_export.json'),metadata:read('metadata.json'),history:read('history.json')},{policyVersion:ZIPPY_R1_POLICY_V2_VERSION});
const before=JSON.stringify(context.data),model=getV58Research(context),byId=new Map(model.all.map(p=>[p.id,p]));
test('All 231 V58 pairs equal independent UUID joins; 32760 common pairs, no cancelled score or duplicate IDs',()=>{
 assert.equal(model.names.length,22);assert.equal(model.chemistry.length,231);assert.equal(model.chemistry.reduce((n,p)=>n+p.n,0),32760);
 for(const pair of model.chemistry){const direct=[];for(const p of model.all){const a=p.scores.find(s=>s.judgeName===pair.a),b=p.scores.find(s=>s.judgeName===pair.b);if(a&&b)direct.push([p.id,a.score,b.score]);}assert.deepEqual(pair.pairs.map(p=>[p.u,p.a,p.b]),direct);assert.equal(new Set(pair.pairs.map(p=>p.u)).size,pair.n);if(pair.n){const gap=direct.reduce((n,[,a,b])=>n+Math.abs(a-b),0)/direct.length;assert.equal(pair.compat,100*(1-gap/4));assert.equal(pair.exact,direct.filter(([,a,b])=>a===b).length/direct.length);}else assert.equal(pair.compat,null);}
 assert(!model.events.some(e=>e.u===ZIPPY_ID&&e.j==='Игорь Кедо'));assert.equal(model.events.length,16380);
});
test('Empty and small compatibility are unknown / explicit; MAE and centered dissent have independent denominators',()=>{
 const score=(judgeName,score)=>({judgeName,score}),rows=[{id:'x',name:'X',scores:[score('A',1),score('B',3),score('C',5)]},{id:'y',name:'Y',scores:[score('A',2),score('B',4),score('C',3)]}];
 const pair=compatiblePairs(rows,['A','B','D']);assert.equal(pair[0].compat,50);assert.equal(pair[0].exact,0);assert.equal(pair[0].eligible,false);assert.equal(pair[1].n,0);assert.equal(pair[1].compat,null);
 const a=dissentRows(rows,['A'])[0];assert.equal(a.n,2);assert.equal(a.bias,-2.25);assert.equal(a.mae,2.25);assert.equal(a.centered,.75);assert.equal(a.large,2);assert.equal(a.eligible,false);
 for(const row of model.dissent){for(const c of row.cases){const p=byId.get(c.u),others=p.scores.filter(s=>s.judgeName!==row.j);assert.equal(c.peer,others.reduce((n,s)=>n+s.score,0)/others.length);assert.equal(c.n,p.scores.length-1);}assert.equal(row.mae,row.cases.reduce((n,c)=>n+Math.abs(c.delta),0)/row.n);}
});
test('Distribution covers exact official complete UUIDs and separates 70/28; empty/constant normal models unavailable',()=>{
 for(const [key,rows]of [['all',model.all],['forum',model.all.filter(p=>p.forum&&!p.veteran)],['veterans',model.all.filter(p=>p.veteran)]]){const d=model.distributions[key];assert.equal(d.n,rows.length);assert.equal(d.bins.reduce((n,b)=>n+b.count,0),rows.length);for(const b of d.bins)assert.equal(b.count,rows.filter(p=>p.total===b.score).length);assert.equal(d.pass,rows.filter(p=>p.total>=15).length);}
 assert.equal(model.distributions.all.n,3276);assert.equal(model.distributions.forum.n,70);assert.equal(model.distributions.veterans.n,28);
 assert.equal(distributionGroup([]).mean,null);assert.equal(distributionGroup([]).curve,false);assert.equal(distributionGroup([{count:5,total:15},{count:5,total:15}]).curve,false);
 // V47 archived histogram, used solely to verify recovery of population SD/CDF.
 const archived=JSON.parse(fs.readFileSync('tests/fixtures/v47-distribution-bins.json'));for(const bins of Object.values(archived.groups)){const sample=bins.counts.flatMap((n,i)=>Array.from({length:n},()=>({count:5,total:i+5}))),d=distributionGroup(sample);
 assert(Math.abs(d.mean-bins.mean)<1e-12);assert(Math.abs(d.sd-bins.sd)<1e-12);const mass=bins.expected.reduce((sum,n)=>sum+n,0)/d.n;for(let i=0;i<21;i++)assert(Math.abs(d.bins[i].expected-bins.expected[i]/mass)<.002);}
});
test('Temporal attribution excludes score/time edits, deletion, tied/invalid times and official admission, not comment edits',()=>{
 const p={id:'p',scores:[1,2,3].map((v,i)=>({judgeName:String(i),score:v,scoredAt:new Date(1000+i*1000).toISOString()}))};
 const mk=(before,after)=>({revisions:[{before:{...p.scores[0],userId:'p',...before},after:after===null?null:{...p.scores[0],userId:'p',...after}}]});
 assert(!uncertaintyIds([p],mk({comment:'a'},{comment:'b'})).has('p'));assert(uncertaintyIds([p],mk({}, {score:5})).has('p'));assert(uncertaintyIds([p],mk({},null)).has('p'));
 assert(uncertaintyIds([{id:'t',scores:[p.scores[0],p.scores[0]]}],{}).has('t'));assert(uncertaintyIds([{id:'u',scores:[{scoredAt:'x'}]}],{}).has('u'));assert(uncertaintyIds([p],{},new Set(['p'])).has('p'));
 for(const e of model.decisive){assert(!model.uncertain.has(e.u));assert.notEqual(e.u,ZIPPY_ID);assert.equal(e.st,byId.get(e.u).status);assert.equal(model.decisive.filter(x=>x.u===e.u).length,1);}
 for(const [values,decision]of [[[5,5,5,1,1],'pass'],[[1,1,1,5,5],'fail']]){const steps=fateSteps({scores:values.map((score,i)=>({score,scoredAt:new Date(1000+i).toISOString()}))});assert.equal(steps.find(s=>s.first).n,3);assert.equal(steps.find(s=>s.first).st,decision);assert.equal(steps.length,6);}
 assert.equal(model.historySeries.at(-1).pass,2217);assert.equal(model.historySeries.at(-1).fail,1058);assert.equal(model.historySeries.at(-1).pending,0);
});
test('V58 pipeline includes equal timestamps and interday gaps; ties at series length choose shorter duration',()=>{
 const es=[0,0,10000,40000,86400000].map((t,i)=>({u:String(i),j:'A',t})),before=JSON.stringify(es),r=pipelineRows(es,['A','B'],10);assert.deepEqual(r[0].gaps,[0,10,30,86360]);assert.equal(r[0].med,20);assert.equal(r[0].short,2);assert.equal(r[0].runs[0].length,3);assert.equal(r[1].med,null);assert.equal(r[1].runs.length,0);assert.equal(JSON.stringify(es),before);assert.throws(()=>pipelineRows(es,['A'],20));
 const actual=pipelineRows(model.events,model.names,30);assert.equal(actual.reduce((n,r)=>n+r.es.length,0),16380);assert.equal(actual.reduce((n,r)=>n+r.gaps.length,0),16380-22);
});
test('Counterfactuals call production formula with fixed groups / one removed Forum member; components and clipping balance',()=>{
 const result=model.impacts(),selected=context.selectGroup('forum'),end=Date.parse(context.exportedAt);
 assert.equal(result.base.index,20.884382840066547);assert.equal(result.forumCount,70);assert.equal(result.judges.length,22);assert.equal(result.rappers.length,70);
 for(const row of result.judges){const direct=generalAt(selected.events.filter(e=>e.judge!==row.name),70,selected.otherCount,selected.events[0].t,end,{historical:false});assert.equal(row.without.index,direct.index);assert.equal(row.impact,result.base.index-direct.index);assert(Math.abs(row.impact-row.favor-row.attention-row.respect-row.clippingEffect)<1e-12);}
 for(const row of result.rappers){const direct=generalAt(selected.events.filter(e=>e.userId!==row.key),69,selected.otherCount,selected.events[0].t,end,{historical:false});assert.equal(row.without.index,direct.index);assert.equal(row.impact,result.base.index-direct.index);assert(!byId.get(row.key).veteran);}
 assert.deepEqual(model.disputed.map(p=>p.id).sort(),model.all.filter(p=>p.count===5&&Math.max(...p.scores.map(s=>s.score))-Math.min(...p.scores.map(s=>s.score))>=2).map(p=>p.id).sort());assert.equal(model.executionCounts.reduce((n,r)=>n+r.n,0),model.decisive.length);assert.equal(JSON.stringify(context.data),before);assert.equal(context.analytics.outcomes().totalPassed,2218);assert.equal(context.analytics.summary({group:'veterans'}).index,32.123232268736096);
});
