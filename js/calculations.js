import {config} from './config.js';
const average=a=>a.length?a.reduce((sum,s)=>sum+s.score,0)/a.length:null;
const time=s=>s.scoredAt!==undefined?Date.parse(s.scoredAt):s.t;
export function uniqueGrades(events){const found=new Map();for(const s of events){const key=JSON.stringify([s.judge,s.userId]),old=found.get(key);if(old){if(old.score!==s.score||old.scoredAt!==s.scoredAt||old.forum!==s.forum)throw new Error('Несогласованные повторные оценки');continue;}found.set(key,s);}return [...found.values()];}
export function favorScore(forumMean,otherMean){return [forumMean,otherMean].every(Number.isFinite)?15*(forumMean-otherMean):null;}
function respectScore(forumScores){return forumScores.length?15*forumScores.reduce((n,s)=>n+(s.score-3)/2,0)/forumScores.length:null;}
export function confidenceCoefficient(nForum,nOther,expected=16440){const n=nForum+nOther;return Number.isFinite(n)&&n>=0&&expected>0?Math.min(1,Math.sqrt(n/expected)):null;}
function calculateTuz({priority,favor,respect,activity=1}){return [priority,favor,respect,activity].every(Number.isFinite)?Math.max(-100,Math.min(100,(favor+.25*priority+respect)*activity)):null;}
export function penaltyFromCounts({threes=0,twos=0,ones=0}){if(![threes,twos,ones].every(n=>Number.isInteger(n)&&n>=0))throw new Error('Количество оценок должно быть неотрицательным целым');return twos*3+ones*5;}
export function forumPenalties(events){const forum=uniqueGrades(events).filter(s=>s.forum);const counts={threes:forum.filter(s=>s.score===3).length,twos:forum.filter(s=>s.score===2).length,ones:forum.filter(s=>s.score===1).length};return {...counts,total:penaltyFromCounts(counts)};}
export function generalTuz(params){return calculateTuz({...params,activity:1});}
export function personalTuz(params){return calculateTuz(params);}
export function coverageDifference(forumCoverage,otherCoverage){return [forumCoverage,otherCoverage].every(Number.isFinite)?100*(forumCoverage-otherCoverage):null;}
function bound(a,t,upper){let l=0,r=a.length;while(l<r){const m=(l+r)>>1;if(a[m]<t||(upper&&a[m]===t))l=m+1;else r=m;}return l;}
export function pairPriority(events,forumTotal,otherTotal){
 const a=uniqueGrades(events),fs=a.filter(s=>s.forum),os=a.filter(s=>!s.forum),invalid=a.filter(s=>!Number.isFinite(time(s))).length;
 const compared=fs.length*os.length;
 if(!compared)return {priority:null,expectedPairs:0,invalidDates:invalid,lastQueue:null,reason:'Нет оценок хотя бы одной группы'};
 if(invalid)return {priority:null,expectedPairs:compared,invalidDates:invalid,lastQueue:null,reason:'Нет достоверного времени у '+invalid+' оценок'};
 const ot=os.map(time).sort((a,b)=>a-b);let sum=0,later=0;
 for(const s of fs){const t=time(s),earlier=ot.length-bound(ot,t,true),after=bound(ot,t,false);sum+=earlier-after;later+=after;}
 return {priority:100*sum/compared,expectedPairs:compared,invalidDates:0,lastQueue:100*later/compared,reason:null};
}
export function editorialMetrics(forumScores,forumCoverage,lastQueue,otherMean){return {disrespect:forumScores.length&&Number.isFinite(otherMean)?forumScores.filter(s=>s.score<otherMean).length/forumScores.length*100:null,forgotForum:Number.isFinite(forumCoverage)?100*(1-forumCoverage):null,lastQueue};}
// Confirmed assignments require participant IDs, not quotas inferred from observed activity.
function assignmentBasis(assignment,forumCount,otherCount,a){
 if(!assignment)return {forumTotal:forumCount,otherTotal:otherCount,scoped:a,conditional:true};
 if(!Array.isArray(assignment.forumUserIds)||!Array.isArray(assignment.otherUserIds))return {forumTotal:null,otherTotal:null,scoped:a,conditional:false};
 const f=new Set(assignment.forumUserIds),o=new Set(assignment.otherUserIds);if([...f].some(id=>o.has(id)))throw new Error('Группы задания судьи пересекаются');
 return {forumTotal:f.size,otherTotal:o.size,scoped:a.filter(s=>(s.forum?f:o).has(s.userId)),conditional:false};
}
export function unifiedAt(events,forumCount,slots=config.scoresPerParticipant,cutoff=Infinity,options={}){
 if(!Number.isInteger(forumCount)||forumCount<0||!Number.isInteger(slots)||slots<1)throw new Error('Некорректный размер выборки');
 const unique=uniqueGrades(events),historical=options.historical??Number.isFinite(cutoff),end=Number.isFinite(cutoff)?cutoff:options.asOf,scores=unique.filter(s=>Number.isFinite(time(s))?(!Number.isFinite(end)||time(s)<=end):!historical),groups=new Map();
 for(const s of scores){if(!Number.isInteger(s.score)||s.score<1||s.score>5)throw new Error('Некорректная оценка');if(!groups.has(s.judge))groups.set(s.judge,[]);groups.get(s.judge).push(s);}
 const names=[...new Set(options.judgeNames??unique.map(s=>s.judge))],judges=names.map(judge=>{
  const a=groups.get(judge)||[],fs=a.filter(s=>s.forum),os=a.filter(s=>!s.forum),forumMean=average(fs),otherMean=average(os),difference=fs.length&&os.length?forumMean-otherMean:null,favor=favorScore(forumMean,otherMean),basis=assignmentBasis(options.judgeAssignments?.[judge],forumCount,options.otherCount,a),bf=basis.scoped.filter(s=>s.forum),bo=basis.scoped.filter(s=>!s.forum),forum=new Set(fs.map(s=>s.userId)).size,other=new Set(os.map(s=>s.userId)).size,coverage=basis.forumTotal>0?new Set(bf.map(s=>s.userId)).size/basis.forumTotal:null,otherCoverage=basis.otherTotal>0?new Set(bo.map(s=>s.userId)).size/basis.otherTotal:null,coverageAdvantage=coverageDifference(coverage,otherCoverage),p=pairPriority(basis.scoped,basis.forumTotal,basis.otherTotal),priority=p.priority,activity=Math.sqrt(forum/(forumCount||1)),confidence=activity,respect=respectScore(fs),penalties=forumPenalties(a),penalty=0,scorePoints=Number.isFinite(favor)?favor:null,speedPoints=Number.isFinite(priority)?.25*priority:null,respectPoints=respect,penaltyPoints=0,tuz=personalTuz({priority,favor,respect,activity}),reason=!Number.isFinite(favor)?'Нет оценок хотя бы одной группы':p.reason;
  return {judge,forum,other,forumTotal:basis.forumTotal,otherTotal:basis.otherTotal,forumMean,otherMean,difference,priority,favor,respect,coverage,otherCoverage,coverageAdvantage,confidence,activity,scorePoints,speedPoints,respectPoints,penaltyPoints,penalty,penalties,tuz,expectedPairs:p.expectedPairs,expectedTotal:basis.forumTotal>0&&basis.otherTotal>0?basis.forumTotal+basis.otherTotal:null,conditionalBasis:basis.conditional,invalidDates:p.invalidDates,missingReason:reason,editorial:editorialMetrics(fs,coverage,p.lastQueue,otherMean)};
 });
 const weighted=(key,weight)=>{const eligible=judges.filter(j=>Number.isFinite(j[key])&&Number.isFinite(j[weight])&&j[weight]>0),total=eligible.reduce((n,j)=>n+j[weight],0);return total?eligible.reduce((n,j)=>n+j[key]*j[weight],0)/total:null;};
 const fs=scores.filter(s=>s.forum),os=scores.filter(s=>!s.forum),forumMean=average(fs),otherMean=average(os),difference=fs.length&&os.length?forumMean-otherMean:null,favor=favorScore(forumMean,otherMean),respect=respectScore(fs),confidence=confidenceCoefficient(fs.length,os.length,(forumCount+(options.otherCount||0))*slots),penalties=forumPenalties(scores),penalty=0,priority=weighted('priority','expectedPairs'),coverageAdvantage=weighted('coverageAdvantage','expectedTotal');
 const credited=a=>{const seen=new Map();for(const s of a)seen.set(s.userId,(seen.get(s.userId)||0)+1);return [...seen.values()].reduce((n,v)=>n+Math.min(v,slots),0);};
 const forumProgress=forumCount>0?credited(fs)/(forumCount*slots)*100:null,otherProgress=options.otherCount>0?credited(os)/(options.otherCount*slots)*100:null,progressDifference=[forumProgress,otherProgress].every(Number.isFinite)?forumProgress-otherProgress:null;
 return {t:end,cf:fs.length,co:os.length,forumMean,otherMean,difference,priority,favor,respect,coverageAdvantage,confidence,penalty,penalties,forumProgress,otherProgress,progressDifference,index:generalTuz({priority,favor,respect}),judges,invalidDates:unique.filter(s=>!Number.isFinite(time(s))).length,excludedPriorityJudges:judges.filter(j=>!Number.isFinite(j.priority)).map(j=>({judge:j.judge,reason:j.missingReason})),historical};
}

