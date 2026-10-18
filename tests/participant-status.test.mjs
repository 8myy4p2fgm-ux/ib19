import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {participantStatus} from '../js/general.js';
import {normalizeData} from '../js/data.js';
import {buildForumLink,groupStats,selectForumRows} from '../js/forum-link-model.js';
import {scoreEconomy} from '../js/score-economy.js';
const scores=(total,count)=>{const values=Array(count).fill(1);for(let i=0,left=total-count;i<count;i++){const add=Math.min(4,left);values[i]+=add;left-=add;}return values.map((score,i)=>({score,judgeName:'J'+i,scoredAt:new Date(Date.UTC(2026,9,1+i)).toISOString()}));};
for(const [total,count,status] of [[13,3,'pass'],[14,3,'pass'],[14,4,'pass'],[12,3,'pending'],[10,4,'pending'],[5,5,'fail'],[15,5,'pass'],[10,3,'pending'],[4,3,'fail']])test(`${total} points / ${count} scores: ${status}`,()=>{
 const objects=scores(total,count),tuples=objects.map(s=>[s.judgeName,s.score,s.scoredAt]);
 for(const input of [objects,tuples]){const actual=participantStatus(input);assert.equal(actual.status,status);assert.equal(actual.remaining,5-count);assert.equal(actual.minFinal,total+5-count);assert.equal(actual.maxFinal,total+(5-count)*5);assert.equal(actual.max,actual.maxFinal);}
});
test('all valid score prefixes agree with all possible completions, including exact threshold',()=>{
 const visit=prefix=>{
  const outcomes=[];
  const finish=values=>{if(values.length===5){outcomes.push(values.reduce((a,b)=>a+b,0)>=15);return;}for(let n=1;n<=5;n++)finish([...values,n]);};
  finish(prefix);
  const expected=outcomes.every(Boolean)?'pass':outcomes.every(x=>!x)?'fail':'pending';
  assert.equal(participantStatus(prefix.map(score=>({score}))).status,expected,JSON.stringify(prefix));
  if(prefix.length<5)for(let n=1;n<=5;n++)visit([...prefix,n]);
 };
 visit([]);
});
test('current data: overview tuple statuses, rapper rows, filters and grouped totals agree',()=>{
 const D=normalizeData(JSON.parse(fs.readFileSync('data/19ib_all_judges_REPAIRED.json')),JSON.parse(fs.readFileSync('data/forum_judges_export.json'))),model=buildForumLink(D);
 for(const rows of [model.forum,model.other,model.veterans,model.forum.filter(r=>!r.veteran),[...model.forum,...model.other]]){
  const stats=groupStats(rows);assert.equal(stats.passed+stats.failed+stats.pending,rows.length);
  for(const status of ['pass','fail','pending'])if(rows.every(r=>r.forum))assert.deepEqual(selectForumRows(rows,{status}).map(r=>r.id).sort(),rows.filter(r=>r.status===status).map(r=>r.id).sort());
 }
 const rows=new Map([...model.forum,...model.other].map(r=>[r.id,r]));
 assert.equal(rows.size,D.people.length);
 for(const p of D.people)assert.equal(participantStatus(p[3]).status,rows.get(p[0]).status);
});
test('score economy recognises scores following guaranteed passage with remaining ones',()=>{
 const partial=scores(13,3);assert.equal(scoreEconomy([{scores:partial}]).future,2);
 const completed=[...partial,{score:1,scoredAt:'2026-10-04T00:00:00Z'},{score:1,scoredAt:'2026-10-05T00:00:00Z'}];
 const economy=scoreEconomy([{scores:completed}]);assert.equal(economy.pastPass,2);assert.equal(economy.pastFail,0);assert.equal(economy.future,0);
});
