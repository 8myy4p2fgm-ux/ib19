import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import http from 'node:http';import {spawn} from 'node:child_process';import {createHash} from 'node:crypto';
import {R2_DIRECTORY,R2_FILES,loadR2State} from '../scripts/r2-submissions-collection.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
test('existing update CLI: R2 no-op, pending deploy, new submission, track change, failure and immutable R1',async()=>{
 const root=process.cwd(),temp=await fs.mkdtemp(path.join(os.tmpdir(),'tuz19-r2-cli-'));let server;
 try{
  const lock=JSON.parse(await fs.readFile('scripts/r1-archive-lock.json','utf8'));
  for(const file of ['scripts/r1-archive-lock.json',...Object.keys(lock.files)]){await fs.mkdir(path.dirname(path.join(temp,file)),{recursive:true});await fs.copyFile(file,path.join(temp,file));}
  await fs.cp(R2_DIRECTORY,path.join(temp,R2_DIRECTORY),{recursive:true});
  const seed=await loadR2State(),full=JSON.parse(seed.snapshot.raw.full),live=JSON.parse(seed.snapshot.raw.live);let failure=false,calls=[];
  server=http.createServer((req,res)=>{calls.push(req.url);res.setHeader('Content-Type','application/json');if(failure){res.writeHead(503);res.end('{}');return;}if(req.url.endsWith('/full'))res.end(JSON.stringify(full));else if(req.url.endsWith('/live'))res.end(JSON.stringify(live));else{res.writeHead(404);res.end('{}');}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const config=JSON.parse(await fs.readFile('scripts/source-config.json','utf8'));Object.assign(config,{apiBase:'http://127.0.0.1:'+server.address().port,requestIntervalMs:0,retries:0});await fs.writeFile(path.join(temp,'scripts/source-config.json'),JSON.stringify(config));
  const run=()=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,[path.join(root,'scripts/fetch-data.mjs')],{cwd:temp,env:{...process.env,COLLECTION_MODE:'incremental',GITHUB_OUTPUT:path.join(temp,'outputs'),GITHUB_STEP_SUMMARY:''}});let error='';child.stderr.on('data',d=>error+=d);child.stdout.resume();child.once('error',reject);child.once('close',code=>resolve({code,error}));});
  const digests=async files=>Promise.all(files.map(async file=>hash(await fs.readFile(path.join(temp,file)))));
  const r2Files=R2_FILES.map(f=>R2_DIRECTORY+'/'+f),initial=await digests(r2Files);
  assert.equal((await run()).code,0);let report=JSON.parse(await fs.readFile(path.join(temp,'collection-report.json')));assert.equal(report.status,'unchanged');assert.equal(report.publish,false);assert.deepEqual(await digests(r2Files),initial);assert.equal(calls.length,2);
  await fs.writeFile(path.join(temp,'previous-check.json'),JSON.stringify({...report,publicationNeeded:true}));assert.equal((await run()).code,0);report=JSON.parse(await fs.readFile(path.join(temp,'collection-report.json')));assert.equal(report.publish,true);assert.deepEqual(await digests(r2Files),initial);await fs.rm(path.join(temp,'previous-check.json'));
  const entry={...full.entries[0],userId:'11111111-1111-4111-8111-111111111111',trackId:'22222222-2222-4222-8222-222222222222',submittedAt:null};full.entries.push(entry);live.progress.push({...live.progress[0],userId:entry.userId});
  assert.equal((await run()).code,0);let state=await loadR2State(temp);assert.equal(state.model.confirmedSubmissionCount,seed.model.confirmedSubmissionCount+1);assert.equal(state.model.entries.at(-1).submittedAt,null);assert.equal(state.history.revisions.length,1);
  const originalTrack=entry.trackId;full.entries.at(-1).trackId='33333333-3333-4333-8333-333333333333';assert.equal((await run()).code,0);state=await loadR2State(temp);assert.equal(state.history.revisions.length,2);assert.equal(state.history.revisions.at(-1).before.trackId,originalTrack);
  assert(calls.every(p=>p===`/rounds/${config.roundId}/full`||p===`/rounds/${config.roundId}/live`));
  const beforeFailure=await digests(r2Files);failure=true;assert.equal((await run()).code,1);assert.deepEqual(await digests(r2Files),beforeFailure);
  failure=false;full.judgingStartedAt='2026-11-20T00:00:00.000Z';assert.equal((await run()).code,1);assert.deepEqual(await digests(r2Files),beforeFailure);
  for(const [file,digest]of Object.entries(lock.files))assert.equal(hash(await fs.readFile(path.join(temp,file))),digest,file);
  await fs.appendFile(path.join(temp,'data/history.json'),' ');const count=calls.length;assert.equal((await run()).code,1);assert.equal(calls.length,count,'R1 mutation blocks before upstream requests');
 }finally{if(server)await new Promise(r=>server.close(r));await fs.rm(temp,{recursive:true,force:true});}
});
