import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL,fileURLToPath} from 'node:url';
// Offline verifier. Default mode is read-only; --json emits the reproducible comparison.
const repo=fileURLToPath(new URL('../../../',import.meta.url)).replace(/\/$/,''),root=fileURLToPath(new URL('./',import.meta.url)).replace(/\/$/,'');
const manifest=JSON.parse(fs.readFileSync(root+'/manifest.json','utf8'));
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const [p,hash]of Object.entries(manifest.baseline.sha256))assert.equal(sha(repo+'/'+p),hash,'Working baseline changed: '+p);
for(const [p,hash]of Object.entries(manifest.validationDependencies))assert.equal(sha(repo+'/'+p),hash,'Validator/formula changed: '+p);
for(const f of manifest.files){assert(!f.path.includes('..')&&!f.path.startsWith('/'));assert.equal(sha(root+'/'+f.path),f.sha256,'Candidate checksum: '+f.path);assert.equal(fs.statSync(root+'/'+f.path).size,f.bytes,'Candidate bytes: '+f.path);if(f.path.endsWith('.json'))JSON.parse(fs.readFileSync(root+'/'+f.path,'utf8'));}

const imp=p=>import(pathToFileURL(repo+'/'+p));
const {validateState}=await imp('scripts/collection-state.mjs');
const {validateData}=await imp('scripts/validate-data.mjs');
const {normalizeData}=await imp('js/data.js');
const {participantStatus}=await imp('js/general.js');
const {unifiedAt}=await imp('js/calculations.js');
const {records,selectionVersion}=await imp('scripts/update-history.mjs');
const {parseForumCSV,applyForumDirectory}=await imp('scripts/forum-directory.mjs');
const {judgeDirectory}=await imp('scripts/judge-directory.mjs');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const old={main:read(repo+'/data/19ib_all_judges_REPAIRED.json'),forum:read(repo+'/data/forum_judges_export.json'),history:read(repo+'/data/history.json'),metadata:read(repo+'/data/metadata.json')};
const pub={main:read(root+'/19ib_all_judges_REPAIRED.json'),forum:read(root+'/forum_judges_export.json'),history:read(root+'/history.json'),metadata:read(root+'/metadata.json')};
const full=read(root+'/evidence/api-full.json'),live=read(root+'/evidence/api-live.json');
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b),sum=p=>p.scores.reduce((n,s)=>n+s.score,0);
const all=m=>[...m.members,...(m.archivedMembers||[]),...(m.quarantinedMembers||[])];
const setdiff=(a,b)=>[...a].filter(x=>!b.has(x));
const byId=m=>new Map(all(m).map(p=>[p.userId,p]));
const checks={};for(const [k,s]of Object.entries({baseline:old,published:pub})){validateState(s);checks[k]=validateData(s.main,s.forum);}
checks.metadataBracketIdentical=equal(pub.metadata,read(root+'/evidence/published-metadata-after.json'));
checks.sameRound=full.id===pub.metadata.source.roundId&&full.id===old.metadata.source.roundId;
checks.liveEqualsFull=equal([...live.progress].sort((a,b)=>a.userId.localeCompare(b.userId)).map(e=>[e.userId,e.scoredCount,e.score]),[...full.entries].sort((a,b)=>a.userId.localeCompare(b.userId)).map(e=>[e.userId,e.scoredCount,e.score]));
const b=byId(old.main),p=byId(pub.main),active=new Set([...pub.main.members,...pub.main.quarantinedMembers].map(e=>e.userId));
checks.fullPublishedRoster=full.entries.length===active.size&&full.entries.every(e=>active.has(e.userId));
checks.fullPublishedGrades=full.entries.every(e=>p.has(e.userId)&&p.get(e.userId).scores.length===e.scoredCount&&sum(p.get(e.userId))===e.score);
checks.rules=full.judgesRequired===5&&full.scoreScale===5&&full.passThreshold===15;
checks.csvByteIdentical=fs.readFileSync(repo+'/data/forum.csv').equals(fs.readFileSync(root+'/forum.csv'));
const csv=parseForumCSV(fs.readFileSync(root+'/forum.csv','utf8'));
checks.csvDirectory=equal(applyForumDirectory(pub.forum,csv).directory,pub.metadata.directory);
checks.selection=selectionVersion(pub.main,pub.forum).id===pub.metadata.selectionVersion&&pub.metadata.selectionVersion===old.metadata.selectionVersion;
checks.roundMetadata=equal(Object.fromEntries(Object.entries(full).filter(([k])=>k!=='entries')),pub.metadata.source.round);
checks.metadataCounts=equal(checks.published,pub.metadata.counts);
checks.judgeDirectory=equal(judgeDirectory(pub.main,read(root+'/evidence/api-judges.json')),{judges:pub.main.judges,judgeIdentities:pub.main.judgeIdentities});
checks.quarantineCard=equal(read(root+'/evidence/api-quarantine-scores.json').scores,p.get('52385ac3-2e09-4df9-a04c-ca4348cf42d6').scores);
function outcomes(m){const counts={pass:0,fail:0,pending:0},buckets=Array(7).fill(0);for(const x of m.members){counts[participantStatus(x.scores.map(s=>[s.judgeName,s.score,s.scoredAt])).status]++;buckets[x.scores.length]++;}return {counts,buckets};}
function models(s){const d=normalizeData(s.main,s.forum);const result={};for(const [name,ids]of Object.entries({combined:new Set(d.metadata.keys()),forum:new Set([...d.metadata].filter(([,p])=>p.group!=='Ветераны'&&!p.veteran).map(([id])=>id)),veterans:new Set([...d.metadata].filter(([,p])=>p.group==='Ветераны'||p.veteran===true).map(([id])=>id))})){const m=unifiedAt(d.events.map(e=>({...e,forum:ids.has(e.userId)})),ids.size,5,Date.parse(s.main.exportedAt),{otherCount:d.people.length-ids.size,historical:false});result[name]={index:m.index,favor:m.favor,attention:m.priority*.25,respect:m.respect,judges:m.judges.map(j=>({judge:j.judge,tuz:j.tuz}))};}return result;}
const changes={added:[],removed:[],edits:[],changedParticipants:[],outcomeTransitions:{}};
const oldRecords=new Map(records(old.main).map(s=>[JSON.stringify([s.userId,s.judgeName]),s])),newRecords=new Map(records(pub.main).map(s=>[JSON.stringify([s.userId,s.judgeName]),s]));
for(const [k,s]of newRecords){if(!oldRecords.has(k))changes.added.push(k);else if(!equal(s,oldRecords.get(k)))changes.edits.push({key:k,fields:[...new Set([...Object.keys(s),...Object.keys(oldRecords.get(k))])].filter(f=>!equal(s[f],oldRecords.get(k)[f]))});}
for(const k of oldRecords.keys())if(!newRecords.has(k))changes.removed.push(k);
for(const [id,x]of p)if(b.has(id)&&!equal(x.scores,b.get(id).scores))changes.changedParticipants.push(id);
for(const x of pub.main.members){const prev=b.get(x.userId);if(!prev)continue;const st=z=>participantStatus(z.scores.map(s=>[s.judgeName,s.score,s.scoredAt])).status;const key=st(prev)+' -> '+st(x);changes.outcomeTransitions[key]=(changes.outcomeTransitions[key]||0)+1;}
const history= {baselinePreserved:equal(old.history.baseline,pub.history.baseline),oldRevisionsPrefix:equal(old.history.revisions,pub.history.revisions.slice(0,old.history.revisions.length)),oldSnapshotsPrefix:equal(old.history.snapshots,pub.history.snapshots.slice(0,old.history.snapshots.length)),oldRevisions:old.history.revisions.length,newRevisions:pub.history.revisions.length,oldSnapshots:old.history.snapshots.length,newSnapshots:pub.history.snapshots.length};
const addedRevs=pub.history.revisions.slice(old.history.revisions.length);history.newKinds={added:addedRevs.filter(r=>!r.before&&r.after).length,removed:addedRevs.filter(r=>r.before&&!r.after).length,edited:addedRevs.filter(r=>r.before&&r.after).length};
const replay=new Map(oldRecords);for(const r of addedRevs){if(r.after)replay.set(r.key,r.after);else replay.delete(r.key);}history.replayedRecordsMatch=replay.size===newRecords.size&&[...newRecords].every(([k,v])=>equal(v,replay.get(k)));
const memberships={};for(const key of ['members','archivedMembers','quarantinedMembers']){const a=new Set((old.main[key]||[]).map(p=>p.userId)),z=new Set((pub.main[key]||[]).map(p=>p.userId));memberships[key]={before:a.size,after:z.size,added:setdiff(z,a),removed:setdiff(a,z)};}
const modelsOld=models(old),modelsNew=models(pub);
checks.historyIndices=['forum','veterans'].every(g=>['index','favor','attention','respect'].every(k=>Math.abs(modelsNew[g][k]-pub.history.snapshots.at(-1).indices[g][k])<1e-10));
const report={checkedAt:manifest.preparedAt,baselineRunId:old.metadata.runId,publishedRunId:pub.metadata.runId,checks,outcomes:{baseline:outcomes(old.main),published:outcomes(pub.main)},memberships,changes,history,judges:{namesBefore:[...new Set(records(old.main).map(s=>s.judgeName))].sort(),namesAfter:[...new Set(records(pub.main).map(s=>s.judgeName))].sort(),directoryUnchanged:equal(old.main.judges,pub.main.judges),identitiesUnchanged:equal(old.main.judgeIdentities,pub.main.judgeIdentities)},forum:{total:csv.length,metadataUnchanged:equal(old.forum.members.map(({scores,scoredCount,...x})=>x),pub.forum.members.map(({scores,scoredCount,...x})=>x)),directory:pub.metadata.directory},modelsOld,modelsNew,api:{status:full.status,resultsPublished:full.resultsPublished,judgingDeadline:full.judgingDeadline,sourceParticipants:full.entries.length,sourceScores:full.entries.reduce((n,e)=>n+e.scoredCount,0),buckets:full.entries.reduce((a,e)=>(a[e.scoredCount]=(a[e.scoredCount]||0)+1,a),{}),fullRequestEstimate:3+full.entries.filter(e=>e.scoredCount>0||b.get(e.userId)?.scores.length).length,incrementalRequestEstimate:3+full.entries.filter(e=>!b.has(e.userId)||b.get(e.userId).scores.length!==e.scoredCount||sum(b.get(e.userId))!==e.score).length}};

// Mandatory acceptance gates supplement the existing repository validators.
assert.equal(pub.metadata.runId,'2026-10-22T19:42:08.167Z');
assert.equal(old.metadata.runId,'2026-10-22T15:02:15.571Z');
assert.equal(pub.metadata.runId,pub.metadata.exportedAt);
assert.equal(pub.metadata.runId,manifest.runId);
assert.equal(pub.metadata.exportedAt,manifest.exportedAt);
assert.equal(pub.metadata.forumExportedAt,pub.forum.exportedAt);
assert.equal(pub.metadata.selectionVersion,manifest.selectionVersion);
assert.equal(pub.metadata.source.roundId,manifest.roundId);
assert.equal(full.id,'c3c5b2f7-9d61-4ffc-8f97-f1b50156d59c');
assert.equal(pub.metadata.source.round.id,full.id);
assert.equal(pub.main.exportedAt,pub.metadata.exportedAt);
assert.equal(pub.history.snapshots.at(-1).scores,checks.published.scores);
assert.equal(pub.history.snapshots.at(-1).selectionVersion,pub.metadata.selectionVersion);
assert.equal(pub.history.snapshots.at(-1).exportedAt,pub.metadata.exportedAt);
assert.equal(pub.main.quarantinedMembers.length,1);
const zippy=pub.main.quarantinedMembers[0];
assert.equal(zippy.userId,'52385ac3-2e09-4df9-a04c-ca4348cf42d6');
assert.equal(zippy.scores.length,6);assert.equal(sum(zippy),18);
assert.deepEqual(zippy.scores,b.get(zippy.userId).scores);
assert(!pub.main.members.some(p=>p.userId===zippy.userId));
assert(!normalizeData(pub.main,pub.forum).events.some(e=>e.userId===zippy.userId));
assert.deepEqual(checks.published,{participants:3275,forum:98,scores:16375,judges:22,forumDirectory:99,og:70,veterans:28,archivedParticipants:12});
assert.deepEqual(report.outcomes.published.counts,{pass:2217,fail:1058,pending:0});
assert.equal(report.outcomes.published.buckets[5],3275);
for(const [key,value]of Object.entries(checks))if(typeof value==='boolean')assert(value,'Consistency failed: '+key);
for(const section of Object.values(memberships)){assert.deepEqual(section.added,[]);assert.deepEqual(section.removed,[]);}
for(const key of ['baselinePreserved','oldRevisionsPrefix','oldSnapshotsPrefix','replayedRecordsMatch'])assert(history[key],key);
assert.deepEqual(changes.edits,[]);assert.deepEqual(changes.removed,[]);assert.equal(changes.added.length,212);assert.equal(changes.changedParticipants.length,134);
assert(report.judges.directoryUnchanged);assert(report.judges.identitiesUnchanged);assert.deepEqual(report.judges.namesBefore,report.judges.namesAfter);assert(report.forum.metadataUnchanged);
assert.deepEqual(old.history.selectionVersions,pub.history.selectionVersions);
assert.deepEqual(old.history.selectionChanges,pub.history.selectionChanges);
// Replay the entire source history, checking every before/after transition, not only new revisions.
const replayAll=new Map(pub.history.baseline.records.map(s=>[JSON.stringify([s.userId,s.judgeName]),s]));
const uniqueObservations=new Set();
for(const rev of pub.history.revisions){
 assert.equal(rev.id,createHash('sha256').update(JSON.stringify([rev.key,rev.before,rev.after])).digest('hex'),'Revision identity');
 assert(!uniqueObservations.has(rev.observedAt+'|'+rev.id),'Duplicate revision observation');uniqueObservations.add(rev.observedAt+'|'+rev.id);
 assert.deepEqual(replayAll.get(rev.key)||null,rev.before,'Historical before state');
 assert.equal(rev.sourceScoredAt,rev.after?.scoredAt??null,'Source timestamp');
 assert(Number.isFinite(Date.parse(rev.observedAt))&&Date.parse(rev.observedAt)<=Date.parse(pub.main.exportedAt));
 if(rev.after){assert(Date.parse(rev.after.scoredAt)<=Date.parse(rev.observedAt));assert.equal(JSON.stringify([rev.after.userId,rev.after.judgeName]),rev.key);replayAll.set(rev.key,rev.after);}else replayAll.delete(rev.key);
}
assert.equal(replayAll.size,newRecords.size);for(const [key,value]of newRecords)assert.deepEqual(replayAll.get(key),value,'Full history replay: '+key);
for(const person of pub.forum.members){const original=p.get(person.userId);if(original)assert.deepEqual(person.scores,original.scores,'Forum grade projection');}
for(const f of manifest.files.filter(f=>f.role==='unaltered-published-source')){
 const receipt=read(root+'/evidence/'+({
  '19ib_all_judges_REPAIRED.json':'published-main',
  'forum_judges_export.json':'published-forum',
  'history.json':'published-history',
  'forum.csv':'published-forum-csv',
  'metadata.json':'published-metadata'
 }[f.path])+'-receipt.json');assert.equal(f.sha256,receipt.sha256);assert.equal(f.sourceUrl,receipt.url);assert.equal(receipt.httpStatus,200);
}
assert.equal(sha(root+'/metadata.json'),sha(root+'/evidence/published-metadata-after.json'));
report.history.fullReplayMatches=true;report.history.selectionVersionsPreserved=true;report.history.selectionChangesPreserved=true;report.history.sourceAndObservationTimesValidated=true;
report.checks.runAndExportBinding=true;report.checks.sourceReceiptHashes=true;report.checks.forumFullGradeProjection=true;report.checks.baselineHashesUnchanged=true;report.checks.validatorAndFormulaHashesUnchanged=true;report.checks.manifestHashes=true;report.checks.allSixQuarantinedGradesPreserved=true;
report.controlValues={participants:3275,scores:16375,pass:2217,fail:1058,pending:0,judges:22,quarantine:1,archivedParticipants:12};
report.fileChecksums=manifest.files.filter(f=>f.role==='unaltered-published-source').map(f=>({file:f.path,baseline:manifest.baseline.sha256['data/'+f.path],candidate:f.sha256,changed:manifest.baseline.sha256['data/'+f.path]!==f.sha256}));
report.personalTuzChanges={};for(const group of Object.keys(modelsOld)){const previous=new Map(modelsOld[group].judges.map(j=>[j.judge,j.tuz]));report.personalTuzChanges[group]=modelsNew[group].judges.filter(j=>previous.get(j.judge)!==j.tuz).map(j=>({judge:j.judge,before:previous.get(j.judge),after:j.tuz}));}
const directoryIds=new Set(pub.forum.members.map(p=>p.userId));report.addedGradeGroups={forumAndVeterans:changes.added.filter(key=>directoryIds.has(JSON.parse(key)[0])).length,other:changes.added.filter(key=>!directoryIds.has(JSON.parse(key)[0])).length};
report.verdict='PASS WITH NOTES';report.limitations=manifest.limitations;
for(const [p,hash]of Object.entries(manifest.baseline.sha256))assert.equal(sha(repo+'/'+p),hash,'Baseline changed during verification: '+p);
if(process.argv.includes('--json'))console.log(JSON.stringify(report,null,2));
else{
 assert.deepEqual(read(root+'/comparison-report.json'),report,'Stored comparison is reproducible');
 console.log(JSON.stringify({verdict:report.verdict,runId:pub.metadata.runId,counts:checks.published,outcomes:report.outcomes.published.counts,fullHistoryReplay:true,storedComparisonReproduced:true,baselineUnchanged:true},null,2));
}
