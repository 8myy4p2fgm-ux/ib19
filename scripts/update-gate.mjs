import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
export function shouldCollect({event,source='manual',clockSlot='',lastSuccessfulAt,now=Date.now()}) {
 if(event!=='schedule'&&!(event==='workflow_dispatch'&&source==='cloudflare'))return true;
 if(source==='cloudflare'&&(!/^\d{13}$/.test(clockSlot)||Number(clockSlot)%600000!==0||Number(clockSlot)>now+60000))throw new Error('Invalid Cloudflare clock slot');
 const last=Date.parse(lastSuccessfulAt),bucketStart=Math.floor(now/600000)*600000;
 // Delayed/queued runs use execution time, never the intended cron timestamp.
 return !Number.isFinite(last)||last<bucketStart||last>now;
}
if(import.meta.url===pathToFileURL(process.argv[1]||'').href){
 let metadata={};try{metadata=JSON.parse(await fs.readFile('data/rounds/r2-submissions.v1/metadata.json','utf8'));}catch{}
 let lastSuccessfulAt=metadata.lastSuccessfulAt;
 try{const report=JSON.parse(await fs.readFile('previous-check.json','utf8'));const {loadR2State,compatibleR2Check}=await import('./r2-submissions-collection.mjs');if(compatibleR2Check(await loadR2State(),report))lastSuccessfulAt=report.lastCheckedAt;}catch{}
 const run=shouldCollect({event:process.env.GITHUB_EVENT_NAME,source:process.env.UPDATE_SOURCE,clockSlot:process.env.CLOCK_SLOT,lastSuccessfulAt});
 console.log(run?'Collect latest state.':'Skip: this ten-minute bucket already has a successful collection.');
 if(process.env.GITHUB_OUTPUT)await fs.appendFile(process.env.GITHUB_OUTPUT,`run=${run}\n`);
}
