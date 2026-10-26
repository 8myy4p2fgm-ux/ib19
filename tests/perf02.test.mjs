import test from 'node:test';import assert from 'node:assert/strict';
import {createRankingModel} from '../js/judge-ranking-model.js';
import {sortScores,filterScores} from '../js/judge-profile-model.js';
import {FIRST_ROUND_ID} from '../js/round-context.js';
test('Timestamp precomputation preserves exact sort and tie behavior without changing rows',()=>{const rows=[{userId:'b',scoredAt:'2026-10-22T10:00:00Z'},{userId:'a',scoredAt:'2026-10-22T10:00:00Z'},{userId:'c',scoredAt:'2026-10-20T00:00:00Z'},{userId:'d',scoredAt:'invalid'}],before=structuredClone(rows);for(const order of ['newest','oldest']){const d=order==='oldest'?1:-1,reference=[...rows].sort((a,b)=>(Date.parse(a.scoredAt)-Date.parse(b.scoredAt))*d||a.userId.localeCompare(b.userId));assert.deepEqual(sortScores(rows,order),reference);}assert.deepEqual(rows,before);});

test('Supplied ranking data avoids another context clone and stays unchanged',()=>{
 const data={updated:'x',snapshotMetadata:{runId:'x'},metadata:new Map(),judgeIdentities:new Map([['Judge','j']]),judges:[{userId:'j',name:'Judge'}],byId:new Map([['p',{userId:'p',scores:[{judgeName:'Judge',score:4,scoredAt:'2026-10-22T10:00:00Z'}]}]]),archivedById:new Map(),artists:new Map([['p',{artistName:'Official'}]])};
 const before=structuredClone(data),context={roundId:FIRST_ROUND_ID,runId:'x',exportedAt:'x',get data(){throw Error('extra clone');},analytics:{rankJudges:()=>[],participantOutcome:()=>({officialOutcome:true,label:'Pass',scoreTotal:15,scoreMaximum:25})}};
 const model=createRankingModel(context,data);assert.deepEqual(data,before);const profile=model.profile('j');assert.equal(profile.rows[0].officialException.label,'Pass');assert.strictEqual(model.profile('j'),profile);assert.deepEqual(data,before);
 assert.equal(filterScores([{artistName:'Official',forumName:'Private'}],{query:'Private'}).length,0);
 assert.equal(filterScores([{artistName:'Official'}],{query:'official'}).length,1);
});
test('Sorting parses each timestamp once per operation',t=>{
 const parse=Date.parse;let calls=0;t.mock.method(Date,'parse',s=>{calls++;return parse(s);});
 const rows=Array.from({length:100},(_,i)=>({userId:String(i),scoredAt:new Date(100000*(i%13)).toISOString()}));sortScores(rows);assert.equal(calls,rows.length);
});