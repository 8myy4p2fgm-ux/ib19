import {loadData,normalizeData} from './data.js';
import {config} from './config.js';
import {generalAt,participantStatus} from './general.js';
import {rankPersonalV4} from './personal.js';

export const FIRST_ROUND_ID='c3c5b2f7-9d61-4ffc-8f97-f1b50156d59c';
export const firstRoundRules=Object.freeze({roundId:FIRST_ROUND_ID,scoresPerParticipant:5,minScore:1,maxScore:5,passScore:15,methodology:'V108 unchanged'});

function assertSupported(roundId){
 if(roundId!==FIRST_ROUND_ID)throw new Error('Unsupported round analytics: '+roundId);
}
function assertMetadata(meta){
 if(!meta||meta.version!==1||typeof meta.runId!=='string'||!meta.runId.trim()||
  ![meta.exportedAt,meta.forumExportedAt,meta.lastSuccessfulAt].every(v=>typeof v==='string'&&Number.isFinite(Date.parse(v)))||
  meta.forumExportedAt!==meta.exportedAt)throw new Error('Invalid round snapshot metadata');
 const source=meta.source,round=source?.round;
 assertSupported(source?.roundId);
 if(round?.id!==FIRST_ROUND_ID||round.judgesRequired!==5||round.scoreScale!==5||round.passThreshold!==15||round.maxScore!==25||
  config.scoresPerParticipant!==5||config.maxScore!==5||config.passScore!==15)throw new Error('Incompatible first-round rules');
}
function assertFiles(data,meta){
 if(data.updated!==meta.exportedAt||data.forumExportedAt!==meta.forumExportedAt)throw new Error('Incompatible round snapshot versions');
}
function assertNoUnboundFiles(history,derived){
 if(history!==undefined||derived!==undefined)throw new Error('Unverified history/derived data cannot be attached to RoundContext Lite');
}
function contextFromData(input,meta){
 assertMetadata(meta);assertFiles(input,meta);
 // Contexts own their data. No module-global cache or mutable maps are shared
 // across loads, rounds or versions. Legacy consumers retain the existing D API.
 const data=structuredClone(input),asOf=Date.parse(meta.exportedAt);
 data.snapshotMetadata=structuredClone(meta);
 const selectGroup=(group='forum')=>{
  if(!['forum','veterans','reference'].includes(group))throw new Error('Unknown analytics group: '+group);
  const ids=new Set([...data.metadata].filter(([,p])=>group==='reference'||(group==='veterans')===(p.group==='Ветераны'||p.veteran===true)).map(([id])=>id));
  const people=data.people.filter(p=>ids.has(p[0]));
  return {people,events:data.events.map(e=>({...e,forum:ids.has(e.userId)})),forumCount:ids.size,otherCount:data.people.length-ids.size};
 };
 const summary=({group='forum',at=asOf}={})=>{
  if(!Number.isFinite(at)||at>asOf)throw new Error('Calculation time exceeds round snapshot');
  const selected=selectGroup(group),start=data.events.find(e=>Number.isFinite(e.t))?.t;
  return generalAt(selected.events,selected.forumCount,selected.otherCount,start,at,{historical:at<asOf});
 };
 return Object.freeze({
  roundId:FIRST_ROUND_ID,runId:meta.runId,exportedAt:meta.exportedAt,rules:firstRoundRules,
  snapshotKey:JSON.stringify([FIRST_ROUND_ID,meta.runId,meta.exportedAt,meta.selectionVersion??null]),
  data,selectGroup,
  history:Object.freeze({supported:false,reason:'history.json has no independent roundId/runId binding; not loaded by RoundContext Lite'}),
  analytics:Object.freeze({
   participantStatus(userId){const p=data.byId.get(userId);if(!p)throw new Error('Participant outside round analytics: '+userId);return participantStatus(p.scores);},
   summary,
   rankJudges(options){return rankPersonalV4(summary(options).judges);}
  })
 });
}

// Offline entry point uses the same production normalizer, never another loader.
export function createRoundContext({main,forum,metadata,history,derived}={}, {roundId=FIRST_ROUND_ID,deferredComments=false}={}){
 assertSupported(roundId);assertMetadata(metadata);
 assertNoUnboundFiles(history,derived);
 const data=normalizeData(main,forum,{deferredComments});data.lastSuccessfulAt=metadata.lastSuccessfulAt;
 return contextFromData(data,metadata);
}

export async function loadRoundContext({roundId=FIRST_ROUND_ID,history,derived}={}){
 assertSupported(roundId);assertNoUnboundFiles(history,derived);
 const data=await loadData({validateMetadata:assertMetadata});
 return contextFromData(data,data.snapshotMetadata);
}
