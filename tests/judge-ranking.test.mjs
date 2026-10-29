import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRoundContext} from '../js/round-context.js';
import {createRankingModel,rankingColumns,sortRanking,podiumRows,formatRankingNumber} from '../js/judge-ranking-model.js';
import {pageScores,filterScores,sortScores} from '../js/judge-profile-model.js';
const read=name=>JSON.parse(fs.readFileSync(new URL('../data/'+name,import.meta.url)));
const context=createRoundContext({main:read('19ib_all_judges_REPAIRED.json'),forum:read('forum_judges_export.json'),metadata:read('metadata.json')});

test('Ranking uses every unrounded component for both groups without mutating the context',()=>{
 const before=structuredClone(context.data),model=createRankingModel(context);
 for(const group of ['forum','veterans']){
  const rows=model.rows(group);assert.deepEqual(rows,context.analytics.rankJudges({group}));
  assert.equal(rows.length,22);
  const leaders=podiumRows(rows),rust=podiumRows(rows,'rust');
  assert.deepEqual(leaders,rows.filter(r=>Number.isFinite(r.tuz)).slice(0,3));
  assert.deepEqual(rust,sortRanking(rows.filter(r=>Number.isFinite(r.tuz)),'tuz',1).slice(0,3));
  for(const column of rankingColumns)for(const direction of [1,-1]){
   const sorted=sortRanking(rows,column.key,direction);
   assert.equal(sorted.length,rows.length);
   for(let i=1;i<sorted.length;i++){
    const a=sorted[i-1][column.key],b=sorted[i][column.key];
    if(Number.isFinite(a)&&Number.isFinite(b))assert.ok((a-b)*direction<=0);
    if(!Number.isFinite(a))assert.ok(!Number.isFinite(b));
   }
   assert.deepEqual(podiumRows(rows),leaders,'component sorting never changes the podium');
  }
  assert.deepEqual(model.rows(group),rows);
 }
 assert.deepEqual(context.data,before);
 assert.equal(model.groupSize('forum'),70);assert.equal(model.groupSize('veterans'),28);
 assert.equal(model.exportedAt,context.exportedAt);
});

test('Ranking sorts original small values, handles nulls and stable alphabetical ties',()=>{
 const rows=[{judge:'Б',tuz:.0002},{judge:'А',tuz:.0001},{judge:'Г',tuz:null},{judge:'В',tuz:.0002}];
 assert.deepEqual(sortRanking(rows,'tuz',1).map(r=>r.judge),['А','Б','В','Г']);
 assert.deepEqual(sortRanking(rows,'tuz',-1).map(r=>r.judge),['Б','В','А','Г']);
 assert.equal(formatRankingNumber(.0001),'+<0,005');assert.equal(formatRankingNumber(-.0001),'−<0,005');
 assert.equal(formatRankingNumber(0),'0,00');assert.equal(formatRankingNumber(null),'—');
 assert.throws(()=>sortRanking(rows,'unknown'),/Invalid/);
 assert.equal(rows[0].judge,'Б');
});

test('Profiles use exact identities, current and archived scores, without quarantine or history',()=>{
 const before=structuredClone(context.data),model=createRankingModel(context);
 for(const judge of context.data.judges){
  const p=model.profile(judge.userId),raw=[...context.data.byId.values(),...context.data.archivedById.values()].flatMap(person=>person.scores.filter(s=>context.data.judgeIdentities.get(s.judgeName)===judge.userId));
  assert.equal(p.count,raw.length);assert.deepEqual(p.distribution,[1,2,3,4,5].map(n=>raw.filter(s=>s.score===n).length));
  assert.equal(p.distribution.reduce((a,b)=>a+b,0),p.count);
  assert.ok(p.rows.every(s=>!context.data.excluded.some(e=>e.userId===s.userId)));
  for(const grade of ['all','1','2','3','4','5'])for(const order of ['newest','oldest']){
   const expected=sortScores(filterScores(p.rows,{grade}),order),found=[];
   const first=pageScores(p.rows,{grade,order});
   for(let page=1;page<=first.pages;page++)found.push(...pageScores(p.rows,{grade,order,page}).rows);
   assert.deepEqual(found,expected);
  }
 }
 assert.equal(model.profile('missing'),null);assert.equal(model.profileKey('similar but unknown'),null);
 assert.throws(()=>createRankingModel({...context,roundId:'round2'}),/Unsupported/);
 assert.throws(()=>createRankingModel({...context,runId:'other-version'}),/Unsupported/);
 assert.equal(context.history.supported,false);assert.deepEqual(context.data,before);
});

test('Shared score paging supports 25/50, combined filters, empty results and duplicate names by ID',()=>{
 const rows=Array.from({length:65},(_,i)=>({userId:String(i),artistName:'Одинаковое имя',forumName:i%2?'Форум':'',score:i%5+1,scoredAt:new Date(1792500000000+i*1000).toISOString(),comment:i?'':'длинный комментарий'}));
 const before=structuredClone(rows);
 assert.equal(pageScores(rows).rows.length,25);assert.equal(pageScores(rows,{pageSize:50}).rows.length,50);
 assert.equal(pageScores(rows,{page:100}).page,3);assert.equal(pageScores(rows,{page:-2}).page,1);
 assert.equal(pageScores(rows,{query:'невозможный поиск'}).total,0);
 const expected=rows.filter(r=>r.score===1).sort((a,b)=>Date.parse(a.scoredAt)-Date.parse(b.scoredAt));
 assert.deepEqual(pageScores(rows,{query:'Одинаковое имя',grade:'1',order:'oldest'}).rows,expected);
 assert.equal(pageScores(rows,{query:'64'}).total,0);assert.equal(pageScores(rows,{query:'форум'}).total,0);assert.equal(pageScores(rows,{page:1}).rows[0].userId,'64');
 assert.equal(pageScores(rows,{query:'Одинаковое имя'}).total,65);assert.deepEqual(rows,before);
});

test('B02 archived Guker fixture: 620 scores, five ones, page 1/25 to 2/25',()=>{
 const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/v58-guker-scores.json',import.meta.url)));
 const rows=fixture.scores.map(([userId,score,scoredAt])=>({userId,score,scoredAt}));
 const first=pageScores(rows),next=pageScores(rows,{page:2}),ones=pageScores(rows,{grade:'1'});
 assert.equal(first.total,620);assert.equal(first.pages,25);assert.equal(first.page,1);assert.equal(next.page,2);
 assert.equal(ones.total,5);assert.equal(ones.pages,1);assert.notDeepEqual(first.rows,next.rows);
});

// Official contexts defensively clone data on each access. Identity lookup must
// reuse the ranking's captured snapshot rather than clone it once per table row.
test('Ranking captures data once and reuses identities across repeated filters',()=>{
 let reads=0;
 const wrapped=new Proxy(context,{get(target,key){if(key==='data')reads++;return Reflect.get(target,key);}});
 const model=createRankingModel(wrapped),identities=context.data.judgeIdentities;
 for(let i=0;i<20;i++)for(const group of ['forum','veterans'])for(const row of model.rows(group))assert.equal(model.profileKey(row.judge),identities.get(row.judge)??null);
 assert.equal(reads,1,'one snapshot read, independent of rendered rows/filter count');
});
