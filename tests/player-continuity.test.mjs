import test from 'node:test';import assert from 'node:assert/strict';
import {parseRoute} from '../js/routes.js';import {createMusicPlayer} from '../js/music-player.js';
const key=n=>'c3c5b2f7-9d61-4ffc-8f97-f1b50156d59c:00000000-0000-4000-8000-'+String(n).padStart(12,'0');
class Audio extends EventTarget{paused=true;currentTime=0;duration=120;volume=1;src='';loads=0;blocked=false;preload='';async play(){if(this.blocked)throw new DOMException('Blocked','NotAllowedError');this.paused=false;this.dispatchEvent(new Event('playing'));}pause(){this.paused=true;this.dispatchEvent(new Event('pause'));}load(){this.loads++;this.currentTime=0;}removeAttribute(){this.src='';}getAttribute(){return this.src||null;}remove(){}}
const tick=()=>new Promise(r=>setImmediate(r));
test('chat uses the existing global route, canonical URL and basePath; invalid rounds remain explicit',()=>{
 for(const base of ['/','/ib19/'])for(const query of ['','?round=1','?round=2']){const value=parseRoute('https://tuz19.ru'+base+'chat/'+query,base);assert.equal(value.type,'chat');assert.equal(value.round,1);assert.equal(value.canonical,base+'chat/');}
 assert(parseRoute('https://tuz19.ru/chat/?round=3','/').error);assert(parseRoute('https://tuz19.ru/chat/?round=1&round=2','/').error);
});
test('one existing audio instance owns queue, pause, seek and ended progression; no implicit autoplay',async()=>{
 const audio=new Audio(),player=createMusicPlayer({audio,resolveSource:k=>'http://127.0.0.1/'+k});assert.equal(audio.preload,'none');assert.equal(audio.src,'');assert.equal(audio.loads,0);player.replace([key(1),key(2)]);await tick();assert.equal(player.audio,audio);assert.equal(player.state().key,key(1));player.seek(25);const loads=audio.loads;player.toggle();assert.equal(player.state().paused,true);assert.equal(player.state().currentTime,25);assert.deepEqual(player.state().queue,[key(1),key(2)]);player.toggle();await tick();assert.equal(audio.loads,loads);assert.equal(player.state().currentTime,25);assert.equal(player.state().paused,false);audio.dispatchEvent(new Event('ended'));await tick();assert.equal(player.state().key,key(2));assert.equal(player.audio,audio);assert.deepEqual(player.state().queue,[key(1),key(2)]);
});
test('browser autoplay denial is recoverable only through an explicit toggle',async()=>{
 const audio=new Audio();audio.blocked=true;const player=createMusicPlayer({audio,resolveSource:()=> 'http://127.0.0.1/fixture.wav'});player.replace([key(1)]);await tick();assert.equal(player.state().paused,true);assert.match(player.state().error,/Нажмите Play/);audio.blocked=false;assert.equal(player.state().paused,true);player.toggle();await tick();assert.equal(player.state().paused,false);
});

test('SPA chat view keeps the exact standalone markup and one client entry',async()=>{
 const {readFile}=await import('node:fs/promises');const html=await readFile('chat/index.html','utf8'),view=await readFile('chat/view.html','utf8');assert.equal(view.trim(),html.match(/<main class="main chat-page">([\s\S]*?)<\/main>/)[1].trim());assert(!view.includes('<script'));const entry=await readFile('js/chat-page.js','utf8');assert.equal(entry.match(/import\('\.\/chat-client\.js'\)/g).length,1);
});
