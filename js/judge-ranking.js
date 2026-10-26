import {mountJudgeResearch} from './judge-research.js';
import {createRankingModel,rankingColumns,sortRanking,podiumRows} from './judge-ranking-model.js';
import {rankingAward} from './ranking-awards.js';
import {esc,metric} from './ranking-view.js';

// Five analytical columns; score counts remain available in judge profiles.
const tableColumns=['scorePoints','speedPoints','respectPoints','activity','tuz'].map(key=>rankingColumns.find(column=>column.key===key));

export function initializeJudgeRanking(context,data){
 const root=document.getElementById('judges');if(root.querySelector('.judge-ranking'))return;
 const model=createRankingModel(context,data),section=document.createElement('section');section.className='judge-ranking';
 const legacy=root.querySelector('.judge-index-heading')?.closest('section');
 root.prepend(section);legacy?.remove();
 const state={group:'forum',mode:'diamond',key:'tuz',direction:-1};
 function profileButton(row,content,className=''){
  const key=model.profileKey(row.judge);
  return `<button type="button" class="${className}" data-ranking-profile="${esc(key??'')}" ${key?'':'disabled title="Нет подтверждённой идентичности судьи"'}>${content}</button>`;
 }
 function render(){
  const scrollLeft=section.querySelector('.ranking-table-scroll')?.scrollLeft??0;
  const source=model.rows(state.group),sorted=sortRanking(source,state.key,state.direction),podium=podiumRows(source,state.mode),rust=state.mode==='rust';
  const values=row=>tableColumns.map(c=>`<td class="ranking-${c.key}">${metric(row[c.key],{signed:!['activity','forum','other'].includes(c.key),integer:['forum','other'].includes(c.key)})}</td>`).join('');
  section.innerHTML=`<header class="ranking-heading"><div><h2>Рейтинг судей по системе ТУЗ</h2><p>Кто выше и ниже в рейтинге ТУЗа — и за счёт чего.</p></div></header>
  <div class="ranking-controls"><div><span>Рейтинг</span><div role="group" aria-label="Часть рейтинга">${[['diamond','Алмазный ТУЗ'],['rust','Ржавый ТУЗ']].map(([key,label])=>`<button type="button" data-ranking-mode="${key}" aria-pressed="${state.mode===key}">${label}</button>`).join('')}</div></div><div><span>Группа</span><div role="group" aria-label="Группа участников рейтинга">${[['forum','Форум'],['veterans','Ветераны']].map(([key,label])=>`<button type="button" data-ranking-group="${key}" aria-pressed="${state.group===key}">${label}</button>`).join('')}</div></div></div>
  <section class="ranking-podium" aria-label="${rust?'Три нижних места':'Три лидера'}"><div class="ranking-leaders">${podium.map((row,i)=>profileButton(row,`<span>${i+1}-е место${rust?' с конца':''}</span><strong>${esc(row.judge)}</strong><b>${metric(row.tuz)}</b>${rankingAward(rust,i+1)}`,`ranking-leader ${rust?'ranking-rust':'ranking-metal'} ranking-place-${i+1}`)).join('')||'<p>Недостаточно данных для подиума.</p>'}</div></section>
  <div class="ranking-sort-tools"><label>Сортировать по<select id="ranking-sort-key">${rankingColumns.filter(c=>!['forum','other'].includes(c.key)).map(c=>`<option value="${c.key}" ${state.key===c.key?'selected':''}>${esc(c.label)}</option>`).join('')}</select></label><button type="button" id="ranking-sort-direction" aria-label="Изменить направление сортировки">${state.direction===-1?'По убыванию ↓':'По возрастанию ↑'}</button></div>
  <div class="ranking-table-scroll" tabindex="0" role="region" aria-label="Рейтинг: имя закреплено слева, ТУЗ справа; все компоненты доступны при горизонтальной прокрутке"><table class="ranking-table"><thead><tr><th scope="col" class="ranking-rank" aria-sort="${state.key==='rank'?(state.direction===-1?'descending':'ascending'):'none'}"><button type="button" data-ranking-sort="rank" aria-label="Сортировать по месту">№ ${state.key==='rank'?(state.direction===-1?'↓':'↑'):'↕'}</button></th><th scope="col" class="ranking-name">Судья</th>${tableColumns.map(c=>`<th scope="col" class="ranking-${c.key}" aria-sort="${state.key===c.key?(state.direction===-1?'descending':'ascending'):'none'}"><button type="button" data-ranking-sort="${c.key}">${esc(c.label)} ${state.key===c.key?(state.direction===-1?'↓':'↑'):'↕'}</button></th>`).join('')}</tr></thead><tbody>${sorted.map(row=>`<tr data-ranking-name="${esc(row.judge)}"><td class="ranking-rank">${Number.isFinite(row.rank)?row.rank:'—'}</td><th scope="row" class="ranking-name">${profileButton(row,`<span class="ranking-judge-label">${esc(row.judge)}</span>`,'ranking-name-button')}</th>${values(row)}</tr>`).join('')}</tbody></table></div>`;
  section.querySelector('.ranking-table-scroll').scrollLeft=scrollLeft;
  const bind=(attribute,change)=>section.querySelectorAll(`[${attribute}]`).forEach(button=>{
   button.onclick=()=>{
    const value=button.getAttribute(attribute);change(value);render();
    section.querySelector(`[${attribute}="${value}"]`)?.focus({preventScroll:true});
   };
  });
  bind('data-ranking-group',value=>{state.group=value;});
  bind('data-ranking-mode',value=>{state.mode=value;state.key='tuz';state.direction=value==='rust'?1:-1;});
  bind('data-ranking-sort',value=>{if(state.key===value)state.direction*=-1;else{state.key=value;state.direction=-1;}});
  section.querySelector('#ranking-sort-key').onchange=e=>{state.key=e.target.value;render();section.querySelector('#ranking-sort-key').focus({preventScroll:true});};
  section.querySelector('#ranking-sort-direction').onclick=()=>{state.direction*=-1;render();section.querySelector('#ranking-sort-direction').focus({preventScroll:true});};
 }
 render();section.dataset.rankingReady='true';
 mountJudgeResearch({context,model,root,ranking:section});
}
