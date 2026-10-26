import {esc} from './ranking-view.js';
const fmt=n=>Number.isFinite(n)?n.toLocaleString('ru-RU',{maximumFractionDigits:2}):'—';
const signed=n=>(n>0?'+':n<0?'−':'')+fmt(Math.abs(n));
// A shared 1–5 scale. Equal scores occupy distinct vertical slots, never averages.
export function dissentVoices(scores,selectedJudge=''){
 const stacks=new Map();const nodes=scores.map(s=>{const slot=stacks.get(s.score)||0;stacks.set(s.score,slot+1);const x=24+(s.score-1)*68,y=72-slot*13,chosen=s.judgeName===selectedJudge;
 return `<g data-voice="${esc(s.judgeName)}" data-score="${s.score}" transform="translate(${x} ${y})"><title>${esc(s.judgeName)}: ${s.score}</title>${chosen?'<path d="M0-6 6 0 0 6-6 0Z" fill="var(--ds-gold)"/>':'<circle r="4" fill="var(--ds-steel)"/>'}</g>`;});
 return `<svg class="du-voices" viewBox="0 0 320 105" role="img" aria-label="${esc(scores.map(s=>s.judgeName+': '+s.score).join('; '))}"><path d="M24 84H296" stroke="var(--ds-rule)"/>${[1,2,3,4,5].map(v=>`<path d="M${24+(v-1)*68} 81v6" stroke="var(--ds-muted)"/><text x="${24+(v-1)*68}" y="101" text-anchor="middle">${v}</text>`).join('')}${nodes.join('')}</svg>`;
}
export function mountDissidentsReport(panel,source,{goFate}={}){
 const existing=panel.querySelector('.dissent-ux');if(existing)return existing;
 const judges=[...source.dissent].sort((a,b)=>(b.mae??-Infinity)-(a.mae??-Infinity)||a.j.localeCompare(b.j,'ru'));
 const people=new Map(source.all.map(p=>[p.id,p])),tracks=source.disputed;
 const root=document.createElement('div');root.className='dissent-ux';panel.append(root);
 let selectedJudge=judges[0]?.j,mode='judges',gap='all',caseLimit=4,trackLimit=8,selectedTrack='';
 root.innerHTML=`<div class="du-tabs" role="tablist" aria-label="Два расследования"><button role="tab" id="du-tab-judges" aria-controls="du-panel-judges" data-mode="judges" aria-selected="true">Судьи-диссиденты</button><button role="tab" id="du-tab-tracks" aria-controls="du-panel-tracks" data-mode="tracks" aria-selected="false" tabindex="-1">Спорные треки</button></div><section id="du-panel-judges" role="tabpanel" aria-labelledby="du-tab-judges"><p class="du-explainer">Среднее абсолютное расхождение с оценками коллег · в баллах.</p><div class="du-workspace"><aside class="du-ranking" aria-label="Рейтинг судей"></aside><section class="du-detail" aria-label="Необычные оценки выбранного судьи"></section></div></section><section id="du-panel-tracks" role="tabpanel" aria-labelledby="du-tab-tracks" hidden><p class="du-explainer">Разброс — разница между максимальной и минимальной оценкой трека.</p><div class="du-filters" role="group" aria-label="Разброс оценок"></div><div class="du-tracks"></div><button class="du-more" data-more="tracks" hidden>Показать ещё 8 треков</button></section><p class="du-live" role="status" aria-live="polite"></p>`;
 const $=s=>root.querySelector(s),rank=$('.du-ranking'),detail=$('.du-detail'),max=Math.max(1,...judges.map(j=>j.mae||0));
 const named=(scores,chosen='')=>`<ul class="du-named">${scores.map(s=>`<li class="${s.judgeName===chosen?'du-chosen':''}"><button type="button" data-judge-card="${esc(s.judgeName)}">${esc(s.judgeName)}</button><b>${s.score}</b></li>`).join('')}</ul>`;
 const profile=id=>typeof goFate==='function'?`<button class="du-profile" data-fate="${esc(id)}" aria-label="Оценки и комментарии участника">Карточка ↗</button>`:'';
 const name=p=>`${esc(p.name)}${p.trackTitle?`<small>${esc(p.trackTitle)}</small>`:''}`;
 function cases(){
  const j=judges.find(j=>j.j===selectedJudge);if(!j){detail.innerHTML='<p>Нет сопоставимых оценок.</p>';return;}
  detail.innerHTML=`<header class="du-judge-heading"><h3><button type="button" data-judge-card="${esc(j.j)}">${esc(j.j)}</button></h3><p>${fmt(j.mae)} балла · ${j.n} сопоставимых оценок${!j.eligible?' · малая выборка':''}</p></header><div class="du-cases">${j.cases.slice(0,caseLimit).map(c=>{const p=people.get(c.u);return `<article class="du-case" data-case="${esc(c.u)}"><header><h4>${name(p)}</h4>${profile(c.u)}</header><div class="du-case-body"><div><p class="du-values"><span class="du-chosen">Судья <b>${c.score}</b></span><span>Коллеги <b>${fmt(c.peer)}</b></span><span>Разница <b>${signed(c.delta)}</b></span></p>${dissentVoices(p.scores,j.j)}</div><div><p class="du-peer-label">Оценки коллег · ${c.n}</p>${named(p.scores.filter(s=>s.judgeName!==j.j))}</div></div></article>`;}).join('')}</div><button class="du-more" data-more="cases" ${caseLimit>=j.cases.length?'hidden':''}>Показать ещё 4 примера</button>`;
  rank.querySelectorAll('[data-judge]').forEach(b=>{const selected=b.dataset.judge===selectedJudge;b.setAttribute('aria-pressed',String(selected));b.closest('.du-judge').dataset.selected=String(selected);});
 }
 rank.innerHTML=judges.map((j,i)=>`<div class="du-judge"><button type="button" class="du-place judge-card-select" data-judge="${esc(j.j)}" aria-pressed="false" aria-label="Показать отклонения: ${esc(j.j)}">${i+1}</button><button type="button" class="du-judge-name" data-judge-card="${esc(j.j)}">${esc(j.j)}<small>${j.n} сравнений</small><i aria-hidden="true"><em style="width:${(j.mae||0)/max*100}%"></em></i></button><b>${fmt(j.mae)}</b></div>`).join('');
 function trackList(){
  const filtered=tracks.filter(p=>gap==='all'||p.gap===+gap);
  $('.du-filters').innerHTML=['all',4,3,2].map(g=>`<button data-gap="${g}" aria-pressed="${String(g)===gap}">${g==='all'?'Все спорные':'Разброс '+g}<span>${tracks.filter(p=>g==='all'||p.gap===g).length}</span></button>`).join('');
  $('.du-tracks').innerHTML=filtered.slice(0,trackLimit).map(p=>`<article class="du-track" data-track="${esc(p.id)}" data-gap-value="${p.gap}" data-selected="${selectedTrack===p.id}"><div class="du-track-title"><button data-select-track="${esc(p.id)}" aria-pressed="${selectedTrack===p.id}">${name(p)}</button><p>Разброс <b>${p.gap}</b> · сумма <b>${p.total}</b></p>${profile(p.id)}</div><div>${dissentVoices(p.scores)}<p class="du-score-line">Оценки: ${p.scores.map(s=>s.score).sort((a,b)=>a-b).join(', ')}</p></div>${named(p.scores)}</article>`).join('')||'<p>Треков с таким разбросом нет.</p>';
  $('[data-more="tracks"]').hidden=trackLimit>=filtered.length;
 }
 function selectMode(next){mode=next;root.querySelectorAll('[data-mode]').forEach(b=>{const active=b.dataset.mode===mode;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});$('#du-panel-judges').hidden=mode!=='judges';$('#du-panel-tracks').hidden=mode!=='tracks';}
 root.addEventListener('click',e=>{const b=e.target.closest('button')||e.target.closest('.du-judge')?.querySelector('[data-judge]');if(!b||!root.contains(b))return;
  if(b.dataset.mode){selectMode(b.dataset.mode);return;}
  if(b.dataset.judge){selectedJudge=b.dataset.judge;caseLimit=4;cases();$('.du-live').textContent=selectedJudge;return;}
  if(b.dataset.gap){gap=b.dataset.gap;trackLimit=8;selectedTrack='';trackList();$(`[data-gap="${gap}"]`).focus({preventScroll:true});return;}
  if(b.dataset.more==='cases'){const old=caseLimit;caseLimit+=4;cases();detail.querySelectorAll('[data-fate]')[old]?.focus({preventScroll:true});return;}
  if(b.dataset.more==='tracks'){const old=trackLimit;trackLimit+=8;trackList();root.querySelectorAll('[data-select-track]')[old]?.focus({preventScroll:true});return;}
  if(b.dataset.selectTrack){selectedTrack=b.dataset.selectTrack;root.querySelectorAll('[data-track]').forEach(row=>{row.dataset.selected=String(row.dataset.track===selectedTrack);row.querySelector('[data-select-track]').setAttribute('aria-pressed',row.dataset.selected);});$('.du-live').textContent=people.get(selectedTrack).name+' · трек выбран';return;}
  if(b.dataset.fate)goFate?.(b.dataset.fate);
 });
 $('.du-tabs').addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();selectMode(e.key==='Home'?'judges':e.key==='End'?'tracks':mode==='judges'?'tracks':'judges');$(`[data-mode="${mode}"]`).focus();}});
 rank.addEventListener('keydown',e=>{if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;const buttons=[...rank.querySelectorAll('button')],i=buttons.indexOf(e.target),n=e.key==='Home'?0:e.key==='End'?buttons.length-1:Math.max(0,Math.min(buttons.length-1,i+(e.key==='ArrowDown'?1:-1)));if(buttons[n]){e.preventDefault();buttons[n].focus();buttons[n].click();}});
 cases();trackList();root.dataset.ready='true';return root;
}
