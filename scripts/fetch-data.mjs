import fs from 'node:fs/promises';
import path from 'node:path';
import {collect} from './collector.mjs';
import {validateData} from './validate-data.mjs';
import {updateHistory} from './update-history.mjs';
import {parseForumCSV,applyForumDirectory} from './forum-directory.mjs';
import {publicationChanged,stateFingerprint,compatibleCheck} from './publication-plan.mjs';
import {loadState,collectionMode} from './collection-state.mjs';
const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const stats={};
try {
 const config=await read('scripts/source-config.json'),state=await loadState();
 const {main:old,forum,history,metadata}=state;
 let previousCheck;try{previousCheck=await read('previous-check.json');}catch{}
 if(!compatibleCheck(state,previousCheck))previousCheck=null;
 const plan=collectionMode({...metadata,collection:{...metadata.collection,...(previousCheck?{lastFullAuditAt:previousCheck.lastFullAuditAt}:{})}},{requested:process.env.COLLECTION_MODE||'auto'});
 if(state.recoveredFrom)console.log(JSON.stringify({stage:'recovery',revision:state.recoveredFrom}));
 const directory=applyForumDirectory(forum,parseForumCSV(await fs.readFile('data/forum.csv','utf8')));
 const batch=await collect({...config,mode:plan.mode,maxDurationMs:plan.mode==='full'?config.fullMaxDurationMs:config.maxDurationMs},old,directory,{stats,onProgress:value=>console.log(JSON.stringify(value))});
 const counts=validateData(batch.main,batch.forum),observedAt=batch.main.exportedAt;
 const source={apiBase:config.apiBase,roundId:config.roundId,absentIds:batch.absent,round:batch.sourceRound};
 const changed=publicationChanged(state,batch,counts,source);
 const publish=changed||previousCheck?.publicationNeeded===true;
 const nextHistory=changed?updateHistory(old,batch.main,batch.forum,history,observedAt,{previousForum:forum}):history;
 if(Buffer.byteLength(JSON.stringify(nextHistory,null,2))>config.maxHistoryBytes)throw new Error('History exceeded limit; archive reviewed history before continuing');
 const collection={...stats,lastFullAuditAt:plan.mode==='full'?observedAt:plan.lastFullAuditAt,...(state.recoveredFrom?{recoveredFrom:state.recoveredFrom}:{})};
 const files={'19ib_all_judges_REPAIRED.json':batch.main,'forum_judges_export.json':batch.forum,'history.json':nextHistory,'metadata.json':{version:1,lastSuccessfulAt:observedAt,exportedAt:observedAt,runId:observedAt,forumExportedAt:batch.forum.exportedAt,selectionVersion:nextHistory.snapshots.at(-1).selectionVersion,directory:batch.forum.directory,counts,collection,source}};
 const finalState=changed?{main:files['19ib_all_judges_REPAIRED.json'],forum:files['forum_judges_export.json'],history:nextHistory,metadata:files['metadata.json']}:state;
 const report={status:changed?'collected':'unchanged',...collection,lastCheckedAt:observedAt,dataExportedAt:finalState.main.exportedAt,dataFingerprint:stateFingerprint(finalState),publish,publicationNeeded:publish,counts,retainedAbsent:batch.absent.length,newRevisions:nextHistory.revisions.length-history.revisions.length,publication:publish?'pending validation, commit and Pages deployment':'skipped: no significant changes'};
 // No working dataset is touched until every source and history validation passes.
 // Runner-local replacement is not a filesystem transaction: only a successful
 // workflow may commit the complete dataset or deploy it; failed runners are discarded.
 if(changed){
 const stage=path.join('data','.staging');await fs.mkdir(stage,{recursive:true});
 for(const [name,value]of Object.entries(files))await fs.writeFile(path.join(stage,name),JSON.stringify(value,null,2)+'\n');
 for(const name of Object.keys(files))await fs.rename(path.join(stage,name),path.join('data',name));await fs.rmdir(stage);
 }
 await fs.writeFile('collection-report.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
 if(process.env.GITHUB_OUTPUT)await fs.appendFile(process.env.GITHUB_OUTPUT,`mode=${plan.mode}\nchanged=${changed}\npublish=${publish}\n`);
 if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,'## Collection\n\n```json\n'+JSON.stringify(report,null,2)+'\n```\n');
}catch(error){
 const report={status:'failed',...stats,error:error.message,publication:'not attempted'};
 await fs.writeFile('collection-report.json',JSON.stringify(report,null,2)+'\n');console.error(JSON.stringify(report));process.exitCode=1;
}
