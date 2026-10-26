import {pageScores} from './judge-profile-model.js';
import {rankingColumns} from './judge-ranking-model.js';
import {esc,date,count,metric} from './ranking-view.js';

export function renderRankingProfile(body,model,key,group){
 const profile=model.profile(key);
 if(!profile){body.innerHTML='<p role="status">Судья не найден. Закройте окно и выберите судью в рейтинге.</p>';return;}
 const url=new URL('../judges/',import.meta.url);url.searchParams.set('judge',key);if(new URLSearchParams(location.search).get('round')==='1')url.searchParams.set('round','1');
 const metrics=model.metric(key,group),groupName=group==='forum'?'Форум':'Ветераны';
 body.innerHTML=`<div class="ranking-profile-summary"><p class="ranking-note">Личный ТУЗ · ${groupName} · ${model.groupSize(group)} участников</p>
  ${profile.bio?`<p class="ranking-bio">${esc(profile.bio)}</p>`:''}
  <div class="ranking-profile-metrics">${metrics.map(row=>rankingColumns.filter(c=>c.key!=='rank').map(c=>`<div><span>${esc(c.label)}</span><strong>${metric(row[c.key],{signed:!['activity','forum','other'].includes(c.key),integer:['forum','other'].includes(c.key)})}</strong></div>`).join('')).join('')||'<p>Для выбранной группы нет показателей.</p>'}<div><span>Действительные оценки с архивом</span><strong>${count(profile.count)}</strong></div><div><span>Средний балл по ним</span><strong>${metric(profile.mean,{signed:false})}</strong></div></div>
  ${metrics.filter(row=>row.missingReason).map(row=>`<p class="ranking-note">${esc(row.missingReason)}</p>`).join('')}
  <p><a class="ranking-full-profile" href="${esc(url.pathname+url.search)}">Отдельная страница профиля ↗</a></p>
  <h3>Какие оценки ставит</h3><p class="ranking-note">Все ${count(profile.count)} действительных оценок: текущие и архивные участники. Доли и полосы — от этой полной выборки, независимо от фильтров.</p>
  <div class="ranking-distribution">${profile.distribution.map((n,i)=>`<button type="button" data-profile-grade="${i+1}" aria-pressed="false" aria-label="Фильтр: ${i+1} балл, ${n} оценок"><b>${i+1}</b><span class="ranking-grade-track"><i style="width:${profile.count?n/profile.count*100:0}%"></i></span><span>${count(n)}</span><span>${profile.count?(n/profile.count*100).toLocaleString('ru-RU',{minimumFractionDigits:1,maximumFractionDigits:1}):'0,0'}%</span></button>`).join('')}</div>
  </div><div class="ranking-profile-tools"><label>Поиск по участнику<input id="ranking-profile-search" type="search" placeholder="Официальный ник"></label><label>Оценка<select id="ranking-profile-grade"><option value="all">Все оценки</option>${[1,2,3,4,5].map(n=>`<option value="${n}">${n}</option>`).join('')}</select></label><label>Порядок · время МСК<select id="ranking-profile-order"><option value="newest">Сначала новые</option><option value="oldest">Сначала старые</option></select></label><button type="button" id="ranking-profile-reset">Сбросить фильтры</button></div>
  <p id="ranking-profile-count" class="ranking-note" role="status" aria-live="polite"></p><div id="ranking-profile-rows"></div>
  <nav class="ranking-profile-pager" aria-label="Страницы оценок"><button type="button" id="ranking-profile-prev">← Назад</button><span id="ranking-profile-page"></span><button type="button" id="ranking-profile-next">Далее →</button></nav>`;
 const search=body.querySelector('#ranking-profile-search'),grade=body.querySelector('#ranking-profile-grade'),order=body.querySelector('#ranking-profile-order');
 let page=1;
 function draw(){
  const result=pageScores(profile.rows,{query:search.value,grade:grade.value,order:order.value,page,pageSize:25});page=result.page;
  body.querySelector('#ranking-profile-count').textContent=`Найдено ${count(result.total)} из ${count(profile.count)} оценок`;
  body.querySelector('#ranking-profile-page').textContent=`Страница ${page} из ${result.pages}`;
  body.querySelector('#ranking-profile-prev').disabled=page===1;body.querySelector('#ranking-profile-next').disabled=page===result.pages;
  body.querySelectorAll('[data-profile-grade]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.profileGrade===grade.value)));
  body.querySelector('#ranking-profile-rows').innerHTML=result.rows.map(s=>{
   const name=s.artistName||'Имя недоступно',artist='https://19ib.ru/artist/'+encodeURIComponent(s.artistSlug||s.userId),comment=s.comment?.trim()?s.comment:'';
   return `<article class="ranking-score" data-profile-user="${esc(s.userId)}" data-score="${s.score}"><div class="ranking-score-heading"><a href="${esc(artist)}" target="_blank" rel="noopener noreferrer">${esc(name)}${!s.artistName?` · ${esc(s.userId)}`:''} ↗</a><b>${s.score}</b></div><small><time datetime="${esc(s.scoredAt)}">${date(s.scoredAt).replace(/ МСК$/,'')}</time>${s.current?'':' · архивный участник'}</small>${s.officialException?`<small class="official-exception">${esc(s.officialException.label)} · ${s.officialException.scoreTotal} из ${s.officialException.scoreMaximum}</small>`:''}${s.trackId?`<a class="ranking-track" href="https://api.19ib.ru/tracks/${encodeURIComponent(s.trackId)}/stream" target="_blank" rel="noopener noreferrer">Трек первого раунда ↗</a>`:''}${comment?comment.length>150?`<details><summary>Комментарий<span class="ranking-comment-preview"> · ${esc(comment.slice(0,85))}…</span></summary><p>${esc(comment)}</p></details>`:`<p>${esc(comment)}</p>`:'<p class="ranking-note">Без комментария</p>'}</article>`;
  }).join('')||'<p class="ranking-empty">Оценок по этим условиям нет. Измените поиск или сбросьте фильтры.</p>';
 }
 const resetPage=()=>{page=1;draw();};search.oninput=resetPage;grade.onchange=resetPage;order.onchange=resetPage;
 body.querySelector('#ranking-profile-reset').onclick=()=>{search.value='';grade.value='all';order.value='newest';resetPage();};
 body.querySelectorAll('[data-profile-grade]').forEach(b=>{b.onclick=()=>{grade.value=grade.value===b.dataset.profileGrade?'all':b.dataset.profileGrade;resetPage();};});
 const move=delta=>{page+=delta;draw();body.querySelector('#ranking-profile-count').scrollIntoView({block:'start',behavior:'instant'});};
 body.querySelector('#ranking-profile-prev').onclick=()=>move(-1);body.querySelector('#ranking-profile-next').onclick=()=>move(1);draw();
}
