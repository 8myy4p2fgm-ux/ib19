import {getV58Research} from '../js/v58-research-model.js';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {ACTIVE_R1_SOURCE,R1_SOURCES} from '../js/r1-application.js';
import {createOfficialR1View} from '../js/r1-official-view.js';
import {rapperR1Model,rapperR2Model} from '../js/rapper-report-model.js';
import {validateR2Submissions} from '../js/r2-submissions.js';
import {r2GroupReference} from '../js/r2-home-model.js';
import {generalAt} from '../js/general.js';
const source=R1_SOURCES[ACTIVE_R1_SOURCE],directory=new URL(source.directory,new URL('../js/r1-application.js',import.meta.url)),read=url=>JSON.parse(fs.readFileSync(url)),raw={};
for(const [key,file]of Object.entries({main:'19ib_all_judges_REPAIRED.json',forum:'forum_judges_export.json',metadata:'metadata.json',history:'history.json'}))raw[key]=read(new URL(file,directory));
const context=createOfficialR1View(raw,{policyVersion:source.policyVersion});
test('Live R1 projection preserves official UUIDs, valid grades, comments and counterfactual index',()=>{
 const before=JSON.stringify(raw),model=rapperR1Model(context);
 assert.equal(model.members.length,98);assert.equal(model.members.filter(p=>p.group==='forum').length,70);assert.equal(model.members.filter(p=>p.group==='veterans').length,28);
 for(const p of model.members){const official=context.data.byId.get(p.id);assert(official);assert.deepEqual(p.scores.map(s=>[s.judgeName,s.score,s.comment]),official.scores.map(s=>[s.judgeName,s.score,s.comment||'']));assert.equal(p.total,p.scores.reduce((n,s)=>n+s.score,0));}
 const selected=context.selectGroup('forum'),start=selected.events[0].t,end=Date.parse(context.exportedAt);
 const impacts=getV58Research(context).impacts();assert.equal(Object.hasOwn(model,'impacts'),false);assert.equal(Object.hasOwn(model,'base'),false);assert.equal(impacts.rappers.length,70);
 for(const p of impacts.rappers){const without=generalAt(selected.events.filter(e=>e.userId!==p.key),selected.forumCount-1,selected.otherCount,start,end,{historical:false});assert.deepEqual(p.without,without);assert.equal(impacts.base.index-without.index,p.impact);}
 assert.equal(JSON.stringify(raw),before);
});
test('R2 shows confirmed submissions without R1 results or guessed group membership',()=>{
 const info=validateR2Submissions(read('data/rounds/r2-submissions.v1/snapshot.json')),ref=r2GroupReference(read('data/forum_judges_export.json')),model=rapperR2Model(info,ref);
 assert.equal(model.members.length,info.confirmedSubmissionCount);assert.equal(model.base,null);assert.deepEqual(model.impacts,[]);assert.deepEqual(model.judges,[]);
 for(const p of model.members){assert.equal(p.group,ref.get(p.id)||'unknown');assert.equal(p.status,null);assert.equal(p.total,null);assert.equal(p.count,null);assert.deepEqual(p.scores,[]);}
 assert.ok(rapperR2Model(info).members.every(p=>p.group==='unknown'));
});
