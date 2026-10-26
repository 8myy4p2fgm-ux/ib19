import {r2HomeReports} from './home-report-links.js';
import {mountDataMethodology,r2DataMethodology} from './data-methodology.js';
import {loadR2GroupReference} from './r2-group-reference.js';
import {r2HomeData} from './r2-home-model.js';
const esc=v=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const base=new URL('../',import.meta.url),link=(path='')=>new URL(path,base).href;
const deadline=v=>v?new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(v)).replace(' г.','')+' МСК':'—';
function groupsHTML(data){
 return [['forum','Форум'],['veterans','Ветераны'],['other','Остальные']].map(([key,label])=>`<article class="r2-home-group" data-r2-group="${key}"><span>${label}</span><strong>${data.groups[key].submitted??'—'} / ${data.groups[key].admitted??'—'}</strong><small>Сдали из допущенных</small><div class="r2-home-track" aria-hidden="true"></div></article>`).join('');
}
function drawDays(target,days){
 if(!days.length){target.innerHTML='<p class="r2-home-empty">График появится после первых подтверждённых сдач</p>';return;}
 const W=Math.max(220,target.clientWidth-32),H=200,L=32,R=18,T=28,B=38,plot=H-T-B,max=Math.max(...days.map(d=>d.count));
 const first=Date.parse(days[0].day),last=Date.parse(days.at(-1).day),x=day=>days.length===1?(W+L-R)/2:L+24+(Date.parse(day)-first)/Math.max(1,last-first)*(W-L-R-48);
 const bar=Math.min(52,(W-L-R)/Math.max(2,days.length*1.8)),tickEvery=Math.max(1,Math.ceil(days.length/Math.max(1,Math.floor((W-L-R)/65))));
 const steps=Math.min(4,max),ticks=Array.from({length:steps+1},(_,i)=>Math.ceil(i*max/steps)).filter((n,i,a)=>a.indexOf(n)===i);
 target.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Подтверждённые сдачи по дням МСК: ${days.map(d=>d.day+' — '+d.count).join('; ')}">${ticks.map(n=>{const y=H-B-n/max*plot;return `<line x1="${L}" x2="${W-R}" y1="${y}" y2="${y}" class="r2-home-gridline"/><text x="${L-8}" y="${y+4}" text-anchor="end">${n}</text>`}).join('')}${days.map((d,i)=>{const cx=x(d.day),h=d.count/max*plot,label=d.day.slice(8)+'.'+d.day.slice(5,7);return `<g data-day="${d.day}" data-count="${d.count}"><title>${label}: ${d.count} подтверждённых сдач</title><rect x="${cx-bar/2}" y="${H-B-h}" width="${bar}" height="${h}" rx="3" class="r2-home-day"/><text x="${cx}" y="${H-B-h-9}" text-anchor="middle" class="r2-home-day-count">${d.count}</text>${i%tickEvery===0||i===days.length-1?`<text x="${cx}" y="${H-13}" text-anchor="middle">${label}</text>`:''}</g>`}).join('')}</svg>`;
}
export function renderR2Home(root,info){
 const data=r2HomeData(info),accepting=info.status==='active'&&!info.resultsPublished&&!info.times.judgingStartedAt&&!info.entries.some(e=>e.scoredCount>0)&&info.times.deadline&&Date.parse(info.times.deadline)>Date.now();
 root.innerHTML=`<header class="ds-page-head r2-home-hero"><div class="ds-kicker"><span>TUZ19 / РАУНД 02</span><span aria-hidden="true">|</span><strong>${esc(info.topic)}</strong></div><h1>Сдача треков</h1><p>Второй отборочный. Следим, кто успел, а кто опять оставил на последний вечер.</p>${accepting?'<span class="r2-home-badge">Микрофон проверяется</span>':''}</header>
 <article class="round-information r2-submissions r2-home" data-groups-ready="false">
 <div class="r2-home-kpis"><a href="${link('rappers/?round=2')}" class="r2-submission-link r2-submission-kpi"><span>Сдали треков</span><strong data-r2-kpi="submitted">${data.submitted}</strong><small>Подтверждённые сдачи</small></a><div><span>Осталось сдать</span><strong data-r2-kpi="waiting">—</strong><small>Полный состав пока неизвестен</small></div><div><span>Дедлайн сдачи</span><strong data-r2-kpi="deadline" class="r2-home-deadline">${esc(deadline(data.deadline))}</strong>${data.deadline?'':'<small>Не подтверждён</small>'}</div></div>
 <section class="r2-home-section"><header class="r2-home-section-head"><h2>Наши на сдаче</h2><span>По подтверждённому составу</span></header><div class="r2-home-groups">${groupsHTML(data)}</div><p class="r2-home-group-note">Полный состав и число ожидающих неизвестны.</p></section>
 <section class="r2-home-section"><header class="r2-home-section-head"><h2>Как несут треки</h2><span>Динамика по дням</span></header><div class="r2-home-chart"></div></section>
 ${r2HomeReports()}</article>`;
 mountDataMethodology(root,r2DataMethodology(info));
 const home=root.querySelector('.r2-home'),chart=home.querySelector('.r2-home-chart');
 const draw=()=>{if(chart.clientWidth>0)drawDays(chart,data.days)};const observer=new ResizeObserver(()=>{if(!chart.isConnected){observer.disconnect();return;}draw()});observer.observe(chart);draw();
 loadR2GroupReference().then(ref=>{if(!home.isConnected)return;const next=r2HomeData(info,ref);home.querySelector('.r2-home-groups').innerHTML=groupsHTML(next);home.querySelector('[data-r2-kpi=waiting]').textContent=next.waiting??'—';home.querySelector('[data-r2-kpi=waiting]').nextElementSibling.textContent=next.cohortCount===null?'Когорта недоступна':'Из прошедших первый раунд';home.querySelector('.r2-home-group-note').textContent=next.cohortCount===null?'Когорта недоступна.':`Когорта: ${next.cohortCount} прошедших первый раунд.`+(next.outsideCohort?` Сдач вне когорты: ${next.outsideCohort}.`:'');home.dataset.groupsReady='true';});
}
