import test from 'node:test';import assert from 'node:assert/strict';
import {selectMatrixRows} from '../js/matrix-selection.js';
import {matrixLayout,windowForJudge,stepWindow} from '../js/focus-matrix-window.js';
const judges=Array.from({length:22},(_,i)=>({id:'judge-'+i}));
test('Focus window uses container geometry: two columns at 292/347, three at 362, full matrix at tablet widths',()=>{
 assert.equal(matrixLayout(292).size,2);assert.equal(matrixLayout(347).size,2);assert.equal(matrixLayout(362).size,3);
 for(const width of [600,740,984,1112])assert.equal(matrixLayout(width).mobile,false);
 assert.equal(matrixLayout(292).mobile,true);assert.equal(matrixLayout(599).size,3);
 for(const width of [260,292,347,362]){const l=matrixLayout(width);assert(width-l.nameWidth-l.size*44-(l.size*4)>=0);}
});
test('Full final windows cover all judges with reversible, bounded navigation and no source mutations',()=>{
 for(const size of [2,3]){const before=structuredClone(judges),seen=[];let start=0;
  const starts=[];
  for(;;){starts.push(start);seen.push(...judges.slice(start,start+size).map(j=>j.id));const next=stepWindow(start,1,size,judges.length);if(next===start)break;assert(next>start);start=next;}
  assert.deepEqual([...new Set(seen)],judges.map(j=>j.id));assert.equal(new Set(seen).size,22);
  assert.deepEqual(starts,size===3?[0,3,6,9,12,15,18,19]:[0,2,4,6,8,10,12,14,16,18,20]);
  const backwards=[start];while(start>0){const next=stepWindow(start,-1,size,22);assert(next<start);assert.equal(stepWindow(next,1,size,22),start);start=next;backwards.push(start);}
  assert.deepEqual(backwards,[...starts].reverse());start=starts.at(-1);
  assert.equal(stepWindow(0,-1,size,22),0);assert.equal(stepWindow(start,1,size,22),start);
  assert.equal(judges.slice(start,start+size).length,size);assert.equal(windowForJudge(judges,'judge-21',size),22-size);assert.deepEqual(judges,before);
 }
});
test('Direct choice and resize keep a stable judge UUID visible in both two/three-column windows',()=>{
 for(const judge of judges)for(const size of [2,3]){const start=windowForJudge(judges,judge.id,size);assert(judges.slice(start,start+size).includes(judge));}
 const reversed=[...judges].reverse();assert.equal(windowForJudge(reversed,'judge-0',3),19);
 for(const size of [2,3]){assert.equal(stepWindow(0,1,size,1),0);assert.equal(windowForJudge(judges.slice(0,1),'judge-0',size),0);}
});

const fixtures=[
 {id:'y',name:'Яша',battleName:'Yasha',aliases:[],total:25,status:'pass',veteran:false,scores:[{judgeName:'A',score:5}]},
 {id:'a',name:'Аня',battleName:'Anya',aliases:[],total:10,status:'fail',veteran:false,scores:[{judgeName:'A',score:2}]},
 {id:'b',name:'Боря',battleName:'Borya',aliases:[],total:20,status:'pass',veteran:true,scores:[{judgeName:'A',score:4}]},
 {id:'t',name:'TROOL',battleName:'Trool',aliases:[],total:5,status:'fail',veteran:true,scores:[]}
];
const ids=rows=>rows.map(r=>r.id);
test('Matrix score sorting is independent of list alpha/Trul sorting, with exact UUID order',()=>{
 const before=structuredClone(fixtures);
 for(const sort of ['alpha','trul','score'])assert.deepEqual(ids(selectMatrixRows(fixtures,{matrixSort:'score',sort})),['y','b','a','t']);
 assert.deepEqual(fixtures,before);
});
test('Matrix alpha directions, filters and score reset compose without inheriting list order',()=>{
 assert.deepEqual(ids(selectMatrixRows(fixtures,{matrixSort:'alpha',sort:'score'})),['a','b','y','t']);
 assert.deepEqual(ids(selectMatrixRows(fixtures,{matrixSort:'alpha-desc',sort:'alpha'})),['t','y','b','a']);
 assert.deepEqual(ids(selectMatrixRows(fixtures,{matrixSort:'score',sort:'alpha',group:'current'})),['y','a']);
 assert.deepEqual(ids(selectMatrixRows(fixtures,{matrixSort:'score',sort:'trul',group:'veterans',status:'pass'})),['b']);
 assert.deepEqual(ids(selectMatrixRows(fixtures,{matrixSort:'score',sort:'alpha',query:'я'})),['y','b','a']);
 assert.deepEqual(ids(selectMatrixRows(fixtures,{matrixSort:'score',query:'ya'})),[]);
});
test('Judge sort directions override row sort; clearing the judge restores exact score order',()=>{
 const base={matrixSort:'score',sort:'alpha',judgeSort:'A'};
 assert.deepEqual(ids(selectMatrixRows(fixtures,{...base,judgeDirection:'desc'})),['y','b','a','t']);
 assert.deepEqual(ids(selectMatrixRows(fixtures,{...base,judgeDirection:'asc'})),['a','b','y','t']);
 assert.deepEqual(ids(selectMatrixRows(fixtures,{...base,judgeSort:null})),['y','b','a','t']);
});
