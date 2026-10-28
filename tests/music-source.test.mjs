import test from 'node:test';import assert from 'node:assert/strict';
import {createMusicSourceResolver,musicAudioEnabled,MUSIC_MEDIA_CSP} from '../js/music-source.js';
const round='c3c5b2f7-9d61-4ffc-8f97-f1b50156d59c',track='a599accf-ef39-4bb7-ba60-9b4596633599',key=round+':'+track;
test('audio is enabled only on approved HTTPS origin or explicit loopback mode',()=>{
 const enabled=href=>musicAudioEnabled({href});assert(enabled('https://tuz19.ru/'));assert(!enabled('http://tuz19.ru/'));assert(!enabled('https://evil.test/?audio=1'));assert(!enabled('http://127.0.0.1:8921/'));assert(enabled('http://127.0.0.1:8921/?audio=1'));
});
test('source resolves only confirmed catalog identities, never URLs from shared input',()=>{
 const resolve=createMusicSourceResolver([{confirmed:true,key,roundId:round,trackId:track}]);
 assert.equal(resolve(key),'https://api.19ib.ru/tracks/'+track+'/stream');assert.equal(resolve('https://evil.test/a.mp3'),null);assert.equal(resolve(round+':00000000-0000-4000-8000-000000000000'),null);
 assert.equal(createMusicSourceResolver([{confirmed:false,key,roundId:round,trackId:track}])(key),null);assert.equal(createMusicSourceResolver([{confirmed:true,key,roundId:round,trackId:'../other'}])(key),null);
 assert(!MUSIC_MEDIA_CSP.includes('*'));assert(MUSIC_MEDIA_CSP.includes('https://api.19ib.ru'));assert(!MUSIC_MEDIA_CSP.includes('connect-src'));
});
