const API='https://api.github.com';
export const INTERVAL=600000;
const bytes=s=>new TextEncoder().encode(s);
const base64url=a=>btoa(String.fromCharCode(...a)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
function der(tag,data){const n=data.length,hex=n.toString(16).padStart(n>255?4:2,'0'),length=n<128?[n]:[128+hex.length/2,...hex.match(/../g).map(x=>parseInt(x,16))];return new Uint8Array([tag,...length,...data]);}
export function privateKeyBytes(pem){
 const rsa=pem.includes('BEGIN RSA PRIVATE KEY'),raw=Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g,'').replace(/\s/g,'')),c=>c.charCodeAt(0));
 if(!rsa){if(!pem.includes('BEGIN PRIVATE KEY'))throw new Error('Expected an RSA PEM private key');return raw;}
 // GitHub downloads PKCS#1; Web Crypto imports PKCS#8. Wrap locally, never export it.
 return der(48,new Uint8Array([2,1,0,48,13,6,9,42,134,72,134,247,13,1,1,1,5,0,...der(4,raw)]));
}
export async function appJwt(issuer,pem,now=Date.now(),cryptoImpl=crypto){
 const at=Math.floor(now/1000),head=base64url(bytes(JSON.stringify({alg:'RS256',typ:'JWT'}))),body=base64url(bytes(JSON.stringify({iat:at-60,exp:at+540,iss:String(issuer)}))),value=head+'.'+body;
 const key=await cryptoImpl.subtle.importKey('pkcs8',privateKeyBytes(pem),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 return value+'.'+base64url(new Uint8Array(await cryptoImpl.subtle.sign('RSASSA-PKCS1-v1_5',key,bytes(value))));
}
export function workflowReady(text){
 const events=text.match(/^on:\n([\s\S]*?)(?=^\S)/m)?.[1]||'';
 const concurrency=text.match(/^concurrency:\n((?:[ \t]+[^\n]*\n)+)/m)?.[1]||'';
 return !/^  schedule:/m.test(events)&&/^  workflow_dispatch:/m.test(events)&&/^      source:\s*$/m.test(events)&&/^      clock_slot:\s*$/m.test(events)&&/^  group: ib19-publish\s*$/m.test(concurrency)&&/^  cancel-in-progress: false\s*$/m.test(concurrency);
}
export class GitHub {
 constructor(env,{fetchImpl=fetch,now=Date.now,cryptoImpl=crypto}={}){this.env=env;this.fetch=(...args)=>fetchImpl.call(globalThis,...args);this.now=now;this.crypto=cryptoImpl;}
 async request(path,{method='GET',token,raw=false,body}={}){
  const r=await this.fetch(API+path,{method,redirect:'manual',signal:AbortSignal.timeout(20000),headers:{Accept:raw?'application/vnd.github.raw+json':'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2026-03-10','User-Agent':'tuz19-cloudflare-clock',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  if(!r.ok){if(r.status===401&&token===this.cachedToken){this.cachedToken=null;this.cachedExpiry=0;}const error=new Error('GitHub HTTP '+r.status);error.httpStatus=r.status;error.requestId=r.headers.get('x-github-request-id');throw error;}
  return r.status===204?null:raw?await r.text():await r.json();
 }
 async accessToken(){
  if(this.cachedToken&&this.cachedExpiry>this.now()+60000)return this.cachedToken;
  if(!this.env.GH_APP_ID||!/^\d+$/.test(this.env.GH_INSTALLATION_ID||'')||!this.env.GH_PRIVATE_KEY)throw new Error('GitHub App secrets are not configured');
  const jwt=await appJwt(this.env.GH_APP_ID,this.env.GH_PRIVATE_KEY,this.now(),this.crypto);
  const result=await this.request('/app/installations/'+this.env.GH_INSTALLATION_ID+'/access_tokens',{method:'POST',token:jwt,body:{repositories:['ib19'],permissions:{actions:'write',contents:'read'}}});
  if(!result.token||!Number.isFinite(Date.parse(result.expires_at)))throw new Error('Invalid installation token response');
  this.cachedToken=result.token;this.cachedExpiry=Date.parse(result.expires_at);return result.token;
 }
 async inspect(){
  const token=await this.accessToken(),root='/repos/8myy4p2fgm-ux/ib19',file='update-data-scheduled.yml';
  const workflow=await this.request(root+'/actions/workflows/'+file,{token});
  const definition=await this.request(root+'/contents/.github/workflows/'+file+'?ref=main',{token,raw:true});
  const runs=await this.request(root+'/actions/runs?per_page=30',{token});
  return {token,workflow,ready:workflowReady(definition),runs:runs.workflow_runs||[]};
 }
 async dispatch(token,slot){
  // POST dispatch has no idempotency contract. Never retry an ambiguous result blindly.
  const result=await this.request('/repos/8myy4p2fgm-ux/ib19/actions/workflows/update-data-scheduled.yml/dispatches',{method:'POST',token,body:{ref:'main',inputs:{mode:'incremental',source:'cloudflare',clock_slot:String(slot)}}});
  return {runId:result?.workflow_run_id??null};
 }
}
export class Clock {
 constructor(storage,github,{now=Date.now,log=value=>console.log(JSON.stringify(value)),enabled=false,dryRun=true}={}){Object.assign(this,{storage,github,now,log,enabled,dryRun});}
 async save(record){await this.storage.put('slot:'+record.slot,record);this.log({component:'tuz19-clock',...record});return record;}
 async prune(){const records=await this.storage.list({prefix:'slot:',limit:1100}),cut=this.now()-7*86400000;const old=[...records].filter(([,r])=>r.slot<cut).map(([k])=>k);if(old.length)await this.storage.delete(old);}
 async tick(scheduledAt){
  const now=this.now(),slot=Math.floor(scheduledAt/INTERVAL)*INTERVAL,base={slot,scheduledAt,observedAt:new Date(now).toISOString()};
  if(!Number.isFinite(scheduledAt)||scheduledAt>now+60000||now-scheduledAt>15*60000)throw new Error('Invalid or stale cron tick');
  if(!this.enabled){this.log({component:'tuz19-clock',...base,status:'disabled'});return {...base,status:'disabled'};}
  await this.prune();
  const previous=await this.storage.get('slot:'+slot);
  if(previous){this.log({component:'tuz19-clock',...base,status:'duplicate',previousStatus:previous.status});return {...base,status:'duplicate'};}
  let posting=false;
  try{
   const info=await this.github.inspect();
   // Reconcile previously accepted/uncertain dispatches with real GitHub run records.
   const records=await this.storage.list({prefix:'slot:',limit:1100});
   for(const [key,r]of records){if(!['dispatching','dispatched','uncertain'].includes(r.status))continue;const run=info.runs.find(x=>x.display_title==='Cloudflare '+r.slot&&x.event==='workflow_dispatch');if(run&&r.runStatus!==run.status){const updated={...r,runId:run.id,runStatus:run.status,conclusion:run.conclusion,checkedAt:base.observedAt,status:run.status==='completed'?'completed':'dispatched'};await this.storage.put(key,updated);this.log({component:'tuz19-clock',...updated});}}
   if(this.dryRun){this.log({component:'tuz19-clock',...base,status:'dry_run',ready:info.ready,workflowState:info.workflow.state});return {...base,status:'dry_run',ready:info.ready};}
   if(info.workflow.state!=='active'||!info.ready)return await this.save({...base,status:'blocked_configuration'});
   const active=info.runs.find(r=>['.github/workflows/update-data-scheduled.yml','.github/workflows/deploy.yml'].includes(r.path)&&r.status!=='completed');
   if(active)return await this.save({...base,status:'skipped_busy',activeRunId:active.id});
   const same=info.runs.find(r=>r.display_title==='Cloudflare '+slot&&r.event==='workflow_dispatch');
   if(same)return await this.save({...base,status:'duplicate_github',runId:same.id});
   // Persist intent before the side effect: a crash cannot repeat the same POST.
   await this.storage.put('slot:'+slot,{...base,status:'dispatching'});posting=true;
   const result=await this.github.dispatch(info.token,slot);
   return await this.save({...base,status:'dispatched',...result});
  }catch(error){
   const record={...base,status:posting?'uncertain':'error',error:posting?'Dispatch outcome requires reconciliation':'GitHub preflight failed',httpStatus:error.httpStatus??null,requestId:error.requestId??null};
   await this.save(record);throw new Error(record.error+(record.httpStatus?' (HTTP '+record.httpStatus+')':''));
  }
 }
}
