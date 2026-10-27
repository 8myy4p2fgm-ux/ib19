// Explicit local review command; builds opt-in UI and starts only loopback fixtures.
import {execFileSync} from 'node:child_process';import {rmSync} from 'node:fs';import {mkdir,writeFile,rm} from 'node:fs/promises';import {startIntegratedChat} from './integration-local.mjs';
execFileSync(process.execPath,['scripts/build.mjs','--chat-nav'],{stdio:'inherit'});
const app=await startIntegratedChat({port:Number(process.env.CHAT_LOCAL_PORT||8932),assetDir:process.cwd()+'/dist'});
await mkdir('.chat-ws-local',{recursive:true,mode:0o700});
const ownerFile='.chat-ws-local/integration-owner.json',operatorFile='.chat-ws-local/integration-operator.json',created=[];
process.once('exit',()=>{for(const file of created)rmSync(file,{force:true});});
await writeFile(ownerFile,JSON.stringify({origin:app.url,password:app.secrets.owner}),{mode:0o600,flag:'wx'});created.push(ownerFile);
const r=await fetch(app.url+'/admin-login',{method:'POST',redirect:'manual',headers:{Origin:app.url,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({password:app.secrets.owner})});
if(r.status!==303){await app.close();throw Error('Local owner fixture login failed');}
await writeFile(operatorFile,JSON.stringify({origin:app.url,cookie:r.headers.get('set-cookie').split(';')[0],adminToken:app.secrets.admin}),{mode:0o600,flag:'wx'});created.push(operatorFile);
console.log('Local integrated chat: '+app.url+'/admin-login');console.log('Fixture password: '+ownerFile+' (local-only, 0600; do not copy into reports)');console.log('Operator file: '+operatorFile+' (local-only, 0600)');
let closing=false;async function close(){if(closing)return;closing=true;await Promise.all(created.map(file=>rm(file,{force:true})));await app.close();}
process.once('SIGINT',()=>close());process.once('SIGTERM',()=>close());
