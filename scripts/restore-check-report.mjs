import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {execFileSync} from 'node:child_process';import {pathToFileURL} from 'node:url';
import {loadState} from './collection-state.mjs';import {compatibleCheck} from './publication-plan.mjs';
export async function restoreCheck(state,{request,unpack,now=Date.now()}={}){
 const artifacts=await request('/repos/'+process.env.GITHUB_REPOSITORY+'/actions/artifacts?per_page=100');
 const candidates=(artifacts.artifacts||[]).filter(a=>!a.expired&&/^collection-report-\d+$/.test(a.name)).sort((a,b)=>b.id-a.id).slice(0,20);
 for(const artifact of candidates)try{const report=await unpack(artifact);if(compatibleCheck(state,report,now))return report;}catch{}
 return null;
}
if(import.meta.url===pathToFileURL(process.argv[1]||'').href){
 let tmp;
 try{
  const state=await loadState();tmp=await fs.mkdtemp(path.join(os.tmpdir(),'ib19-check-'));
  const request=async suffix=>{const r=await fetch('https://api.github.com'+suffix,{headers:{Authorization:'Bearer '+process.env.GH_TOKEN,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error('GitHub artifact HTTP '+r.status);return r.json();};
  const unpack=async artifact=>{const r=await fetch('https://api.github.com/repos/'+process.env.GITHUB_REPOSITORY+'/actions/artifacts/'+artifact.id+'/zip',{headers:{Authorization:'Bearer '+process.env.GH_TOKEN},signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error('Artifact unavailable');const file=path.join(tmp,'report.zip');await fs.writeFile(file,Buffer.from(await r.arrayBuffer()));return JSON.parse(execFileSync('unzip',['-p',file,'collection-report.json'],{encoding:'utf8',maxBuffer:1024*1024}));};
  const report=await restoreCheck(state,{request,unpack});if(report){await fs.writeFile('previous-check.json',JSON.stringify(report));console.log('Restored successful API check: '+report.lastCheckedAt);}else console.log('No matching check artifact; use committed state timestamps.');
 }catch(error){console.log('Check artifact unavailable; collect safely from Git: '+error.message);}finally{if(tmp)await fs.rm(tmp,{recursive:true,force:true});}
}
