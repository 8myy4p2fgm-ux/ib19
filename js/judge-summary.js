import {personalMethod} from './methodology.js';
import {rankPersonalV4} from './personal.js';
import {meanDifference,sortByDifference,signedDifference} from './judge-presentation.js';
export function createJudgeSummary({rows,judgeCurrent,forumCount,$,fmt,esc,chartTooltip,judgeVeterans}){
 const root=$('judges');
 const sorted=sortByDifference(rows);
 const tracks=n=>fmt(n,0)+' '+(n%100>=11&&n%100<=14?'треков':n%10===1?'трек':n%10>=2&&n%10<=4?'трека':'треков');
 root.innerHTML='<section class="judge-summary"><h2>Кому ставят выше</h2><p class="judge-heat-subtitle">Насколько выше или ниже судьи оценивают Форум и Ветеранов по сравнению с остальными участниками</p><div class="judge-heat-wrap"><table class="judge-heat-table"><thead><tr><th scope="col">Судья</th><th scope="col">Форум <span class="judge-heat-sort" data-heat-sort="forum">↕</span></th><th scope="col">Ветераны <span class="judge-heat-sort" data-heat-sort="veteran">↕</span></th><th scope="col">Средняя оценка</th></tr></thead><tbody id="judge-heat-body"></tbody></table></div></section><section class="judge-summary"><div class="judge-index-heading"><h2>Судейский ТУЗ</h2><div class="judge-tuz-filters" role="group" aria-label="Группа для расчёта ТУЗа"><button type="button" class="judge-tuz-filter active" data-judge-tuz-group="current" aria-pressed="true">Форум</button><button type="button" class="judge-tuz-filter" data-judge-tuz-group="former" aria-pressed="false">Ветераны</button></div><button type="button" class="method-open" data-method="personal">Как считается <span aria-hidden="true">↗</span></button></div><div class="judge-table-controls"><span>Рейтинг судей по авторскому индексу</span></div><div class="judge-index-scroll" tabindex="0" role="region" aria-label="Рейтинг личных ТУЗов. Таблицу можно прокрутить по горизонтали"><table class="table judge-index-table judge-compact"><thead><tr><th>№</th><th class="judge-name-column">Судья</th><th><button class="tuz-sort" data-tuz-sort="tuz">Итоговый ТУЗ ↕</button></th><th><button class="tuz-sort" data-tuz-sort="scorePoints">Благосклонность ↕</button></th><th><button class="tuz-sort" data-tuz-sort="speedPoints">Внимание ↕</button></th><th><button class="tuz-sort" data-tuz-sort="respectPoints">Уважение ↕</button></th><th><button class="tuz-sort" data-tuz-sort="activity">Активность ↕</button></th></tr></thead><tbody id="tuz-judge-body"></tbody></table></div></section>';
 let tuzSortKey='tuz',tuzSortDirection=-1,judgeTuzGroup='current';
 function drawTuzJudges(){
  const data=[...(judgeTuzGroup==='current'?judgeCurrent:judgeVeterans)].sort((a,b)=>{
   const x=a[tuzSortKey],y=b[tuzSortKey],xf=Number.isFinite(x),yf=Number.isFinite(y);
   return xf&&yf?(x-y)*tuzSortDirection||a.judge.localeCompare(b.judge,'ru'):xf?-1:yf?1:a.judge.localeCompare(b.judge,'ru');
  });
  const signed=n=>Number.isFinite(n)?(n>0?'+':'')+fmt(n,2):'—';
  const body=root.querySelector('#tuz-judge-body');if(!body)return;
  const chosen=window.__ibCompareJudges||[];
  body.innerHTML=data.map((j,i)=>{const name=esc(j.judge);
   return `<tr class="judge-main-row" data-judge-name="${name}"><td class="judge-rank">${Number.isFinite(j.tuz)?i+1:'—'}</td><th scope="row" class="judge-name-column">${name}</th><td class="judge-final-index judge-result-column">${signed(j.tuz)}</td><td class="tuz-points">${signed(j.scorePoints)}</td><td class="tuz-points">${signed(j.speedPoints)}</td><td class="tuz-points">${signed(j.respectPoints)}</td><td class="tuz-points">${fmt(j.activity,2)}</td></tr>`;
  }).join('');
  let compare=root.querySelector('#judge-compare-panel');if(!compare){compare=document.createElement('section');compare.id='judge-compare-panel';compare.className='judge-compare-panel';root.querySelector('.judge-index-scroll').after(compare);}
  const selected=[];
  compare.hidden=selected.length===0;
  compare.innerHTML=selected.length?'<div class="judge-compare-head"><h3>Сравнение судей</h3><button class="control" type="button" id="judge-compare-clear">Сбросить</button></div><div class="judge-compare-grid">'+selected.map(j=>'<div><h4>'+esc(j.judge)+'</h4><strong class="judge-compare-total">'+signed(j.tuz)+'</strong>'+[['Благосклонность',j.scorePoints],['Внимание',j.speedPoints],['Уважение',j.respectPoints],['Активность',j.activity]].map(([label,val])=>'<p><span>'+label+'</span><b>'+signed(val)+'</b></p>').join('')+'</div>').join('')+'</div>': '';
  compare.querySelector('#judge-compare-clear')?.addEventListener('click',()=>{window.__ibCompareJudges=[];drawTuzJudges();});
  root.querySelectorAll('[data-tuz-sort]').forEach(btn=>{const active=btn.dataset.tuzSort===tuzSortKey;btn.textContent=({forum:'Форумщиков',other:'Остальных',scorePoints:'Благосклонность',speedPoints:'Внимание',respectPoints:'Уважение',activity:'Активность',tuz:'Итоговый ТУЗ'})[btn.dataset.tuzSort]+(active?(tuzSortDirection===-1?' ↓':' ↑'):' ↕');btn.setAttribute('aria-sort',active?(tuzSortDirection===-1?'descending':'ascending'):'none');});
 }
 root.addEventListener('click',e=>{const toggle=e.target.closest('#judge-detail-toggle');if(toggle){return;}const groupBtn=e.target.closest('[data-judge-tuz-group]');if(groupBtn){judgeTuzGroup=groupBtn.dataset.judgeTuzGroup;root.querySelectorAll('[data-judge-tuz-group]').forEach(b=>{const active=b.dataset.judgeTuzGroup===judgeTuzGroup;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});drawTuzJudges();return;}const btn=e.target.closest('[data-tuz-sort]');if(!btn)return;const key=btn.dataset.tuzSort;if(key===tuzSortKey)tuzSortDirection*=-1;else{tuzSortKey=key;tuzSortDirection=-1;}drawTuzJudges();});
 drawTuzJudges();
 function hide(){chartTooltip.style.display='none';}
 function tip(target,html){
  const show=ev=>{chartTooltip.classList.remove('home-chart-tip');chartTooltip.innerHTML=html;chartTooltip.style.display='block';chartTooltip.style.left=Math.max(8,Math.min(ev.clientX+12,window.innerWidth-chartTooltip.offsetWidth-8))+'px';chartTooltip.style.top=Math.max(8,Math.min(ev.clientY+12,window.innerHeight-chartTooltip.offsetHeight-8))+'px';};
  target.onpointermove=show;target.onpointerleave=hide;target.onclick=show;
  target.onfocus=()=>{const r=target.getBoundingClientRect();show({clientX:r.left,clientY:r.bottom});};target.onblur=hide;
  target.onkeydown=e=>{if(e.key==='Escape')hide();if(e.key==='Enter'||e.key===' '){e.preventDefault();target.onfocus();}};
 }
 let heatSort='forum',heatDirection=-1;
 const signed=v=>(v>0?'+':v<0?'−':'')+fmt(Math.abs(v),2);
 function draw(){
  const deltas=rows.flatMap(r=>r.other.count?['forum','veteran'].filter(k=>r[k].count).map(k=>r[k].mean-r.other.mean):[]);
  const maxMagnitude=Math.max(.1,...deltas.map(Math.abs));
  const data=[...rows].sort((a,b)=>{
   const delta=r=>r.other.count&&r[heatSort].count?r[heatSort].mean-r.other.mean:null;
   const x=delta(a),y=delta(b);
   if(x===null)return y===null?a.name.localeCompare(b.name,'ru'):1;
   if(y===null)return -1;
   return (x-y)*heatDirection||a.name.localeCompare(b.name,'ru');
  });
  const tipHtml=r=>'<strong>'+esc(r.name)+'</strong>'+[['other','Остальные'],['forum','Форум'],['veteran','Ветераны']].map(([k,label])=>'<div>'+label+': '+(r[k].count?'<b>'+fmt(r[k].mean,2)+'</b> балла / '+fmt(r[k].count,0)+' оценок':'нет оценок')+'</div>').join('');
  const cell=(r,key,color)=>{
   if(!r.other.count||!r[key].count)return '<td><span class="judge-heat-empty" title="Нет данных для сравнения">—</span></td>';
   const d=r[key].mean-r.other.mean,alpha=.07+Math.min(1,Math.abs(d)/maxMagnitude)*.31;
   const bg=key==='forum'?'121,201,155':'215,161,90';
   return '<td><button type="button" class="judge-heat-cell" style="background:rgba('+bg+','+alpha.toFixed(3)+');color:'+color+'" data-heat-tip="'+esc(r.name)+'" data-heat-group="'+key+'" aria-label="'+esc(r.name)+' '+(key==='forum'?'Форум':'Ветераны')+' '+signed(d)+'">'+signed(d)+'</button></td>';
  };
  root.querySelector('#judge-heat-body').innerHTML=data.map(r=>'<tr data-judge-name="'+esc(r.name)+'"><th scope="row"><button type="button" class="judge-name-link" data-jump-judge="'+esc(r.name)+'" title="Найти судью в рейтинге ТУЗа">'+esc(r.name)+'</button></th>'+cell(r,'forum','#79C99B')+cell(r,'veteran','#D7A15A')+'<td class="judge-heat-overall"><b>'+fmt(r.mean,2)+'</b><small>'+tracks(r.count)+'</small></td></tr>').join('');
  root.querySelectorAll('[data-heat-sort]').forEach(el=>{el.textContent=el.dataset.heatSort===heatSort?(heatDirection===-1?'↓':'↑'):'↕';});
  root.querySelectorAll('[data-heat-tip]').forEach(el=>{const r=rows.find(v=>v.name===el.dataset.heatTip);if(r)tip(el,tipHtml(r));});
 }
 root.addEventListener('click',e=>{const btn=e.target.closest('[data-jump-judge]');if(!btn)return;const name=btn.dataset.jumpJudge;const row=[...root.querySelectorAll('#tuz-judge-body tr')].find(r=>r.dataset.judgeName===name);if(!row)return;root.querySelectorAll('.judge-cross-highlight').forEach(r=>r.classList.remove('judge-cross-highlight'));row.classList.add('judge-cross-highlight');const source=btn.closest('tr');if(source)source.classList.add('judge-cross-highlight');row.scrollIntoView({behavior:'smooth',block:'center'});});
 root.addEventListener('click',e=>{const btn=e.target.closest('[data-heat-sort]');if(!btn)return;if(heatSort===btn.dataset.heatSort)heatDirection*=-1;else{heatSort=btn.dataset.heatSort;heatDirection=-1;}draw();});
 draw();window.addEventListener('resize',draw);return {draw};
}

