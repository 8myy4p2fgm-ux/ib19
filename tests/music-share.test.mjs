import test from 'node:test';import assert from 'node:assert/strict';
import {createMusicShareClient,shortShareId} from '../js/music-share.js';import {shareURL,sharedPlaylistPayload} from '../js/music-model.js';
const round='c3c5b2f7-9d61-4ffc-8f97-f1b50156d59c',key=n=>round+':00000000-0000-4000-8000-'+String(n).padStart(12,'0');const p={v:1,id:'local',name:'Тест',tracks:[key(1),key(2)]},id='a'.repeat(22);
test('short URL parser rejects ambiguity; legacy loading never calls server',async()=>{
 assert.equal(shortShareId('http://localhost/?share='+id),id);for(const suffix of ['share=bad','share='+id+'&share='+id,'share='+id+'&list=abc'])assert.throws(()=>shortShareId('http://localhost/?'+suffix));
 const client=createMusicShareClient({base:'http://localhost/',fetchImpl(){throw Error('No API for legacy');}});const legacy=shareURL(p,'http://localhost/');assert.deepEqual(await client.load(legacy),{v:1,name:p.name,tracks:p.tracks});assert.equal(await client.load('http://localhost/'),null);
});
test('publish freezes input, retries same requestId after lost response, and caches immutable snapshots',async()=>{
 let calls=[];const original=structuredClone(p);const client=createMusicShareClient({base:'http://localhost/',newRequestId:()=> '00000000-0000-4000-8000-000000000001',fetchImpl:async(url,options)=>{calls.push(JSON.parse(options.body));if(calls.length===1)throw Error('lost response');return Response.json({id});}});
 await assert.rejects(client.publish(original),/Локальный плейлист не изменён/);const url=await client.publish(original);assert.equal(calls.length,2);assert.equal(calls[0].requestId,calls[1].requestId);assert.equal(url,'http://localhost/?music=playlists&share='+id);assert.equal(await client.publish(original),url);assert.equal(calls.length,2);
 original.tracks.reverse();assert.deepEqual(calls[1].playlist,sharedPlaylistPayload(p));
});
test('new shares load a validated independent value; missing and malformed responses remain recoverable',async()=>{
 let fail=false;const client=createMusicShareClient({base:'http://localhost/',fetchImpl:async()=>fail?Response.json({error:'Плейлист не найден'},{status:404}):Response.json({id,playlist:sharedPlaylistPayload(p)})});
 const value=await client.load('http://localhost/?share='+id);value.tracks.pop();assert.equal((await client.load('http://localhost/?share='+id)).tracks.length,2);fail=true;await assert.rejects(client.load('http://localhost/?share='+id),e=>e.status===404&&!e.retryable);
});
