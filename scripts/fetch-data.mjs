import fs from 'node:fs/promises';
import {assertR1Archive,loadR2State,collectR2Submissions,saveR2State,compatibleR2Check,R2_ROUND,R2_PHASE} from './r2-submissions-collection.mjs';
const stats={};
try{
 await assertR1Archive();
 const config=JSON.parse(await fs.readFile('scripts/source-config.json','utf8')),state=await loadR2State();
 // Retain workflow inputs without enabling judging or R1 full audits.
 if(!['auto','incremental','full'].includes(process.env.COLLECTION_MODE||'auto'))throw Error('Unknown collection mode');
 let previous;try{previous=JSON.parse(await fs.readFile('previous-check.json','utf8'));}catch{}
 const result=await collectR2Submissions(config,state,{stats,onProgress:value=>console.log(JSON.stringify(value))});
 const publish=result.changed||(compatibleR2Check(state,previous)&&previous.publicationNeeded===true);
 if(result.changed)await saveR2State('.',result);
 await assertR1Archive();await loadR2State();
 const report={status:result.changed?'collected':'unchanged',roundId:R2_ROUND,phase:R2_PHASE,mode:'incremental',...stats,lastCheckedAt:result.snapshot.importedAt,dataExportedAt:result.changed?result.snapshot.importedAt:state.snapshot.importedAt,dataFingerprint:result.metadata.dataFingerprint,changed:result.changed,publish,publicationNeeded:publish,newRevisions:result.newRevisions,confirmedSubmissions:result.model.confirmedSubmissionCount,publication:publish?'pending validation, commit and Pages deployment':'skipped: no significant changes'};
 await fs.writeFile('collection-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 if(process.env.GITHUB_OUTPUT)await fs.appendFile(process.env.GITHUB_OUTPUT,`mode=incremental\nchanged=${result.changed}\npublish=${publish}\n`);
 if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,'## R2 submissions\n\n```json\n'+JSON.stringify(report,null,2)+'\n```\n');
}catch(error){
 const report={status:'failed',roundId:R2_ROUND,phase:R2_PHASE,...stats,error:error.message,publication:'not attempted'};
 await fs.writeFile('collection-report.json',JSON.stringify(report,null,2)+'\n');console.error(JSON.stringify(report));process.exitCode=1;
}
