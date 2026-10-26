import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createOfficialR1View} from '../js/r1-official-view.js';import {R1_SOURCES,ACTIVE_R1_SOURCE} from '../js/r1-application.js';
import {getV58Research,uncertaintyIds} from '../js/v58-research-model.js';
const source=R1_SOURCES[ACTIVE_R1_SOURCE],dir=new URL(source.directory,new URL('../js/r1-application.js',import.meta.url));
const raw=Object.fromEntries(Object.entries({main:'19ib_all_judges_REPAIRED.json',forum:'forum_judges_export.json',metadata:'metadata.json',history:'history.json'}).map(([k,f])=>[k,JSON.parse(fs.readFileSync(new URL(f,dir)))]));
const make=()=>createOfficialR1View(raw,{policyVersion:source.policyVersion});
test('Revision facts preserve every uncertainty input, are isolated, and never replace full source history',()=>{
 const c=make(),facts=c.historyRevisionFacts(),fact=x=>x==null?x:{userId:x.userId,score:x.score,scoredAt:x.scoredAt};
 assert.deepEqual(facts,raw.history.revisions.map(r=>({before:fact(r.before),after:fact(r.after)})));
 const original=JSON.stringify(facts);facts[0].after.score=99;facts.length=1;
 assert.equal(JSON.stringify(c.historyRevisionFacts()),original);assert.deepEqual(c.history.source,raw.history);
 const snapshot=structuredClone(raw),a=createOfficialR1View(snapshot,{policyVersion:source.policyVersion});snapshot.history.revisions[0].after.comment='changed externally';assert.deepEqual(a.history.source,raw.history);
});
test('Live research uncertainty exactly equals full-history result without asking for a full history clone',()=>{
 const c=make(),wrapped=Object.create(c);Object.defineProperty(wrapped,'history',{get(){throw Error('Full history copy is unnecessary for uncertainty');}});
 const r=getV58Research(wrapped),expected=uncertaintyIds(r.all,raw.history,r.officialIds);
 assert.deepEqual(r.uncertain,expected);assert.equal(r.all.length,3276);assert.equal(r.events.length,16380);
 const legacy=Object.create(c);Object.defineProperty(legacy,'historyRevisionFacts',{value:undefined});assert.deepEqual(getV58Research(legacy).uncertain,expected);
});
test('Group projection retains all score fields and identity while never sharing caller mutations',()=>{
 const c=make(),data=c.data;
 for(const group of ['forum','veterans','reference']){
  const ids=new Set([...data.metadata].filter(([,p])=>group==='reference'||(group==='veterans')===(p.group==='Ветераны'||p.veteran===true)).map(([id])=>id));
  const expected=structuredClone({people:data.people.filter(p=>ids.has(p[0])),events:data.events.map(e=>({...e,forum:ids.has(e.userId)})),forumCount:ids.size,otherCount:data.people.length-ids.size});
  const selected=c.selectGroup(group);assert.deepEqual(selected,expected);selected.events[0].comment='caller edit';selected.people.length=0;assert.deepEqual(c.selectGroup(group),expected);
 }
 assert.equal(c.analytics.summary().index,20.884382840066547);assert.equal(c.analytics.summary({group:'veterans'}).index,32.123232268736096);
});

test('Owner-approved fixed R1 preserves the exact complete view, grades, comments and attribution without history',()=>{
 const full=make(),{history,...core}=raw,fixed=createOfficialR1View(core,{policyVersion:source.policyVersion,sourceContract:'r1-fixed-facts-v1'});
 assert.equal(fixed.history.source,null);assert.equal(fixed.snapshotKey,full.snapshotKey);
 assert.deepEqual(fixed.data,full.data);assert.deepEqual(fixed.analytics.outcomes(),full.analytics.outcomes());assert.deepEqual(fixed.activity(),full.activity());
 for(const group of ['forum','veterans','reference'])assert.deepEqual(fixed.analytics.summary({group}),full.analytics.summary({group}));
 const a=getV58Research(full),b=getV58Research(fixed);
 for(const key of ['all','events','uncertain','decisive','executionCounts','historySeries','distributions'])assert.deepEqual(b[key],a[key],key+' exactly preserved');
 const ids=[];for(const r of history.revisions){const x=r.before,y=r.after;if(x&&(!y||x.score!==y.score||x.scoredAt!==y.scoredAt)&&!ids.includes(x.userId))ids.push(x.userId);}
 assert.deepEqual(fixed.attributionUncertaintyIds(),ids);assert.equal(ids.length,12);const leaked=fixed.attributionUncertaintyIds();leaked.length=0;assert.equal(fixed.attributionUncertaintyIds().length,12);
});
test('Fixed contract fails closed on wrong generation, modified core, missing contract or unexpected history',()=>{
 const {history,...core}=raw,options={policyVersion:source.policyVersion,sourceContract:'r1-fixed-facts-v1'};
 assert.throws(()=>createOfficialR1View(raw,options),/fixed R1/);
 assert.throws(()=>createOfficialR1View(core,{...options,sourceContract:'invented'}),/source contract/);
 assert.throws(()=>createOfficialR1View(core,{policyVersion:source.policyVersion}),/source content mismatch: history/);
 for(const key of ['main','forum','metadata']){const bad=structuredClone(core);bad[key].unexpected='tampered';assert.throws(()=>createOfficialR1View(bad,options),new RegExp('source content mismatch: '+key));}
 const changed=structuredClone(core);changed.metadata.runId='new-run';assert.throws(()=>createOfficialR1View(changed,options),/fixed R1/);
 assert.equal(history.snapshots.length,812);assert.deepEqual(make().history.source,history);
});
