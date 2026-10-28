import test from 'node:test';import assert from 'node:assert/strict';
import {createCatalog,selectTracks,validateR1TrackSubmissions} from '../js/music-model.js';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const context={roundId:id(1),rules:{scoresPerParticipant:5},data:{byId:new Map([[id(10),{userId:id(10),trackId:id(11),artistName:'R1',submittedAt:'2026-10-28T00:00:00Z'}]]),referenceMetadata:new Map([[id(20),{group:'Форум'}]])},analytics:{participantOutcome(){return {scoreTotal:15,validScoreCount:5};}}};
const submissions=[{userId:id(20),trackId:id(21),name:'Б',submittedAt:'2026-10-26T12:00:00Z'},{userId:id(30),trackId:id(31),name:'А',submittedAt:'2026-10-26T12:00:00Z'},{userId:id(40),trackId:id(41),name:'Новый',submittedAt:'2026-10-27T12:00:00Z'},{userId:id(50),trackId:id(51),name:'Без даты',submittedAt:null,scoredAt:'2026-10-28T12:00:00Z'},{userId:id(60),trackId:id(61),name:'Неверная дата',submittedAt:'invalid'}];
const rows=()=>createCatalog(context,{roundId:id(2),submissions},new Map([[JSON.stringify([id(10),id(11)]),'2026-10-25T00:00:00Z']]));
test('PLAYER-02: actual submission dates, stable ties and missing dates last in both directions',()=>{
 const r=rows(),before=structuredClone(r);assert.equal(r[0].submittedTime,Date.parse('2026-10-25T00:00:00Z'));assert.equal(r[4].submittedTime,null);assert.equal(r[5].submittedTime,null);
 assert.deepEqual(selectTracks(r,{round:'2',order:'newest'}).map(x=>x.name),['Новый','А','Б','Без даты','Неверная дата']);
 assert.deepEqual(selectTracks(r,{round:'2',order:'oldest'}).map(x=>x.name),['А','Б','Новый','Без даты','Неверная дата']);assert.deepEqual(r,before);
});
test('PLAYER-02: filters compose across rounds and use explicit R1 submission dates',()=>{
 const r=rows();assert.deepEqual(selectTracks(r,{round:'2',order:'newest',group:'forum'}).map(x=>x.userId),[id(20)]);
 assert.deepEqual(selectTracks(r,{round:'2',order:'oldest',query:'нов'}).map(x=>x.userId),[id(40)]);assert.deepEqual(selectTracks(r,{round:'2',order:'newest',complete:true}),[]);
 assert.deepEqual(selectTracks(r,{round:'1',order:'newest'}).map(x=>x.name),['R1']);
 assert.deepEqual(selectTracks(r,{round:'all',order:'oldest'}).map(x=>x.name),['R1','А','Б','Новый','Без даты','Неверная дата']);
 assert.deepEqual(selectTracks(r,{round:'all',order:'newest'}).map(x=>x.name),['Новый','А','Б','R1','Без даты','Неверная дата']);
 assert.equal(createCatalog(context)[0].submittedAt,null,'Never infer dates from other participant fields');
});

test('PLAYER-02: public R1 date projection is exact, allowlisted, pinned and independent of private archive',async()=>{
 const fs=await import('node:fs/promises'),{readPublicR1}=await import('../scripts/public-data.mjs'),{createOfficialR1View}=await import('../js/r1-official-view.js');
 const projection=JSON.parse(await fs.readFile('public-data/r1/submissions.v1.json','utf8')),{snapshot}=await readPublicR1();
 assert.deepEqual(Object.keys(projection).sort(),['records','roundId','schema']);assert.equal(projection.records.length,3277);assert.equal(projection.records.filter(p=>p.submittedAt===null).length,1);
 for(const p of projection.records)assert.deepEqual(Object.keys(p).sort(),['submittedAt','trackId','userId']);
 const expected=new Set(['members','archivedMembers','quarantinedMembers'].flatMap(k=>snapshot.main[k].filter(p=>p.trackId).map(p=>JSON.stringify([p.userId,p.trackId]))));
 assert.deepEqual(new Set(projection.records.map(p=>JSON.stringify([p.userId,p.trackId]))),expected);
 const dates=validateR1TrackSubmissions(projection,projection.roundId),context=createOfficialR1View(snapshot,{policyVersion:'r1-official-zippy-v2',sourceContract:'r1-public-v1'}),catalog=createCatalog(context,null,dates);
 for(const p of catalog)assert.equal(p.submittedAt,dates.get(JSON.stringify([p.userId,p.trackId])));
 for(const order of ['oldest','newest']){const result=selectTracks(catalog,{round:'1',order});assert.equal(new Set(result.map(p=>p.key)).size,catalog.length);for(let i=1;i<result.length;i++){const a=result[i-1].submittedTime,b=result[i].submittedTime;if(a===null)assert.equal(b,null);else if(b!==null)assert(order==='oldest'?a<=b:a>=b);}}
 assert.throws(()=>validateR1TrackSubmissions(projection,id(2)));
 for(const change of [v=>v.records[0].submittedAt='2000-01-01T00:00:00Z',v=>v.records[0].aliases=['private'],v=>v.records.push(v.records[0]),v=>v.schema='other']){const bad=structuredClone(projection);change(bad);assert.throws(()=>validateR1TrackSubmissions(bad,projection.roundId));}
});
