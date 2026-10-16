import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {collect,mergeSnapshot} from '../scripts/collector.mjs';
import {normalizeData,loadData} from '../js/data.js';
import {artistIdentity} from '../js/artist-identity.js';
import {buildForumLink,selectForumRows} from '../js/forum-link-model.js';
import {publicationChanged} from '../scripts/publication-plan.mjs';
import {updateHistory} from '../scripts/update-history.mjs';

const at='2026-10-15T12:00:00Z',later='2026-10-15T12:05:00Z';
const grade={judgeName:'Judge',score:4,comment:'Original comment',scoredAt:'2026-10-14T12:00:00Z'};
const old={exportedAt:at,totalParticipants:2,members:[
 {userId:'first',artistName:'Old name',artistSlug:'old-name',scores:[grade],scoredCount:1,fetchedAt:at,current:true},
 {userId:'second',artistName:'Other artist',artistSlug:'other-artist',scores:[],scoredCount:0,fetchedAt:at,current:true}
]};
const forum={exportedAt:at,members:[{userId:'first',forum_name:'Forum nickname',group:'OG',veteran:false,current:true,scores:[grade]}]};
const full={id:'r',judgesRequired:5,scoreScale:5,passThreshold:15,entries:[
 {userId:'first',name:'Renamed artist',slug:'renamed-artist',scoredCount:1,score:4},
 {userId:'second',name:'Other artist',slug:'other-artist',scoredCount:0,score:null}
]};
const scores=new Map(old.members.map(p=>[p.userId,p.scores]));

test('name-only runId refresh bypasses the previous JSON cache without changing score timestamps',async t=>{
 const meta={runId:'artist-names-v2',exportedAt:at,forumExportedAt:at,lastSuccessfulAt:at},requests=[];
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  requests.push(url.href);assert.equal(options.priority,'high','analytics keeps its published fetch priority');
  const file=url.pathname.split('/').pop();
  if(file==='metadata.json'){assert.equal(options.cache,'no-store');return {ok:true,json:async()=>meta};}
  assert.equal(url.searchParams.get('v'),meta.runId);assert.equal(options.cache,'default');
  return {ok:true,json:async()=>file==='forum_judges_export.json'?forum:old};
 });
 const D=await loadData();
 assert.equal(requests.length,3);assert.equal(D.updated,at);assert.equal(D.forumExportedAt,at);
 assert.equal(D.artists.get('first').artistName,'Old name');assert.equal(D.metadata.get('first').forum_name,'Forum nickname');
});

test('identity refresh with unchanged grades uses only the two existing summary requests',async()=>{
 const paths=[];
 const batch=await collect({roundId:'r'},old,forum,{now:()=>later,get:async path=>{
  paths.push(path);
  if(path.endsWith('/full'))return structuredClone(full);
  if(path.endsWith('/live'))return {progress:full.entries};
  assert.fail('name refresh must not request score or artist cards');
 }});
 assert.deepEqual(paths,['/rounds/r/full','/rounds/r/live']);
 assert.equal(batch.collection.updatedCards,0);
 const renamed=batch.main.members[0];
 assert.equal(renamed.userId,'first');assert.equal(renamed.artistName,'Renamed artist');assert.equal(renamed.artistSlug,'renamed-artist');
 assert.deepEqual(renamed.scores,old.members[0].scores);assert.equal(renamed.fetchedAt,at);
 assert.deepEqual(batch.forum.members,forum.members);
 assert.equal(updateHistory(old,batch.main,batch.forum,null,later).revisions.length,0);
 assert.equal(publicationChanged({main:old,forum,metadata:{counts:{},source:{}}},batch,{},{}),true);
 assert.equal(old.members[0].artistName,'Old name','source snapshot stays untouched');
});

test('blank, missing and malformed identity values retain each last known field independently',()=>{
 for(const patch of [{},{name:'',slug:' '},{name:null,slug:null},{name:17,slug:[]},{name:'\n\t',slug:undefined}]){
  const source=structuredClone(full);Object.assign(source.entries[0],{name:undefined,slug:undefined},patch);
  const result=mergeSnapshot(old,forum,source,scores,later).main.members[0];
  assert.equal(result.artistName,'Old name');assert.equal(result.artistSlug,'old-name');
 }
 const source=structuredClone(full);Object.assign(source.entries[0],{name:' New name ',slug:''});
 const result=mergeSnapshot(old,forum,source,scores,later).main.members[0];
 assert.equal(result.artistName,'New name');assert.equal(result.artistSlug,'old-name');
});

test('duplicate artist names remain separate UUIDs and forum names stay separate',()=>{
 const source=structuredClone(full);source.entries.forEach(e=>{e.name='Same name';});
 const batch=mergeSnapshot(old,forum,source,scores,later),D=normalizeData(batch.main,batch.forum);
 assert.equal(D.artists.size,2);assert.equal(D.artists.get('first').artistName,'Same name');assert.equal(D.artists.get('second').artistName,'Same name');
 assert.equal(D.metadata.get('first').forum_name,'Forum nickname');assert.equal(D.metadata.get('first').group,'OG');
 const model=buildForumLink(D);
 assert.equal(model.forum[0].name,'Forum nickname');assert.equal(model.forum[0].battleName,'Same name');
 assert.equal(model.other[0].name,'Same name');assert.equal(selectForumRows(model.forum,{query:'same name'}).length,1);
 assert.equal(model.forum[0].battleProfile,'https://19ib.ru/artist/renamed-artist');
});

test('unknown artist has an explicit label and UUID URL, never a forum nickname',()=>{
 const main=structuredClone(old);delete main.members[0].artistName;delete main.members[0].artistSlug;
 const D=normalizeData(main,forum),artist=artistIdentity(D,'first');
 assert.deepEqual(D.artists.get('first'),{artistName:null,artistSlug:null});
 assert.equal(artist.displayName,'Имя неизвестно');assert.equal(artist.userId,'first');assert.equal(artist.profileUrl,'https://19ib.ru/artist/first');
 assert.equal(artistIdentity(D,'no-record').displayName,'Имя неизвестно');
 D.artists.set('unsafe',{artistName:'<b>Artist</b>',artistSlug:'a/b?c'});
 assert.equal(artistIdentity(D,'unsafe').profileUrl,'https://19ib.ru/artist/a%2Fb%3Fc');
});

test('archiving preserves artist identity and reappearance updates it under the original UUID',()=>{
 const base={...old,totalParticipants:20,members:Array.from({length:20},(_,i)=>({userId:String(i),artistName:'Artist '+i,artistSlug:'artist-'+i,scores:[grade],scoredCount:1,current:true}))};
 const scoreMap=new Map(base.members.map(p=>[p.userId,p.scores])),emptyForum={...forum,members:[]};
 const source={...full,entries:base.members.slice(0,19).map(p=>({userId:p.userId,scoredCount:1}))};
 const batch=mergeSnapshot(base,emptyForum,source,scoreMap,later),D=normalizeData(batch.main,batch.forum);
 assert.equal(batch.main.archivedMembers[0].artistName,'Artist 19');assert.deepEqual(batch.main.archivedMembers[0].scores,[grade]);
 assert.equal(D.artists.get('19').artistName,'Artist 19');
 const restored=mergeSnapshot(batch.main,batch.forum,{...source,entries:[...source.entries,{userId:'19',scoredCount:1,name:'Returned artist',slug:'returned'}]},scoreMap,later);
 assert.equal(restored.main.archivedMembers.length,0);assert.equal(restored.main.members.find(p=>p.userId==='19').artistName,'Returned artist');
});

test('saved round has names/slugs for every current UUID and preserves all archived records',()=>{
 const main=JSON.parse(fs.readFileSync('data/19ib_all_judges_REPAIRED.json')),meta=JSON.parse(fs.readFileSync('data/forum_judges_export.json'));
 const D=normalizeData(main,meta);
 assert.equal(D.artists.size,main.members.length+main.archivedMembers.length);
 assert.ok(main.members.every(p=>p.artistName?.trim()&&p.artistSlug?.trim()));
 assert.equal(new Set(main.members.map(p=>p.userId)).size,main.members.length);
 for(const p of main.archivedMembers)assert.ok(D.archivedById.has(p.userId)&&D.artists.has(p.userId));
 const kot='66caebea-d33d-4ff6-951c-91ed9d93c4be';
 assert.equal(D.artists.get(kot).artistName,'Кот Форумчанина');assert.equal(D.metadata.get(kot).forum_name,'K_Slim');
 assert.equal(artistIdentity(D,kot).profileUrl,'https://19ib.ru/artist/kot-forumchanina');
});
