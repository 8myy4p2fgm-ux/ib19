import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {readPublicR1} from '../scripts/public-data.mjs';
import {createOfficialR1View} from '../js/r1-official-view.js';
import {loadR1ApplicationContext} from '../js/r1-application.js';
import {createRankingModel} from '../js/judge-ranking-model.js';
import {buildProfiles,pageScores,filterScores} from '../js/judge-profile-model.js';
import {buildForumLink,selectForumRows} from '../js/forum-link-model.js';
import {getV58Research} from '../js/v58-research-model.js';
import {checkPublicData} from '../scripts/check-public-data.mjs';
const {snapshot}=await readPublicR1(),policyVersion='r1-official-zippy-v2';
const context=createOfficialR1View(snapshot,{policyVersion,sourceContract:'r1-public-v1'});
test('Pinned public snapshot retains approved aggregate outcomes and group indices',()=>{
 assert.deepEqual(context.analytics.outcomes(),{participants:3276,standardPasses:2217,specialOfficialPasses:1,totalPassed:2218,failed:1058,pending:0});
 assert.equal(context.analytics.summary({group:'forum'}).index,20.884382840066547);assert.equal(context.analytics.summary({group:'veterans'}).index,32.123232268736096);
 const data=context.data;assert.equal(data.events.length,16380);assert.equal(data.metadata.size,98);assert.equal([...data.metadata.values()].filter(p=>p.group==='Ветераны'||p.veteran===true).length,28);
});
test('Public source rejects changed grades, names, membership and metadata',()=>{
 for(const change of [s=>s.main.members[0].scores[0].score=999,s=>s.main.members[0].artistName+='x',s=>s.forum.members[0].group='x',s=>s.metadata.runId='other']){const bad=structuredClone(snapshot);change(bad);assert.throws(()=>createOfficialR1View(bad,{policyVersion,sourceContract:'r1-public-v1'}));}
});
test('Public loading uses four bracketed requests and no private source',async t=>{
 const urls=[];t.mock.method(globalThis,'fetch',async url=>{urls.push(url);return {ok:true,json:async()=>JSON.parse(await fs.readFile(new URL('../public-data/r1/'+url.pathname.split('/').at(-1),import.meta.url),'utf8'))};});
 const result=await loadR1ApplicationContext();assert.equal(result.snapshotKey,context.snapshotKey);assert.equal(urls.length,4);assert(urls.every(u=>u.pathname.includes('/public-data/r1/')));
});
test('Profiles retain 25/50 paging, official search and distinct archived identities',()=>{
 const data=context.data,before=structuredClone(data),profiles=buildProfiles(data);const p=[...profiles.values()].find(p=>p.count>50);
 assert.equal(pageScores(p.rows,{pageSize:25}).rows.length,25);assert.equal(pageScores(p.rows,{pageSize:50}).rows.length,50);assert.deepEqual(data,before);
 assert.equal(filterScores([{artistName:'Official',forumName:'PrivateAlias'}],{query:'PrivateAlias'}).length,0);
 const missing=[...data.archivedById.values()].filter(p=>!p.artistName);assert.equal(missing.length,7);assert.equal(new Set(missing.map(p=>p.userId)).size,7);
});
test('Ranking and research use the same context; group membership stays UUID based',()=>{
 const data=context.data,before=structuredClone(data),ranking=createRankingModel(context,data);
 for(const group of ['forum','veterans'])assert.deepEqual(ranking.rows(group),context.analytics.rankJudges({group}));
 const rows=buildForumLink(data).forum;assert.equal(selectForumRows(rows.map(r=>({...r,aliases:['PrivateAlias']})),{query:'PrivateAlias'}).length,0);
 assert.strictEqual(getV58Research(context),getV58Research(context));assert.deepEqual(data,before);
});
