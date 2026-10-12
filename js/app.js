// Local formatter for the comparison chart; module6 has a private formatter.
const homeComparisonNumberFormat=new Intl.NumberFormat('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2,signDisplay:'exceptZero'});
const formatIndex=value=>homeComparisonNumberFormat.format(value).replace('-', '−');
import {createForumLink} from './forum-link.js';
import {homeDailyHistory,drawHomeHistory} from './home-history.js';
import {judgingProgress} from './judging-progress.js';
import {initializeRoutes} from './routes.js';
import {generalMethod,personalMethod,formulaMethod} from './methodology.js';
import {judgeGroups} from './judge-groups.js';
import {createJudgeSummary} from './judge-summary.js';
import {createCharts} from './charts.js';
import {config,DAY} from './config.js';
import {loadData} from './data.js';
import {generalAt,participantStatus,verdict,mean} from './general.js';
import {snapshotTimes} from './history.js';
import {createPacePage} from './pace-page.js';
async function bootstrap(){
const D=await loadData(),P=D.people;
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
const calcAt=t=>generalAt(tuzScores,tuzForumCount,tuzOtherCount,start,t);
$('about').innerHTML='<div class="panel" style="max-width:780px"><h2>Как считается индекс ТУЗа</h2>'+generalMethod+'</div><div class="panel judge-method" style="max-width:900px;margin-top:14px"><h2>Личный индекс судьи · ТУЗ</h2>'+personalMethod+formulaMethod+'</div>';
document.querySelector('.home-method-link').outerHTML='<button type="button" class="method-open" data-method="general">Как считается <span aria-hidden="true">↗</span></button>';
const daily=snapshotTimes(start,end).map(calcAt),now=generalAt(tuzScores,tuzForumCount,tuzOtherCount,start,end,{historical:false}),ver=verdict(now.index);
$('index-main').textContent=(now.index>0?'+':'')+fmt(now.index,2);$('index-main').style.color=ver[2];$('verdict-main').textContent=ver[1];$('forum-count').textContent=fmt(forum.length,0);$('scores-count').textContent=fmt(allScores.length,0);$('judges-count').textContent=new Set(allScores.map(s=>s.judge)).size;$('updated').title=Date.now()-Date.parse(D.updated)>7200000?'Последняя успешная выгрузка старше двух часов':'';$('updated').textContent=new Date(D.updated).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Moscow'})+' МСК';$('coverage').textContent='Оценок: '+fmt(allScores.length,0);
$('home-index-components').textContent='Благосклонность '+fmt(now.favor,2)+' · Внимание '+fmt(Number.isFinite(now.priority)?now.priority*.25:null,2)+' · Уважение '+fmt(now.respect,2);
$('home-confidence').textContent='Общий ТУЗ: Форум; на графике можно выбрать Ветеранов';
$('judging-group-progress').textContent='Форум — '+fmt(now.forumProgress,2)+'% · Остальные — '+fmt(now.otherProgress,2)+'% · Разница покрытия — '+(now.progressDifference>0?'+':'')+fmt(now.progressDifference,2)+' п.п.';
const {attachChartTip,chartTooltip}=createCharts({daily,fmt,$});
const veteranScores=allScores.map(e=>({...e,forum:veteranIds.has(e.userId)}));
const veteranCount=veteranIds.size,veteranOtherCount=P.length-veteranCount;
const veteranNow=generalAt(veteranScores,veteranCount,veteranOtherCount,start,end,{historical:false});
const groupHistories={
 current:homeDailyHistory(tuzScores,tuzForumCount,tuzOtherCount,start,end),
 former:homeDailyHistory(veteranScores,veteranCount,veteranOtherCount,start,end)
};
const homeVisible=new Set(['current']);
document.querySelectorAll('[data-home-group]').forEach(b=>{const active=homeVisible.has(b.dataset.homeGroup);b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
const homeSeriesMeta={current:{name:'Форум',color:'#68D99A'},former:{name:'Ветераны',color:'#E8B36B'}};
function drawHome(){
 const svg=$('chart-main'),keys=[...homeVisible],series=keys.map(key=>({key,...homeSeriesMeta[key],points:groupHistories[key]}));
 const allPoints=series.flatMap(s=>s.points),mobile=window.innerWidth<=760;
 const W=svg.clientWidth||(mobile?Math.max(280,window.innerWidth-28):760),H=mobile?270:290,L=58,R=mobile?70:112,T=18,B=36;
 const min=0,max=Math.max(20,Math.ceil(Math.max(0,...Object.values(groupHistories).flatMap(history=>history.map(p=>Number.isFinite(p.index)?p.index:0)))/10)*10),length=groupHistories.current.length;
 svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.style.height=H+'px';
 const x=i=>L+i*(W-L-R)/Math.max(1,length-1),y=v=>T+(max-v)*(H-T-B)/(max-min);
 let out=`<defs><clipPath id="home-plot-clip"><rect x="${L}" y="${T}" width="${W-L-R}" height="${H-T-B}"/></clipPath></defs>`;
 for(const [lo,hi,color] of [[20,max,'#65B78A'],[10,20,'#D5A451'],[min,10,'#D96D6B']])out+=`<rect class="home-state-strip" x="${L-13}" y="${y(hi)}" width="8" height="${y(lo)-y(hi)}" fill="${color}"/>`;
 for(let v=min;v<=max;v+=10)out+=`<line class="gridline${v===0?' home-zero-line':''}" x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L-23}" y="${y(v)+4}" text-anchor="end">${v}</text>`;
 for(const v of [10,20])out+=`<line class="home-threshold-line" x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}"/>`;
 const count=mobile?3:4;for(const i of [...new Set(Array.from({length:count},(_,j)=>Math.round(j*(length-1)/(count-1))))]){const p=groupHistories.current[i];if(p)out+=`<text x="${x(i)}" y="${H-8}" text-anchor="middle">${new Date(p.t).toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',timeZone:'Europe/Moscow'})}</text>`;}
 const endpoints=[];
 for(const serie of series){
  let segments=[],segment=[];
  serie.points.forEach((p,i)=>{if(Number.isFinite(p.index))segment.push({x:x(i),y:y(p.index)});else if(segment.length){segments.push(segment);segment=[];}});
  if(segment.length)segments.push(segment);
  for(const seg of segments)out+=`<path class="home-index-line" d="${seg.map((p,i)=>(i?'L':'M')+p.x+','+p.y).join(' ')}" fill="none" stroke="${serie.color}" stroke-width="${serie.key==='all'?2.5:2.8}" stroke-linecap="round" stroke-linejoin="round" clip-path="url(#home-plot-clip)"/>`;
  const last=serie.points.findLastIndex(p=>Number.isFinite(p.index));
  if(last>=0){const p=serie.points[last];out+=`<circle cx="${x(last)}" cy="${y(p.index)}" r="4" fill="${serie.color}"/>`;endpoints.push({serie,p,py:y(p.index)});}
 }
 // Разводим подписи по вертикали, не меняя реальные координаты точек.
 endpoints.sort((a,b)=>a.py-b.py);
 const minGap=mobile?30:34;
 endpoints.forEach((item,i)=>{item.labelY=Math.max(T+9,item.py,i?endpoints[i-1].labelY+minGap:T+9);});
 if(endpoints.length&&endpoints.at(-1).labelY>H-B-7){const shift=endpoints.at(-1).labelY-(H-B-7);endpoints.forEach(item=>item.labelY-=shift);}
 for(const item of endpoints){
  const label=formatIndex(item.p.index);
  out+=`<path d="M${x(item.serie.points.findLastIndex(p=>Number.isFinite(p.index)))+5},${item.py} L${W-R+13},${item.labelY}" stroke="${item.serie.color}" stroke-width="1" stroke-opacity=".55" fill="none"/>`;
  out+=`<text x="${W-R+19}" y="${item.labelY+4}" fill="${item.serie.color}" font-size="${mobile?12:14}" font-weight="700" text-anchor="start">${label}</text>`;
 }
 svg.innerHTML=out;
 // Единая подсказка на дату: в режиме сравнения показывает обе группы.
 svg.onpointermove=ev=>{
  const ctm=svg.getScreenCTM();if(!ctm)return;
  const pt=svg.createSVGPoint();pt.x=ev.clientX;pt.y=ev.clientY;
  const pos=pt.matrixTransform(ctm.inverse());
  if(pos.x<L||pos.x>W-R){chartTooltip.style.display='none';return;}
  const i=Math.max(0,Math.min(length-1,Math.round((pos.x-L)/(W-L-R)*Math.max(1,length-1))));
  const record=groupHistories.current[i];if(!record)return;
  const date=new Date(record.t).toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Europe/Moscow'});
  chartTooltip.classList.add('home-chart-tip');
  chartTooltip.innerHTML='<strong>'+date+'</strong>'+series.map(serie=>{const v=serie.points[i]?.index;return Number.isFinite(v)?'<div><span style="color:'+serie.color+'">●</span> '+serie.name+': <b>'+formatIndex(v)+'</b></div>':'';}).join('');
  chartTooltip.style.display='block';
  chartTooltip.style.left=Math.max(8,Math.min(ev.clientX+14,window.innerWidth-chartTooltip.offsetWidth-10))+'px';
  chartTooltip.style.top=Math.max(8,Math.min(ev.clientY+14,window.innerHeight-chartTooltip.offsetHeight-8))+'px';
 };
 svg.onpointerleave=()=>chartTooltip.style.display='none';
 svg.onclick=svg.onpointermove;
}
document.querySelectorAll('[data-home-group]').forEach(button=>button.addEventListener('click',()=>{
 const key=button.dataset.homeGroup;
 if(homeVisible.has(key)){if(homeVisible.size>1)homeVisible.delete(key);}else homeVisible.add(key);
 document.querySelectorAll('[data-home-group]').forEach(b=>{const active=homeVisible.has(b.dataset.homeGroup);b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
 drawHome();
}));
function drawPeriod(id,from){if(id==='chart-main'){drawHome();return;}}

drawHome();
window.addEventListener('resize',()=>drawPeriod('chart-main',Number($('chart-main').dataset.periodFrom)||0));
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

const pacePage=createPacePage({D,config,$,fmt,attachChartTip});
window.addEventListener('resize',pacePage.draw);
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
 $('judging-'+groupName+'-detail').textContent=fmt(placed,0)+' из '+fmt(required,0)+' оценок';
}

const countStatus=(people,status)=>people.filter(p=>participantStatus(p[3]).status===status).length;
const forumPassed=countStatus(forum,'pass'),forumFailed=countStatus(forum,'fail'),forumPending=countStatus(forum,'pending');
const otherStatuses=other.map(p=>participantStatus(p[3])),otherPassed=otherStatuses.filter(p=>p.status==='pass').length,otherFailed=otherStatuses.filter(p=>p.status==='fail').length,otherPending=other.length-otherPassed-otherFailed;

$('home-forum-size').textContent=fmt(currentForum.length,0)+' человек';
$('home-veteran-size').textContent=fmt(veteranForum.length,0)+' человек';
$('home-other-size').textContent=fmt(other.length,0)+' человек';
for(const [group,people,prefix] of [['current',currentForum,'home'],['veterans',veteranForum,'home-veteran']]){
 for(const [status,suffix] of [['pass','passed'],['fail','failed'],['pending','pending']]){
  const el=$(prefix+'-'+suffix);el.textContent=fmt(countStatus(people,status),0);el.title='Открыть список: '+(group==='veterans'?'бывшие / ветераны':'форум')+', '+({pass:'прошли',fail:'выбыли',pending:'в борьбе'}[status]);
 }
}
$('home-other-passed').textContent=fmt(otherPassed,0);$('home-other-failed').textContent=fmt(otherFailed,0);$('home-other-pending').textContent=fmt(otherPending,0);
// Add a muted within-group percentage without replacing clickable status cells.
for(const [people,prefix] of [[currentForum,'home'],[veteranForum,'home-veteran'],[other,'home-other']]){
 for(const [status,suffix] of [['pass','passed'],['fail','failed'],['pending','pending']]){
  const cell=$(prefix+'-'+suffix),n=countStatus(people,status);
  const share=document.createElement('small');share.className='home-group-share';
  share.textContent=people.length?' · '+fmt(100*n/people.length,0)+'%':'';
  cell.append(share);
 }
}

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
const judgeSummary=createJudgeSummary({rows:judgeGroups(tuzScores,veteranIds),judgeCurrent,forumCount:tuzForumCount,$,fmt,esc,chartTooltip,judgeVeterans:veteranNow.judges});
// Shared participant rows supply forum results and judge histories.
$('coverage').textContent='';
document.querySelector('.nav.active')?.setAttribute('aria-current','page');
createForumLink({D,$,fmt,esc});
initializeRoutes({D,P,allScores,daily,now,fmt,esc,$,judgeNames,judgeCurrent,judgeSummary});
document.getElementById('deadline-countdown').dataset.deadline=config.deadline;window.dispatchEvent(new Event('deadline-data-ready'));$('load-state').hidden=true;document.querySelector('.app').hidden=false;drawPeriod('chart-main',Number($('chart-main').dataset.periodFrom)||0);
if(D.warnings.length){const note=document.createElement('div');note.className='data-warning';note.textContent=D.warnings.join(' ');document.querySelector('.main').prepend(note);}
}
bootstrap().catch(error=>{const state=document.getElementById('load-state');state.className='load-error';state.textContent='Не удалось подготовить аналитику. '+error.message;const retry=document.createElement('button');retry.className='control';retry.textContent='Повторить загрузку';retry.onclick=()=>location.reload();state.append(document.createElement('br'),retry);console.error(error);});

