import {participantStatus} from './general.js';
// The shared attribution model excludes official exceptions. This chart counts
// their valid scores by the same dates as its participant list, without assigning
// the official decision to a judge or creating a synthetic timestamp.
export function outcomeHistoryForDisplay(source){
 const official=source.all.filter(p=>p.official);
 return source.historySeries.map(point=>{
  const states=official.map(p=>participantStatus(p.scores.filter(s=>Date.parse(s.scoredAt)<=point.t)).status);
  return {...point,pass:point.pass+states.filter(s=>s==='pass').length,
   fail:point.fail+states.filter(s=>s==='fail').length,pending:point.pending+states.filter(s=>s==='pending').length};
 });
}
// V41 source chart/list, now retrospective current-grade states rather than old bundles.
export function mountV58OutcomeHistory(root,source){
 const history=outcomeHistoryForDisplay(source);let idx=history.length-1,status='pass',search='',page=0;const PAGE=10;
 const number=n=>Number(n).toLocaleString('ru-RU'),local=t=>new Date(t).toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',timeZone:'Europe/Moscow'});
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const lines={pass:{color:'#a8c7b5'},fail:{color:'#d18a90'}},$=sel=>root.querySelector(sel);
 function rowsAt(t){return source.all.flatMap(p=>{const scores=p.scores.filter(s=>Date.parse(s.scoredAt)<=t),st=participantStatus(scores);return [{id:p.id,name:p.name,profile:p.battleProfile||'https://19ib.ru/artist/'+encodeURIComponent(p.slug||p.id),official:p.official,status:st.status,n:scores.length,sum:st.total,scores:scores.map(s=>[s.judgeName,s.score,s.scoredAt])}];});}
root.innerHTML=`<section class="r38-section r40-history-section" data-r38-firstonly>
<div class="r38-section-head r40-history-head"><h2>Как определялись результаты</h2><span class="r40-history-period">${local(history[0].t)} — ${local(history.at(-1).t)}</span></div>
<div class="r40-chart-panel">
<div class="r40-chart-top"><div class="r39-line-legend"><span><i class="pass"></i>Прошли</span><span><i class="fail"></i>Вылетели</span></div></div>
<div class="r38-chart-wrap r39-chart-wrap r40-chart-wrap" id="r38-chart-wrap"><svg id="r38-chart" role="group" aria-label="Реконструкция числа проходов и вылетов по датам выставления оценок начиная с 30 августа; выбери дату" preserveAspectRatio="xMidYMid meet"></svg><div class="r38-chart-tip" id="r38-chart-tip" hidden></div></div>
<div class="r40-selection" aria-live="polite" aria-atomic="true"><div class="r40-selection-date r39-step-controls" role="group" aria-label="Выбор даты"><button id="r39-prev-date" type="button" aria-label="Предыдущий день">‹</button><strong id="r39-selected-date">20 октября</strong><button id="r39-next-date" type="button" aria-label="Следующий день">›</button></div>
<div class="r40-selection-stats"><span><span>Прошли</span> <strong class="pass" id="r39-selected-pass">—</strong></span><span>Вылетели <strong class="fail" id="r39-selected-fail">—</strong></span></div></div></div>
</section>
<section class="r38-section r40-participants-section" data-r38-firstonly>
<details class="r38-details" id="r38-participants"><summary class="r38-details-summary" aria-expanded="false" aria-controls="r38-search-content"><span>Найти участника <small>Поиск по имени</small></span></summary>
<div class="r38-list-content" id="r38-search-content"><div class="r38-filterbar"><div class="r38-filter-buttons" role="group" aria-label="Исход участника"><button type="button" data-status="pass" aria-pressed="true">Прошли</button><button type="button" data-status="fail" aria-pressed="false">Вылетели</button></div><input type="search" id="r38-search" class="r38-search" placeholder="Имя участника" aria-label="Поиск по имени"></div><div class="r38-list-summary"><span id="r38-list-count">—</span></div><div id="r38-list" class="r38-list"></div><div class="r38-pagination"><button type="button" id="r38-prev">← Назад</button><span id="r38-page-num">—</span><button type="button" id="r38-next">Далее →</button></div></div></details>
</section>
`;
function renderSelected(){
 const p=history[idx],day=new Date(p.t).toLocaleDateString('ru-RU',{day:'numeric',month:'long',timeZone:'Europe/Moscow'});
 $('#r39-selected-date').textContent=day;$('#r39-selected-date').dataset.at=String(p.t);$('#r39-selected-pass').textContent=number(p.pass);$('#r39-selected-fail').textContent=number(p.fail);
 $('#r39-prev-date').disabled=idx===0;$('#r39-next-date').disabled=idx===history.length-1;
}
function chart(){
 if(!root.getClientRects().length)return;
 const el=$('#r38-chart'),outer=$('#r38-chart-wrap');if(!el||!outer)return;
 const W=Math.max(250,Math.min(1150,outer.clientWidth-2)),mobile=W<610,H=mobile?205:245,L=mobile?38:57,R=mobile?12:18,T=18,B=mobile?32:38;
 const d0=history[0].t,d1=history.at(-1).t,top=Math.ceil(Math.max(...history.map(p=>p.pass))/500)*500||500;
 const x=t=>L+(t-d0)/(d1-d0)*(W-L-R),y=v=>H-B-v/top*(H-B-T);
 const n=v=>Number(v).toFixed(2);let html='';
 const tickStep=top>3000?1000:500;
 for(let v=0;v<=top;v+=tickStep){const yy=y(v);html+=`<line class="r38-grid" x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}"/><text x="${L-8}" y="${yy+4}" text-anchor="end">${v===0?'0':number(v)}</text>`;}
 const labels=mobile?[0,Math.floor((history.length-1)/2),history.length-1]:[0,Math.round((history.length-1)/4),Math.round((history.length-1)/2),Math.round((history.length-1)*3/4),history.length-1];
 for(const i of labels)html+=`<text x="${x(history[i].t)}" y="${H-7}" text-anchor="${i===0?'start':i===history.length-1?'end':'middle'}">${local(history[i].t)}</text>`;
 for(const [key,v] of Object.entries(lines)){
  const coords=history.map(p=>`${n(x(p.t))},${n(y(p[key]))}`).join(' ');
  html+=`<polyline points="${coords}" fill="none" stroke="${v.color}" stroke-width="${mobile?2.3:2.7}" stroke-linecap="round" stroke-linejoin="round"/>`;
 }
 const active=history[idx],cx=x(active.t);
 html+=`<line class="r38-cross" x1="${cx}" x2="${cx}" y1="${T}" y2="${H-B}"/>`;
 for(const [key,v] of Object.entries(lines))html+=`<circle cx="${cx}" cy="${y(active[key])}" r="${mobile?4.6:5.2}" stroke="#171a19" stroke-width="2" fill="${v.color}"/>`;
 // Larger hit areas allow a day to be selected without aiming at a narrow line.
 for(let i=0;i<history.length;i++){
  const p=history[i],center=x(p.t),left=i===0?L:(center+x(history[i-1].t))/2,right=i===history.length-1?W-R:(center+x(history[i+1].t))/2;
  html+=`<rect data-tick="${i}" tabindex="0" role="button" aria-label="Исходы на ${local(p.t)}" x="${left}" y="${T}" width="${Math.max(1,right-left)}" height="${H-B-T}"><title>${local(p.t)} · прошли ${number(p.pass)} · вылетели ${number(p.fail)}</title></rect>`;
 }
 el.setAttribute('viewBox',`0 0 ${W} ${H}`);el.innerHTML=html;
 const tip=$('#r38-chart-tip');
 const show=i=>{const p=history[i];tip.innerHTML=`<strong>${local(p.t)}</strong><div class="pass">Прошли: ${number(p.pass)}</div><div class="fail">Вылетели: ${number(p.fail)}</div>`;tip.hidden=false;tip.style.top='12px';tip.style.left=Math.max(3,Math.min(W-170,x(p.t)-58))+'px';};
 el.querySelectorAll('[data-tick]').forEach(node=>{const i=Number(node.dataset.tick);
  node.addEventListener('pointerenter',()=>show(i));node.addEventListener('focus',()=>show(i));node.addEventListener('click',()=>{pick(i);tip.hidden=true});
  node.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();pick(i);show(i);}else if(ev.key==='ArrowLeft'||ev.key==='ArrowRight'){ev.preventDefault();const j=Math.max(0,Math.min(history.length-1,i+(ev.key==='ArrowLeft'?-1:1)));el.querySelector(`[data-tick="${j}"]`)?.focus();}});
 });
}
function pick(next){const focused=$('#r38-chart').contains(document.activeElement);idx=Math.max(0,Math.min(history.length-1,Number(next)||0));renderSelected();renderList();chart();$('#r38-chart-tip').hidden=true;if(focused)$('#r38-chart').querySelector('[data-tick="'+idx+'"]')?.focus({preventScroll:true});}
function profileLink(p){try{const url=new URL(p.profile);return url.protocol==='https:'?`<a class="r40-participant-link" href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">Профиль участника на 19ib.ru</a>`:'';}catch{return '';}}
function renderList(){const q=search.trim().toLocaleLowerCase('ru');const list=rowsAt(history[idx].t).filter(p=>p.status===status&&(!q||p.name.toLocaleLowerCase('ru').includes(q)));const count=list.length;const pages=Math.max(1,Math.ceil(count/PAGE));page=Math.max(0,Math.min(page,pages-1));const slice=list.slice(page*PAGE,(page+1)*PAGE);
 $('#r38-list-count').textContent=number(count)+' участников'+(q?' по запросу':'');$('#r38-page-num').textContent=(page+1)+' / '+pages;$('#r38-prev').disabled=page<=0;$('#r38-next').disabled=page>=pages-1;
 const stateLabel={pass:'Проход',fail:'Вылет'}[status];
 $('#r38-list').innerHTML=slice.map(p=>{const scores=p.scores.map(sc=>`<div><span>${esc(sc[0])}</span><strong>${sc[1]} / 5</strong></div>`).join('');return `<details class="r38-person"><summary><span><strong>${esc(p.name)}</strong><br><small>${p.official?'Официальный проход':stateLabel} · ${p.n} из 5 оценок</small></span><span class="r38-person-data"><b class="${esc(p.status)}">${p.sum} балл.</b><br><small>Показать оценки ▾</small></span></summary><div class="r38-score-detail">${scores}${profileLink(p)}</div></details>`}).join('')||'<p class="r38-muted-foot">По этому запросу участников нет.</p>';
}

 const disclosure=$('#r38-participants'),summary=disclosure.querySelector('summary');
 disclosure.addEventListener('toggle',()=>{summary.setAttribute('aria-expanded',String(disclosure.open));if(!disclosure.open&&disclosure.contains(document.activeElement)&&document.activeElement!==summary)summary.focus({preventScroll:true});});
 $('#r38-chart').addEventListener('pointerleave',()=>{$('#r38-chart-tip').hidden=true;});
 $('#r39-prev-date').onclick=()=>pick(idx-1);$('#r39-next-date').onclick=()=>pick(idx+1);
 root.querySelectorAll('[data-status]').forEach(b=>b.onclick=()=>{status=b.dataset.status;page=0;root.querySelectorAll('[data-status]').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));renderList();});
 $('#r38-search').oninput=e=>{search=e.target.value;page=0;renderList();};$('#r38-prev').onclick=()=>{page--;renderList();};$('#r38-next').onclick=()=>{page++;renderList();};
 new ResizeObserver(()=>{if(root.getClientRects().length)chart();}).observe($('#r38-chart-wrap'));
 renderSelected();renderList();chart();return {draw:chart};
}
