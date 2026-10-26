import {isFirstRoundActive} from './routes.js';
import {buildProfiles,pageScores} from './judge-profile-model.js';
export async function initializeJudgeProfiles(D){
 const profiles=buildProfiles(D),root=document.getElementById('judges');
 const container=document.createElement('section');container.id='judge-profile';container.hidden=true;root.append(container);
 const base=new URL('../',import.meta.url),directory=new URL('judges/',base);
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=(v,n=0)=>Number.isFinite(v)?v.toLocaleString('ru-RU',{minimumFractionDigits:n,maximumFractionDigits:n}):'—';
 const date=v=>new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(v));
 let active=null;
 function profileUrl(key){const u=new URL(directory);u.searchParams.set('judge',key);if(new URLSearchParams(location.search).get('round')==='1')u.searchParams.set('round','1');return u.pathname+u.search;}
 function enhance(){
  for(const row of root.querySelectorAll('.judge-summary tr[data-judge-name]')){
   const p=profiles.get(D.judgeIdentities.get(row.dataset.judgeName)),cell=row.querySelector('th');if(!p||!cell||cell.querySelector('[data-jp-open]'))continue;
   const a=document.createElement('a');a.className='jp-name-link';a.dataset.jpOpen=p.key;a.href=profileUrl(p.key);a.textContent=row.dataset.judgeName;a.title='Профиль судьи и вся история оценок';cell.replaceChildren(a);
  }
 }
 new MutationObserver(enhance).observe(root,{childList:true,subtree:true});enhance();
 function setParams(values){const u=new URL(location.href);for(const [k,v]of Object.entries(values))v==null||v===''?u.searchParams.delete(k):u.searchParams.set(k,v);history.replaceState(history.state,'',u.pathname+u.search);}
 function open(key){
  if(!isFirstRoundActive()||!profiles.has(key))return;
  history.replaceState({...history.state,jpDirectory:{scrollY:scrollY}},'',location.href);
  history.pushState({jpEntered:true},'',profileUrl(key));handle();window.scrollTo(0,0);
 }
 function back(){
  if(history.state?.jpEntered){history.back();return;}
  const backURL=new URL(directory);if(new URLSearchParams(location.search).get('round')==='1')backURL.searchParams.set('round','1');
  history.pushState(null,'',backURL.pathname+backURL.search);window.dispatchEvent(new PopStateEvent('popstate'));
 }
 document.addEventListener('click',e=>{
  if(!isFirstRoundActive())return;
  const a=e.target.closest('[data-jp-open]');
  if(a){if(e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();e.stopImmediatePropagation();open(a.dataset.jpOpen);return;}
  if(active&&e.target.closest('.site-header [data-tab="judges"]')){e.preventDefault();e.stopImmediatePropagation();back();}
 },true);
 function avatarURL(value){if(!value)return null;try{const url=new URL(value,'https://api.19ib.ru');return ['https:','http:'].includes(url.protocol)?url.href:null;}catch{return null;}}
 function actor(s){
  const name=s.artistName||'Имя недоступно',url='https://19ib.ru/artist/'+encodeURIComponent(s.artistSlug||s.userId);
  return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(name)}${!s.artistName?` · ${esc(s.userId)}`:''} ↗</a>`+

   (s.trackId?`<small><a href="https://api.19ib.ru/tracks/${encodeURIComponent(s.trackId)}/stream" target="_blank" rel="noopener noreferrer">Трек первого раунда ↗</a></small>`:'');
 }
 function comment(text){
  if(!text?.trim())return '<span class="jp-muted">Без комментария</span>';
  if(text.length<=150)return `<p class="jp-comment">${esc(text)}</p>`;
  return `<details class="jp-comment-details"><summary><span class="jp-snippet">${esc(text.slice(0,130))}… <span>Читать полностью</span></span><span class="jp-close">Свернуть комментарий</span></summary><p class="jp-comment">${esc(text)}</p></details>`;
 }
 function handle(){
  if(!isFirstRoundActive()){active=null;root.classList.remove('jp-open');container.hidden=true;const shell=root.querySelector('.judge-research');if(shell)shell.hidden=false;return;}
  const params=new URLSearchParams(location.search),key=location.pathname===directory.pathname?params.get('judge'):null;
  active=key?profiles.get(key):null;
  root.classList.toggle('jp-open',!!key);container.hidden=!key;
  const shell=root.querySelector('.judge-research');if(shell)shell.hidden=!!key;
  if(!key){
   if(location.pathname===directory.pathname){document.getElementById('page-title').textContent='Судьи';document.title='Судьи — TUZ19';
    const pos=history.state?.jpDirectory?.scrollY;if(Number.isFinite(pos))requestAnimationFrame(()=>scrollTo(0,pos));}
   return;
  }
  document.getElementById('page-title').textContent='Профиль судьи';
  if(!active){container.innerHTML='<button class="control jp-back" id="jp-back">← Все судьи</button><article class="panel"><h2>Судья не найден</h2><p class="jp-muted">Проверьте ссылку или вернитесь к списку судей.</p></article>';container.querySelector('#jp-back').onclick=back;return;}
  const p=active;document.title=p.name+' — Судьи — TUZ19';
  container.innerHTML=`<button type="button" class="control jp-back" id="jp-back">← Все судьи</button>
   <div class="jp-top"><article class="panel"><div class="jp-identity">${avatarURL(p.avatarUrl)?`<img class="jp-avatar" src="${esc(avatarURL(p.avatarUrl))}" alt="Фото судьи ${esc(p.name)}" width="80" height="80">`:'<div class="jp-avatar jp-avatar-empty" role="img" aria-label="Фото судьи не опубликовано"></div>'}<div><h2>${esc(p.name)}</h2><div class="jp-muted">Судья первого раунда</div>${!avatarURL(p.avatarUrl)?'<small class="jp-muted">Фото не опубликовано</small>':''}</div></div>
   ${p.bio?`<p class="jp-bio">${esc(p.bio)}</p>`:''}<div class="jp-stats"><div class="jp-stat"><span>Действительных оценок</span><strong>${fmt(p.count)}</strong></div><div class="jp-stat"><span>Средний балл</span><strong>${fmt(p.mean,2)}</strong></div></div>
   </article>
   <article class="panel"><h2>Какие оценки ставит</h2><div class="jp-muted">Количество и доля от действительных оценок судьи, включая архив</div><div class="jp-dist">${p.distribution.map((n,i)=>`<div class="jp-dist-row" aria-label="${i+1} балл: ${n}, ${p.count?fmt(n/p.count*100,1):0}%"><b>${i+1}</b><span class="jp-dist-track"><i class="jp-dist-fill" style="width:${p.count?n/p.count*100:0}%"></i></span><span class="jp-dist-count">${fmt(n)}</span><span class="jp-dist-percent jp-muted">${p.count?fmt(n/p.count*100,1):'0'}%</span></div>`).join('')}</div></article></div>
   <article class="panel"><h2 id="jp-history-title">История оценок</h2>
   <div id="jp-scores"><div class="jp-toolbar"><label>Поиск по участнику<input id="jp-search" class="control" type="search" placeholder="Имя артиста"></label><label>Оценка<select id="jp-grade" class="control"><option value="all">Все оценки</option>${[1,2,3,4,5].map(n=>`<option value="${n}">${n} балл${n===1?'':n===5?'ов':'а'}</option>`).join('')}</select></label><label>Сортировка<select id="jp-order" class="control"><option value="newest">Сначала новые</option><option value="oldest">Сначала старые</option></select></label></div>
   <p id="jp-count" class="jp-note" aria-live="polite"></p><table class="table jp-table"><thead><tr><th scope="col">Дата и время (МСК)</th><th scope="col">Участник</th><th scope="col">Оценка</th><th scope="col">Комментарий</th></tr></thead><tbody id="jp-rows"></tbody></table><div class="jp-pager"><button id="jp-prev" type="button" class="control">← Назад</button><span id="jp-page" class="jp-muted"></span><button id="jp-next" type="button" class="control">Далее →</button></div></div>
   </article>`;
  container.querySelector('#jp-back').onclick=back;
  const input=container.querySelector('#jp-search'),grade=container.querySelector('#jp-grade'),order=container.querySelector('#jp-order');input.value=params.get('judgeQ')||'';grade.value=['1','2','3','4','5'].includes(params.get('grade'))?params.get('grade'):'all';
  order.value=params.get('order')==='oldest'?'oldest':'newest';
  let page=Math.max(1,Number(params.get('jpPage'))||1);const size=50;
  function draw(){
   const result=pageScores(p.rows,{query:input.value,grade:grade.value,order:order.value,page,pageSize:size}),pages=result.pages;page=result.page;
   container.querySelector('#jp-count').textContent=`Найдено ${fmt(result.total)} из ${fmt(p.count)} оценок`;
   container.querySelector('#jp-rows').innerHTML=result.rows.map(s=>`<tr data-jp-user="${esc(s.userId)}" data-jp-score="${s.score}"><td><time datetime="${esc(s.scoredAt)}">${date(s.scoredAt)}</time></td><td>${actor(s)}${s.officialException?`<small class="official-exception">${esc(s.officialException.label)} · ${s.officialException.scoreTotal} из ${s.officialException.scoreMaximum}</small>`:''}</td><td><span class="jp-score">${s.score}</span></td><td>${comment(s.comment)}</td></tr>`).join('')||'<tr><td colspan="4" class="jp-empty">Оценок по этим условиям нет.</td></tr>';
   container.querySelector('#jp-prev').disabled=page===1;container.querySelector('#jp-next').disabled=page===pages;container.querySelector('#jp-page').textContent=`Страница ${page} из ${pages}`;
   setParams({judgeQ:input.value||null,grade:grade.value==='all'?null:grade.value,jpPage:page===1?null:page,order:order.value==='oldest'?'oldest':null,view:null});
  }
  input.oninput=()=>{page=1;draw()};grade.onchange=()=>{page=1;draw()};order.onchange=()=>{page=1;draw()};
  const toHistory=()=>{const top=container.querySelector('#jp-history-title').getBoundingClientRect().top+scrollY-document.querySelector('.site-header').getBoundingClientRect().height-20;scrollTo(0,Math.max(0,top));};
  container.querySelector('#jp-prev').onclick=()=>{page--;draw();toHistory()};container.querySelector('#jp-next').onclick=()=>{page++;draw();toHistory()};draw();
  for(const img of container.querySelectorAll('img'))img.onerror=()=>{const placeholder=document.createElement('div');placeholder.className='jp-avatar jp-avatar-empty';placeholder.setAttribute('role','img');placeholder.setAttribute('aria-label','Фото недоступно');img.replaceWith(placeholder)};

 }
 window.addEventListener('ib19:route',handle);handle();
}
