import {bindReportURL,writeReportURL} from './report-catalog.js';
import {fastestSeriesForContext} from './fastest-series.js';
import {renderFastestSeries} from './fastest-series-view.js';
import {availableReports,availableReportIndex,nextAvailableReport,onReportFallback} from './report-availability.js';
import {keepActiveReportVisible} from './report-tabs.js';
import {createV58ResearchReports,goToV58Fate} from './v58-research-reports.js';
import {v58Method,appendMethodParagraphs} from './v58-research-methods.js';
import {esc,number,count,date} from './ranking-view.js';
import {compareRankingJudges,comparisonMetrics,comparisonJudges} from './judge-comparison.js';

// Owns the native judge report panels. Ranking/profile retain their owner.
export function mountJudgeResearch({context,model,root,ranking}){
 if(root.querySelector('.judge-research'))return;
 const names=comparisonJudges(model).filter(row=>row.id).sort((a,b)=>a.name.localeCompare(b.name,'ru'));
 const state={tab:0,a:names[0]?.id,b:names[1]?.id,group:'forum'};
 const available=availableReports('judges');
 const labels=['Рейтинг','Сравнение','Судейский Tinder','Диссиденты','Скорострелы','Палачи и спасатели'];
 const subtitles=['','Два судьи, одна группа: кто выше по ТУЗу и его составляющим?','Кто судит в унисон? Рейтинг близости оценок на общих треках.','Кто судит против всех и на каких треках судьи не договорились.','Самая быстрая серия из 30 треков и среднее время между оценками.','Кто поставил оценку, после которой судьба трека стала решённой.'];
 const shell=document.createElement('section');shell.className='judge-research jr-shell';shell.dataset.snapshotKey=context.snapshotKey;
 const legacy=[...root.children].filter(e=>e!==ranking&&!e.matches('dialog,#judge-profile'));
 shell.innerHTML=`<header class="rpt-page-head jr-page-head"><p class="bp-kicker">TUZ19 / РАУНД 01 <span aria-hidden="true">|</span><span class="rpt-theme">Всё, кроме правды</span></p><h1>Судьи</h1><p class="rpt-page-intro">Как судьи выставляли оценки и чем отличались их решения.</p></header><nav class="jr-tabs report-tabs" role="tablist" aria-label="Отчёты о судьях">${labels.map((text,i)=>available.includes(i)?`<button type="button"${i===2?' class="report-tab-tinder"':''} role="tab" data-judge-research-tab="${i}" id="int09-tab-${i}" aria-controls="int09-panel-${i}" aria-selected="${i===0}" tabindex="${i===0?0:-1}">${text}</button>`:'').join('')}</nav>${labels.map((_,i)=>`<div class="jr-report" id="int09-panel-${i}" ${available.includes(i)?`role="tabpanel" aria-labelledby="int09-tab-${i}"`:'inert aria-hidden="true"'} ${i?'hidden':''}></div>`).join('')}`;
 root.prepend(shell);keepActiveReportVisible(shell.querySelector('.report-tabs'));shell.querySelector('#int09-panel-0').append(ranking,...legacy);
 const panel=shell.querySelector('#int09-panel-1');
 const gaps=createV58ResearchReports(context,{goFate:goToV58Fate,method:button=>openMethod(button)});
 const dialog=document.createElement('dialog');dialog.className='jr-dialog';dialog.setAttribute('aria-labelledby','int09-method-title');dialog.innerHTML='<header class="jr-dialog-head"><h2 id="int09-method-title">Как считаем</h2><button type="button" aria-label="Закрыть">×</button></header>';
 dialog.addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();dialog.querySelector('button').focus({preventScroll:true});}});
 shell.append(dialog);let opener,saved;
 const close=()=>dialog.close();dialog.querySelector('button').onclick=close;
 let methodOutside=false;const outsideMethod=e=>{const r=dialog.getBoundingClientRect();return e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom);};
 dialog.addEventListener('pointerdown',e=>{methodOutside=outsideMethod(e);});dialog.addEventListener('click',e=>{if(methodOutside&&outsideMethod(e))close();methodOutside=false;});
 dialog.addEventListener('close',()=>{if(saved){document.body.style.overflow=saved.body;document.documentElement.style.overflow=saved.html;saved=null;}if(root.classList.contains('active'))opener?.focus({preventScroll:true});});
 function openMethod(button){dialog.querySelectorAll(':scope>p').forEach(p=>p.remove());appendMethodParagraphs(dialog,v58Method('judges',state.tab,gaps.source));opener=button;saved={body:document.body.style.overflow,html:document.documentElement.style.overflow};dialog.showModal();document.body.style.overflow='hidden';document.documentElement.style.overflow='hidden';dialog.querySelector('button').focus({preventScroll:true});}
 const selector=(id,value,options,label)=>`<select class="control" id="${id}" aria-label="${label}">${options.map(o=>`<option value="${esc(o.id)}" ${o.id===value?'selected':''}>${esc(o.name)}</option>`).join('')}</select>`;
 function comparison(){
  if(names.length<2){panel.innerHTML='<p class="int09-unavailable">Недостаточно судей для сравнения.</p>';return;}
  const c=compareRankingJudges(model,state.group,state.a,state.b),a=c.a,b=c.b;
  const verdict=c.same?'Выбери двух разных судей':c.difference===null?'Недостаточно данных':Math.abs(c.difference)<.005?'Почти ничья':`${esc(c.difference>0?a.judge:b.judge)} впереди на ${number(Math.abs(c.difference),{signed:false})} пункта`;
  const pair=gaps.source.chemistry.find(p=>p.a===a.judge&&p.b===b.judge||p.b===a.judge&&p.a===b.judge);
  const metric=v=>`<span title="${Number.isFinite(v)?v:'Нет данных для расчёта'}">${number(v)}</span>`;
  const side=(row,letter)=>`<div class="jr-v52-contender"><span>Судья ${letter}</span><strong>${esc(row.judge)}</strong><b>${metric(row.tuz)}</b><small>Личный ТУЗ</small></div>`;
  const lines=c.metrics.map(m=>`<div class="jr-v52-duel-line" data-compare-metric="${m.key}"><span>${m.label}</span><div class="jr-v52-duel-values"><strong>${metric(m.a)}</strong><div class="jr-v52-duel-tracks" aria-label="Ноль в центре; отрицательные значения слева"><span>${m.bars[0]?`<i data-value="${m.a}" data-negative="${m.a<0}" style="left:${m.bars[0].left}%;width:${m.bars[0].width}%"></i>`:'<span class="jr-unknown">—</span>'}</span><span>${m.bars[1]?`<i data-value="${m.b}" data-negative="${m.b<0}" style="left:${m.bars[1].left}%;width:${m.bars[1].width}%"></i>`:'<span class="jr-unknown">—</span>'}</span></div><strong>${metric(m.b)}</strong></div></div>`).join('');
  panel.innerHTML=`<div class="jr-title"><h2>Сравнение судей</h2><p>${subtitles[1]}</p><button type="button" class="rpt-method-trigger">ⓘ Как считаем</button></div><div class="jr-v52-selectors">${selector('jr-compare-a',state.a,names,'Судья А')}<span>против</span>${selector('jr-compare-b',state.b,names,'Судья Б')}${selector('jr-compare-group',state.group,[{id:'forum',name:'Форум'},{id:'veterans',name:'Ветераны'}],'Группа')}</div><section class="jr-v52-duel"><div class="jr-v52-duel-hero">${side(a,'А')}<div class="jr-v52-versus">VS</div>${side(b,'Б')}</div><p class="jr-v52-duel-verdict">${verdict}</p><div class="jr-v52-duel-lines">${lines}</div><p class="jr-v52-small-note">Полосы сравнивают величину показателя между двумя судьями. Точные значения указаны рядом.</p></section><details class="jr-v52-details"><summary>Все показатели и общие треки <span>↗</span></summary><div class="jr-v52-detail-grid"><div><p>${state.group==='forum'?'Форум':'Ветераны'}: ${count(model.groupSize(state.group))} участников</p><table class="jr-table"><thead><tr><th>Показатель</th><th>${esc(a.judge)}</th><th>${esc(b.judge)}</th></tr></thead><tbody>${[...comparisonMetrics,['activity','Активность']].map(([k,label])=>`<tr><td>${label}</td><td>${metric(a[k])}</td><td>${metric(b[k])}</td></tr>`).join('')}<tr><td>Оценок выбранной группе</td><td>${count(a.forum)}</td><td>${count(b.forum)}</td></tr></tbody></table></div><div><h3>Общие треки · ${pair?count(pair.n):'—'}</h3>${gaps.commonGrid(pair,a.judge,b.judge)}</div></div></details>`;
  for(const [id,key]of [['jr-compare-a','a'],['jr-compare-b','b'],['jr-compare-group','group']])panel.querySelector('#'+id).onchange=e=>{state[key]=e.target.value;const open=panel.querySelector('details').open;comparison();panel.querySelector('details').open=open;panel.querySelector('#'+id).focus({preventScroll:true});};
  panel.querySelector('.rpt-method-trigger').onclick=e=>openMethod(e.currentTarget);
 }
 let fastestView;
 function choose(index,focus=false,write=true){if(write)writeReportURL('judges',index);index=availableReportIndex('judges',index);state.tab=index;for(const button of shell.querySelectorAll('[data-judge-research-tab]')){const selected=+button.dataset.judgeResearchTab===index;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;if(selected&&focus)button.focus();}for(let i=0;i<6;i++)shell.querySelector('#int09-panel-'+i).hidden=i!==index;if(index===1&&!panel.childElementCount)comparison();if(index===4){if(!fastestView)fastestView=renderFastestSeries(shell.querySelector('#int09-panel-4'),fastestSeriesForContext(context,30));else fastestView.draw();}else if(index>=2)gaps.draw('judges',index,shell.querySelector('#int09-panel-'+index));}
 onReportFallback('judges',choose);bindReportURL('judges',root,choose);
 for(const button of shell.querySelectorAll('[data-judge-research-tab]')){button.onclick=()=>choose(+button.dataset.judgeResearchTab);button.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();choose(nextAvailableReport('judges',+button.dataset.judgeResearchTab,e.key),true);}};}
}
