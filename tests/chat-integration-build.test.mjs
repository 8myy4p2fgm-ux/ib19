import {tmpdir} from 'node:os';
import test from 'node:test';import assert from 'node:assert/strict';import {readFile,writeFile,mkdir,cp,rm,mkdtemp,readdir} from 'node:fs/promises';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';import {checkPublicData} from '../scripts/check-public-data.mjs';import {SMILIES} from '../js/chat-smilies-catalog.js';
const hash=b=>createHash('sha256').update(b).digest('hex');
test('one build produces versioned site + chat; source nav setting is preserved across on/off builds without data edits',async()=>{
 await mkdir('.chat-integration-artifacts',{recursive:true});const config=await readFile('config/chat-ui.json'),snapshot=await readFile('data/rounds/r2-submissions.v1/snapshot.json');
 try{
 for(const [mode,args] of [['off',[]],['on',['--chat-nav']]]){
  await writeFile('config/chat-ui.json',JSON.stringify({enabled:mode==='on'}));
  execFileSync(process.execPath,['scripts/build.mjs',...args],{stdio:'pipe'});await rm('.chat-integration-artifacts/'+mode,{recursive:true,force:true});await cp('dist','.chat-integration-artifacts/'+mode,{recursive:true});
  const html=await readFile('dist/index.html','utf8'),chat=await readFile('dist/chat/index.html','utf8');assert(html.includes('name="tuz19-chat-enabled" content="'+(mode==='on')+'"'));assert(chat.includes('name="tuz19-chat-enabled" content="true"'));const siteVersion=html.match(/chat-nav\.([a-f0-9]{16})\.js/)[1];assert(chat.includes('chat-client.'+siteVersion+'.js'));assert(chat.includes('chat-nav.'+siteVersion+'.js'));assert(!chat.includes('src="./client.js"'));
  const compiled=await readFile('dist/js/chat-client.'+siteVersion+'.js','utf8');assert(compiled.includes('chat-public-presence.'+siteVersion+'.js'));assert(compiled.includes('chat-smilies.'+siteVersion+'.js'));assert.equal((await checkPublicData('dist')).forbiddenFields,0);assert.equal(hash(await readFile('dist/data/rounds/r2-submissions.v1/snapshot.json')),hash(snapshot));
 }
 }finally{await writeFile('config/chat-ui.json',config);}
 execFileSync(process.execPath,['scripts/build.mjs'],{stdio:'pipe'});assert((await readFile('dist/index.html','utf8')).includes('name="tuz19-chat-enabled" content="'+JSON.parse(config).enabled+'"'));assert.deepEqual(await readFile('config/chat-ui.json'),config);assert.deepEqual(await readFile('data/rounds/r2-submissions.v1/snapshot.json'),snapshot);
});
test('public boundary rejects backend, extra GIF, modified original GIF, orphan JS and private keys',async()=>{
 const tmp=await mkdtemp(tmpdir()+'/chat-integrated-public-');try{await cp('dist',tmp+'/dist',{recursive:true});for(const [file,content] of [['backend/worker.mjs','private'],['chat/smilies/custom.gif','GIF89a'],['js/orphan.js','alert(1)'],['chat/admin.key','private']]){await mkdir(tmp+'/dist/'+file.slice(0,file.lastIndexOf('/')),{recursive:true});await writeFile(tmp+'/dist/'+file,content);await assert.rejects(checkPublicData(tmp+'/dist'));await rm(tmp+'/dist/'+file);}
 const gif=tmp+'/dist/chat/smilies/'+SMILIES[0].file;await writeFile(gif,'changed');await assert.rejects(checkPublicData(tmp+'/dist'),/Smiley checksum mismatch/);
 }finally{await rm(tmp,{recursive:true,force:true});}
});
test('disabled configs retain MAINT and private API-only backend without activating deployment',async()=>{
 const backend=JSON.parse(await readFile('backend/chat/wrangler.production.jsonc.disabled','utf8')),gate=JSON.parse(await readFile('cloudflare/maintenance/wrangler.jsonc.disabled','utf8'));assert.equal(backend.workers_dev,false);assert.equal(backend.preview_urls,false);assert.deepEqual(backend.routes,[]);assert.equal(backend.vars.REQUIRE_GATEWAY_ACCESS,'true');assert.equal(backend.vars.CHAT_ENABLED,'false');assert.equal(gate.vars.CHAT_API_ENABLED,'false');assert.equal(gate.services[0].service,backend.name);assert(!JSON.stringify(backend).includes('secret_text'));
});
