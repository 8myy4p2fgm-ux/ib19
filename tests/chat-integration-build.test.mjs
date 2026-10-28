import {tmpdir} from 'node:os';
import test from 'node:test';import assert from 'node:assert/strict';import {readFile,writeFile,mkdir,cp,rm,mkdtemp,readdir} from 'node:fs/promises';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';import {checkPublicData} from '../scripts/check-public-data.mjs';import {SMILIES} from '../js/chat-smilies-catalog.js';
const hash=b=>createHash('sha256').update(b).digest('hex');
test('one build produces versioned site + chat; source nav setting is preserved across on/off builds without data edits',async()=>{
 const dir=await mkdtemp(tmpdir()+'/inc02-chat-build-'),config=await readFile('config/chat-ui.json'),snapshot=await readFile('data/rounds/r2-submissions.v1/snapshot.json');
 try{
 for(const name of ['js','scripts','css','horo','chat','config','public-data','public-compat'])await cp(name,dir+'/'+name,{recursive:true});await cp('index.html',dir+'/index.html');await cp('package.json',dir+'/package.json');await mkdir(dir+'/data/rounds/r2-submissions.v1',{recursive:true});await writeFile(dir+'/data/rounds/r2-submissions.v1/snapshot.json',snapshot);
 for(const [mode,args]of [['off',[]],['on',['--chat-nav']]]){
  await writeFile(dir+'/config/chat-ui.json',JSON.stringify({enabled:mode==='on'}));
  execFileSync(process.execPath,['scripts/prepare-js-graphs.mjs',...args],{cwd:dir,stdio:'pipe'});execFileSync(process.execPath,['scripts/build.mjs',...args],{cwd:dir,stdio:'pipe'});
  const html=await readFile(dir+'/dist/index.html','utf8'),chat=await readFile(dir+'/dist/chat/index.html','utf8');assert(html.includes('name="tuz19-chat-enabled" content="'+(mode==='on')+'"'));assert(chat.includes('name="tuz19-chat-enabled" content="true"'));const tag=html.match(/chat-nav\.([a-f0-9]{16})\.js/)[1];assert(chat.includes('chat-client.'+tag+'.js'));assert(chat.includes('chat-nav.'+tag+'.js'));assert(!chat.includes('src="./client.js"'));
  const compiled=await readFile(dir+'/dist/js/chat-client.'+tag+'.js','utf8');assert(compiled.includes('chat-public-presence.'+tag+'.js'));assert(compiled.includes('chat-smilies.'+tag+'.js'));const {pathToFileURL}=await import('node:url');assert.equal((await checkPublicData(dir+'/dist',{graphRoot:pathToFileURL(dir+'/public-compat/graphs/')})).forbiddenFields,0);assert.equal(hash(await readFile(dir+'/dist/data/rounds/r2-submissions.v1/snapshot.json')),hash(snapshot));
 }
 assert.deepEqual(await readFile('config/chat-ui.json'),config);assert.deepEqual(await readFile('data/rounds/r2-submissions.v1/snapshot.json'),snapshot);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('public boundary rejects backend, extra GIF, modified original GIF, orphan JS and private keys',async()=>{
 const tmp=await mkdtemp(tmpdir()+'/chat-integrated-public-');try{await cp('dist',tmp+'/dist',{recursive:true});for(const [file,content] of [['backend/worker.mjs','private'],['chat/smilies/custom.gif','GIF89a'],['js/orphan.js','alert(1)'],['chat/admin.key','private']]){await mkdir(tmp+'/dist/'+file.slice(0,file.lastIndexOf('/')),{recursive:true});await writeFile(tmp+'/dist/'+file,content);await assert.rejects(checkPublicData(tmp+'/dist'));await rm(tmp+'/dist/'+file);}
 const gif=tmp+'/dist/chat/smilies/'+SMILIES[0].file;await writeFile(gif,'changed');await assert.rejects(checkPublicData(tmp+'/dist'),/Smiley checksum mismatch/);
 }finally{await rm(tmp,{recursive:true,force:true});}
});
test('disabled configs retain MAINT and private API-only backend without activating deployment',async()=>{
 const backend=JSON.parse(await readFile('backend/chat/wrangler.production.jsonc.disabled','utf8')),gate=JSON.parse(await readFile('cloudflare/maintenance/wrangler.jsonc.disabled','utf8'));assert.equal(backend.workers_dev,false);assert.equal(backend.preview_urls,false);assert.deepEqual(backend.routes,[]);assert.equal(backend.vars.REQUIRE_GATEWAY_ACCESS,'true');assert.equal(backend.vars.CHAT_ENABLED,'false');assert.equal(gate.vars.CHAT_API_ENABLED,'false');assert.equal(gate.services[0].service,backend.name);assert(!JSON.stringify(backend).includes('secret_text'));
});
