import test from 'node:test';import assert from 'node:assert/strict';
import {catalogQueue} from '../js/music-model.js';import {createMusicPlayer} from '../js/music-player.js';
const round='c3c5b2f7-9d61-4ffc-8f97-f1b50156d59c',key=n=>round+':00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const tick=()=>new Promise(r=>setImmediate(r));
class Audio extends EventTarget{paused=true;currentTime=0;duration=90;volume=1;src='';loads=0;broken=false;async play(){if(this.broken)throw new DOMException('Decode failure','NotSupportedError');this.paused=false;this.dispatchEvent(new Event('playing'));}pause(){this.paused=true;this.dispatchEvent(new Event('pause'));}load(){this.loads++;this.currentTime=0;}removeAttribute(){this.src='';}getAttribute(){return this.src||null;}remove(){}finish(){this.paused=true;this.dispatchEvent(new Event('ended'));}}
const rows=[
 {key:key(1),name:'Тест А',round:1,group:'forum',total:20,count:5,required:5,confirmed:true,submittedTime:10},
 {key:key(2),name:'Тест Б',round:1,group:'forum',total:25,count:5,required:5,confirmed:true,submittedTime:30},
 {key:key(3),name:'Тест В',round:1,group:'forum',total:15,count:4,required:5,confirmed:true,submittedTime:null},
 {key:key(4),name:'Тест Г',round:2,group:'forum',total:null,count:0,required:null,confirmed:true,submittedTime:20},
 {key:key(5),name:'Другой',round:2,group:'veterans',total:null,count:0,required:null,confirmed:true,submittedTime:40},
 {key:key(6),name:'Тест Д',round:1,group:'forum',total:23,count:5,required:5,confirmed:false,submittedTime:50}
];
test('PLAYER-03: catalog tail follows round/group/search/completeness and every existing sort, without duplicates',()=>{
 const before=structuredClone(rows);
 assert.deepEqual(catalogQueue(rows,{round:'1',group:'forum',query:'Тест',complete:true,order:'desc'},key(2)),[key(2),key(1)]);
 assert.deepEqual(catalogQueue(rows,{round:'1',order:'newest'},key(1)),[key(1),key(3)]);
 assert.deepEqual(catalogQueue(rows,{round:'1',order:'oldest'},key(1)),[key(1),key(2),key(3)]);
 assert.deepEqual(catalogQueue(rows,{round:'2',group:'forum',order:'oldest'},key(4)),[key(4)]);
 assert.deepEqual(catalogQueue(rows,{round:'2',order:'newest'},key(5)),[key(5),key(4)]);
 assert.deepEqual(catalogQueue(rows,{round:'1',order:'alpha'},key(2)),[key(2),key(3)]);
 assert.deepEqual(catalogQueue(rows,{round:'1',order:'asc'},key(3)),[key(3),key(1),key(2)]);
 assert.deepEqual(catalogQueue([...rows,rows[0]],{round:'1',order:'alpha'},key(1)),[key(1),key(2),key(3)]);
 assert.deepEqual(catalogQueue(rows,{round:'2'},key(1)),[]);assert.deepEqual(rows,before);
});
test('PLAYER-03: entire catalog supports >1000 tracks and freezes queue at launch; manual limits unchanged',async()=>{
 const many=Array.from({length:3324},(_,i)=>({...rows[0],key:key(i+1),submittedTime:i}));
 const keys=catalogQueue(many,{order:'oldest'},key(1));assert.equal(keys.length,3324);assert.equal(keys.at(-1),key(3324));
 const audio=new Audio(),p=createMusicPlayer({audio,resolveSource:k=>k});p.replace(keys,{sequential:true});await tick();assert.deepEqual(p.state().queue,keys);
 keys.pop();many.reverse();catalogQueue(many,{order:'newest'},key(3324));assert.equal(p.state().queue.length,3324);assert.equal(p.state().key,key(1));
 const middle=catalogQueue(many,{order:'oldest'},key(1500));assert.equal(middle.length,1825);assert.equal(middle[0],key(1500));assert.equal(middle.at(-1),key(3324));
 assert.equal(p.enqueue(key(9999)),false,'Manual enqueue keeps its existing limit');p.replace([key(9),key(7)]);await tick();assert.deepEqual(p.state().queue,[key(9),key(7)]);assert(p.enqueue(key(8)));assert.deepEqual(p.state().queue,[key(9),key(7),key(8)]);
});
test('PLAYER-03: automatic next, Next/Previous and final stop reuse one audio; catalog clears shuffle/repeat only',async()=>{
 const audio=new Audio(),p=createMusicPlayer({audio,resolveSource:k=>k});p.setRepeat();p.setShuffle();p.replace([key(1),key(2),key(3)],{sequential:true});await tick();assert.equal(p.state().repeat,'off');assert.equal(p.state().shuffle,false);
 audio.finish();await tick();assert.equal(p.state().key,key(2));p.next();await tick();assert.equal(p.state().key,key(3));p.previous();await tick();assert.equal(p.state().key,key(2));p.next();await tick();const loads=audio.loads;audio.finish();await tick();assert.equal(p.state().status,'Очередь закончилась');assert(p.state().paused);assert.equal(audio.loads,loads);assert.equal(p.audio,audio);assert.equal(p.state().key,key(3));
});
test('PLAYER-03: unavailable audio stops with a recoverable error and never retries in a loop',async()=>{
 const audio=new Audio(),p=createMusicPlayer({audio,resolveSource:k=>k});audio.broken=true;p.replace([key(1),key(2)],{sequential:true});await tick();assert.match(p.state().error,/Аудио недоступно/);assert(p.state().paused);const loads=audio.loads;audio.dispatchEvent(new Event('error'));await tick();assert.equal(audio.loads,loads);assert.equal(p.state().key,key(1));audio.broken=false;p.next();await tick();assert.equal(p.state().key,key(2));assert(!p.state().paused);
});
