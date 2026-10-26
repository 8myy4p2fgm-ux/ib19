import test from 'node:test';import assert from 'node:assert/strict';
import {verdictExpression,renderVerdictIllustrations} from '../js/verdict-illustrations.js';
test('Five group-relative states are monotone and mirrored without rounding',()=>{
 const group=[0,25,50,75,100].map(pass=>({pass,n:100}));assert.deepEqual(group.map(j=>verdictExpression(j,group)),[0,1,2,3,4]);
 const angels=new Set(),devils=new Set();for(let i=0;i<5;i++){const art=renderVerdictIllustrations(i);assert.match(art.pass,new RegExp('data-expression="'+i+'"'));assert.match(art.fail,new RegExp('data-expression="'+(4-i)+'"'));angels.add(art.pass);devils.add(art.fail);assert(!/__ANGEL|__DEVIL|NaN|Infinity/.test(art.pass+art.fail));}assert.equal(angels.size,5);assert.equal(devils.size,5);
});
test('The current group range, not absolute shares or rounded labels, sets expression steps',()=>{
 const group=[{pass:45,n:100},{pass:60,n:100},{pass:87,n:100}],copy=JSON.stringify(group);assert.equal(verdictExpression(group[0],group),0);assert.equal(verdictExpression(group[2],group),4);assert.equal(verdictExpression(group[1],group),1);assert.equal(JSON.stringify(group),copy);
});
test('Missing/equal groups use neutral rather than an invented ranking',()=>{
 assert.equal(verdictExpression({pass:0,n:0},[]),2);assert.equal(verdictExpression({pass:5,n:10},[{pass:5,n:10},{pass:10,n:20}]),2);assert.equal(verdictExpression({pass:1,n:2},[]),2);assert.match(renderVerdictIllustrations(null).pass,/data-expression="2"/);
});
