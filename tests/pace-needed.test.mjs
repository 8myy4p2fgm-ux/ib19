import test from 'node:test';
import assert from 'node:assert/strict';
import {paceNeeded} from '../js/pace-needed.js';
import {paceModel} from '../js/pace-model.js';
const deadline=Date.parse('2026-10-22T23:59:00+03:00');
const fmt=(n,d=0)=>n.toLocaleString('ru-RU',{maximumFractionDigits:d});
const m={remaining:562,deadline};
for(const timezone of ['UTC','America/Los_Angeles','Asia/Tokyo','Europe/Moscow'])test('deadline card in '+timezone,()=>{
 const previous=process.env.TZ;process.env.TZ=timezone;
 try{
  for(const time of ['2026-10-21T00:00:00+03:00','2026-10-21T23:59:59.999+03:00']){
   const now=Date.parse(time),card=paceNeeded(m,now,fmt);
   assert.equal(card.label,'Нужно в день');assert.equal(card.value,fmt(Math.ceil(562/((deadline-now)/86400000)),0));
  }
  for(const time of ['2026-10-22T00:00:00+03:00','2026-10-22T23:58:00+03:00','2026-10-22T23:58:59.999+03:00']){
   const card=paceNeeded(m,Date.parse(time),fmt);
   assert.equal(card.label,'До дедлайна');assert.equal(card.value,'Сегодня');assert.equal(card.detail,'23:59 МСК');
  }
  for(const now of [deadline,deadline+1,deadline+86400000])assert.equal(paceNeeded(m,now,fmt).value,'Дедлайн прошёл');
  for(const now of [deadline-86400000,deadline-1,deadline,deadline+1])assert.equal(paceNeeded({...m,remaining:0},now,fmt).value,'Завершено');
 }finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});
test('missing deadline stays unavailable',()=>assert.equal(paceNeeded({...m,deadline:null},deadline,fmt).value,'—'));
test('presentation preserves exact forecast and deadline comparison',()=>{
 const DAY=86400000,asOf=deadline-DAY;
 const events=Array.from({length:8},(_,i)=>({userId:String(i),judge:'A',t:asOf-(8-i)*DAY}));
 for(const shift of [0,1]){
  const model=paceModel({events:events.map(e=>({...e,t:e.t+shift})),participants:9,scoresPerParticipant:1,asOf:asOf+shift,deadline:new Date(deadline).toISOString(),now:asOf+shift});
  const before=structuredClone(model);
  assert.equal(model.projected,deadline+shift);assert.equal(model.verdict,shift?'Не успевают':'Успевают');
  for(const now of [deadline-DAY,deadline-1,deadline,deadline+1])paceNeeded(model,now,fmt);
  assert.deepEqual(model,before);
 }
});
