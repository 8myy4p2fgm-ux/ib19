import {calculateImpactRow} from './impact-calculation.js';
import {buildForumLink} from './forum-link-model.js';
import {participantStatus,generalAt,mean} from './general.js';
import {snapshotTimes} from './history.js';
import {FIRST_ROUND_ID} from './round-context.js';

// V58 reports/research.js methods and progress.js pipeData, applied to one official
// context. No raw snapshot reads, module-global dataset or copied report results.
const cache=new WeakMap();
export const median=values=>{const a=[...values].sort((a,b)=>a-b),m=Math.floor(a.length/2);return a.length?(a.length%2?a[m]:(a[m-1]+a[m])/2):null;};
export function compatiblePairs(participants,names){
 const pairs=[];
 for(let a=0;a<names.length;a++)for(let b=a+1;b<names.length;b++){
  const rows=[];for(const p of participants){const x=p.scores.find(s=>s.judgeName===names[a]),y=p.scores.find(s=>s.judgeName===names[b]);if(x&&y)rows.push({u:p.id,a:x.score,b:y.score});}
  const n=rows.length,mae=n?mean(rows.map(p=>Math.abs(p.a-p.b))):null;
  pairs.push({a:names[a],b:names[b],n,pairs:rows,mae,compat:n?100*(1-mae/4):null,exact:n?rows.filter(p=>p.a===p.b).length/n:null,bias:n?mean(rows.map(p=>p.a-p.b)):null,eligible:n>=20});
 }return pairs;
}
export function dissentRows(participants,names){
 return names.map(j=>{const cases=[];for(const p of participants){if(p.scores.length<3)continue;const s=p.scores.find(s=>s.judgeName===j);if(!s)continue;const others=p.scores.filter(s=>s.judgeName!==j),peer=mean(others.map(s=>s.score));cases.push({u:p.id,name:p.name,score:s.score,peer,n:others.length,delta:s.score-peer});}
 const n=cases.length,bias=n?mean(cases.map(c=>c.delta)):null;
 return {j,n,bias,mae:n?mean(cases.map(c=>Math.abs(c.delta))):null,centered:n?mean(cases.map(c=>Math.abs(c.delta-bias))):null,large:cases.filter(c=>Math.abs(c.delta)>=1.5).length,eligible:n>=20,cases:cases.sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta)||a.u.localeCompare(b.u))};});
}
export function uncertaintyIds(participants,history,officialIds=new Set(),knownUncertainIds=[]){
 const ids=new Set(participants.map(p=>p.id)),reasons=new Map();const add=(id,reason)=>{if(!reasons.has(id))reasons.set(id,[]);if(!reasons.get(id).includes(reason))reasons.get(id).push(reason);};
 for(const id of officialIds)add(id,'official-special-case');
 for(const id of knownUncertainIds)if(ids.has(id))add(id,'score-time-revision-or-deletion');
 for(const rev of history?.revisions||[]){const a=rev.before,b=rev.after,id=a?.userId??b?.userId;if(!ids.has(id))continue;if(a&&(!b||a.score!==b.score||a.scoredAt!==b.scoredAt))add(id,'score-time-revision-or-deletion');}
 for(const p of participants){const ts=p.scores.map(s=>Date.parse(s.scoredAt));if(ts.some(t=>!Number.isFinite(t)))add(p.id,'invalid-date');if(new Set(ts).size!==ts.length)add(p.id,'equal-timestamps');if(p.scores.length>5)add(p.id,'nonstandard-score-count');}
 return reasons;
}
export function fateSteps(p){
 const scores=[...p.scores].sort((a,b)=>Date.parse(a.scoredAt)-Date.parse(b.scoredAt));let decided=false;
 const steps=[{n:0,total:0,min:5,max:25,st:'pending'}],prefix=[];
 for(const s of scores){const status=participantStatus([...prefix,s]),first=!decided&&status.status!=='pending';if(first)decided=true;const row={...s,n:status.count,total:status.total,min:status.minFinal,max:status.maxFinal,st:status.status,first};prefix.push(row);steps.push(row);}return steps;
}
export function pipelineRows(events,names,threshold=30){
 if(![10,30,60].includes(threshold))throw Error('Unsupported V58 interval');
 return names.map(j=>{const es=events.filter(e=>e.j===j).sort((a,b)=>a.t-b.t||a.u.localeCompare(b.u)),gaps=es.slice(1).map((e,i)=>(e.t-es[i].t)/1000),runs=[];let run=[];
 for(const e of es){if(run.length&&e.t-run.at(-1).t>threshold*1000){if(run.length>=3)runs.push(run);run=[];}run.push(e);}if(run.length>=3)runs.push(run);
 runs.sort((a,b)=>b.length-a.length||(a.at(-1).t-a[0].t)-(b.at(-1).t-b[0].t));return {j,es,gaps,med:median(gaps),short:gaps.filter(g=>g<=threshold).length,runs};});
}
// Population variance and CDF interval probabilities, conditioned on the
// admissible integer scale 5–25. Normalization approved for this report.
// Numerical erf approximation (absolute error <1.5e-7) only evaluates that CDF.
function erf(x){const sign=x<0?-1:1,a=Math.abs(x),t=1/(1+.3275911*a);return sign*(1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-a*a));}
export function distributionGroup(rows){
 const complete=rows.filter(p=>p.count===5),values=complete.map(p=>p.total),n=values.length,average=mean(values),sd=n?Math.sqrt(mean(values.map(v=>(v-average)**2))):null;
 const cdf=x=>.5*(1+erf((x-average)/(sd*Math.sqrt(2))));
 const mass=sd>0?cdf(25.5)-cdf(4.5):null,curve=Number.isFinite(mass)&&mass>0;let cumulative=0;
 const bins=Array.from({length:21},(_,i)=>{const score=i+5,count=values.filter(v=>v===score).length;cumulative+=count;return {score,count,share:n?count/n:0,cumulative:n?cumulative/n:0,expected:curve?n*(cdf(score+.5)-cdf(score-.5))/mass:null};});
 const max=Math.max(0,...bins.map(b=>b.count));const pass=complete.filter(p=>p.total>=15).length;
 return {total:rows.length,n,incomplete:rows.length-n,mean:average,median:median(values),sd,modes:n?bins.filter(b=>b.count===max).map(b=>b.score):[],pass,fail:n-pass,passShare:n?pass/n:null,curve,modelMass:mass,bins};
}
export function distributionComparison(data){
 const expected=data.curve?data.bins.filter(b=>b.score>=15).reduce((sum,b)=>sum+b.expected,0):null;
 return {actual:data.n?data.pass:null,expected,difference:expected===null?null:data.pass-expected};
}
export function getV58Research(context){
 if(cache.has(context))return cache.get(context);
 if(context.roundId!==FIRST_ROUND_ID)throw Error('V58 analytics requires official R1');
 const D=context.data;D.participantOutcomes=new Map([...D.byId.keys()].map(id=>[id,context.analytics.participantOutcome(id)]));
 const source=buildForumLink(D),officialIds=new Set([...D.participantOutcomes].filter(([,o])=>o.officialOutcome).map(([id])=>id));
 const all=[...source.forum,...source.other].map(p=>({...p,artist:p.battleName,slug:D.artists.get(p.id)?.artistSlug,official:officialIds.has(p.id)}));
 const names=[...new Set(D.events.map(s=>s.judge))].sort((a,b)=>a.localeCompare(b,'ru'));
 const history=typeof context.historyRevisionFacts==='function'?{revisions:context.historyRevisionFacts()}:context.history.source;
 const uncertain=uncertaintyIds(all,history,officialIds,context.attributionUncertaintyIds?.()??[]),asOf=Date.parse(context.exportedAt);
 for(const p of all){p.uncertain=uncertain.has(p.id);p.uncertainty=uncertain.get(p.id)||[];}
 const participantById=new Map(all.map(p=>[p.id,p]));
 const events=D.events.map(s=>({u:s.userId,j:s.judge,t:s.t,v:s.score,a:participantById.get(s.userId)?.name??s.userId}));
 const decisive=all.filter(p=>!p.uncertain).flatMap(p=>fateSteps(p).filter(s=>s.first).map(s=>({u:p.id,a:p.name,j:s.judgeName,v:s.score,t:Date.parse(s.scoredAt),n:s.n,total:s.total,st:s.st,early:s.n<5})));
 let chemistry,dissent,distributions,impacts,historySeries,disputed,executionCounts;
 let impactAPI,impactBasis;
 const impactRows={},impactPending={};
 function basis(){
  if(!impactBasis){const selected=context.selectGroup('forum'),base=context.analytics.summary({group:'forum'});impactBasis={selected,base,start:selected.events[0]?.t,asOf};}
  return impactBasis;
 }
 function impactInputs(kind){return kind==='judges'?names:all.filter(p=>p.forum&&!p.veteran);}
 function impactRow(kind,item){return calculateImpactRow(basis(),kind,item);}
 function workerImpacts(kind){return new Promise((resolve,reject)=>{
  let worker;
  try{
   worker=new Worker(new URL('./impact-worker.js',import.meta.url),{type:'module'});
   worker.onmessage=({data})=>{worker.terminate();data.error?reject(Error(data.error)):resolve(data.rows);};
   worker.onerror=event=>{worker.terminate();reject(Error(event.message||'Impact worker unavailable'));};
   worker.postMessage({basis:basis(),kind,items:impactInputs(kind)});
  }catch(error){worker?.terminate();reject(error);}
 });}
 function makeImpacts(){
  const {selected,base}=basis();
  return {base,forumCount:selected.forumCount,scoreCount:selected.events.filter(e=>e.forum).length,rawBase:base.favor+.25*base.priority+base.respect,
   get judges(){return impactRows.judges??=impactInputs('judges').map(item=>impactRow('judges',item));},
   get rappers(){return impactRows.rappers??=impactInputs('rappers').map(item=>impactRow('rappers',item));}};
 }
 const api={all,names,events,decisive,uncertain,officialIds,exportedAt:context.exportedAt,snapshotKey:context.snapshotKey,judgeIdentities:new Map(D.judgeIdentities),
  get chemistry(){return chemistry??=compatiblePairs(all,names);},get dissent(){return dissent??=dissentRows(all,names);},
  get disputed(){return disputed??=all.filter(p=>p.count===5).map(p=>({...p,gap:Math.max(...p.scores.map(s=>s.score))-Math.min(...p.scores.map(s=>s.score))})).filter(p=>p.gap>=2).sort((a,b)=>b.gap-a.gap||a.name.localeCompare(b.name,'ru'));},
  get executionCounts(){return executionCounts??=names.map(j=>{const events=decisive.filter(e=>e.j===j),pass=events.filter(e=>e.st==='pass').length;return {key:j,name:j,n:events.length,pass,fail:events.length-pass};});},
  get distributions(){return distributions??={all:distributionGroup(all),forum:distributionGroup(all.filter(p=>p.forum&&!p.veteran)),veterans:distributionGroup(all.filter(p=>p.veteran))};},
  get historySeries(){if(!historySeries){const es=D.events.filter(e=>!officialIds.has(e.userId)).sort((a,b)=>a.t-b.t),states=new Map(),times=snapshotTimes(es[0]?.t,asOf);let i=0,pass=0,fail=0;
   historySeries=times.map(t=>{while(i<es.length&&es[i].t<=t){const e=es[i++],ss=states.get(e.userId)||[],before=participantStatus(ss).status;ss.push(e);states.set(e.userId,ss);const after=participantStatus(ss).status;pass+=(after==='pass')-(before==='pass');fail+=(after==='fail')-(before==='fail');}return {t,pass,fail,pending:all.length-officialIds.size-pass-fail};});}return historySeries;},
  impacts(){return impactAPI??=makeImpacts();},
  async prepareImpacts(kind){
   if(!['judges','rappers'].includes(kind))throw Error('Unknown impact projection');
   const result=api.impacts();
   if(impactRows[kind])return result[kind];
   return impactPending[kind]??=(async()=>{
    if(typeof Worker==='function'){
     try{return impactRows[kind]=await workerImpacts(kind);}catch{/* Restricted browsers keep the yielding fallback. */}
    }
    const rows=[];
    // Yield between counterfactuals; never approximate or change the formula.
    for(const item of impactInputs(kind)){await new Promise(resolve=>setTimeout(resolve,0));rows.push(impactRow(kind,item));}
    impactRows[kind]=rows;return rows;
   })().catch(error=>{delete impactPending[kind];throw error;});
  }

 };
 cache.set(context,api);return api;
}
