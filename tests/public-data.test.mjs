import {splitPublicR1} from '../scripts/public-data.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {readPrivateR1,projectR1,projectGroups} from '../scripts/public-data.mjs';
import {createOfficialR1View} from '../js/r1-official-view.js';import {loadR1ApplicationContext} from '../js/r1-application.js';
import {buildForumLink,selectForumRows} from '../js/forum-link-model.js';import {buildProfiles,filterScores} from '../js/judge-profile-model.js';import {artistIdentity}from '../js/artist-identity.js';import {getV58Research}from '../js/v58-research-model.js';import {checkPublicData}from '../scripts/check-public-data.mjs';
const raw=await readPrivateR1(),projected=projectR1(raw),policyVersion='r1-official-zippy-v2';
const original=createOfficialR1View(raw,{policyVersion,sourceContract:'r1-fixed-facts-v1'}),view=createOfficialR1View(projected,{policyVersion,sourceContract:'r1-public-v1'});
test('Projection preserves original UUIDs, groups, exact grades/comments and computations without modifying source',()=>{
 assert.deepEqual(projectR1(raw),projected);
 const a=original.data,b=view.data;assert.deepEqual([...a.byId.keys()],[...b.byId.keys()]);assert.deepEqual([...a.archivedById.keys()],[...b.archivedById.keys()]);
 for(const field of ['byId','archivedById'])for(const [id,p]of a[field]){assert.deepEqual(b[field].get(id).scores,p.scores,id);assert.equal(b[field].get(id).artistName,p.artistName);}
 assert.deepEqual([...a.metadata].map(([id,p])=>[id,p.group,p.veteran]),[...b.metadata].map(([id,p])=>[id,p.group,p.veteran]));
 assert.deepEqual(view.analytics.outcomes(),original.analytics.outcomes());assert.deepEqual(view.activity(),original.activity());
 for(const group of ['forum','veterans','reference'])assert.deepEqual(view.analytics.summary({group}),original.analytics.summary({group}));
 const x=getV58Research(original),y=getV58Research(view);for(const key of ['uncertain','decisive','executionCounts','historySeries','distributions'])assert.deepEqual(y[key],x[key],key);
 const publicText=JSON.stringify(projected);assert(!/"(?:forum_name|aliases|forum_profile_url|battle_name)"\s*:/.test(publicText));
 assert.equal(raw.forum.members.filter(p=>p.forum_name).length,99);
});
test('Public search cannot resolve private nicknames, even when supplied by an internal caller',()=>{
 const D=original.data,rows=buildForumLink(D).forum;
 for(const row of rows)assert.equal(row.name,D.artists.get(row.id).artistName);
 const injected=rows.map(r=>({...r,aliases:['PrivateUniqueAlias'],forumName:'PrivateUniqueAlias'}));assert.deepEqual(selectForumRows(injected,{query:'PrivateUniqueAlias'}),[]);
 const nick='K_Slim';assert.deepEqual(selectForumRows(rows,{query:nick}),[]);assert.equal(selectForumRows(rows,{query:'Кот Форумчанина'}).length,1);
 const scores=[...buildProfiles(D).values()].flatMap(p=>p.rows);assert.deepEqual(filterScores(scores,{query:nick}),[]);assert(scores.every(s=>!Object.hasOwn(s,'forumName')));
});
test('Seven distinct archived missing identities remain separate and retain every score',()=>{
 const D=view.data,unknown=[...D.archivedById.values()].filter(p=>!p.artistName);assert.equal(unknown.length,7);assert.equal(new Set(unknown.map(p=>p.userId)).size,7);
 const profiles=[...buildProfiles(D).values()].flatMap(p=>p.rows);
 for(const p of unknown){assert.equal(artistIdentity(D,p.userId).displayName,'Имя недоступно');assert.equal(profiles.filter(s=>s.userId===p.userId).length,p.scores.length);assert(artistIdentity(D,p.userId).profileUrl.endsWith(p.userId));}
});
test('Public contract rejects changes to UUID, membership, official name, comment and metadata',()=>{
 for(const mutate of [d=>d.main.members[0].userId='other',d=>d.forum.members[0].group='Ветераны',d=>d.main.members[0].artistName='Alias',d=>d.main.members[0].scores[0].comment+='x',d=>d.metadata.runId='other',d=>d.forum.members[0].forum_name='Leak']){const d=structuredClone(projected);mutate(d);assert.throws(()=>createOfficialR1View(d,{policyVersion,sourceContract:'r1-public-v1'}));}
 assert.deepEqual(projectGroups(raw.forum).members.map(p=>p.userId),raw.forum.members.map(p=>p.userId));
});
test('Default browser loader requests pinned core and defers exact comments',async t=>{
 const requests=[],split=splitPublicR1(projected);t.mock.method(globalThis,'fetch',async url=>{requests.push(url.pathname);return {ok:true,json:async()=>structuredClone(url.pathname.endsWith('core.json')?split.core:split.comments)};});
 const result=await loadR1ApplicationContext();assert.equal(result.sourceContract,'r1-public-core-v1');assert.equal(requests.length,1);assert(requests[0].endsWith('/public-data/r1/core.json'));assert.equal(result.comments.ready,false);
 await result.comments.load();assert.equal(requests.length,2);assert(requests[1].endsWith('/public-data/r1/comments.json'));assert.deepEqual(result.data.events,view.data.events);
});
test('Whole build scanner rejects unreferenced files and forbidden nested fields',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'tuz-public-boundary-'));
 try{await fs.writeFile(path.join(dir,'index.html'),'<html></html>');for(const file of ['horo/content.json','public-data/r1/core.json','public-data/r1/comments.json','public-data/r1/metadata.json','public-data/r1/19ib_all_judges_REPAIRED.json','public-data/r1/forum_judges_export.json','public-data/groups.json','data/rounds/r2-submissions.v1/snapshot.json']){await fs.mkdir(path.dirname(path.join(dir,file)),{recursive:true});await fs.writeFile(path.join(dir,file),'{}');}await checkPublicData(dir);await fs.mkdir(path.join(dir,'js'));await fs.writeFile(path.join(dir,'js/unused.js'),'const hidden = 1;');await assert.rejects(checkPublicData(dir),/Unreferenced JavaScript/);await fs.rm(path.join(dir,'js/unused.js'));await fs.writeFile(path.join(dir,'unused.csv'),'private mapping');await assert.rejects(checkPublicData(dir),/Unexpected public file/);await fs.rm(path.join(dir,'unused.csv'));const file=path.join(dir,'public-data/groups.json');await fs.writeFile(file,JSON.stringify({members:[{userId:'x',forum_name:'Hidden'}]}));await assert.rejects(checkPublicData(dir),/forum_name/);}finally{await fs.rm(dir,{recursive:true,force:true});}
});
