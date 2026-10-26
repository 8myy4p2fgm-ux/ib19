import {mountDissidentsReport} from './dissidents-report.js';
import {mountVerdictReport} from './verdict-report.js';
import {getV58Research,fateSteps} from './v58-research-model.js';
// V58 reports/research.js UI functions. No prototype globals or old data bundle.
export function createV58ResearchReports(context,{goFate,method}={}){
 const source=getV58Research(context),all=source.all,byId=new Map(all.map(p=>[p.id,p])),names=source.names;
 const R={get chemistry(){return source.chemistry;},get dissent(){return source.dissent;},get judges(){return source.impacts().judges;},get base(){return source.impacts().base;},get forumCount(){return source.impacts().forumCount;},get scoreCount(){return source.impacts().scoreCount;}};
 const nodes={judges:{},rappers:{}},state={chemJudge:'',chemIndex:0,chemSort:'best',chemPage:0,impactJudge:'',impactOrder:'desc',executionJudge:'',fateId:all[0]?.id};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const f=(n,d=2)=>Number.isFinite(n)?n.toLocaleString('ru-RU',{maximumFractionDigits:d}):'—',sg=(n,d=2)=>Number.isFinite(n)?(n>0?'+':'')+f(n,d):'—';
const dt=t=>new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(t));
const status=s=>s==='pass'?'Проход':s==='fail'?'Вылет':'Исход не определён';
const selector=(id,value,options=names)=>`<select class="control" id="${id}" aria-label="${id.includes('order')?'Порядок':id.includes('rapper')?'Участник':'Судья'}">${options.map(o=>{const [v,n]=Array.isArray(o)?o:[o,o];return `<option value="${esc(v)}" ${v===value?'selected':''}>${esc(n)}</option>`}).join('')}</select>`;
const stats=items=>`<div class="jr-stats">${items.map(([v,l,c])=>`<div><strong class="${c||''}">${v}</strong><span>${l}</span></div>`).join('')}</div>`;
const plainMeaning={
 'Судейский ТУЗ':'Кто благосклоннее к форумчанам? Чем выше индекс, тем лучше отношение судьи к выбранной группе.',
 'Один на один':'Два судьи, одна группа: кто выше по ТУЗу и его составляющим?' ,
 'Рейтинг мэтчей':'Кто судит в унисон? Рейтинг близости оценок на общих треках.',
 'Диссиденты':'Кто из судей сильнее расходится с коллегами — и на каких треках это особенно заметно?',
 'Кто двигает общий ТУЗ':'Насколько изменился бы общий индекс без оценок выбранного человека.',
 'Палачи и спасатели':'Кто поставил оценку, после которой судьба трека стала решённой.',
 'Участники':'Все наши участники: найти, посмотреть результат и перейти к треку.',
 'Матрица оценок':'Все оценки Форума и Ветеранов на одной сетке. Нажмите на ячейку для комментария.',
 'На грани':'Один балл мог решить всё: 14 — вылет, 15 — проход при пяти оценках.',
 'Судьба репера':'Как накапливались баллы и в какой момент исход стал гарантированным.'
};
const reportTitle={'Судейский ТУЗ':'Рейтинг судей','Один на один':'Сравнение судей','Кто двигает общий ТУЗ':'Влияние на индекс ТУЗа','Палачи и спасатели':'Решающие оценки судей','Участники':'Участники Форума и ветераны','На грани':'Реперы на грани прохода'};
const title=(h,p)=>`<div class="jr-title"><h2>${reportTitle[h]||h}</h2><p>${plainMeaning[h]||p}</p>${h==='Рейтинг мэтчей'?'':'<button type="button" class="rpt-method-trigger">ⓘ Как считаем</button>'}</div>`;
function signedBars(rows,key='impact',click='impact'){const max=Math.max(.01,...rows.map(r=>Math.abs(r[key]??0)));return `<div class="jr-bars" role="img" aria-label="${click==='dissent'?'Отклонение оценок от коллег: длиннее полоса — сильнее различие':click==='execution'?'Количество решающих оценок по судьям':'Влияние на индекс: слева отрицательные, справа положительные значения'}">${rows.map(r=>{const v=r[key];return `<button type="button" class="jr-bar-row" data-${click}="${esc(r.key||r.j||r.name)}"><span>${esc(r.name||r.j)}</span><span class="jr-bar-track"><i style="left:${v<0?50-Math.abs(v)/max*48:50}%;width:${Math.abs(v||0)/max*48}%;background:${r.color||(click==='dissent'?'#99A6AC':v<0?'#c98a91':'#9fb5bd')}"></i></span><b class="${v<0?'negative':'positive'}">${sg(v,3)}</b></button>`}).join('')}</div>`;}
function commonGrid(pair,a,b){if(!pair||!pair.n)return '<p class="jr-muted">Нет общих оценённых треков.</p>';
 let html='';const max=Math.max(1,...Array.from({length:25},(_,k)=>pair.pairs.filter(p=>p.a===Math.floor(k/5)+1&&p.b===k%5+1).length));
 for(let y=5;y>=1;y--)for(let x=1;x<=5;x++){const n=pair.pairs.filter(p=>(a===pair.a?p.a:p.b)===x&&(a===pair.a?p.b:p.a)===y).length;html+=`<div tabindex="0" title="${esc(a)}: ${x}; ${esc(b)}: ${y}; ${n} треков" style="background:${n?(x===y?`rgba(191,156,117,${(.11+.7*n/max).toFixed(2)})`:`rgba(124,145,156,${(.11+.7*n/max).toFixed(2)})`):'rgba(124,135,141,.07)'}">${n||'·'}</div>`;}
 return `<div class="jr-common"><div class="jr-grid-label">${esc(b)}: 5 сверху, 1 снизу</div><div class="jr-score-grid">${html}</div><div class="jr-grid-label">${esc(a)}: 1 слева → 5 справа · диагональ = одинаковые баллы</div></div>`;
}
function matchMood(v){
 if(v>=90)return {label:'СЛУЖЕБНЫЙ РОМАН',text:'Одна душа — две судейские ведомости.',symbol:'♥ ♥'};
 if(v>=87)return {label:'СОВПАДЕНИЕ ПОДОЗРИТЕЛЬНОЕ',text:'У них одна методичка на двоих. Или одна подписка на неё.',symbol:'♥ ♥'};
 if(v>=83)return {label:'СВАЙП ВПРАВО',text:'Судейский совет одобряет эти отношения.',symbol:'♥'};
 if(v>=78)return {label:'НА ОДНОЙ ВОЛНЕ',text:'Сошлись почти во всём. Кроме пары припевов.',symbol:'♡'};
 if(v>=73)return {label:'ЕСТЬ ХИМИЯ',text:'На свидание можно. Но баллы лучше обсудить заранее.',symbol:'♡'};
 if(v>=68)return {label:'СЛОЖНЫЕ ОТНОШЕНИЯ',text:'Вроде мэтч, но после каждой двойки серьёзный разговор.',symbol:'♡'};
 return {label:'АНТИМЭТЧ',text:'Диалог в Pure удалён. Разница в баллах осталась.',symbol:'♡'};
}
function matchInitials(name){return name.trim().split(/\s+/).map(s=>s[0]).slice(0,2).join('').toLocaleUpperCase('ru');}
function chemistry(panel){
 const eligible=R.chemistry.filter(p=>p.n>0);
 const globalBest=[...eligible].sort((a,b)=>b.compat-a.compat||b.n-a.n)[0];
 const globalWorst=[...eligible].sort((a,b)=>a.compat-b.compat||b.n-a.n)[0];
 const all=R.chemistry.filter(p=>p.n>0&&(!state.chemJudge||p.a===state.chemJudge||p.b===state.chemJudge));
 all.sort((a,b)=>state.chemSort==='worst'?a.compat-b.compat||b.n-a.n:b.compat-a.compat||b.n-a.n);
 const size=window.innerWidth<=650?8:12,maxPage=Math.max(0,Math.ceil(all.length/size)-1);
 state.chemPage=Math.max(0,Math.min(maxPage,state.chemPage));
 if(state.chemIndex>=all.length)state.chemIndex=0;
 const p=all[state.chemIndex]||null;
 const compat=p?.compat??null,exact=p?.exact??null,n=p?.n||0,mood=Number.isFinite(compat)?matchMood(compat):{label:'Нет общих треков',text:'Близость оценок не определена.',symbol:'♡'};
 const averageGap=p?.mae??null;
 const fmt=n=>Number.isFinite(n)?n.toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';
 const judgeFilter=`<label class="v49-filter-label" for="v49-judge">Судья</label><select class="v49-select" id="v49-judge" aria-label="Фильтр по судье"><option value="">Все судьи</option>${names.map(name=>`<option value="${esc(name)}" ${name===state.chemJudge?'selected':''}>${esc(name)}</option>`).join('')}</select>`;
 const orderFilter=`<label class="v49-filter-label" for="v49-sort">Порядок</label><select class="v49-select" id="v49-sort" aria-label="Порядок рейтинга"><option value="best" ${state.chemSort==='best'?'selected':''}>Лучшие сначала</option><option value="worst" ${state.chemSort==='worst'?'selected':''}>Антимэтчи сначала</option></select>`;
 const rows=all.slice(state.chemPage*size,(state.chemPage+1)*size);
 panel.innerHTML=title('Рейтинг мэтчей','Дейтинг для судей: кто ставил похожие баллы одним и тем же участникам?')+`
 <section class="v49-match-hero" aria-label="Выбранная пара судей">
  <div class="v49-match-top"><span class="v49-match-eyebrow">♥ TUZ MATCH · ${p&&p.a===globalBest?.a&&p.b===globalBest?.b?'ЛУЧШАЯ ПАРА РАУНДА':'СУДЕЙСКАЯ СОВМЕСТИМОСТЬ'}</span><span class="v49-match-position">${all.length?state.chemIndex+1:0} / ${all.length}</span></div>
  <div class="v49-couple">
    <div class="v49-person"><div class="v49-avatar" aria-hidden="true">${p?esc(matchInitials(p.a)):'—'}</div><strong>${p?`<button type="button" data-judge-card="${esc(p.a)}" >${esc(p.a)}</button>`:'Нет пары'}</strong><span>Судья</span></div>
    <div class="v49-match-heart"><span aria-hidden="true">${mood.symbol}</span><strong>${Number.isFinite(p?.compat)?fmt(p.compat)+'%':'—'}</strong><small>Близость оценок</small></div>
    <div class="v49-person"><div class="v49-avatar" aria-hidden="true">${p?esc(matchInitials(p.b)):'—'}</div><strong>${p?`<button type="button" data-judge-card="${esc(p.b)}" >${esc(p.b)}</button>`:'Нет пары'}</strong><span>Судья</span></div>
  </div>
  <div class="v49-quote"><span>${mood.label}</span><p>${p?mood.text:'Для выбранного фильтра нет подходящих пар.'}</p></div>
  <div class="v49-pair-facts">
   <div><strong>${f(n,0)}</strong><span>Общих треков</span></div>
   <div><strong>${Number.isFinite(exact)?f(exact*100,1)+'%':'—'}</strong><span>Одинаковые баллы</span></div>
   <div><strong>${p?f(averageGap,2):'—'}</strong><span>Средняя разница · балла</span></div>
  </div>
  <div class="v49-hero-actions"><button class="v49-btn" id="v49-prev" type="button" ${all.length<2?'disabled':''} aria-label="Предыдущая пара">← Предыдущая</button><button class="v49-btn" id="v49-next" type="button" ${all.length<2?'disabled':''}>Следующая пара →</button></div>
 </section>
 <section class="v49-rank-section" aria-label="Рейтинг судейских пар">
  <div class="v49-rank-head"><div><h3>Рейтинг пар</h3><p>${f(all.length,0)} пар</p></div><div class="v49-quick"><button type="button" class="v49-btn" id="v49-best" >♥ Лучшая пара</button><button type="button" class="v49-btn" id="v49-worst" >Антимэтч ↘</button></div></div>
  <div class="v49-match-filters">${judgeFilter}${orderFilter}</div>
  <div class="v49-rank-list">${rows.map((row,i)=>{const pos=state.chemPage*size+i,selected=pos===state.chemIndex,rMood=matchMood(row.compat);return `<div class="v49-rank-row ${selected?'selected':''}" data-v49-pair="${pos}"><button type="button" class="v49-rank-number judge-card-select" aria-label="Выбрать пару ${pos+1}">${String(pos+1).padStart(2,'0')}</button><span class="v49-rank-names"><strong><button type="button" data-judge-card="${esc(row.a)}">${esc(row.a)}</button> <span>♥</span> <button type="button" data-judge-card="${esc(row.b)}">${esc(row.b)}</button></strong><small>${rMood.label.toLowerCase()} · ${f(row.n,0)} общих треков</small></span><button type="button" class="v49-rank-score judge-card-select" aria-label="Выбрать пару ${pos+1}">${fmt(row.compat)}%</button><span class="v49-rank-arrow" aria-hidden="true">↗</span></div>`}).join('')||'<p class="v49-empty">По выбранным фильтрам пар нет. Измени фильтр.</p>'}</div>
  <div class="v49-rank-pager"><button type="button" class="v49-btn" id="v49-page-prev" ${state.chemPage===0?'disabled':''}>← Назад</button><span>${state.chemPage+1} / ${maxPage+1}</span><button type="button" class="v49-btn" id="v49-page-next" ${state.chemPage===maxPage?'disabled':''}>Вперёд →</button></div>
 </section>
 `;
 const selectPair=(target)=>{if(!target)return;const i=all.indexOf(target);if(i<0)return;state.chemIndex=i;state.chemPage=Math.floor(i/size);chemistry(panel);requestAnimationFrame(()=>panel.querySelector('.v49-match-hero')?.scrollIntoView({behavior:'smooth',block:'start'}))};
 const move=(delta)=>{if(!all.length)return;const i=(state.chemIndex+delta+all.length)%all.length;state.chemIndex=i;state.chemPage=Math.floor(i/size);chemistry(panel)};
 panel.querySelector('#v49-prev').onclick=()=>move(-1);
 panel.querySelector('#v49-next').onclick=()=>move(1);
 panel.querySelector('#v49-best').onclick=()=>{state.chemJudge='';state.chemSort='best';state.chemIndex=0;state.chemPage=0;chemistry(panel);requestAnimationFrame(()=>panel.querySelector('.v49-match-hero')?.scrollIntoView({behavior:'smooth',block:'start'}))};
 panel.querySelector('#v49-worst').onclick=()=>{state.chemJudge='';state.chemSort='worst';state.chemIndex=0;state.chemPage=0;chemistry(panel);requestAnimationFrame(()=>panel.querySelector('.v49-match-hero')?.scrollIntoView({behavior:'smooth',block:'start'}))};
 panel.querySelector('#v49-judge').onchange=e=>{state.chemJudge=e.target.value;state.chemIndex=0;state.chemPage=0;chemistry(panel)};
 panel.querySelector('#v49-sort').onchange=e=>{state.chemSort=e.target.value;state.chemIndex=0;state.chemPage=0;chemistry(panel)};
 panel.querySelector('#v49-page-prev').onclick=()=>{state.chemPage--;chemistry(panel)};
 panel.querySelector('#v49-page-next').onclick=()=>{state.chemPage++;chemistry(panel)};
 panel.querySelectorAll('[data-v49-pair]').forEach(btn=>btn.onclick=()=>selectPair(all[Number(btn.dataset.v49Pair)]));
 const card=panel.querySelector('.v49-match-hero');let touch=null;
 card.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;touch=e.clientX});
 card.addEventListener('pointerup',e=>{if(touch!==null&&Math.abs(e.clientX-touch)>75){move(e.clientX<touch?1:-1)}touch=null});
}
function dissidents(panel){
 if(panel.querySelector('.dissent-ux'))return;
 panel.innerHTML=title('Диссиденты','Кто из судей расходится с коллегами сильнее всего?');
 mountDissidentsReport(panel,source,{goFate,judgeIdentities:source.judgeIdentities});
}
function impact(kind){const panel=nodes[kind].panel,rows=[...R.judges].filter(r=>r.available).sort((a,b)=>state.impactOrder==='asc'?a.impact-b.impact:b.impact-a.impact),prop='impactJudge',selected=rows.find(r=>r.key===state[prop])||rows[0];if(!selected){panel.innerHTML=title('Кто двигает общий ТУЗ','Нет данных для расчёта.');return;}state[prop]=selected.key;
 panel.innerHTML=title('Кто двигает общий ТУЗ','Индекс со всеми минус индекс без одного. Чувствительность индекса, а не приговор.')+`<div class="jr-tools">${selector('jr-impact-selection-'+kind,selected.key,rows.map(r=>[r.key,r.name]))}${selector('jr-impact-order-'+kind,state.impactOrder,[['desc','Сначала повышающие'],['asc','Сначала понижающие']])}<span>Форум: ${R.forumCount} участников · ${R.scoreCount} оценок</span></div>${stats([[sg(R.base.index,5),'Общий ТУЗ'],[sg(selected.impact,5),'Влияние выбранного',selected.impact<0?'negative':'positive'],[sg(selected.without.index,5),'ТУЗ без выбранного']])}<div class="jr-two-columns"><div class="jr-scroll">${signedBars(rows,'impact','impact')}</div><div class="jr-component-card"><h3>${esc(selected.name)}</h3><p>${selected.n} оценок · ${selected.forumN} форумских</p>${signedBars([{name:'Благосклонность',key:'favor',delta:selected.favor},{name:'Внимание',key:'attention',delta:selected.attention},{name:'Уважение',key:'respect',delta:selected.respect}],'delta','component')}<p class="jr-note">Δ компонентов в пунктах ТУЗа.${Math.abs(selected.clippingEffect)>1e-10?' Эффект ограничения: '+sg(selected.clippingEffect,5):' Ограничение ±100 не повлияло.'}</p>${`<div class="jr-impact-personal"><span>Личный ТУЗ судьи</span><strong>${sg(selected.personalTuz)}</strong><small>Иная метрика: коэффициент активности и сравнение внутри судьи.</small></div>${impactScatter(rows,selected.key)}`}</div></div>`;
 panel.querySelector('#jr-impact-selection-'+kind).onchange=e=>{state[prop]=e.target.value;impact(kind)};panel.querySelector('#jr-impact-order-'+kind).onchange=e=>{state.impactOrder=e.target.value;impact(kind)};panel.querySelectorAll('[data-impact]').forEach(b=>b.onclick=()=>{state[prop]=b.dataset.impact;impact(kind)});bindFate(panel);
}
function impactScatter(rows,key){const valid=rows.filter(r=>Number.isFinite(r.personalTuz)),min=Math.min(0,...valid.map(r=>r.personalTuz)),max=Math.max(1,...valid.map(r=>r.personalTuz)),lim=Math.max(.01,...valid.map(r=>Math.abs(r.impact))),x=v=>30+(v-min)/(max-min)*300,y=v=>110-v/lim*75;return `<svg class="jr-scatter" viewBox="0 0 360 220" role="img" aria-label="Личный ТУЗ по горизонтали, влияние по вертикали"><path d="M30,35V185H330M30,110H330" fill="none" stroke="#425747"/>${valid.map(r=>`<circle cx="${x(r.personalTuz)}" cy="${y(r.impact)}" r="${r.key===key?6:3.5}" fill="${r.impact<0?'#c98a91':'#9fb5bd'}" tabindex="0"><title>${esc(r.name)} · личный ${sg(r.personalTuz)} · влияние ${sg(r.impact,4)}</title></circle>`).join('')}<text x="30" y="20">Влияние ↑ · ±${f(lim,2)}</text><text x="30" y="207">${f(min)} → личный ТУЗ → ${f(max)}</text></svg>`;}
function execution(panel){
 mountVerdictReport(panel,source,{selectedJudge:state.executionJudge,onJudge:key=>{state.executionJudge=key;},goFate});
}
function fate(panel){const p=byId.get(state.fateId)||all[0];if(!p){panel.innerHTML='<p>Участники не найдены.</p>';return;}const steps=fateSteps(p),prefix=steps.slice(1);
 panel.innerHTML=title('Судьба репера','От первой оценки до момента, когда арифметика сказала своё.')+`<div class="jr-tools jr-fate-tools"><label>Найти участника<input class="control" id="jr-fate-search" placeholder="Ник или псевдоним" aria-label="Поиск участника для хронологии"></label>${selector('jr-rapper-fate',p.id,all.map(p=>[p.id,p.name+(p.artist&&p.artist!==p.name?' · '+p.artist:'')]))}</div>${stats([[esc(p.name),'Участник'],[p.total+' / '+p.count,'Сумма / число оценок'],[p.official?'Официальный проход':p.minFinal+'–'+p.maxFinal,'Возможный итог']])}${p.uncertain?'<div class="jr-warning">'+(p.official?'Официальный проход учитывается отдельно. Время решения не подтверждено; решающий судья не назначается.':'Известны правки, удаление оценки или недостоверные временные метки. Надёжный порядок не восстановлен: ниже текущие баллы по алфавиту судей, без хронологии и без решающего судьи.')+'</div>':fateChart(steps)}<div class="jr-fate-list">${(p.uncertain?[...p.scores].sort((a,b)=>a.judgeName.localeCompare(b.judgeName,'ru')):prefix).map(s=>`<article class="jr-fate-step int10-score ${s.first?'jr-decisive':''}"><div class="jr-step-grade">${s.score}</div><div><h3>${esc(s.judgeName)}${!p.uncertain?' <small>· '+s.n+'-я оценка</small>':''}</h3><time>${dt(s.scoredAt)} МСК</time>${!p.uncertain?`<p>Сумма ${s.total} · итог ${s.min}–${s.max} <b class="${s.st}">${s.first?'Впервые гарантирован: '+status(s.st):status(s.st)}</b></p>`:''}<details><summary>Комментарий судьи</summary><p class="jr-comment">${esc(s.comment?.trim()||'Комментарий отсутствует')}</p></details></div></article>`).join('')||'<p class="jr-note">Оценок пока нет. Возможный итог 5–25, исход не определён.</p>'}</div><p class="jr-note">${p.uncertain?'Время каждой текущей записи сохранено, но не принимается за достоверную последовательность.':'Пунктир — 15 баллов; область — минимальный и максимальный возможный итог. По горизонтали — номер оценки.'}</p>`;
 panel.querySelector('#jr-rapper-fate').onchange=e=>{if(e.target.value){state.fateId=e.target.value;fate(panel)}};panel.querySelector('#jr-fate-search').oninput=e=>{const q=e.target.value.trim().toLocaleLowerCase('ru'),sel=panel.querySelector('#jr-rapper-fate');const matched=all.filter(p=>[p.name].some(v=>v?.toLocaleLowerCase('ru').includes(q)));sel.innerHTML='<option value="">Выберите из найденных ('+matched.length+')</option>'+matched.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');};
}
function fateChart(steps){const x=n=>40+n/5*620,y=v=>225-v/25*200,path=k=>steps.map((s,i)=>(i?'L':'M')+x(s.n)+','+y(s[k])).join(' ');return `<svg class="jr-fate-chart" viewBox="0 0 700 290" role="img" aria-label="Сумма, минимальный и максимальный итог по мере оценивания"><g transform="translate(0 20)"><path d="${path('max')} ${[...steps].reverse().map(s=>'L'+x(s.n)+','+y(s.min)).join(' ')}Z" fill="#a7cfb81c"/><path d="M40,${y(15)}H665" stroke="#d6ae78" stroke-dasharray="5 4"/><text x="660" y="${y(15)-6}" text-anchor="end">порог 15</text>${['max','min','total'].map((k,i)=>`<path d="${path(k)}" fill="none" stroke="${['#6f9470','#b89668','#a7cfb8'][i]}" stroke-width="${i===2?3:1.5}"/>`).join('')}${steps.map(s=>`<circle cx="${x(s.n)}" cy="${y(s.total)}" r="${s.first?6:3}" fill="${s.st==='fail'?'#dc828b':'#a7cfb8'}" tabindex="0"><title>${s.n}-я оценка; сумма ${s.total}; минимум ${s.min}; максимум ${s.max}</title></circle><text x="${x(s.n)}" y="249" text-anchor="middle">${s.n}</text>`).join('')}${[0,5,10,15,20,25].map(v=>`<text x="30" y="${y(v)+4}" text-anchor="end">${v}</text>`).join('')}<text x="40" y="13">Максимум / минимум / сумма</text></g></svg>`;}
function bindFate(panel){panel.querySelectorAll('[data-fate]').forEach(b=>b.onclick=()=>{state.fateId=b.dataset.fate;goFate(state.fateId)});}

 const mounted=new WeakSet();
 function draw(kind,index,panel){
  nodes[kind].panel=panel;panel.dataset.reportMode=String(index);
  if(kind==='judges')({2:chemistry,3:dissidents,4:()=>impact(kind),5:execution}[index])?.(panel);
  else if(index===4)fate(panel);
  const title=panel.querySelector('.jr-title');if(title&&!(kind==='judges'&&[2,5].includes(index))&&!title.querySelector('.rpt-method-trigger')){const button=document.createElement('button');button.type='button';button.className='rpt-method-trigger';button.textContent='ⓘ Как считаем';title.append(button);}
  if(!mounted.has(panel)){mounted.add(panel);panel.addEventListener('click',e=>{const button=e.target.closest('.rpt-method-trigger');if(button)method?.(button);});panel.addEventListener('change',e=>{const id=e.target.id,wasOpen=e.target.closest('details')?.open;if(id)queueMicrotask(()=>{const field=panel.querySelector('[id="'+CSS.escape(id)+'"]');if(wasOpen)field?.closest('details')?.setAttribute('open','');field?.focus({preventScroll:true});});});}
 }
 return {draw,commonGrid(pair,a,b){return commonGrid(pair,a,b);},fate(id,panel){state.fateId=id;draw('rappers',4,panel);},get source(){return source;}};
}
export function goToV58Fate(id){
 const url=new URL('../rappers/',import.meta.url);url.searchParams.set('round','1');url.searchParams.set('participant',id);
 history.pushState(null,'',url.pathname+url.search);window.dispatchEvent(new PopStateEvent('popstate'));
}
