import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm,readFile} from 'node:fs/promises';import {buildPreview} from '../backend/chat/build-preview.mjs';import {Miniflare} from '../backend/chat/node_modules/miniflare/dist/src/index.js';
test('actual workerd preview artifact: ASSETS, CSP, Origin, socket, moderation and emergency switch',async()=>{
 const dir=await mkdtemp('/private/tmp/chat06-artifact-');let mf;const sockets=[];try{
  const artifact=await buildPreview({outDir:dir+'/pack',origin:'https://chat-preview.example.test'}),c=JSON.parse(await readFile(artifact.configPath,'utf8'));
  mf=new Miniflare({modules:true,modulesRoot:dir+'/pack',scriptPath:dir+'/pack/'+c.main,compatibilityDate:c.compatibility_date,assets:{directory:artifact.publicDir,binding:'ASSETS',routerConfig:{invoke_user_worker_ahead_of_assets:true,has_user_worker:true}},durableObjects:{CHAT_ROOM:{className:'ChatRoom',useSQLite:true}},bindings:{...c.vars,ADMIN_TOKEN:'local-preview-test-admin-token-32',NETWORK_SECRET:'local-preview-test-network'}});
  const origin=c.vars.ALLOWED_ORIGIN,headers={Origin:origin,'CF-Connecting-IP':'192.0.2.1'};
  const page=await mf.dispatchFetch(origin+'/chat/');assert.equal(page.status,200);assert(page.headers.get('Content-Security-Policy').includes('wss://chat-preview.example.test'));assert((await page.text()).includes('smiley-toggle'));
  assert.equal((await mf.dispatchFetch(origin+'/')).status,200);assert.equal((await mf.dispatchFetch(origin+'/backend/chat/worker.mjs')).status,404);assert.equal((await mf.dispatchFetch(origin+'/api/chat/unknown',{headers})).status,404);
  assert.equal((await mf.dispatchFetch(origin+'/api/chat/socket',{headers:{...headers,Origin:'https://wrong.example.test',Upgrade:'websocket'}})).status,403);
  const response=await mf.dispatchFetch(origin+'/api/chat/socket',{headers:{...headers,Upgrade:'websocket'}});assert.equal(response.status,101);const ws=response.webSocket;sockets.push(ws);const messages=[];ws.addEventListener('message',e=>messages.push(JSON.parse(e.data)));ws.accept();ws.send(JSON.stringify({type:'join',nick:'Проверка'}));
  for(let i=0;i<100&&!messages.some(d=>d.type==='joined');i++)await new Promise(r=>setTimeout(r,10));assert(messages.some(d=>d.type==='joined'));
  const admin=body=>mf.dispatchFetch(origin+'/api/chat/admin',{method:'POST',headers:{...headers,Authorization:'Bearer local-preview-test-admin-token-32'},body:JSON.stringify(body)});
  assert.equal((await admin({action:'enabled',value:false})).status,200);assert.equal((await mf.dispatchFetch(origin+'/api/chat/status',{headers})).status,503);assert.equal((await mf.dispatchFetch(origin+'/chat/')).status,200);
 }finally{for(const ws of sockets)try{ws.close();}catch{}await mf?.dispose();await rm(dir,{recursive:true,force:true});}
});
