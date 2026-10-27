import {pageScores} from './judge-profile-model.js';
import {esc,date,count,metric} from './ranking-view.js';

// Shared factual profile. Analytical ranking components are intentionally not rendered here.
export function renderJudgeCard(body,profile,{round=1,params=new URLSearchParams(),loadComments=null}={}){
 if(!profile){body.innerHTML='<p role="status">Судья не найден. Проверьте ссылку или выберите судью в отчёте.</p>';return;}
 let commentState=profile.rows.every(s=>typeof s.comment==='string')?'ready':'loading';
 let avatar='';try{if(!profile.avatarUrl)throw Error();const u=new URL(profile.avatarUrl,'https://api.19ib.ru');if(u.protocol==='https:'||u.protocol==='http:')avatar=u.href;}catch{}
 body.innerHTML=`<div class="judge-card-top"><section class="judge-card-panel"><div class="judge-card-identity">${avatar?`<img src="${esc(avatar)}" alt="" width="64" height="64">`:''}<div><p class="ranking-note">Судья ${round===1?'первого':'второго'} раунда</p></div></div><div class="judge-card-stats"><div><span>Действительных оценок</span><strong>${count(profile.count)}</strong></div><div><span>Средний балл</span><strong>${metric(profile.mean,{signed:false})}</strong></div></div></section><section class="judge-card-panel"><h3>Какие оценки ставит</h3><div class="ranking-distribution">${profile.distribution.map((n,i)=>`<button type="button" data-profile-grade="${i+1}" aria-pressed="false" aria-label="Фильтр: ${i+1} балл, ${n} оценок"><b>${i+1}</b><span class="ranking-grade-track"><i style="width:${profile.count?n/profile.count*100:0}%"></i></span><span>${count(n)}</span><span>${profile.count?(n/profile.count*100).toLocaleString('ru-RU',{minimumFractionDigits:1,maximumFractionDigits:1}):'0,0'}%</span></button>`).join('')}</div></section></div>
 <section class="judge-card-panel judge-card-history"><h3>История оценок</h3><div class="ranking-profile-tools"><label>Поиск по участнику<input id="ranking-profile-search" type="search" placeholder="Имя участника"></label><label>Оценка<select id="ranking-profile-grade"><option value="all">Все оценки</option>${[1,2,3,4,5].map(n=>`<option value="${n}">${n}</option>`).join('')}</select></label><label>Порядок · время МСК<select id="ranking-profile-order"><option value="newest">Сначала новые</option><option value="oldest">Сначала старые</option></select></label><button type="button" id="ranking-profile-reset">Сбросить фильтры</button></div>
 <p class="ranking-note" data-profile-comments-status role="status"></p><p id="ranking-profile-count" class="ranking-note" role="status" aria-live="polite"></p><div id="ranking-profile-rows"></div><nav class="ranking-profile-pager" aria-label="Страницы оценок"><button type="button" id="ranking-profile-prev">← Назад</button><span id="ranking-profile-page"></span><button type="button" id="ranking-profile-next">Далее →</button></nav></section>`;
 const search=body.querySelector('#ranking-profile-search'),grade=body.querySelector('#ranking-profile-grade'),order=body.querySelector('#ranking-profile-order');
 search.value=params.get('judgeQ')||'';grade.value=['1','2','3','4','5'].includes(params.get('grade'))?params.get('grade'):'all';order.value=params.get('order')==='oldest'?'oldest':'newest';let page=Math.max(1,Number(params.get('jpPage'))||1);
 function draw(){
  const result=pageScores(profile.rows,{query:search.value,grade:grade.value,order:order.value,page,pageSize:25});page=result.page;
  body.querySelector('#ranking-profile-count').textContent=`Найдено ${count(result.total)} из ${count(profile.count)} оценок`;
  body.querySelector('#ranking-profile-page').textContent=`Страница ${page} из ${result.pages}`;
  body.querySelector('#ranking-profile-prev').disabled=page===1;body.querySelector('#ranking-profile-next').disabled=page===result.pages;
  body.querySelectorAll('[data-profile-grade]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.profileGrade===grade.value)));
  body.querySelector('#ranking-profile-rows').innerHTML=result.rows.map(s=>{
   const name=s.artistName||'Имя недоступно',artist='https://19ib.ru/artist/'+encodeURIComponent(s.artistSlug||s.userId);
   return `<article class="ranking-score" data-profile-user="${esc(s.userId)}" data-score="${s.score}"><div class="ranking-score-heading"><a href="${esc(artist)}" target="_blank" rel="noopener noreferrer">${esc(name)}${!s.artistName?` · ${esc(s.userId)}`:''} ↗</a><b>${s.score}</b></div><small><time datetime="${esc(s.scoredAt)}">${date(s.scoredAt).replace(/ МСК$/,'')}</time>${s.current?'':' · архивный участник'}</small>${s.officialException?`<small class="official-exception">${esc(s.officialException.label)} · ${s.officialException.scoreTotal} из ${s.officialException.scoreMaximum}</small>`:''}${s.trackId?`<a class="ranking-track" href="https://api.19ib.ru/tracks/${encodeURIComponent(s.trackId)}/stream" target="_blank" rel="noopener noreferrer">Трек ${round===1?'первого':'второго'} раунда ↗</a>`:''}<div data-profile-comment-user="${esc(s.userId)}" data-profile-comment-at="${esc(s.scoredAt)}">${commentHTML(s)}</div></article>`;
  }).join('')||'<p class="ranking-empty">Оценок по этим условиям нет.</p>';
 }
 const reset=()=>{page=1;draw();};search.oninput=reset;grade.onchange=reset;order.onchange=reset;
 body.querySelector('#ranking-profile-reset').onclick=()=>{search.value='';grade.value='all';order.value='newest';reset();};
 body.querySelectorAll('[data-profile-grade]').forEach(b=>b.onclick=()=>{grade.value=grade.value===b.dataset.profileGrade?'all':b.dataset.profileGrade;reset();});
 const move=n=>{page+=n;draw();body.querySelector('#ranking-profile-count').scrollIntoView({block:'nearest'});};body.querySelector('#ranking-profile-prev').onclick=()=>move(-1);body.querySelector('#ranking-profile-next').onclick=()=>move(1);
 body.querySelector('img')?.addEventListener('error',e=>e.target.remove());draw();

 function commentHTML(s){
  if(commentState!=='ready')return '<p class="ranking-note">'+(commentState==='error'?'Комментарий пока недоступен.':'Комментарий загружается…')+'</p>';
  const comment=s.comment?.trim()?s.comment:'';
  return comment?comment.length>150?`<details><summary>Комментарий<span class="ranking-comment-preview"> · ${esc(comment.slice(0,85))}…</span></summary><p>${esc(comment)}</p></details>`:`<p>${esc(comment)}</p>`:'<p class="ranking-note">Без комментария</p>';
 }
 const commentStatus=body.querySelector('[data-profile-comments-status]');
 function updateComments(){
  const position=body.scrollTop,rows=new Map(profile.rows.map(s=>[JSON.stringify([s.userId,s.scoredAt]),s]));
  for(const slot of body.querySelectorAll('[data-profile-comment-user]')){const row=rows.get(JSON.stringify([slot.dataset.profileCommentUser,slot.dataset.profileCommentAt]));slot.innerHTML=commentHTML(row);}
  body.scrollTop=position;
 }
 function status(){
  commentStatus.dataset.state=commentState;commentStatus.hidden=commentState==='ready';
  commentStatus.textContent=commentState==='loading'?'Загружаем комментарии…':commentState==='error'?'Не удалось загрузить комментарии. ':'';
  if(commentState==='error'){const retry=document.createElement('button');retry.type='button';retry.className='control';retry.textContent='Повторить';retry.onclick=requestComments;commentStatus.append(retry);}
 }
 async function requestComments(){
  commentState='loading';status();updateComments();
  try{if(typeof loadComments!=='function')throw Error('Comments loader unavailable');await loadComments();if(!commentStatus.isConnected)return;commentState='ready';}
  catch{if(!commentStatus.isConnected)return;commentState='error';}
  const restore=commentStatus.contains(document.activeElement);status();updateComments();if(restore)body.closest('dialog')?.querySelector('[data-ranking-close]')?.focus({preventScroll:true});
 }
 status();if(commentState!=='ready')requestComments();

}
