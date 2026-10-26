import {mountPulseControls} from './home-pulse-controls.js';
import {mountHomeReportLinks} from './home-report-links.js';
import {verdict} from './general.js';

const date=value=>Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Moscow'})+' МСК':'Время неизвестно';
const day=t=>new Date(t).toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',timeZone:'Europe/Moscow'});
// Presentation of the existing official activity series. No replay, aggregation,
// slot filling or forecast: every point comes directly from factual.days.
// V58's historical orange marker is presentation only, not an API deadline.
const V58_HISTORICAL_MARK=Date.parse('2026-10-18T20:59:00Z');
export function pulseSvg(days,width,fmt,{deadline=null,selectedIndex=null}={}){
 const W=Math.max(200,Math.round(width)),mobile=W<580,H=mobile?245:370;
 const L=mobile?46:67,R=mobile?15:86,T=mobile?44:29,B=H-(mobile?37:43);
 if(!days.length)return {viewBox:`0 0 ${W} ${H}`,height:H,markup:'<text x="16" y="40">Нет подтверждённых оценок</text>'};
 const t0=days[0].t,last=days.at(-1),end=Math.max(last.t,deadline??last.t),top=Math.ceil(Math.max(...days.map(p=>p.cumulative))/4000)*4000||4000;
 const x=t=>L+(t-t0)/Math.max(1,end-t0)*(W-L-R),y=v=>B-v/top*(B-T);
 let markup='';
 for(let i=0;i<=4;i++){const value=top*i/4,Y=y(value);markup+=`<line class="r1-pulse-grid" x1="${L}" x2="${W-R}" y1="${Y}" y2="${Y}" stroke="#50615a" stroke-opacity="${i?.53:.75}" stroke-dasharray="${i?'3 6':''}"/><text x="${L-9}" y="${Y+4}" text-anchor="end" fill="#a8b5aa" font-size="${mobile?11:13}">${fmt(value,0)}</text>`;}
 // V58 calendar ticks, restricted to this actual series' time domain.
 const tickDates=mobile?['09-01','10-01','10-22']:['09-01','09-15','10-01','10-15','10-22'];
 const year=new Date(t0).getUTCFullYear();
 const ticks=tickDates.map(d=>Date.parse(`${year}-${d}T12:00:00Z`)).filter(t=>t>=t0&&t<=end);
 if(!ticks.length)ticks.push(t0);
 for(const [i,t]of ticks.entries()){const X=x(t);markup+=`<line x1="${X}" x2="${X}" y1="${B}" y2="${B+5}" stroke="#7b8c80" stroke-opacity=".65"/><text x="${X}" y="${B+23}" text-anchor="${i===0?'start':i===ticks.length-1?'end':'middle'}" fill="#aab8ad" font-size="${mobile?11:13}">${day(t)}</text>`;}
 const marks=[[V58_HISTORICAL_MARK,'#dba06b','historical'],[deadline,'#78d4b2','confirmed']].filter(([t])=>t!==null&&t>=t0&&t<=end);
 for(const [t,color,kind]of marks){const X=x(t);markup+=`<line class="r1-deadline-mark" data-kind="${kind}" data-time="${t}" x1="${X}" x2="${X}" y1="${T}" y2="${B}" stroke="${color}" stroke-opacity=".92" stroke-width="1.6" stroke-dasharray="5 6"/><circle cx="${X}" cy="${T}" r="3.5" fill="${color}"/>`;}
 const path=days.map((p,i)=>(i?'L':'M')+x(p.t).toFixed(1)+','+y(p.cumulative).toFixed(1)).join(' ');
 markup+=`<path class="r1-pulse-area" d="${path} L${x(last.t).toFixed(1)},${B} L${x(t0).toFixed(1)},${B} Z" fill="#a9cdb7" fill-opacity=".075"/><path class="r1-pulse-line" d="${path}" fill="none" stroke="#a9d0b8" stroke-width="${mobile?2.4:3.3}" stroke-linecap="round" stroke-linejoin="round"/>`;
 const px=x(last.t),py=y(last.cumulative),fontSize=16,valueLabel=fmt(last.cumulative,0);
 // Desktop reserves a right gutter for the factual endpoint value. On narrow
 // charts the same value becomes a compact caption above the plotting area.
 const labelX=mobile?L:Math.max(px,...marks.map(([t])=>x(t)))+12;
 const labelY=mobile?18:Math.max(T+fontSize,py+5);
 markup+=`<circle class="r1-pulse-point" cx="${px}" cy="${py}" r="${mobile?3.7:4.8}" fill="#b9e1c9" stroke="#17211b" stroke-width="2"/>`;
 if(!mobile)markup+=`<line class="r1-pulse-leader" x1="${px+7}" y1="${py}" x2="${labelX-5}" y2="${labelY-5}" stroke="#b9e1c9" stroke-width="1"/>`;
 markup+=`<text class="r1-pulse-end" data-time="${last.t}" x="${labelX}" y="${labelY}" text-anchor="start" fill="#b9e1c9" font-weight="700" font-size="${fontSize}">${valueLabel}</text>`;
 const points=days.map(p=>({x:x(p.t),y:y(p.cumulative)}));
 if(selectedIndex!==null&&points[selectedIndex]){const q=points[selectedIndex];markup+=`<line class="r1-pulse-cursor" x1="${q.x}" x2="${q.x}" y1="${T}" y2="${B}" stroke="#cba66f" stroke-dasharray="3 4"/><circle class="r1-pulse-selected" cx="${q.x}" cy="${q.y}" r="5" fill="#cba66f" stroke="#292b2b" stroke-width="2"/>`;}
 return {viewBox:`0 0 ${W} ${H}`,height:H,markup,points};
}
export function mountR1Home({context,activity,summaries,groupResults,outcomes,fmt}){
 const root=document.getElementById('home'),put=(id,text)=>root.querySelector('#'+id).textContent=text;
 root.dataset.snapshotKey=context.snapshotKey;mountHomeReportLinks(root,1);
 const a=activity.accounting;
 for(const [key,group]of [['forum','current'],['veterans','veterans']]){const r=groupResults[group];put('r1-'+key+'-fraction',fmt(r.pass,0)+' / '+fmt(r.total,0));put('r1-'+key+'-percent',r.total?fmt(100*r.pass/r.total,1)+'%':'—');}
 const decided=outcomes.totalPassed+outcomes.failed;
 put('home-position-pass-label',decided?fmt(100*outcomes.totalPassed/decided,1)+'%':'—');put('home-position-fail-label',decided?fmt(100*outcomes.failed/decided,1)+'%':'—');
 const deadline=activity.slots.deadline;put('r1-deadline',deadline===null?'Дедлайн не подтверждён':day(deadline)+' · Настоящий дедлайн');
 for(const button of root.querySelectorAll('[data-r1-index-group]')){
  const key=button.dataset.r1IndexGroup,s=summaries[key];
  button.querySelector('strong').textContent=(s.index>0?'+':'')+fmt(s.index,2);
  button.querySelector('strong').dataset.value=String(s.index);
  button.onclick=()=>{
   const v=verdict(s.index);put('index-main',(s.index>0?'+':'')+fmt(s.index,2));
   const index=root.querySelector('#index-main');index.dataset.value=String(s.index);index.style.color=v[2];
   put('verdict-main',v[1].replace('Хо-ро-шо. По форумному','Хо-ро-шо. По-форумному'));put('home-confidence',(key==='forum'?'Форум':'Ветераны')+' · сравнение с остальными участниками');
   put('home-index-components','Благосклонность '+fmt(s.favor,2)+' · Внимание '+fmt(Number.isFinite(s.priority)?s.priority*.25:null,2)+' · Уважение '+fmt(s.respect,2));
   root.querySelectorAll('[data-r1-index-group]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  };
 }
 put('r1-pulse-total',fmt(activity.factual.count,0));
 root.querySelector('#r1-deadline').title=deadline===null?'Дата не подтверждена':date(new Date(deadline).toISOString());
 const tbody=root.querySelector('#r1-pulse-days');
 for(const p of activity.factual.days){const row=document.createElement('tr');for(const value of [day(p.t)+(p.partial?' · неполный день':''),fmt(p.count,0),fmt(p.cumulative,0)]){const td=document.createElement('td');td.textContent=value;row.append(td);}tbody.append(row);}
 const chart=root.querySelector('#r1-pulse-chart');
 let selection;
 function draw(){if(!chart.getClientRects().length)return;const svg=pulseSvg(activity.factual.days,chart.clientWidth,fmt,{deadline,selectedIndex:selection?.index()});chart.setAttribute('viewBox',svg.viewBox);chart.style.height=svg.height+'px';chart.innerHTML=svg.markup;selection?.points?.(svg.points); }
 selection=mountPulseControls(chart,activity.factual.days,draw,fmt);
 const observer=new ResizeObserver(draw);observer.observe(chart);
 draw();
}
