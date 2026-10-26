import {PUBLIC_R1_CONTRACT,publicR1Contract} from './r1-public-contract.js';
import {FIXED_R1_CONTRACT,fixedR1Contract} from './r1-fixed-contract.js';
import {createRoundContext,FIRST_ROUND_ID} from './round-context.js';
import {config} from './config.js';
import {generalAt,participantStatus} from './general.js';
import {rankPersonalV4} from './personal.js';
import {officialR1Policy,STANDARD_R1_POLICY_VERSION} from './r1-official-policy.js';
import {officialR1Activity} from './r1-official-activity.js';
import {correctOfficialScores,contentHash} from './r1-correction.js';

const requireValue=(condition,message)=>{if(!condition)throw new Error(message);};

// Offline opt-in adapter. No JSON loader, shared cache, UI activation or edits
// to RoundContext. Existing partition/normalization validates the base first;
// only registry-authorized quarantine records are then admitted to this copy.
export function createOfficialR1View({main,forum,metadata,history}={}, {policyVersion=STANDARD_R1_POLICY_VERSION,sourceContract='full'}={}){
 return createOfficialR1ViewForPolicy({main,forum,metadata,history},officialR1Policy(policyVersion),{sourceContract});
}

// Trusted-code entry for testing future reviewed source approvals. The application
// always resolves its policy from the code registry above, never from source JSON.
export function createOfficialR1ViewForPolicy({main,forum,metadata,history}={},policy,{sourceContract='full'}={}){
 requireValue(sourceContract==='full'||sourceContract===FIXED_R1_CONTRACT||sourceContract===PUBLIC_R1_CONTRACT,'Unknown R1 source contract');
 const fixed=sourceContract===PUBLIC_R1_CONTRACT?publicR1Contract({main,forum,metadata,history},policy,contentHash):sourceContract===FIXED_R1_CONTRACT?fixedR1Contract({main,forum,metadata,history},policy):null;
 const base=createRoundContext({main,forum,metadata});
 const data=base.data,asOf=Date.parse(base.exportedAt),deadline=data.snapshotMetadata.source.round.judgingDeadline;
 requireValue(policy.roundId===base.roundId&&base.roundId===FIRST_ROUND_ID,'Official policy round mismatch');
 requireValue(typeof metadata.selectionVersion==='string'&&!!metadata.selectionVersion,'Missing source selectionVersion');
 requireValue(metadata.lastSuccessfulAt===metadata.exportedAt,'Inconsistent source observation');
 const expected={participants:data.people.length,scores:data.events.length,judges:new Set(data.events.map(e=>e.judge)).size,forum:data.metadata.size,archivedParticipants:data.archivedById.size};
 for(const [key,value]of Object.entries(expected))requireValue(metadata.counts?.[key]===value,'Source metadata count mismatch: '+key);
 requireValue(!data.warnings.length,'Source contains unverified score timestamps');
 for(const p of [...data.byId.values(),...data.archivedById.values()])for(const s of p.scores)requireValue(typeof s.comment==='string','Missing original comment');
 const sourceHistory=history===undefined?null:structuredClone(history);
 if(sourceHistory){
  const last=sourceHistory.snapshots?.at(-1);
  requireValue(Array.isArray(sourceHistory.revisions)&&Array.isArray(sourceHistory.baseline?.records)&&last?.exportedAt===metadata.exportedAt&&last.selectionVersion===metadata.selectionVersion&&last.scores===data.events.length&&Number.isFinite(Date.parse(last.observedAt))&&Date.parse(last.observedAt)>=asOf,'History is not bound to the source snapshot');
 }
 const exceptions=new Map(),annulled=[],sourceObservedEvents=[...data.events];
 for(const rule of policy.exceptions){
  requireValue(rule.roundId===base.roundId&&(rule.allScoresValid||rule.cancelledEvent)&&rule.officialOutcome==='pass','Invalid official exception');
  const source=[...main.members,...(main.quarantinedMembers||[])].filter(p=>p.userId===rule.participantId);
  requireValue(source.length===1&&source[0].current!==false,'Official participant must be present and current');
  const person=structuredClone(source[0]);
  sourceObservedEvents.push(...person.scores.map(s=>({...s,userId:person.userId,forum:false,judge:s.judgeName,t:Date.parse(s.scoredAt)})));
  if(rule.cancelledEvent){
   const corrected=correctOfficialScores({main,forum,metadata,history},person,data,rule,{sourceContract});
   annulled.push(corrected.audit);person.scores=corrected.valid;person.scoredCount=corrected.valid.length;
  }
  requireValue(person.scores.length===rule.validScoreCount&&person.scoredCount===rule.validScoreCount,'Official score count requires review');
  requireValue(!data.byId.has(person.userId)&&!data.archivedById.has(person.userId),'Official admission must originate in validated quarantine');
  requireValue(data.excluded.some(p=>p.userId===person.userId),'Official admission must originate in validated quarantine');
  requireValue(!data.referenceMetadata.has(person.userId),'Official exception group membership requires review');
  for(const score of person.scores)requireValue(data.judgeIdentities.has(score.judgeName),'Unknown official judge identity');
  data.byId.set(person.userId,person);
  data.artists.set(person.userId,{artistName:person.artistName||null,artistSlug:person.artistSlug||null});
  data.people.push([person.userId,'','',person.scores.map(s=>[s.judgeName,s.score,s.scoredAt])]);
  data.events.push(...person.scores.map(s=>({...s,userId:person.userId,forum:false,judge:s.judgeName,t:Date.parse(s.scoredAt)})));
  data.excluded=data.excluded.filter(p=>p.userId!==person.userId);
  exceptions.set(person.userId,rule);
 }
 if(annulled.length){
  data.annulledScores=structuredClone(annulled);
  data.sourceRatingsReport=structuredClone(data.ratingsReport);
  const counts=[...data.byId.values()].map(p=>p.scores.length),buckets=Array.from({length:Math.max(config.scoresPerParticipant,...counts)+1},()=>0);
  for(const count of counts)buckets[count]++;
  data.ratingsReport={total:counts.length,buckets};
 }
 data.events.sort((a,b)=>a.t-b.t);sourceObservedEvents.sort((a,b)=>a.t-b.t);
 const eventKeys=data.events.map(e=>JSON.stringify([e.userId,e.judge]));
 requireValue(new Set(eventKeys).size===eventKeys.length,'Duplicate official analytics event');
 const sourceSelectionVersion=metadata.selectionVersion;
 // A semantic version of the derived selection; never written into source metadata.
 const selectionVersion=exceptions.size?JSON.stringify([sourceSelectionVersion,policy.version]):sourceSelectionVersion;
 const correctionFingerprint=policy.exceptions.find(r=>r.cancelledEvent)?.cancelledEvent.fingerprint;
 const identity=Object.freeze({...(correctionFingerprint?{correctionFingerprint}:{}),roundId:base.roundId,runId:base.runId,exportedAt:base.exportedAt,sourceSelectionVersion,selectionVersion,policyVersion:policy.version});
 const snapshotKey=JSON.stringify([identity.roundId,identity.runId,identity.exportedAt,identity.selectionVersion,identity.policyVersion,...(correctionFingerprint?[correctionFingerprint]:[])]);
 function selectGroup(group='forum'){
  requireValue(['forum','veterans','reference'].includes(group),'Unknown official analytics group');
  const ids=new Set([...data.metadata].filter(([,p])=>group==='reference'||(group==='veterans')===(p.group==='Ветераны'||p.veteran===true)).map(([id])=>id));
  const selected=structuredClone({people:data.people.filter(p=>ids.has(p[0])),events:data.events,forumCount:ids.size,otherCount:data.people.length-ids.size});
  // These events are already owned by the caller; avoid an intermediate object per grade.
  for(const event of selected.events)event.forum=ids.has(event.userId);
  return selected;
 }
 function participantOutcome(userId){
  const person=data.byId.get(userId);requireValue(!!person,'Participant outside official analytics');
  const rule=exceptions.get(userId);
  if(rule)return {standardOutcome:null,standardOutcomeReason:'official-special-case',officialOutcome:rule.officialOutcome,status:rule.officialOutcome,validScoreCount:person.scores.length,scoreTotal:person.scores.reduce((n,s)=>n+s.score,0),scoreMaximum:rule.validScoreCount*config.maxScore,basis:rule.basis,policyVersion:policy.version,label:rule.label,...(rule.cancelledEvent?{classification:'special-official-pass',standardMathDiagnostic:participantStatus(person.scores)}:{})};
  const standard=participantStatus(person.scores);
  return {standardOutcome:standard.status,standardOutcomeReason:null,officialOutcome:null,status:standard.status,validScoreCount:standard.count,scoreTotal:standard.total,scoreMaximum:config.scoresPerParticipant*config.maxScore,standard};
 }
 function outcomes(){
  const result={participants:data.people.length,standardPasses:0,specialOfficialPasses:0,totalPassed:0,failed:0,pending:0};
  for(const id of data.byId.keys()){
   const outcome=participantOutcome(id);
   if(outcome.officialOutcome==='pass')result.specialOfficialPasses++;
   else if(outcome.standardOutcome==='pass')result.standardPasses++;
   else if(outcome.standardOutcome==='fail')result.failed++;
   else result.pending++;
  }
  result.totalPassed=result.standardPasses+result.specialOfficialPasses;return result;
 }
 const summaryCache=new Map();
 function summary({group='forum',at=asOf}={}){
  requireValue(Number.isFinite(at)&&at<=asOf,'Calculation time exceeds official snapshot');
  const key=JSON.stringify([group,at]);
  if(!summaryCache.has(key)){
   const selected=selectGroup(group),start=data.events[0]?.t;
   summaryCache.set(key,{...generalAt(selected.events,selected.forumCount,selected.otherCount,start,at,{historical:at<asOf}),provenance:{kind:at<asOf?'reconstruction':'derived-current',...identity}});
   if(summaryCache.size>64)summaryCache.delete(summaryCache.keys().next().value);
  }
  return structuredClone(summaryCache.get(key));
 }
 return Object.freeze({
  ...identity,identity,snapshotKey,sourceContract,sourceSnapshotKey:base.snapshotKey,rules:base.rules,
  get data(){return structuredClone(data);},
  get policy(){return structuredClone(policy);},
  get history(){return {source:structuredClone(sourceHistory),gradeRevisionsAdded:0,sourceRewritten:false,historicalCalculations:'reconstruction',...(annulled.length?{policyAudit:structuredClone(annulled)}:{}),selectionChange:{from:sourceSelectionVersion,to:selectionVersion,policyVersion:policy.version}};},
  // History uncertainty uses only these fields. Full source/audit access above
  // stays intact and independently cloned; comments and history are never discarded.
  attributionUncertaintyIds(){return [...(fixed?.chronologyUncertainIds??[])];},
  historyRevisionFacts(){
   const fact=score=>score==null?score:{userId:score.userId,score:score.score,scoredAt:score.scoredAt};
   return (sourceHistory?.revisions??[]).map(({before,after})=>({before:fact(before),after:fact(after)}));
  },
  selectGroup,
  analytics:Object.freeze({participantOutcome,outcomes,summary,rankJudges(options){return rankPersonalV4(summary(options).judges);}}),
  activity({at=asOf,now=at}={}){
   requireValue(Number.isFinite(at)&&at<=asOf,'Activity time exceeds official snapshot');
   return {...officialR1Activity({events:data.events,members:[...data.byId.values()],asOf:at,deadline,now,...(annulled.length?{sourceObservedEvents,annulledEvents:annulled}:{})}),snapshotKey,provenance:{kind:at<asOf?'reconstruction':'derived-current',...identity}};
  }
 });
}
