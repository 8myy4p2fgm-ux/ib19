import {primeR2GroupReference} from './r2-group-reference.js';
import {prepareSectionStyles} from './section-styles.js';
import './site-selects.js';
import {mountR1Home} from './home-r1.js';
import {installJudgeProfiles} from './judge-profile-entry.js';
import {installJudgeRanking} from './judge-ranking-entry.js';
// Local formatter for the comparison chart; module6 has a private formatter.
const homeComparisonNumberFormat=new Intl.NumberFormat('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2,signDisplay:'exceptZero'});
const formatIndex=value=>homeComparisonNumberFormat.format(value).replace('-', '−');
import {judgingProgress} from './judging-progress.js';
import {initializeRoutes,isFirstRoundActive} from './routes.js';
import {generalMethod,personalMethod,formulaMethod} from './methodology.js';
import {judgeGroups} from './judge-groups.js';
import {createJudgeSummary} from './judge-summary.js';
import {createCharts} from './charts.js';
import {config,DAY} from './config.js';
import {loadR1ApplicationContext} from './r1-application.js';
import {generalAt,participantStatus,verdict,mean} from './general.js';
function bootstrap(roundContext){
const D=roundContext.data,P=D.people;
D.participantOutcomes=new Map([...D.byId.keys()].map(id=>[id,roundContext.analytics.participantOutcome(id)]));
primeR2GroupReference(roundContext,D);
const activity=roundContext.activity({now:Date.now()}),outcomes=roundContext.analytics.outcomes();
Object.assign(document.querySelector('.app').dataset,{runId:roundContext.runId,policyVersion:roundContext.policyVersion,sourceSelectionVersion:roundContext.sourceSelectionVersion,snapshotKey:roundContext.snapshotKey});
const forum=P.filter(p=>D.metadata.has(p[0])),other=P.filter(p=>!D.metadata.has(p[0]));
const allScores=D.events,start=allScores.find(s=>Number.isFinite(s.t))?.t,end=Date.parse(D.updated),day=DAY;
// TUZ considers active Forum members only; Veterans belong to comparison group.
const veteranIds=new Set([...D.metadata.entries()].filter(([,m])=>m.group==='Ветераны'||m.veteran===true).map(([id])=>id));
const currentIds=new Set([...D.metadata.keys()].filter(id=>!veteranIds.has(id)));
const tuzForumIds=currentIds;
const tuzScores=allScores.map(e=>({...e,forum:tuzForumIds.has(e.userId)}));
const tuzForumCount=tuzForumIds.size,tuzOtherCount=P.length-tuzForumCount;
const fmt=(v,d=1)=>Number.isFinite(v)?v.toLocaleString('ru-RU',{minimumFractionDigits:d,maximumFractionDigits:d}).replace('-', '−'):'—';
const sign=v=>fmt(v),$=id=>document.getElementById(id),avg=mean;
const fs=allScores.filter(s=>s.forum),os=allScores.filter(s=>!s.forum);
$('about').innerHTML='<div class="panel" style="max-width:780px"><h2>Как считается индекс ТУЗа</h2>'+generalMethod+'</div><div class="panel judge-method" style="max-width:900px;margin-top:14px"><h2>Личный индекс судьи · ТУЗ</h2>'+personalMethod+formulaMethod+'</div>';
document.querySelector('.home-method-link').outerHTML='<button type="button" class="method-open" data-method="general" title="Методология индекса ТУЗа">ⓘ Как считается<span aria-hidden="true"></span></button>';
const daily=[],now=roundContext.analytics.summary({group:'forum'}),ver=verdict(now.index);
$('index-main').textContent=(now.index>0?'+':'')+fmt(now.index,2);$('index-main').style.color=ver[2];$('verdict-main').textContent=ver[1].replace('Хо-ро-шо. По форумному','Хо-ро-шо. По-форумному');$('forum-count').textContent=fmt(forum.length,0);$('scores-count').textContent=fmt(allScores.length,0);$('judges-count').textContent=new Set(allScores.map(s=>s.judge)).size;$('updated').title='';$('updated').textContent='';$('coverage').textContent='Оценок: '+fmt(allScores.length,0);
$('home-index-components').textContent='Благосклонность '+fmt(now.favor,2)+' · Внимание '+fmt(Number.isFinite(now.priority)?now.priority*.25:null,2)+' · Уважение '+fmt(now.respect,2);
$('index-main').dataset.value=String(now.index);
$('home-confidence').textContent='Форум · сравнение с остальными участниками';

$('judging-group-progress').textContent='Форум — '+fmt(now.forumProgress,2)+'% · Остальные — '+fmt(now.otherProgress,2)+'% · Разница покрытия — '+(now.progressDifference>0?'+':'')+fmt(now.progressDifference,2)+' п.п.';
const {attachChartTip,chartTooltip}=createCharts({daily,fmt,$});
const veteranScores=allScores.map(e=>({...e,forum:veteranIds.has(e.userId)}));
const veteranCount=veteranIds.size,veteranOtherCount=P.length-veteranCount;
const veteranNow=roundContext.analytics.summary({group:'veterans'});
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

const judging=judgingProgress([...D.byId.values()]);
$('required-scores').textContent=fmt(judging.required,0);
$('scores-count').textContent=fmt(judging.placed,0);
$('judging-percent').textContent=fmt(judging.percent,1)+'%';
$('judging-progress').setAttribute('aria-valuenow',String(judging.percent));
$('judging-progress').setAttribute('aria-valuetext',fmt(judging.percent,1)+'%');
$('judging-progress-fill').style.width=judging.percent+'%';
const forumStatus=forum.map(p=>{const st=participantStatus(p[3]);return {...st,passed:st.status==='pass',failed:st.status==='fail'};});


const isVeteran=p=>{const m=D.metadata.get(p[0]);return m?.group==='Ветераны'||m?.veteran===true;};
const currentForum=forum.filter(p=>!isVeteran(p)),veteranForum=forum.filter(isVeteran);
// Coverage for mutually exclusive participant groups.
const expectedPerParticipant=config.scoresPerParticipant;
for(const [groupName,people] of [['forum',currentForum],['veteran',veteranForum],['other',other]]){
 const ids=new Set(people.map(p=>p[0]));
 const required=people.length*expectedPerParticipant;
 const placed=allScores.filter(e=>ids.has(e.userId)).length;
 const percent=required>0?Math.min(100,100*placed/required):0;
 $('judging-'+groupName+'-percent').textContent=fmt(percent,1)+'%';
 $('judging-'+groupName+'-fill').style.width=percent+'%';
 $('judging-'+groupName+'-progress').setAttribute('aria-valuenow',String(percent));
 const credited=people.reduce((n,p)=>n+Math.min(p[3].length,expectedPerParticipant),0);
 $('judging-'+groupName+'-detail').textContent=fmt(credited,0)+' из '+fmt(required,0)+' слотов'+(placed>credited?' · '+fmt(placed-credited,0)+' дополнительная оценка':'');
}

const countStatus=(people,status)=>people.filter(p=>D.participantOutcomes.get(p[0]).status===status).length;
const forumPassed=countStatus(forum,'pass'),forumFailed=countStatus(forum,'fail'),forumPending=countStatus(forum,'pending');
const otherStatuses=other.map(p=>D.participantOutcomes.get(p[0])),otherPassed=otherStatuses.filter(p=>p.status==='pass').length,otherFailed=otherStatuses.filter(p=>p.status==='fail').length,otherPending=other.length-otherPassed-otherFailed;

$('home-forum-size').textContent=fmt(currentForum.length,0)+' человек';
$('home-veteran-size').textContent=fmt(veteranForum.length,0)+' человек';
$('home-other-size').textContent=fmt(other.length,0)+' человек';
const homeGroupResults={};
for(const [group,people,prefix] of [['current',currentForum,'home'],['veterans',veteranForum,'home-veteran']]){
 homeGroupResults[group]={total:people.length};
 for(const [status,suffix] of [['pass','passed'],['fail','failed'],['pending','pending']]){
  const count=countStatus(people,status);homeGroupResults[group][status]=count;
  const el=$(prefix+'-'+suffix);el.textContent=fmt(count,0);el.title='Открыть список: '+(group==='veterans'?'бывшие / ветераны':'форум')+', '+({pass:'прошли',fail:'выбыли',pending:'в борьбе'}[status]);
 }
}
$('home-other-passed').textContent=fmt(otherPassed,0);$('home-other-failed').textContent=fmt(otherFailed,0);$('home-other-pending').textContent=fmt(otherPending,0);
const totalPassed=outcomes.totalPassed,totalFailed=outcomes.failed,totalPending=outcomes.pending;
const totalDecided=totalPassed+totalFailed; const passFill=$('home-position-pass-fill'),failFill=$('home-position-fail-fill');if(passFill&&failFill){passFill.style.width=(totalDecided?totalPassed/totalDecided*100:0)+'%';failFill.style.width=(totalDecided?totalFailed/totalDecided*100:0)+'%';}const passLabel=$('home-position-pass-label'),failLabel=$('home-position-fail-label');if(passLabel)passLabel.textContent='Прошли · '+(totalDecided?fmt(100*totalPassed/totalDecided,1)+'%':'—');if(failLabel)failLabel.textContent='Выбыли · '+(totalDecided?fmt(100*totalFailed/totalDecided,1)+'%':'—');
$('home-total-size').textContent=fmt(P.length,0);
for(const [id,n,percent] of [['home-total-passed',totalPassed,true],['home-total-failed',totalFailed,true],['home-total-pending',totalPending,false]]){
 const cell=$(id);cell.textContent=fmt(n,0);
 if(percent){const small=document.createElement('small');small.className='home-group-share';small.textContent=totalDecided?fmt(100*n/totalDecided,1)+'%':'—';cell.append(small);}
}
if(activity.sourceObserved)$('home-ratings-title').textContent='Сколько действительных оценок получили участники';
const {buckets:ratingBuckets,total:ratingsTotal}=D.ratingsReport;
const maxBucket=Math.max(1,...ratingBuckets);
$('home-ratings-total').textContent=fmt(ratingsTotal,0)+' участников';
$('home-ratings-list').replaceChildren(...ratingBuckets.map((count,i)=>{
 const row=document.createElement('div');row.className='home-rating-item'+(i===config.scoresPerParticipant?' home-rating-complete':'');
 const label=document.createElement('span');label.className='home-rating-label';label.textContent=i===6?'6 оценок (Шкала Никсона)':i+' '+(i===1?'оценка':i>=2&&i<=4?'оценки':'оценок');if(i===6)label.title='6 оценок';
 const track=document.createElement('div');track.className='home-rating-track';
 const fill=document.createElement('i');fill.style.width=(count/maxBucket*100)+'%';track.append(fill);
 const value=document.createElement('strong');value.textContent=fmt(count,0)+' ('+fmt(ratingsTotal?100*count/ratingsTotal:0,1)+'%)';
 row.append(label,track,value);return row;
}));

for(const [suffix,n,label] of [['pass',otherPassed,'Прошли'],['fail',otherFailed,'Выбыли'],['pending',otherPending,'В борьбе']]){const el=$('home-other-'+suffix+'-bar');el.style.width=(other.length?n/other.length*100:0)+'%';el.title=label+': '+fmt(n,0);el.setAttribute('aria-label',el.title);}


$('home-forum-pass-bar').style.width=(forumPassed/forum.length*100)+'%';$('home-forum-fail-bar').style.width=(forumFailed/forum.length*100)+'%';
$('home-forum-pending-bar').style.width=(forumPending/forum.length*100)+'%';
const veteranIdSet=new Set(veteranForum.map(p=>p[0]));
const currentForumIdSet=new Set(currentForum.map(p=>p[0]));
const forumAverage=avg(allScores.filter(e=>currentForumIdSet.has(e.userId)).map(e=>e.score).filter(Number.isFinite)),otherAverage=avg(os.map(s=>s.score));
const veteranAverage=avg(allScores.filter(e=>veteranIdSet.has(e.userId)).map(e=>e.score).filter(Number.isFinite));
$('home-veteran-avg').textContent=fmt(veteranAverage,2);
$('home-forum-avg').textContent=fmt(forumAverage,2);$('home-other-avg').textContent=fmt(otherAverage,2);
const scoreDifference=Number.isFinite(forumAverage)&&Number.isFinite(otherAverage)?forumAverage-otherAverage:null;

for(const [id,value] of [['home-forum-average-bar',forumAverage],['home-veteran-average-bar',veteranAverage],['home-other-average-bar',otherAverage]]){
 const bar=$(id);bar.querySelector('i').style.width=Number.isFinite(value)?(value/5*100)+'%':'0%';
 if(Number.isFinite(value))bar.setAttribute('aria-valuenow',String(value));
 bar.setAttribute('aria-valuetext',Number.isFinite(value)?fmt(value,2)+' из 5':'Нет оценок');
}
for(const [id,n,label] of [['home-forum-pass-bar',forumPassed,'Прошли'],['home-forum-fail-bar',forumFailed,'Выбыли'],['home-forum-pending-bar',forumPending,'В борьбе']]){$(id).title=label+': '+fmt(n,0);$(id).setAttribute('aria-label',label+': '+fmt(n,0));}
// Личные индексы из того же среза и единой формулы ТУЗ.
const judgeNames=[...new Set(allScores.map(s=>s.judge))].sort((a,b)=>a.localeCompare(b,'ru'));
const judgeCurrent=now.judges;
let judgeSummary;
function prepareSummary(){return judgeSummary??=createJudgeSummary({rows:judgeGroups(tuzScores,veteranIds),judgeCurrent,forumCount:tuzForumCount,$,fmt,esc,chartTooltip,judgeVeterans:veteranNow.judges});}
// Shared participant rows supply forum results and judge histories.
$('coverage').textContent='';
document.querySelector('.nav.active')?.setAttribute('aria-current','page');
let rappers,dynamics;
async function preparePage(type){
 // Fetch modules alongside CSS; initialization still waits for styled geometry.
 const modules=type==='forum-link'?[import('./forum-link.js')]:type==='dynamics'?[import('./dynamics-v58.js')]:type==='judges'?[import('./judge-ranking.js'),import('./judge-profile.js')]:[];
 await Promise.all([prepareSectionStyles(type),...modules]);
 if(type==='forum-link'){
  rappers??=import('./forum-link.js').then(({createForumLink})=>createForumLink({D,$,fmt,esc,context:roundContext})).catch(error=>{rappers=null;throw error;});
  await rappers;
 }else if(type==='dynamics'){
  dynamics??=import('./dynamics-v58.js').then(({mountDynamicsV58})=>{const view=mountDynamicsV58({context:roundContext,activity,outcomes,fmt});window.addEventListener('resize',()=>{if(isFirstRoundActive())view.draw();});return view;}).catch(error=>{dynamics=null;throw error;});
  await dynamics;
 }else if(type==='judges'){prepareSummary();await Promise.all([prepareJudgeRanking(),prepareJudgeProfiles()]);}
}
const prepareJudgeProfiles=installJudgeProfiles(D);
const prepareJudgeRanking=installJudgeRanking(roundContext,D);
mountR1Home({context:roundContext,activity,summaries:{forum:now,veterans:veteranNow},groupResults:homeGroupResults,outcomes,fmt});

document.getElementById('deadline-countdown').dataset.deadline=config.deadline;window.dispatchEvent(new Event('deadline-data-ready'));$('load-state').hidden=true;
if(D.warnings.length){const note=document.createElement('div');note.className='data-warning';note.textContent=D.warnings.join(' ');document.querySelector('.main').prepend(note);}
return {D,P,allScores,daily,now,fmt,esc,$,judgeNames,judgeCurrent,judgeSummary:{draw(){judgeSummary?.draw();}},preparePage};
}
initializeRoutes({loadR1:loadR1ApplicationContext,mountR1:bootstrap});
