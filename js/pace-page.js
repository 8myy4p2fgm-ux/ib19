import {paceStatus} from './pace-status.js';
import {scoreEconomy} from './score-economy.js';
import {DAY} from './config.js';
import {paceModel,pacePlotRange,moscowDay} from './pace-model.js';
const GREEN='#93AA9C',ORANGE='#A6A9D7',RED='#D38A91',LIGHT='#F1F2EC';
const date=t=>new Date(t).toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Moscow'}).replace(/\s*г\.$/,'');
function niceMaximum(value){const raw=Math.max(1,value/4),power=10**Math.floor(Math.log10(raw)),scaled=raw/power,step=Math.max(1,Math.ceil((scaled<=1?1:scaled<=2?2:scaled<=2.5?2.5:scaled<=5?5:10)*power));return step*4;}
const shortDate=t=>new Date(t).toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',timeZone:'Europe/Moscow'});
export function createPacePage({D,config,$,fmt,attachChartTip}){
 const m=paceModel({events:D.events,participants:D.people.length,scoresPerParticipant:config.scoresPerParticipant,asOf:Date.parse(D.updated),deadline:config.deadline,now:Date.now()});
 // Historical metadata affects presentation only; paceModel receives the current deadline alone.
 const originalTime=Date.parse(config.originalDeadline),originalDeadline=Number.isFinite(originalTime)&&m.deadline!==null&&originalTime<m.deadline?originalTime:null;
 const extensionNote=$('pace-extension-note');
 if(extensionNote){
  extensionNote.hidden=originalDeadline===null;
  if(originalDeadline!==null){const days=(m.deadline-originalDeadline)/DAY;extensionNote.replaceChildren();const title=document.createElement('strong'),copy=document.createElement('span');title.textContent='Дедлайн продлён до '+new Date(m.deadline).toLocaleDateString('ru-RU',{day:'numeric',month:'long',timeZone:'Europe/Moscow'})+' · +'+days+' дня';copy.textContent='Не успели обхватить к 18-му. Судейство продолжается';extensionNote.append(title,copy);extensionNote.title='Первоначальный срок: '+date(originalDeadline)+', 23:59 МСК. Новый срок: '+date(m.deadline)+', 23:59 МСК.';}
 }
 const presentation=paceStatus(m,originalDeadline);
 $('pace-verdict').textContent=presentation.text;$('pace-verdict').dataset.tone=presentation.tone;
 const statusCaption=$('pace-status-caption');if(statusCaption){statusCaption.hidden=!presentation.caption;statusCaption.textContent=presentation.caption||'';}
 const captionNode=$('pace-caption');if(captionNode)captionNode.textContent='';
 $('pace-remaining').textContent=fmt(m.remaining,0);$('pace-current').textContent=m.rate>0&&m.rate<1?'<1':fmt(m.rate,0);
 const snapshotAsOf=m.asOf;
 function refreshNeeded(){
  const now=Date.now(),expired=m.deadline!==null&&now>=m.deadline;
  const daysLeft=m.deadline===null?null:Math.max(0,(m.deadline-now)/DAY);
  const needRate=daysLeft>0?m.remaining/daysLeft:null;
  $('pace-needed-label').textContent=expired?'Прогноз завершения':'Нужно в день';
  $('pace-needed').classList.toggle('is-forecast',expired);
  $('pace-needed').classList.remove('is-caption');
  $('pace-needed').textContent=expired?(m.remaining===0?'Завершено':m.projected!==null?date(m.projected):'Недостаточно данных'):needRate!==null?fmt(Math.ceil(needRate),0):'—';
  const help=$('pace-needed-help');if(help)help.textContent=expired?'Прогноз по последним 7 полным дням на дату выгрузки '+date(snapshotAsOf)+'.':needRate!==null?'Осталось '+fmt(m.remaining,0)+' оценок на '+fmt(daysLeft,1)+' дня до дедлайна 22 октября, 23:59 МСК. Нужно в среднем '+fmt(Math.ceil(needRate),0)+' оценок в день.':'Нельзя рассчитать без актуального дедлайна.';
 }
 refreshNeeded();
 setInterval(refreshNeeded,1000);
 $('pace-remaining-help').textContent='Всего '+fmt(m.target,0)+' оценок: '+fmt(D.people.length,0)+' участников × '+config.scoresPerParticipant+'. Осталось '+fmt(m.remaining,0)+' невыставленных.';
 let summary;
 if(m.remaining===0)summary='Судейство завершено.';
 else if(!m.enough)summary='Для прогноза недостаточно данных.';
 else if(m.rate===0)summary='Нужно возобновить судейство или увеличить число судей';
 else if(m.deadline===null)summary='Дедлайн не задан — оценить завершение в срок нельзя.';
 else if(m.deadline<=m.asOf)summary='Дедлайн прошёл. Судейство не завершено.';
 else if(m.ratio>1)summary='Нужно ускориться в '+fmt(Math.ceil(m.ratio),0)+' раз или увеличить число судей до '+fmt(m.requiredJudges,0);
 else summary='При текущем темпе судьи успевают';
 const summaryNode=$('pace-summary');if(summaryNode)summaryNode.textContent='';
 const deadlineNode=$('pace-deadline');if(deadlineNode)deadlineNode.textContent='';
 $('pace-volume-method').textContent='Нужно '+fmt(m.target,0)+' оценок: '+fmt(D.people.length,0)+' участников × '+config.scoresPerParticipant+' обязательных оценок; проходной балл — '+config.passScore+'; пары «участник + судья» учитываются один раз.';
 $('pace-deadline-method').textContent='Дедлайн '+(m.deadline!==null?date(m.deadline)+' задан в config.deadline и не подтверждён самим JSON.':'не задан в конфигурации проекта.');
 const economy=scoreEconomy([...D.byId.values()]);
 const judgeCounts=new Map();for(const e of m.unique)judgeCounts.set(e.judge,(judgeCounts.get(e.judge)||0)+1);
 const ordered=[...judgeCounts.entries()].sort((a,b)=>b[1]-a[1]||String(a[0]).localeCompare(String(b[0])));
 const leader=ordered[0],trailer=[...ordered].reverse().find(([name,count])=>count>0)||ordered.at(-1);
 const extra=m.requiredJudges!==null?Math.max(0,m.requiredJudges-m.judgeCount):null;
 const daysElapsed=m.first!==null?Math.max(1,(m.asOf-m.first)/DAY):null;
 const missingDaily=m.needRate!==null?Math.max(0,m.needRate-m.rate):null;
 const clonesFor=judge=>judge&&daysElapsed&&missingDaily!==null&&judge[1]>0?Math.ceil(missingDaily/(judge[1]/daysElapsed)):null;
 const leadClones=clonesFor(leader),slowClones=clonesFor(trailer);
 $('pace-insight-pace').textContent=m.remaining===0?'1. Судейство завершено.':m.ratio!==null&&m.ratio>1?'1. Чтобы успеть, нужно ускориться в '+fmt(m.ratio,1)+' раза или добавить '+(extra===null?'—':fmt(extra,0))+' резервных судей.':m.ratio!==null?'1. При текущем темпе судьи успевают.':'1. Пока недостаточно данных для прогноза.';
 $('pace-insight-clones').textContent=m.remaining===0?'2. Клонирование судей больше не требуется.':missingDaily===null?'2. Пока нельзя рассчитать число клонов.':'2. Или клонировать '+(leadClones===null?'—':fmt(leadClones,0))+' раз '+(leader?leader[0]:'самого продуктивного судью')+' либо '+(slowClones===null?'—':fmt(slowClones,0))+' раз '+(trailer?trailer[0]:'наименее продуктивного судью')+'.';
 $('pace-insight-saving').textContent='3. Можно было не ставить '+fmt(economy.total,0)+' оценок: '+fmt(economy.past,0)+' уже выставлены после математически решённого исхода, ещё '+fmt(economy.future,0)+' можно не выставлять. '+(m.rate>0?'Экономия — около '+fmt(economy.total/m.rate,1)+' дня при нынешнем темпе.':'');
 $('pace-economy-method').textContent='Исход определён при сумме + остаток ≥ '+config.passScore+' или сумме + остаток × '+config.maxScore+' < '+config.passScore+': считаем оценки после первого такого момента и оставшиеся слоты, это гипотетическая экономия — официальное обязательство, объём и прогноз сохраняются.';
 $('pace-economy-limit').hidden=economy.ambiguous===0;
 $('pace-economy-limit').textContent=fmt(economy.ambiguous,0)+' участников исключены из исторической экономии из-за неоднозначных дат.';
 function frame(svg,activity=false){
  const mobile=window.innerWidth<=760;
  const fallback=window.innerWidth<=760?window.innerWidth-28:Math.min(1280,window.innerWidth-2*Math.max(24,Math.min(64,window.innerWidth*.04)));
  const W=Math.max(240,svg.clientWidth||fallback),H=activity?(mobile?280:360):(mobile?290:330),L=mobile?51:76,R=mobile?24:42,T=mobile?36:48,B=46;
  svg.setAttribute('viewBox','0 0 '+W+' '+H);svg.style.height=H+'px';
  return {W,H,L,R,T,B,mobile};
 }
 function axes({W,H,L,R,T,B,mobile},start,end,max){
  const x=t=>L+(t-start)/Math.max(DAY,end-start)*(W-L-R),y=v=>T+(max-v)/max*(H-T-B);
  let html='';const step=max/4;
  for(let value=0;value<=max+step*.01;value+=step){const label=H>280&&value>=1000&&value%1000===0?fmt(value/1000,0)+' тыс.':fmt(value,0);html+='<line class="pace-grid" x1="'+L+'" x2="'+(W-R)+'" y1="'+y(value)+'" y2="'+y(value)+'"/><text x="'+(L-8)+'" y="'+(y(value)+4)+'" text-anchor="end">'+label+'</text>';}
  const count=mobile?3:4;
  for(let i=0;i<count;i++){if(i===count-1&&m.projected!==null)continue;const t=start+(end-start)*i/(count-1);if(!(m.deadline!==null && Math.abs(x(t)-x(m.deadline))<66) && !(m.projected!==null && Math.abs(x(t)-x(m.projected))<72))html+='<text x="'+x(t)+'" y="'+(H-9)+'" text-anchor="'+(i===0?'start':i===count-1?'end':'middle')+'">'+shortDate(t)+'</text>';}
  return {x,y,html};
 }
 function drawProgressScale(){
  const percent=value=>Math.max(0,Math.min(100,100*value/Math.max(1,m.target)));
  const projectedByDeadline=m.deadline===null?null:(m.remaining===0?m.done:(m.enough&&m.rate>0?Math.max(m.done,Math.min(m.target,m.done+m.rate*Math.max(0,m.deadline-m.asOf)/DAY)):null));
  const projected=projectedByDeadline===null?m.done:projectedByDeadline;
  const factPct=percent(m.done),projectionPct=percent(projected);
  $('pace-progress-fill').style.width=factPct+'%';
  $('pace-progress-forecast').style.left=factPct+'%';
  $('pace-progress-forecast').style.width=Math.max(0,projectionPct-factPct)+'%';
  $('pace-progress-now').style.left=factPct+'%';
  $('pace-progress-deadline').style.left=projectionPct+'%';
  $('pace-progress-fact').textContent=fmt(m.done,0)+' · '+fmt(factPct,0)+'%';
  $('pace-progress-estimate').textContent=projectedByDeadline===null?'—':fmt(projectedByDeadline,0)+' · '+fmt(projectionPct,0)+'%';
  $('pace-progress-total').textContent=fmt(m.target,0);
  $('pace-progress-now-date').textContent=shortDate(m.asOf)+' · факт';
  $('pace-progress-deadline-date').textContent=m.deadline===null?'Дедлайн не задан':shortDate(m.deadline)+' · дедлайн';
 }
 function drawFinish(){
  const svg=$('pace-finish-chart'),f=frame(svg),range=pacePlotRange(m),max=niceMaximum(m.target);f.T=f.mobile?31:33;f.B=originalDeadline!==null?108:86;if(originalDeadline!==null)range.start=Math.min(range.start,moscowDay(originalDeadline));const a=axes(f,range.start,range.end,max);
  const {x,y}=a;let html='<defs><linearGradient id="pace-fact-glow" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#9ABFAE" stop-opacity=".17"/><stop offset="100%" stop-color="#9ABFAE" stop-opacity="0"/></linearGradient></defs>'+a.html;

  if(originalDeadline!==null&&originalDeadline>=range.start&&originalDeadline<=range.end)html+='<line class="pace-original-deadline-line" x1="'+x(originalDeadline)+'" x2="'+x(originalDeadline)+'" y1="'+f.T+'" y2="'+(f.H-f.B)+'"/>';
  if(m.deadline!==null&&m.deadline>=range.start&&m.deadline<=range.end)html+='<line class="pace-deadline-line" x1="'+x(m.deadline)+'" x2="'+x(m.deadline)+'" y1="'+f.T+'" y2="'+(f.H-f.B)+'"/>';
  const fact=m.days.map(d=>({t:Math.min(d.t+DAY-1,m.asOf),count:d.cumulative}));
  if(fact.length){const path=fact.map((p,i)=>(i?'L':'M')+x(p.t)+','+y(p.count)).join(' ');html+='<path class="pace-fact-fill" d="'+path+' L'+x(fact.at(-1).t)+','+y(0)+' L'+x(fact[0].t)+','+y(0)+' Z"/>';html+='<path class="pace-fact-line" d="'+path+'"/>';html+='<circle class="pace-last-point-halo" cx="'+x(fact.at(-1).t)+'" cy="'+y(fact.at(-1).count)+'" r="10"/><circle class="pace-last-point" cx="'+x(fact.at(-1).t)+'" cy="'+y(fact.at(-1).count)+'" r="4.5"/>';const current=fact.at(-1),cx=x(current.t),cy=y(current.count);const labelX=Math.max(f.L+50,cx-18),labelY=Math.max(f.T+17,cy-24);html+='<text class="pace-current-value" x="'+labelX+'" y="'+labelY+'" text-anchor="end">'+fmt(m.done,0)+'</text>';}
  const anchor=fact.at(-1),forecast=[];if(range.forecastEnd!==null&&anchor){
   forecast.push(anchor);
   for(let t=anchor.t+DAY;t<range.forecastEnd;t+=DAY)forecast.push({t,count:Math.min(m.target,anchor.count+m.rate*(t-anchor.t)/DAY)});
   forecast.push({t:range.forecastEnd,count:Math.min(m.target,anchor.count+m.rate*(range.forecastEnd-anchor.t)/DAY)});
   html+='<path class="pace-projection-line" d="'+forecast.map((p,i)=>(i?'L':'M')+x(p.t)+','+y(p.count)).join(' ')+'"/>';
  }
  
  // A restrained post-deadline band makes a late finish visible without deficit metrics.
  if(m.deadline!==null&&m.projected!==null&&m.projected>m.deadline&&m.deadline<range.end){
   const left=Math.max(f.L,x(Math.max(range.start,m.deadline))),right=Math.min(f.W-f.R,x(range.end));
   if(right>left)html=html.replace('</defs>','</defs><rect class="pace-late-band" x="'+left+'" y="'+f.T+'" width="'+(right-left)+'" height="'+(f.H-f.B-f.T)+'"/>');
  }
  // Direct labels describe existing reference lines; forecast math stays unchanged.
   
  // Each annotation has its own lane, independent of date proximity and the axis ticks.
  if(originalDeadline!==null&&originalDeadline>=range.start&&originalDeadline<=range.end){
   const ox=x(originalDeadline),labelX=Math.max(f.L+94,Math.min(f.W-f.R-94,ox));
   html+='<text class="pace-original-deadline-label" x="'+labelX+'" y="'+(f.H-76)+'" text-anchor="middle">Первоначальный срок · '+shortDate(originalDeadline)+'</text>';
  }
  if(m.deadline!==null&&m.deadline>=range.start&&m.deadline<=range.end){
   const dx=x(m.deadline),labelX=Math.max(f.L+55,Math.min(f.W-f.R-55,dx));
   html+='<circle cx="'+dx+'" cy="'+(f.H-f.B)+'" r="3.5" fill="#C3A46A"/><text class="pace-deadline-bottom" x="'+labelX+'" y="'+(originalDeadline!==null?f.H-54:f.H-32)+'" text-anchor="middle">'+(originalDeadline!==null?'Новый срок':'Дедлайн')+' · '+shortDate(m.deadline)+'</text>';
  }
  if(m.projected!==null&&m.enough&&forecast.length){
   const last=forecast.at(-1),dateLabel=shortDate(m.projected),truncated=range.truncated;
   const px=x(last.t),py=y(last.count),right=px>f.W-f.R-120;
   const label=(truncated?'Прогноз за пределами графика':'Финиш ≈ '+dateLabel);
   const labelY=Math.max(f.T+34,Math.min(f.H-f.B-12,py-15));
   html+='<circle class="pace-forecast-end" cx="'+px+'" cy="'+py+'" r="4"/>';
   html+='<text class="pace-finish-date-tick" x="'+Math.max(f.L+50,Math.min(f.W-f.R-50,px))+'" y="'+(originalDeadline!==null?f.H-32:f.H-52)+'" text-anchor="middle">Финиш ≈ '+shortDate(m.projected)+'</text>';
   // Show the projected cumulative score at the endpoint, inside the chart bounds.
   // The label is anchored to the right and shifted away from the dot and upper gridline.
   const valueLabel=fmt(Math.round(last.count),0);
   const labelX=Math.max(f.L+65,Math.min(f.W-12,px-12));
   const labelYValue=py<f.T+30?py+27:py-17;
   html+='<text class="pace-forecast-value" x="'+labelX+'" y="'+labelYValue+'" text-anchor="end">'+valueLabel+'</text>';
  }
  const finishDate=$('finish-date-value');
  if(finishDate)finishDate.textContent=m.remaining===0?'Завершено':m.projected!==null?(new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',timeZone:'Europe/Moscow'}).format(new Date(m.projected))):'Недостаточно данных';
  svg.innerHTML=html;
  const points=[...fact.map(p=>({...p,kind:'fact'})),...forecast.filter(p=>p.t>m.asOf).map(p=>({...p,kind:'forecast'}))],times=points.map(p=>p.t);
  if(times.length)attachChartTip(svg,[{name:'Факт',color:GREEN,values:points.map(p=>p.kind==='fact'?p.count:null),format:v=>fmt(v,0)},{name:'Прогноз · расчётное значение',color:ORANGE,values:points.map(p=>p.kind==='forecast'?p.count:null),format:v=>fmt(v,0)}],times,f.L,f.W-f.R,x);
  $('pace-horizon').hidden=!(range.truncated||range.deadlineHidden);
  $('pace-horizon').textContent=(range.truncated?'Прогноз на графике ограничен 90 днями после выгрузки; завершение находится за показанным горизонтом. ':'')+(range.deadlineHidden?'Дедлайн находится за пределами показанного горизонта. ':'')+(!m.enough?'Для обоснованного прогноза не хватает полной семидневной истории.':'');
 }
 const activitySvg=$('pace-activity-chart'),judgeToggle=$('pace-judge-toggle'),judgePanel=$('pace-judge-panel'),judgeOptions=$('pace-judge-options'),judgeCurrent=$('pace-judge-current');
 const completeDays=m.days.filter(d=>!d.partial);
 const dailyJudgeCounts=new Map();
 const completedSet=new Set(completeDays.map(d=>d.t));
 for(const e of m.unique){const day=moscowDay(e.t);if(!completedSet.has(day))continue;dailyJudgeCounts.set(e.judge,(dailyJudgeCounts.get(e.judge)||0)+1);}
 const judges=[...dailyJudgeCounts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'ru'));
 let selectedJudge='';
 function closeJudgePanel(){judgePanel.hidden=true;judgeToggle.setAttribute('aria-expanded','false');}
 function chooseJudge(name){selectedJudge=name;judgeCurrent.textContent=name||'Все судьи';for(const b of judgeOptions.querySelectorAll('button')){const active=b.dataset.judge===name;b.classList.toggle('is-active',active);b.setAttribute('aria-pressed',String(active));}closeJudgePanel();drawActivity();}
 function addJudgeOption(name,count){const b=document.createElement('button');b.type='button';b.className='pace-judge-option';b.dataset.judge=name;b.setAttribute('aria-pressed',String(name===''));const label=document.createElement('span');label.textContent=name||'Все судьи';const amount=document.createElement('small');amount.textContent=fmt(count,0);b.append(label,amount);b.addEventListener('click',()=>chooseJudge(name));judgeOptions.appendChild(b);}
 addJudgeOption('',completeDays.reduce((a,d)=>a+d.count,0));for(const [name,count] of judges)addJudgeOption(name,count);
 judgeToggle.addEventListener('click',()=>{const opening=judgePanel.hidden;judgePanel.hidden=!opening;judgeToggle.setAttribute('aria-expanded',String(opening));});
 $('pace-judge-close').addEventListener('click',()=>chooseJudge(''));
 document.addEventListener('click',e=>{if(!judgePanel.hidden&&!e.target.closest('.pace-activity-full .pace-chart-head'))closeJudgePanel();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!judgePanel.hidden){closeJudgePanel();judgeToggle.focus();}});
 function drawActivity(){
  const svg=activitySvg,f=frame(svg,true);
  if(!completeDays.length){svg.innerHTML='<text x="20" y="60">Пока нет полных дней с оценками</text>';return;}
  const counts=new Map(completeDays.map(d=>[d.t,0]));
  if(selectedJudge){for(const e of m.unique){if(e.judge!==selectedJudge)continue;const day=moscowDay(e.t);if(counts.has(day))counts.set(day,counts.get(day)+1);}}
  const days=completeDays.map(d=>({t:d.t,count:selectedJudge?counts.get(d.t):d.count}));
  const maximum=niceMaximum(Math.max(1,...days.map(d=>d.count))),start=days[0].t,end=days.at(-1).t+DAY,a=axes(f,start,end,maximum),{x,y}=a,slot=(f.W-f.L-f.R)/days.length;
  let html=a.html;
  for(const d of days)html+='<rect class="pace-activity-bar" x="'+(x(d.t)+slot*.15)+'" y="'+y(d.count)+'" width="'+slot*.7+'" height="'+(y(0)-y(d.count))+'"/>';
  svg.innerHTML=html;
  const times=days.map(d=>d.t+DAY/2);
  attachChartTip(svg,[{name:selectedJudge||'Все судьи',color:GREEN,values:days.map(d=>d.count),format:v=>fmt(v,0)}],times,f.L,f.W-f.R,x);
 }


 function draw(){drawFinish();drawActivity();}
 draw();return {model:m,draw};
}

