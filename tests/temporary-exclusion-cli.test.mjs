import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {stateFiles} from '../scripts/collection-state.mjs';
const target='52385ac3-2e09-4df9-a04c-ca4348cf42d6',other='0460e777-7403-40dd-8176-fd168c93a530';
test('real update CLI: six-grade quarantine publishes a valid local candidate; no-op is stable; another six-grade UUID remains a blocking error',async()=>{
 const root=process.cwd(),temp=await fs.mkdtemp(path.join(os.tmpdir(),'ib19-quarantine-cli-'));let server;
 try{
  await fs.mkdir(path.join(temp,'data'));await fs.mkdir(path.join(temp,'scripts'));
  for(const file of [...stateFiles,'forum.csv'])await fs.copyFile(path.join(root,'data',file),path.join(temp,'data',file));
  const main=JSON.parse(await fs.readFile(path.join(temp,'data/19ib_all_judges_REPAIRED.json'))),metadata=JSON.parse(await fs.readFile(path.join(temp,'data/metadata.json'))),fixture=JSON.parse(await fs.readFile('tests/fixtures/excluded-participant-scores.json'));
  // Establish the pre-incident fixture regardless of whether the saved production
  // snapshot has already moved this UUID into raw quarantine.
  const directory=JSON.parse(await fs.readFile(path.join(temp,'data/forum_judges_export.json')));
  // This historical quarantine fixture must not depend on today's corrected roster.
  const csvPath=path.join(temp,'data/forum.csv');
  await fs.writeFile(csvPath,(await fs.readFile(csvPath,'utf8')).replace('OG,Zippy kid,'+other,'OG,Zippy kid,'+target));
  directory.members=directory.members.filter(p=>p.userId!==other);
  if(![...directory.members,...(directory.quarantinedMembers||[])].some(p=>p.userId===target))directory.members.push({userId:target,forum_name:'Zippy kid',group:'OG',scores:[]});
  for(const dataset of [main,directory]){
   dataset.members.push(...(dataset.quarantinedMembers||[]));delete dataset.quarantinedMembers;
   const person=dataset.members.find(p=>p.userId===target);
   person.scores=structuredClone(fixture.scores.filter(s=>s.judgeName!=='Игорь Кедо'));
   if(person.scoredCount!==undefined)person.scoredCount=person.scores.length;
  }
  main.totalParticipants=main.members.length;
  await fs.writeFile(path.join(temp,'data/19ib_all_judges_REPAIRED.json'),JSON.stringify(main));
  await fs.writeFile(path.join(temp,'data/forum_judges_export.json'),JSON.stringify(directory));
  const full={...metadata.source.round,id:metadata.source.roundId,entries:main.members.map(p=>({userId:p.userId,scoredCount:p.scores.length,score:p.scores.length?p.scores.reduce((n,s)=>n+s.score,0):null}))};
  Object.assign(full.entries.find(p=>p.userId===target),{scoredCount:6,score:fixture.scores.reduce((n,s)=>n+s.score,0)});
  let bad=false;
  server=http.createServer((req,res)=>{
   res.setHeader('Content-Type','application/json');const snapshot=structuredClone(full);
   if(bad)Object.assign(snapshot.entries.find(p=>p.userId===other),{scoredCount:6,score:fixture.scores.reduce((n,s)=>n+s.score,0)});
   if(req.url==='/judges')res.end(JSON.stringify(main.judges));
   else if(req.url.endsWith('/full'))res.end(JSON.stringify(snapshot));
   else if(req.url.endsWith('/live'))res.end(JSON.stringify({progress:snapshot.entries}));
   else if(req.url.endsWith('/'+target+'/scores')||bad&&req.url.endsWith('/'+other+'/scores'))res.end(JSON.stringify(fixture));
   else{res.writeHead(404);res.end('{}');}
  });await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const config=JSON.parse(await fs.readFile('scripts/source-config.json'));Object.assign(config,{apiBase:'http://127.0.0.1:'+server.address().port,requestIntervalMs:0});await fs.writeFile(path.join(temp,'scripts/source-config.json'),JSON.stringify(config));
  const run=()=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,[path.join(root,'scripts/fetch-data.mjs')],{cwd:temp,env:{...process.env,COLLECTION_MODE:'incremental',GITHUB_OUTPUT:'',GITHUB_STEP_SUMMARY:''}});let out='',err='';child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err+=d);child.on('error',reject);child.on('close',code=>resolve({code,out,err}));});
  const digest=async()=>Promise.all(stateFiles.map(async file=>createHash('sha256').update(await fs.readFile(path.join(temp,'data',file))).digest('hex')));
  const first=await run();assert.equal(first.code,0,first.err);assert.match(first.out,/temporary-exclusion/);assert.match(first.out,new RegExp(target));
  const selected=JSON.parse(await fs.readFile(path.join(temp,'data/19ib_all_judges_REPAIRED.json'))),forum=JSON.parse(await fs.readFile(path.join(temp,'data/forum_judges_export.json'))),report=JSON.parse(await fs.readFile(path.join(temp,'collection-report.json'))),history=JSON.parse(await fs.readFile(path.join(temp,'data/history.json')));
  assert.equal(selected.members.length,main.members.length-1);assert.equal(selected.totalParticipants,selected.members.length);assert(!selected.members.some(p=>p.userId===target));assert.equal(selected.quarantinedMembers[0].userId,target);assert.deepEqual(selected.quarantinedMembers[0].scores,fixture.scores);
  assert(!forum.members.some(p=>p.userId===target));assert.deepEqual(forum.quarantinedMembers[0].scores,fixture.scores);
  for(const p of main.members.filter(p=>p.userId!==target))assert.deepEqual(selected.members.find(x=>x.userId===p.userId),p);
  assert(selected.members.some(p=>p.userId===other));assert.equal(report.status,'collected');assert.equal(report.counts.participants,main.members.length-1);assert.equal(report.temporaryExclusions[0].userId,target);assert.equal(history.snapshots.at(-1).scores,report.counts.scores);
  const before=await digest(),second=await run();assert.equal(second.code,0,second.err);assert.deepEqual(await digest(),before);assert.equal(JSON.parse(await fs.readFile(path.join(temp,'collection-report.json'))).status,'unchanged');
  bad=true;const failed=await run();assert.equal(failed.code,1);assert.match(failed.err,new RegExp('больше пяти оценок '+other));assert.deepEqual(await digest(),before,'an unrelated invalid UUID must not replace any validated file');
 }finally{if(server)await new Promise(r=>server.close(r));await fs.rm(temp,{recursive:true,force:true});}
});
