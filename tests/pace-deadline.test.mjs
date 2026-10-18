import test from 'node:test';
import assert from 'node:assert/strict';
import {paceModel,pacePlotRange} from '../js/pace-model.js';
import {DAY} from '../js/config.js';
const deadline='2026-10-18T23:59:00+03:00',limit=Date.parse(deadline);
const events=Array.from({length:16},(_,i)=>({userId:String(i),judge:'A',t:limit-16*DAY+i*DAY}));
const model=(overrides={})=>paceModel({events,participants:100,scoresPerParticipant:5,asOf:limit,deadline,...overrides});
for(const offset of [-3*3600000,-30000,-1,0,DAY,7*DAY])test('deadline boundary '+offset,()=>{
 const m=model({now:limit+offset});
 assert.equal(m.needRate,offset<0?m.remaining/(-offset/DAY):null);
 assert.ok(Number.isFinite(m.projected));
 assert.equal(m.rate,1);
 assert.equal(m.projected,limit+m.remaining*DAY);
});
test('full completion has no forecast or post-deadline required rate',()=>{const m=model({participants:16,scoresPerParticipant:1});assert.equal(m.remaining,0);assert.equal(m.needRate,null);assert.equal(m.projected,null);assert.ok(Number.isFinite(m.completion));});
test('no recent scores, missing timestamps or short history produce no forecast',()=>{
 for(const changes of [{events:events.slice(0,2)},{events:[...events,{userId:'missing',judge:'A'}]},{events:events.slice(-2)},{historyComplete:false},{events:[]},{asOf:NaN},{participants:undefined}])assert.equal(model(changes).projected,null);
});
test('nearby finish and historical deadline remain in range',()=>{for(const offset of [-1,0,1,30*DAY]){const m=model();m.projected=limit+offset;const r=pacePlotRange(m);assert.ok(r.start<=m.deadline&&r.end>=m.deadline);assert.ok(r.forecastEnd===m.projected);}});
test('distant forecast extends beyond deadline with explicit 90-day cap',()=>{const m=model({now:limit+7*DAY});const r=pacePlotRange(m);assert.ok(r.end>limit);assert.ok(r.truncated);assert.equal(r.end,m.asOf+90*DAY);});
test('fresh snapshots after deadline retain the seven-full-day forecast',()=>{
 for(const offset of [DAY,7*DAY]){
  const m=model({asOf:limit+offset,events:events.map(e=>({...e,t:e.t+offset}))});
  assert.equal(m.rate,1);assert.equal(m.needRate,null);assert.equal(m.projected,m.asOf+m.remaining*DAY);
 }
});
