import test from 'node:test';import assert from 'node:assert/strict';
import {createCatalog,selectTracks,loadPlaylists,savePlaylists,addUnique,moveItem,shareURL,readShared,validPlaylist,trackKey,localMusicEnabled,MUSIC_STORAGE_KEY} from '../js/music-model.js';
import {parseRoute} from '../js/routes.js';
const round='c3c5b2f7-9d61-4ffc-8f97-f1b50156d59c',r2='235f6600-5224-4adf-bbcc-a220f4572251',id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),key=n=>trackKey(round,id(n));
const playlist={v:1,id:'local-id',name:'Форум <script>🙂',tracks:[key(1),trackKey(r2,id(2))]};
test('catalog projects all official participants and uses official totals; R2 has no R1 grades',()=>{
 const context={roundId:round,rules:{scoresPerParticipant:5},data:{byId:new Map([['a',{userId:'a',trackId:id(1),artistName:'А'}],['b',{userId:'b',trackId:id(2),artistName:'Б'}]]),referenceMetadata:new Map([['a',{group:'Ветераны'}]])},analytics:{participantOutcome(id){return {scoreTotal:id==='a'?23:22,validScoreCount:id==='a'?4:5};}}};
 const rows=createCatalog(context,{roundId:r2,submissions:[{userId:'a',trackId:id(3),name:'А R2',durationSec:118}]});
 assert.equal(rows.length,3);assert.equal(rows[0].group,'veterans');assert.equal(rows[1].group,'other');assert.equal(rows[2].total,null);assert.equal(rows[2].count,0);assert.equal(rows[2].required,null);
 assert.deepEqual(selectTracks(rows).map(r=>r.total),[23,22,null]);assert.equal(selectTracks(rows,{complete:true}).length,1);assert.equal(selectTracks(rows,{round:'2'})[0].duration,118);
});
test('sorting uses total only with deterministic name and identity ties; filters include other participants',()=>{
 const rows=[{key:key(4),name:'Б',total:22,count:5,required:5,round:1,group:'other'},{key:key(3),name:'А',total:23,count:4,required:5,round:1,group:'forum'},{key:key(2),name:'А',total:23,count:5,required:5,round:1,group:'veterans'},{key:key(1),name:'Без оценок',total:null,count:0,required:null,round:2,group:'other'}];
 assert.deepEqual(selectTracks(rows).map(r=>r.key),[key(2),key(3),key(4),key(1)]);assert.deepEqual(selectTracks(rows,{order:'asc'}).map(r=>r.total),[22,23,23,null]);assert.equal(selectTracks(rows,{query:'без'}).length,1);assert.equal(selectTracks(rows,{group:'forum'}).length,1);assert.equal(selectTracks(rows,{round:'2',complete:true}).length,0);
});
test('storage validates format, identities and duplicates and handles denied access and quota',()=>{
 let raw=null;const storage={getItem:()=>raw,setItem:(k,v)=>{assert.equal(k,MUSIC_STORAGE_KEY);raw=v;}};
 assert.deepEqual(loadPlaylists(storage).lists,[]);assert.equal(savePlaylists(storage,[playlist]),'');const loaded=loadPlaylists(storage);assert.deepEqual(loaded.lists,[playlist]);loaded.lists[0].tracks.reverse();assert.deepEqual(loadPlaylists(storage).lists,[playlist]);
 raw='{"v":999}';assert.match(loadPlaylists(storage).warning,/повреждено/);raw=JSON.stringify({v:1,lists:[playlist,playlist]});assert(loadPlaylists(storage).warning);
 assert(savePlaylists(storage,[playlist,playlist]));const large=Array.from({length:100},(_,i)=>({...playlist,id:'list-'+i,tracks:Array.from({length:300},(_,n)=>key(n))}));assert.match(savePlaylists(storage,large),/лимит/);assert(loadPlaylists(undefined).warning);assert(savePlaylists({setItem(){throw Error('quota');}},[playlist]));assert(!validPlaylist({...playlist,tracks:[key(1),key(1)]}));assert(!validPlaylist({...playlist,tracks:['https://evil.test/a.mp3']}));
});
test('playlist edits preserve source arrays and prevent accidental duplicates',()=>{
 const before=[key(1),key(2)];assert.deepEqual(addUnique(before,key(1)),before);assert.deepEqual(moveItem(before,0,1),[key(2),key(1)]);assert.deepEqual(before,[key(1),key(2)]);assert.throws(()=>addUnique(before,'evil'));
});
test('shared snapshots round-trip Unicode and round identities, validate untrusted input and limit complete URL',()=>{
 const url=shareURL(playlist,'https://tuz19.ru/ib19/');assert(url.startsWith('https://tuz19.ru/ib19/?music=playlists&list='));const copy=readShared(url);assert.deepEqual(copy,{v:1,name:playlist.name,tracks:playlist.tracks});playlist.tracks.push(key(9));assert.equal(readShared(url).tracks.length,2);playlist.tracks.pop();
 assert.equal(readShared('https://tuz19.ru/'),null);for(const tail of ['!', 'a', 'eyJ2Ijo5OTl9'])assert.throws(()=>readShared('https://tuz19.ru/?list='+tail));assert.throws(()=>readShared(url+'&list=abc'));assert.throws(()=>shareURL({...playlist,tracks:Array.from({length:50},(_,i)=>key(i))},'https://tuz19.ru/'));
 const malformed={v:1,name:'test',tracks:[['https://evil',id(1)]]};assert.throws(()=>readShared('https://tuz19.ru/?list='+btoa(JSON.stringify(malformed))));
});
test('music route allows the approved domain and loopback only, preserving shared query state',()=>{
 assert(localMusicEnabled('127.0.0.1'));assert(localMusicEnabled('tuz19.ru'));assert(!localMusicEnabled('tuz19.invalid'));assert(!localMusicEnabled('www.tuz19.ru'));assert.equal(parseRoute('http://localhost/?music=playlists','/').type,'music');assert.equal(parseRoute('https://tuz19.ru/?music=playlists','/').type,'music');const shared=shareURL(playlist,'http://localhost/ib19/');assert.equal(parseRoute(shared,'/ib19/').canonical,new URL(shared).pathname+new URL(shared).search);
});
