import test from 'node:test';import assert from 'node:assert/strict';
import {config,DAY} from '../js/config.js';import {paceModel} from '../js/pace-model.js';
test('deadline history preserves Moscow dates and exactly four days',()=>{assert.equal(config.originalDeadline,'2026-10-18T23:59:00+03:00');assert.equal(config.deadline,'2026-10-22T23:59:00+03:00');assert.equal(Date.parse(config.deadline)-Date.parse(config.originalDeadline),4*DAY);assert.equal(new Date(config.deadline).toISOString(),'2026-10-22T20:59:00.000Z');});
test('only current deadline changes required pace; projection and observed scores stay independent',()=>{
 const asOf=Date.parse('2026-10-18T15:00:00+03:00'),now=Date.parse('2026-10-19T12:00:00+03:00'),events=Array.from({length:20},(_,i)=>({userId:String(i),judge:'A',t:asOf-(20-i)*DAY}));
 const input={events,participants:100,scoresPerParticipant:5,asOf,now};
 const old=paceModel({...input,deadline:config.originalDeadline}),current=paceModel({...input,deadline:config.deadline});
 assert.equal(old.needRate,null);assert.equal(current.needRate,current.remaining/((Date.parse(config.deadline)-now)/DAY));
 for(const k of ['rate','projected','remaining','target','done','unique','days','windowStart','windowEnd'])assert.deepEqual(current[k],old[k],k);
});
