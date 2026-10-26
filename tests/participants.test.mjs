import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createOfficialR1View} from '../js/r1-official-view.js';
import {ZIPPY_R1_POLICY_V2_VERSION,ZIPPY_ID} from '../js/r1-official-policy.js';
import {buildForumLink,selectForumRows,groupStats,isTrul} from '../js/forum-link-model.js';
import {participantRow,participantsSummary,participantsMethodology} from './legacy/participants-view.js';
const root=new URL('../docs/data-candidates/r1-2026-10-22-194208/',import.meta.url),read=f=>JSON.parse(fs.readFileSync(new URL(f,root)));
const snapshot={main:read('19ib_all_judges_REPAIRED.json'),forum:read('forum_judges_export.json'),metadata:read('metadata.json'),history:read('history.json')};
const view=createOfficialR1View(snapshot,{policyVersion:ZIPPY_R1_POLICY_V2_VERSION}),D=view.data;
D.participantOutcomes=new Map([...D.byId.keys()].map(id=>[id,view.analytics.participantOutcome(id)]));
const model=buildForumLink(D),rows=model.forum,esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const options={esc,fmt:n=>String(n),updated:D.updated,safeUrl:u=>u};

test('Participants use exact current roster UUIDs, disjoint 70/28 groups and separate Zippy identities',()=>{
 const source=snapshot.forum.members.filter(p=>D.byId.has(p.userId));
 assert.deepEqual(rows.map(r=>r.id).sort(),source.map(p=>p.userId).sort());
 assert.equal(rows.length,98);assert.equal(new Set(rows.map(r=>r.id)).size,98);
 const current=selectForumRows(rows,{group:'current'}),vets=selectForumRows(rows,{group:'veterans'});
 assert.equal(current.length,70);assert.equal(vets.length,28);assert(!vets.some(v=>current.some(c=>c.id===v.id)));
 assert.deepEqual(vets.map(r=>r.id).sort(),source.filter(p=>p.group==='Ветераны'||p.veteran===true).map(p=>p.userId).sort());
 assert(!rows.some(r=>r.id===ZIPPY_ID));const kid=rows.find(r=>r.id==='0460e777-7403-40dd-8176-fd168c93a530');assert.equal(kid.total,7);assert.equal(kid.status,'fail');
});

test('Nickname, battle name and confirmed aliases are searchable; filters intersect',()=>{
 const ids=items=>items.map(r=>r.id).sort();
 const expectedSearch=(items,query)=>{const q=query.trim().toLocaleLowerCase('ru-RU');return items.filter(r=>[r.name,r.battleName,...r.aliases].filter(Boolean).some(name=>name.toLocaleLowerCase('ru-RU').includes(q)));};
 for(const r of rows)for(const q of [r.name,r.battleName,...r.aliases].filter(Boolean)){
  const query=' '+q.toUpperCase()+' ';
  assert.deepEqual(ids(selectForumRows(rows,{query})),ids(expectedSearch(rows,query)),query);
 }
 const aliasFixture={...rows[0],aliases:['Подтверждённый тестовый псевдоним']};
 const aliasRows=[aliasFixture,...rows.slice(1)];
 assert.deepEqual(ids(selectForumRows(aliasRows,{query:'ТЕСТОВЫЙ ПСЕВДОНИМ'})),[aliasFixture.id]);
 for(const group of ['all','current','veterans'])for(const status of ['all','pass','fail','pending']){
  const expected=expectedSearch(rows,'а').filter(r=>(group==='all'||r.veteran===(group==='veterans'))&&(status==='all'||r.status===status));
  const selected=selectForumRows(rows,{group,status,query:'а'});
  assert.deepEqual(ids(selected),ids(expected),`${group}/${status}: exact UUID set, no extra participants`);
 }
 assert.equal(selectForumRows(rows,{query:'NO_SUCH_PARTICIPANT_061'}).length,0);
});

test('Sort modes, Trul and baseline statuses are preserved without mutation',()=>{
 const before=structuredClone(D),rowBefore=structuredClone(rows),sourceBefore=JSON.stringify(snapshot);
 const byScore=selectForumRows(rows),alpha=selectForumRows(rows,{sort:'alpha'}),trul=selectForumRows(rows,{sort:'trul'});
 for(let i=1;i<rows.length;i++){assert(byScore[i-1].total>=byScore[i].total);assert(alpha[i-1].name.localeCompare(alpha[i].name,'ru')<=0);}
 assert(isTrul(trul[0]));assert(trul.slice(rows.filter(isTrul).length).every(r=>!isTrul(r)));
 assert(!isTrul({name:'notroolname',aliases:[]}));
 for(const r of rows){assert.equal(r.count,5);assert.equal(r.status,r.total>=15?'pass':'fail');}
 assert.equal(groupStats(rows).pending,0);
 for(const query of ['a','т','', 'Zippy'])selectForumRows(rows,{query,sort:'trul'});
 assert.deepEqual(D,before);assert.deepEqual(rows,rowBefore);assert.equal(JSON.stringify(snapshot),sourceBefore);
});

test('Presentation preserves exact values, group, links, Trul and accessible detail action',()=>{
 for(const r of rows){const html=participantRow(r,options);assert(html.includes(`data-fl-open="${r.id}"`));assert(html.includes(`>${r.veteran?'Ветераны':'Форум'}<`));assert(html.includes(`>${r.total}</td>`));assert(html.includes('5 / 5'));assert.equal(html.includes('title="Трул · ЛТБ"'),isTrul(r));}
 const html=participantRow({...rows[0],name:'<script>alert(1)</script>'},options);assert(!html.includes('<script>'));assert(html.includes('&lt;script&gt;'));
 const summary=participantsSummary(model,options);for(const n of [98,70,28])assert(summary.includes(`<strong>${n}</strong>`));
});

test('Methodology documents actual group definitions, minimum/maximum status rule without service metadata',()=>{
 const html=participantsMethodology(options);
 for(const term of ['OG, база, основа, фундамент','бывшие OG','не все участники','минимально','максимальные','15 баллов','Трул','ЛТБ','подтверждённые псевдонимы','Сброс'])assert(html.includes(term),term);
 assert(!/UUID|Снимок:|политик|22.10.2026/.test(html));
 assert(!/iframe|postMessage/.test(html));
});

test('R1 v2 control figures remain exact',()=>{
 assert.equal(view.policyVersion,'r1-official-zippy-v2');assert.equal(D.byId.size,3276);assert.equal(D.events.length,16380);assert.equal(D.annulledScores.length,1);
 assert.equal(view.analytics.outcomes().totalPassed,2218);assert.equal(view.analytics.outcomes().failed,1058);assert.equal(view.analytics.outcomes().pending,0);
 assert.equal(view.analytics.summary().index,20.884382840066547);assert.equal(view.analytics.summary({group:'veterans'}).index,32.123232268736096);
});
