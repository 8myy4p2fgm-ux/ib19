import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
export function shouldCollect({event,lastSuccessfulAt,now=Date.now()}) {
 if(event!=='schedule')return true;
 const last=Date.parse(lastSuccessfulAt),bucketStart=Math.floor(now/300000)*300000;
 // Delayed/queued runs use execution time, never the intended cron timestamp.
 return !Number.isFinite(last)||last<bucketStart||last>now;
}
if(import.meta.url===pathToFileURL(process.argv[1]||'').href){
 let metadata={};try{metadata=JSON.parse(await fs.readFile('data/metadata.json','utf8'));}catch{}
 let lastSuccessfulAt=metadata.lastSuccessfulAt;
 try{const report=JSON.parse(await fs.readFile('previous-check.json','utf8'));const {loadState}=await import('./collection-state.mjs');const {compatibleCheck}=await import('./publication-plan.mjs');if(compatibleCheck(await loadState(),report))lastSuccessfulAt=report.lastCheckedAt;}catch{}
 const run=shouldCollect({event:process.env.GITHUB_EVENT_NAME,lastSuccessfulAt});
 console.log(run?'Collect latest state.':'Skip: this five-minute bucket already has a successful collection.');
 if(process.env.GITHUB_OUTPUT)await fs.appendFile(process.env.GITHUB_OUTPUT,`run=${run}\n`);
}
