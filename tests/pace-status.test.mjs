import test from 'node:test';import assert from 'node:assert/strict';import {paceStatus} from '../js/pace-status.js';
const old='2026-10-18T23:59:00+03:00',deadline=Date.parse('2026-10-22T23:59:00+03:00');
const model=projected=>({remaining:100,enough:true,projected,deadline,verdict:projected<=deadline?'Успевают':'Не успевают'});
for(const [t,expected]of [[Date.parse(old)-1,'Успевают'],[Date.parse(old),'Успевают'],[Date.parse(old)+1,'Успевают. Со второго раза.'],[deadline,'Успевают. Со второго раза.'],[deadline+1,'Успевают. Со второго раза.']])test('active extended window status '+t,()=>assert.equal(paceStatus(model(t),old,deadline-1).text,expected));
test('unreliable or missing forecasts stay uncertain',()=>{for(const m of [{...model(null),projected:null},{...model(deadline),enough:false}])assert.equal(paceStatus(m,old).text,'Недостаточно данных');});
test('actual completion retains its existing status',()=>{const r=paceStatus({...model(deadline),remaining:0,completion:deadline},old);assert.equal(r.text,'Успевают');assert.equal(r.caption,null);});
test('second attempt keeps positive tone and Moscow dates',()=>{const r=paceStatus(model(deadline),Date.parse(old),deadline-1);assert.equal(r.tone,'positive');assert.equal(r.caption,'Дедлайн продлён до 22 октября. Первоначальный дедлайн — 18 октября');});
