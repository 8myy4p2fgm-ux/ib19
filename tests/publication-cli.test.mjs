import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import http from 'node:http';import {spawn} from 'node:child_process';import {createHash} from 'node:crypto';
import {stateFiles} from '../scripts/collection-state.mjs';
test('CLI no-op leaves all four files byte-identical; pending deployment retries without commit; real change writes coherent state',async()=>{
 const root=process.cwd(),temp=await fs.mkdtemp(path.join(os.tmpdir(),'ib19-noop-'));let server;
 try{
  await fs.mkdir(path.join(temp,'data'));await fs.mkdir(path.join(temp,'scripts'));
  for(const f of [...stateFiles,'forum.csv'])await fs.copyFile(path.join(root,'data',f),path.join(temp,'data',f));
  const metadata=JSON.parse(await fs.readFile(path.join(temp,'data/metadata.json'))),main=JSON.parse(await fs.readFile(path.join(temp,'data/19ib_all_judges_REPAIRED.json')));
  const full={...metadata.source.round,id:metadata.source.roundId,entries:[...main.members,...(main.quarantinedMembers||[])].map(p=>({userId:p.userId,scoredCount:p.scores.length,score:p.scores.length?p.scores.reduce((n,s)=>n+s.score,0):null}))};let changed=false,calls=[];
  const target=main.members.find(p=>p.scores.some(s=>s.score>1));const details=structuredClone(target.scores);details.find(s=>s.score>1).score--;
  server=http.createServer((req,res)=>{calls.push(req.url);res.setHeader('Content-Type','application/json');const snapshot=structuredClone(full);if(changed)snapshot.entries.find(p=>p.userId===target.userId).score--;
   if(req.url==='/judges')res.end(JSON.stringify(main.judges));else if(req.url.endsWith('/full'))res.end(JSON.stringify(snapshot));else if(req.url.endsWith('/live'))res.end(JSON.stringify({progress:snapshot.entries}));else if(req.url.endsWith('/'+target.userId+'/scores'))res.end(JSON.stringify({scores:details}));else {res.writeHead(404);res.end('{}');}
  });await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const config=JSON.parse(await fs.readFile(path.join(root,'scripts/source-config.json')));Object.assign(config,{apiBase:'http://127.0.0.1:'+server.address().port,requestIntervalMs:0});await fs.writeFile(path.join(temp,'scripts/source-config.json'),JSON.stringify(config));
  // Source identity must match fixture endpoint so the comparison isolates content.
  metadata.source.apiBase=config.apiBase;await fs.writeFile(path.join(temp,'data/metadata.json'),JSON.stringify(metadata));
  const digest=async()=>Promise.all(stateFiles.map(async f=>createHash('sha256').update(await fs.readFile(path.join(temp,'data',f))).digest('hex')));
  const run=()=>new Promise((resolve,reject)=>{const p=spawn(process.execPath,[path.join(root,'scripts/fetch-data.mjs')],{cwd:temp,env:{...process.env,COLLECTION_MODE:'incremental',GITHUB_OUTPUT:path.join(temp,'outputs'),GITHUB_STEP_SUMMARY:path.join(temp,'summary')}});let errors='';p.stderr.on('data',d=>errors+=d);p.stdout.resume();p.on('error',reject);p.on('close',code=>code?reject(new Error(errors)):resolve());});
  // Establish a coherent baseline even when the editable forum roster has changed since the saved snapshot.
  await run();let report=JSON.parse(await fs.readFile(path.join(temp,'collection-report.json')));assert.ok(['collected','unchanged'].includes(report.status));
  const before=await digest();await run();report=JSON.parse(await fs.readFile(path.join(temp,'collection-report.json')));assert.equal(report.status,'unchanged');assert.equal(report.publish,false);assert.equal(report.newRevisions,0);assert.equal(report.httpRequests,3);assert.deepEqual(await digest(),before);assert.ok(Date.parse(report.lastCheckedAt)>Date.parse(report.dataExportedAt));
  await fs.writeFile(path.join(temp,'previous-check.json'),JSON.stringify({...report,publicationNeeded:true}));await run();report=JSON.parse(await fs.readFile(path.join(temp,'collection-report.json')));assert.equal(report.status,'unchanged');assert.equal(report.publish,true);assert.deepEqual(await digest(),before);
  changed=true;await run();report=JSON.parse(await fs.readFile(path.join(temp,'collection-report.json')));assert.equal(report.status,'collected');assert.equal(report.publish,true);assert.equal(report.newRevisions,1);assert.equal(report.httpRequests,4);assert.notDeepEqual(await digest(),before);assert.equal(calls.length,13);
 }finally{if(server)await new Promise(r=>server.close(r));await fs.rm(temp,{recursive:true,force:true});}
});
