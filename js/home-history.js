import {generalAt,verdict} from './general.js';
import {DAY} from './config.js';
const homeIndexFormat=new Intl.NumberFormat('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2,signDisplay:'exceptZero'});
const formatIndex=v=>homeIndexFormat.format(v).replace('-', '−');
export function homeDailyHistory(events,forumCount,otherCount,start,end){
 if(!Number.isFinite(start)||!Number.isFinite(end))return [];
 const offset=3*3600000,first=Date.parse('2026-09-01T00:00:00+03:00'),last=Math.floor((end+offset)/DAY)*DAY-offset;
 const days=[];
 for(let day=first;day<=last;day+=DAY){const cutoff=Math.min(day+DAY-1,end);const point=generalAt(events,forumCount,otherCount,start,cutoff,{historical:true});days.push({t:day,index:point?.index??null,priority:point?.priority??null,favor:point?.favor??null,coverageAdvantage:point?.coverageAdvantage??null,confidence:point?.confidence??null});}
 return days;
}
export function homeAxisMaximum(points=[]){return Math.max(20,Math.ceil(Math.max(0,...points.filter(p=>Number.isFinite(p.index)).map(p=>p.index))/10)*10);}
export function homeAxisMinimum(points=[]){return 0;}
export function homeValueLabels(points,{x,y,left,right,top,bottom=Infinity,measure}){
 const i=points.findLastIndex(p=>Number.isFinite(p.index));if(i<0)return [];
 const text=formatIndex(points[i].index),width=measure(text),px=x(i),py=y(points[i].index),cx=Math.max(left+4+width/2,Math.min(right-4-width/2,px)),preferred=py-27>=top+4?py-14:py+26,baseline=Math.max(top+17,Math.min(bottom-7,preferred));
 return [{i,text,x:cx,y:baseline,px,py,last:true,box:{left:cx-width/2,right:cx+width/2,top:baseline-13,bottom:baseline+3}}];
}
export function drawHomeHistory({svg,points,attachChartTip}){
 const mobile=window.innerWidth<=760,W=svg.clientWidth||(mobile?Math.max(280,window.innerWidth-28):1000),H=mobile?270:290,L=58,R=26,T=18,B=36,max=homeAxisMaximum(points),min=homeAxisMinimum(points);
 svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.style.height=H+'px';
 const x=i=>L+i*(W-L-R)/Math.max(1,points.length-1),y=v=>T+(max-v)*(H-T-B)/(max-min);
 let out=`<defs><clipPath id="home-plot-clip"><rect x="${L}" y="${T}" width="${W-L-R}" height="${H-T-B}"/></clipPath></defs>`;
 for(const [lo,hi,color] of [[20,max,'#65B78A'],[10,20,'#D5A451'],[min,10,'#D96D6B']])out+=`<rect class="home-state-strip" x="${L-13}" y="${y(hi)}" width="8" height="${y(lo)-y(hi)}" fill="${color}"/>`;
 const segments=[];let current=[];points.forEach((p,i)=>{if(Number.isFinite(p.index))current.push({x:x(i),y:y(p.index)});else if(current.length){segments.push(current);current=[];}});if(current.length)segments.push(current);
 const linePath=segment=>segment.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join(' ');
 for(let v=min;v<=max;v+=10)out+=`<line class="gridline${v===0?' home-zero-line':''}" x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L-23}" y="${y(v)+4}" text-anchor="end">${v}</text>`;
 for(const v of [10,20])out+=`<line class="home-threshold-line" x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}"/>`;
 const count=mobile?3:4;for(const i of [...new Set(Array.from({length:count},(_,j)=>Math.round(j*(points.length-1)/(count-1))))]){if(!points[i])continue;out+=`<text x="${x(i)}" y="${H-8}" text-anchor="middle">${new Date(points[i].t).toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',timeZone:'Europe/Moscow'})}</text>`;}
 for(const segment of segments)out+=`<path class="home-index-line" d="${linePath(segment)}" fill="none" stroke="#F8F9F3" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" clip-path="url(#home-plot-clip)"/>`;svg.innerHTML=out;
 const measure=text=>{const probe=document.createElementNS('http://www.w3.org/2000/svg','text');probe.textContent=text;probe.setAttribute('class','home-value-label');probe.style.fontSize='13px';probe.style.fontWeight='700';svg.appendChild(probe);let width=text.length*8.5;try{const actual=probe.getComputedTextLength?.();if(actual>0)width=actual;}finally{probe.remove();}return width;};
 const labels=homeValueLabels(points,{x,y,left:L,right:W-R,top:T,bottom:H-B,measure,mobile});
 svg.insertAdjacentHTML('beforeend',labels.map(a=>`<circle class="home-value-marker" cx="${a.px}" cy="${a.py}" r="3.25" fill="#F8F9F3"/><text class="home-value-label" x="${a.x}" y="${a.y}" text-anchor="middle" style="fill:#F8F9F3;font-size:13px;font-weight:600">${a.text}</text>`).join(''));
 attachChartTip(svg,[{name:'Индекс ТУЗа',values:points.map(p=>p.index),color:'#F8F9F3',format:value=>formatIndex(value)+' · '+verdict(value)[0]},{name:'Приоритет оценивания · до ±30',values:points.map(p=>Number.isFinite(p.priority)?0.3*p.priority:null),color:'#A8B5AD',format:value=>formatIndex(value)},{name:'Преимущество по баллам · до ±60',values:points.map(p=>p.favor),color:'#A8B5AD',format:value=>formatIndex(value)}],points.map(p=>p.t),L,W-R,t=>x(points.findIndex(p=>p.t===t)));
}

