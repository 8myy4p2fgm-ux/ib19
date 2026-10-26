import {bindReportURL,writeReportURL} from './report-catalog.js';
import {renderClockDoodle} from './clock-doodle.js';
import {mountHourJudgeSelect} from './hour-judge-select.js';
import {mountPaceTooltip} from './pace-tooltip.js';
import {availableReports,availableReportIndex,nextAvailableReport,onReportFallback} from './report-availability.js';
import {keepActiveReportVisible} from './report-tabs.js';
import {getV58Research} from './v58-research-model.js';
import {mountV58OutcomeHistory} from './v58-outcome-history.js';
import {mountV58Distribution} from './v58-distribution.js';
import {v58Method,distributionMethodDetails} from './v58-research-methods.js';
import {hourBins} from './dynamics-hours.js';
import {mountActivityClock} from './activity-clock.js';
// Native port of V58 reports/progress.js pace() and hours(); no iframe/data loader.
export function mountDynamicsV58({context,activity,outcomes,fmt:format,legacyPace}){
 const fmt=(n,d=0)=>format(n,d);
 const root=document.getElementById('dynamics'),asOf=Date.parse(context.exportedAt);
 const E=activity.factual.events.map(e=>({...e,j:e.judge}));
 const names=[...new Set(E.map(e=>e.j))].sort((a,b)=>a.localeCompare(b,'ru'));
 const m={...activity.slots,days:activity.factual.days,done:activity.factual.count};
 let hourClock,hourJudgeSelect;
 const research=getV58Research(context);let gapHistory,gapDistribution;
 const D=86400000;let report=0,hourJudge='',hour=null,hourPinned=false,paceMode='daily';
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const date=(t,full=false)=>new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',...(full?{year:'numeric',hour:'2-digit',minute:'2-digit'}:{})}).format(t);
 const scoreForm=n=>{const a=Math.abs(Math.round(Number(n)))%100,u=a%10;return a>=11&&a<=14?'оценок':u===1?'оценка':u>=2&&u<=4?'оценки':'оценок'};
 const select=(id,value)=>`<select class="control" id="${id}" aria-label="Судья"><option value="">Все судьи</option>${names.map(n=>`<option ${n===value?'selected':''}>${esc(n)}</option>`).join('')}</select>`;
 // The shared resize handler still updates these legacy nodes by ID. Keep them
 // hidden and outside the report surfaces, without a disclosure or layout space.
 const existing=document.createElement('div');existing.className='int08-legacy-data';existing.hidden=true;
 existing.append(...root.childNodes);
 const available=availableReports('dynamics');
 const labels=['Итоги отбора','Хроника сугейства','Судейские сутки','Распределение баллов','Скорострелы','Решающие оценки'];
 root.innerHTML=`<div class="r38-results-host r40-report r41-report"><header class="r38-hero v41-header"><div class="v41-kicker"><span>TUZ19 / РАУНД 01</span><span aria-hidden="true">|</span><strong>Всё, кроме правды</strong></div><h1>Ход баттла</h1><p class="rpt-page-intro">Как шло судейство и складывались итоги первого раунда.</p></header><nav class="r38-tabs report-tabs" role="tablist" aria-label="Исследования первого раунда">${labels.map((s,i)=>available.includes(i)?`<button type="button" class="r38-tab" role="tab" id="int08-tab-${i}" aria-controls="int08-report-${i}" data-dynamics-tab="${i}" aria-selected="${i===0}" tabindex="${i===0?0:-1}">${s}</button>`:'').join('')}</nav>${labels.map((s,i)=>`<div class="analytical-report-surface" id="int08-report-${i}" ${available.includes(i)?`role="tabpanel" aria-labelledby="int08-tab-${i}"`:'inert aria-hidden="true"'} ${i?'hidden':''}></div>`).join('')}<footer class="report-method-footer"><button type="button" class="r38-plain-button" id="int08-method-open">ⓘ Как считаем</button></footer></div>`;
 keepActiveReportVisible(root.querySelector('.report-tabs'));
 // Presentation only: shared provenance/method controls travel with the active
 // working surface, outside the charts' redraw targets.
 const reportNotes=root.querySelector('.report-method-footer');
 root.dataset.snapshotKey=context.snapshotKey;

 root.querySelector('#int08-report-0').innerHTML=`<div class="r38-section-head r40-report-head"><h2>Итоги отбора</h2></div><div class="r40-summary-panel r41-summary-panel"><div class="r41-stats"><div><span>Прошли</span><strong class="r40-pass">${fmt(outcomes.totalPassed,0)}</strong></div><div><span>Вылетели</span><strong class="r40-fail">${fmt(outcomes.failed,0)}</strong></div></div><div class="r38-outcome-track r41-summary-track"><i style="width:${100*outcomes.totalPassed/outcomes.participants}%"></i><i style="width:${100*outcomes.failed/outcomes.participants}%"></i></div></div><div id="gap-outcome-history"></div>`;
 const host=document.createElement('div');host.id='battle-progress';host.innerHTML='<article class="bp-panel" id="bp-report"></article>';
 const panel=host.querySelector('#bp-report');
  // One source renderer host is moved between native panels; it never mounts another router.
 function svgFrame(title,height=300){const W=Math.max(200,Math.min(1200,panel.clientWidth-44));return {W,H:height,L:48,R:22,T:18,B:36,title};}
 function svg(f,html){return `<svg class="bp-chart" role="img" aria-label="${f.title}" viewBox="0 0 ${f.W} ${f.H}">${html}</svg>`;}
function pace(){
 const days=m.days;
 const oldDeadline=Date.parse('2026-10-18T23:59:00+03:00');
 const newDeadline=activity.slots.deadline;
 const split=Date.parse('2026-10-05T00:00:00+03:00');
 const graphTitle=paceMode==='daily'?'Оценки по дням':'Накопление оценок';
 panel.innerHTML=`<div class="v44-report v44-pace-report">
  <header class="v44-report-head"><h2>Хроника судейства</h2></header>
  <section class="v44-chart-card" aria-labelledby="v44-chart-title">
   <div class="v44-chart-heading"><h3 id="v44-chart-title">${graphTitle}</h3>
    <div class="v44-chart-switch" role="group" aria-label="Вид графика">
     <button type="button" id="bp-daily" class="${paceMode==='daily'?'active':''}" aria-pressed="${paceMode==='daily'}">По дням</button>
     <button type="button" id="bp-cumulative" class="${paceMode==='cumulative'?'active':''}" aria-pressed="${paceMode==='cumulative'}">Накопление</button>
    </div>
   </div>
   <ul class="v19-pace-events" aria-label="События судейства">
    <li style="--pace-event-color:#B5A59A"><i aria-hidden="true"></i><span>05.10 · Старт активного судейства</span></li>
    <li style="--pace-event-color:#CE926D"><i aria-hidden="true"></i><span>18.10 · Прикол дедлайн</span></li>
    ${newDeadline===null?'':`<li style="--pace-event-color:#9F9CCD"><i aria-hidden="true"></i><span>${date(newDeadline)} · Настоящий дедлайн</span></li>`}
   </ul>
   <div id="bp-pace-plot" class="v44-chart-stage"></div>
   <div class="v44-chart-key" aria-label="Легенда графика">
    ${paceMode==='daily'?'<span><i class="v44-key v44-key-early"></i>До 05.10</span><span><i class="v44-key v44-key-active"></i>После 05.10</span>':'<span><i class="v44-key v44-key-line"></i>Выставленные оценки</span>'}
   </div>
  </section>
 </div>`;
 const target=panel.querySelector('#bp-pace-plot');
 const f=svgFrame(graphTitle,paceMode==='daily'?278:278);
 const {W,H,L,R,T,B:bt}=f;
 const first=days[0]?.t??asOf;
 const start=first;
 const end=Math.max(days.at(-1)?.t??asOf,newDeadline??asOf);
 const plotW=W-L-R,plotH=H-T-bt;
 const x=t=>L+(t-start)/Math.max(1,end-start)*plotW;
 const maxValue=paceMode==='daily'?Math.max(1,...days.map(d=>d.count))*1.16:Math.ceil(Math.max(m.done,1)/2000)*2000;
 const y=v=>T+plotH-(Math.max(0,v)/maxValue)*plotH;
 const ty=i=>i===0?'0':fmt(Math.round(maxValue*i/4));
 let chart=`<rect x="${Math.max(L,x(split))}" y="${T}" width="${Math.max(0,W-R-x(split))}" height="${plotH}" fill="#a68e7023" />`;
 chart+=`<line x1="${x(split)}" x2="${x(split)}" y1="${T}" y2="${H-bt}" stroke="#B5A59A" stroke-opacity=".85" stroke-width="1.4" stroke-dasharray="4 4" />`;
 for(let i=0;i<=4;i++){
  const value=maxValue*i/4;
  chart+=`<line x1="${L}" x2="${W-R}" y1="${y(value)}" y2="${y(value)}" stroke="#88958d" stroke-opacity=".23" stroke-dasharray="3 6" />`;
  chart+=`<text x="${L-8}" y="${y(value)+4}" text-anchor="end">${ty(i)}</text>`;
 }
 if(paceMode==='daily'){
  const slot=plotW/(Math.max(1,(end-start)/D));
  for(const d of days){
   const bw=Math.max(2,slot*.69),xx=x(d.t)+slot*.15,yy=y(d.count),barColor=d.t<split?'#84939A':'#C1A07C';
   chart+=`<rect x="${xx}" y="${yy}" width="${bw}" height="${Math.max(1,T+plotH-yy)}" rx="1.8" fill="${barColor}" opacity="${d.partial?.48:.92}"><title>${date(d.t)}: ${fmt(d.count)} оценок${d.partial?' (неполные сутки)':''}</title></rect>`;
  }
 }else{
  const d=days.map((item,i)=>(i?'L':'M')+x(item.t+D*.5).toFixed(2)+' '+y(item.cumulative).toFixed(2)).join(' ');
  chart+=`<path d="${d}" fill="none" stroke="#A8C8B7" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />`;
  if(days.length){
   const last=days.at(-1),px=x(last.t+D*.5),py=y(last.cumulative),value=fmt(last.cumulative),labelX=px-8;
   const labelY=Math.max(T+22,py-16);
   chart+=`<circle class="int08-end-point" cx="${px}" cy="${py}" r="4.5" fill="#A8C8B7"/><line class="int08-end-leader" x1="${labelX+4}" y1="${labelY-4}" x2="${px-4}" y2="${py-4}" stroke="#A8C8B7"/><text class="int08-end-label" x="${labelX}" y="${labelY}" text-anchor="end" fill="#d1e0d5">${value}</text>`;
  }
 }
 for(const [t,c] of [[oldDeadline,'#CE926D'],[newDeadline,'#9F9CCD']].filter(([t])=>t!==null)){
  const xx=x(t);
  chart+=`<line x1="${xx}" x2="${xx}" y1="${T}" y2="${H-bt}" stroke="${c}" stroke-width="1.8" stroke-dasharray="5 5"/>`;
  chart+=`<circle cx="${xx}" cy="${T}" r="3" fill="${c}"/>`;
 }
 const ticks=[start,Date.parse('2026-09-15T00:00:00+03:00'),split,oldDeadline,newDeadline];
 for(const [i,t] of ticks.entries()){
  // On phones the deadline markers are close together; both remain in the legend,
  // but omit the first date from the crowded horizontal axis.
  if(W<610 && t===oldDeadline)continue;
  if(t===null||t<start||t>end)continue;const xx=x(t);chart+=`<text class="int08-date-label" x="${xx}" y="${H-8}" text-anchor="${i===0?'start':i===ticks.length-1?'end':'middle'}">${date(t)}</text>`;
 }
 target.innerHTML=svg(f,chart);
 // Keep the endpoint value clear of every event marker, using real glyph bounds.
 // Only the annotation moves; the series, time axis and value scale stay intact.
 const endpoint=target.querySelector('.int08-end-label');
 if(endpoint){
  const width=endpoint.getBBox().width,point=target.querySelector('.int08-end-point');
  let right=Number(point.getAttribute('cx'))-8;
  for(const mark of [split,oldDeadline,newDeadline].filter(t=>t!==null).map(x).sort((a,b)=>b-a)){
   if(mark>=right-width-8&&mark<=right+8)right=mark-10;
  }
  right=Math.max(L+width,right);
  endpoint.setAttribute('x',right);
  target.querySelector('.int08-end-leader').setAttribute('x1',right+4);
 }
 // Cull only colliding date labels using their actual glyph bounds. The time
 // scale and series stay untouched, and the first/last dates remain visible.
 const labels=[...target.querySelectorAll('.int08-date-label')],last=labels.at(-1);
 if(labels.length>1){let right=-Infinity;const limit=last.getBBox().x-8;
  for(const label of labels.slice(0,-1)){const box=label.getBBox();if(box.x<right+8||box.x+box.width>limit)label.remove();else right=box.x+box.width;}
 }
 mountPaceTooltip(target,{days,mode:paceMode,x,y,W,H,L,R,T,B:bt,fmt});
 function selectMode(mode,id){const focused=panel.querySelector('#'+id)===document.activeElement;paceMode=mode;pace();if(focused)panel.querySelector('#'+id).focus({preventScroll:true});}
 panel.querySelector('#bp-daily').onclick=()=>selectMode('daily','bp-daily');
 panel.querySelector('#bp-cumulative').onclick=()=>selectMode('cumulative','bp-cumulative');
}
function hours(){
 const focusedHour=panel.contains(document.activeElement)?document.activeElement.closest('.clock-sector')?.dataset.hour:null;
 hourClock?.destroy();hourJudgeSelect?.destroy();
 const es=E.filter(e=>!hourJudge||e.j===hourJudge);
 const bins=hourBins(activity.factual.events,hourJudge);
 const peakHour=bins.indexOf(Math.max(...bins));
 const night=bins.slice(0,6).reduce((a,b)=>a+b,0),total=es.length;
 const hh=h=>String(h).padStart(2,'0');
 const range=h=>`${hh(h)}:00–${hh(h)}:59`;
 if(!hourPinned)hour=peakHour;
 panel.innerHTML=`<div class="v44-report v44-hours-report v46-hours-report v20-hours cardiogram">
  <div class="v44-report-head"><div><h2>Судейские сутки</h2><p>Когда судьи ставили оценки</p></div>
   <div class="v44-judge-select">${select('bp-hour-judge',hourJudge)}</div></div>
  <div class="v44-hours-grid v46-clock-layout">
   <section class="v46-clock-panel" aria-label="Суточная кардиограмма по 24 часам">
    <div id="bp-hour-dial" class="v46-clock"></div>
    <div class="v44-hour-legend"><span><i class="v44-key v44-key-night"></i>Ночь</span><span><i class="v44-key v44-key-regular"></i>Остальные часы</span><span><i class="v44-key v44-key-peak"></i>Пик</span></div>
    <p class="clock-timezone">Московское время</p>
   </section>
   <aside class="v44-hour-aside has-clock-doodle" aria-label="Сводка активности">
    ${renderClockDoodle(bins,hourJudge?(research.judgeIdentities.get(hourJudge)??null):'all')}
    <div class="clock-selected-hour"></div>
    <div class="v44-hour-feature"><span>Самый активный час</span><strong data-clock-peak>${total?range(peakHour):'—'}</strong><small>${fmt(bins[peakHour])} ${scoreForm(bins[peakHour])}</small></div>
    <div class="v44-hour-feature v44-hour-night" aria-label="Ночная активность, 00:00–05:59"><span>Ночная активность</span><strong data-clock-night>${fmt(total?100*night/total:0,1)}%</strong><small>${fmt(night)} ${scoreForm(night)}</small></div>
   </aside>
  </div>
 </div>`;
 hourClock=mountActivityClock(panel.querySelector('#bp-hour-dial'),{bins,total,peakHour,selectedHour:hour,fmt,readoutHost:panel.querySelector('.clock-selected-hour'),onSelect:i=>{hour=i;hourPinned=true;}});
 if(focusedHour!=null)panel.querySelector('.clock-sector[data-hour="'+focusedHour+'"]')?.focus({preventScroll:true});
 panel.querySelector('#bp-hour-judge').onchange=e=>{const focused=panel.querySelector('.hour-judge-select').contains(document.activeElement);hourJudge=e.target.value;hours();if(focused)panel.querySelector('#bp-hour-judge-trigger').focus({preventScroll:true});};
 hourJudgeSelect=mountHourJudgeSelect(panel.querySelector('#bp-hour-judge'));
}

 // The responsive hourly SVG updates labels in place; resize must not replace its focused node.
 function draw(){if(!root.classList.contains('active'))return;if(report===0)gapHistory?.draw();else if(report===3)gapDistribution?.draw();else if(report===1)pace();else if(!panel.querySelector('#bp-hour-dial'))hours();if(report===3)reportNotes.remove();else root.querySelector('#int08-report-'+report).append(reportNotes);}
 function choose(i,focus=false,write=true){if(write)writeReportURL('dynamics',i);i=availableReportIndex('dynamics',i);if(i!==2){hourClock?.destroy();hourJudgeSelect?.destroy();}report=i;root.querySelectorAll('[data-dynamics-tab]').forEach(b=>{const yes=+b.dataset.dynamicsTab===i;b.setAttribute('aria-selected',String(yes));b.tabIndex=yes?0:-1;if(yes&&focus)b.focus();});for(let n=0;n<labels.length;n++)root.querySelector('#int08-report-'+n).hidden=n!==i;
  if(i===1||i===2)root.querySelector('#int08-report-'+i).append(host);
  if(i===1){pace();}else if(i===2)hours();else if(i===0){if(!gapHistory)gapHistory=mountV58OutcomeHistory(root.querySelector('#gap-outcome-history'),research);else gapHistory.draw();}else if(i===3){if(!gapDistribution)gapDistribution=mountV58Distribution(root.querySelector('#int08-report-3'),research.distributions);else gapDistribution.draw();}
  if(i===3)reportNotes.remove();else root.querySelector('#int08-report-'+i).append(reportNotes);reportNotes.hidden=i===0||i===1||i===2||i===3||i===4;
 }
 for(const button of root.querySelectorAll('[data-dynamics-tab]')){button.onclick=()=>choose(+button.dataset.dynamicsTab);button.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();choose(nextAvailableReport('dynamics',+button.dataset.dynamicsTab,e.key),true);}};}
 onReportFallback('dynamics',choose);bindReportURL('dynamics',root,choose);
 const dialog=document.createElement('dialog');dialog.className='bp-dialog';dialog.id='int08-method-dialog';dialog.setAttribute('aria-labelledby','int08-method-title');dialog.innerHTML='<div class="bp-dialog-head"><h2 id="int08-method-title">Методология</h2><button type="button" aria-label="Закрыть">×</button></div>';
 dialog.addEventListener('keydown',e=>{if(e.key==='Tab'){const stops=[...dialog.querySelectorAll('button,summary')],first=stops[0],last=stops.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
 root.append(dialog);
 root.querySelector('#int08-report-0').append(reportNotes);
 const opener=root.querySelector('#int08-method-open');let methodScroll,methodOutside=false;
 function openGapMethod(button){dialog.querySelectorAll(':scope>p,:scope>details').forEach(p=>p.remove());const text=document.createElement('p');text.textContent=v58Method('dynamics',report,research);dialog.append(text);if(report===3){const details=document.createElement('details'),summary=document.createElement('summary'),formulas=document.createElement('p');summary.textContent='Подробные формулы и ограничения';formulas.textContent=distributionMethodDetails;details.append(summary,formulas);dialog.append(details);}gapMethodOrigin=button;methodScroll={html:document.documentElement.style.overflow,body:document.body.style.overflow};dialog.showModal();document.documentElement.style.overflow='hidden';document.body.style.overflow='hidden';dialog.querySelector('button').focus({preventScroll:true});}
 let gapMethodOrigin=opener;opener.onclick=()=>openGapMethod(opener);
 dialog.querySelector('button').onclick=()=>dialog.close();
 const outsideMethod=e=>{const r=dialog.getBoundingClientRect();return e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom);};
 dialog.addEventListener('pointerdown',e=>{methodOutside=outsideMethod(e);});dialog.addEventListener('click',e=>{if(methodOutside&&outsideMethod(e))dialog.close();methodOutside=false;});
 dialog.addEventListener('close',()=>{if(methodScroll){document.documentElement.style.overflow=methodScroll.html;document.body.style.overflow=methodScroll.body;methodScroll=null;}if(root.classList.contains('active'))gapMethodOrigin?.focus({preventScroll:true});});
 let lastReportWidth=-1;new ResizeObserver(entries=>{const width=entries[0].contentRect.width;if(width<=0||Math.abs(width-lastReportWidth)<1)return;lastReportWidth=width;if(!host.contains(document.activeElement)){const id=root.contains(document.activeElement)?document.activeElement.id:null;draw();if(id)root.querySelector('[id="'+CSS.escape(id)+'"]')?.focus({preventScroll:true});}}).observe(root);
 root.append(existing);
 choose(0,false,false);return {draw};
}
