import {prepareSectionStyles} from './section-styles.js';
import {reportCatalog,requestedReport} from './report-catalog.js';
import {removeHiddenReportRequest} from './report-availability.js';
import {openHoro} from './horo-entry.js';
import {rankPersonalV4} from './personal.js';
import {buildEvents} from './analytics-v2.js';
import {voiceInline,selectEditorial,createEditorialSession} from './forum-voice.js';
import {renderPublicRoundTwo} from './r2-public-page.js';
const paths={overview:'',dynamics:'dynamics/',judges:'judges/','forum-link':'rappers/',events:'events/',horo:'horo/'};
const sectionRoutes={home:'overview',judges:'judges',dynamics:'dynamics','forum-link':'forum-link','events-page':'events',horo:'horo'};
const routeSections=Object.fromEntries(Object.entries(sectionRoutes).map(([k,v])=>[v,k]));
const titles={overview:'Главная',judges:'Судьи',dynamics:'Ход баттла','forum-link':'Реперы',events:'События',horo:'Хо-ро-шо. По форумному'};
const basePath=new URL('../',import.meta.url).pathname;
export function parseRoute(input,base=basePath){
 const url=new URL(input),params=new URLSearchParams(url.search),rounds=params.getAll('round');
 let type=Object.keys(paths).find(k=>paths[k]===url.pathname.slice(base.length))||'overview',hashRound=null,legacyReport='';
 const fail=error=>({error,type,round:null,params,url:url.href});
 if(rounds.length>1)return fail('Неоднозначный URL: параметр round указан несколько раз.');
 if(rounds.length&& !['1','2'].includes(rounds[0]))return fail('Раунд не поддерживается.');
 if(url.hash){
  const [hash,queryString='']=url.hash.slice(1).split('?'),parts=hash.split('/').filter(Boolean);
  if(parts[0]==='forum')type='forum-link';
  else if(parts[0]==='round'){
   if(!['1','2'].includes(parts[1]))return fail('Раунд в legacy-ссылке не поддерживается.');
   hashRound=Number(parts[1]);type=parts[2]||'overview';if(type==='compare')legacyReport='compare';
   type=({forum:'forum-link',judge:'judges',compare:'judges',participant:'forum-link'})[type]||type;
   if(!Object.hasOwn(paths,type))type='overview';
  }
  for(const [key,value]of new URLSearchParams(queryString))if(!params.has(key))params.set(key,value);
  const hashParams=new URLSearchParams(queryString).getAll('round');
  if(hashParams.length>1||hashParams.some(v=>!['1','2'].includes(v)))return fail('Некорректный round в legacy-ссылке.');
  if(rounds.length&&hashParams.length&&rounds[0]!==hashParams[0])return fail('Неоднозначный URL: раунды hash и query различаются.');
  if(hashRound&&params.has('round')&&Number(params.get('round'))!==hashRound)return fail('Неоднозначный URL: раунды hash и query различаются.');
 }
 const round=hashRound??Number(params.get('round')||1);
 if(round===2||params.has('round'))params.set('round',String(round));
 // REL-OPEN-01: public R2 has one destination, including legacy and restored links.
 if(round===2)return {type:'overview',round,params:new URLSearchParams('round=2'),error:null,canonical:base+'?round=2'};
 const reportFallback=removeHiddenReportRequest(type,params,url.hash,legacyReport);
 return {type,round,params,error:null,...(reportFallback?{reportFallback:true}:{}),canonical:base+paths[type]+(params.size?'?'+params:'')};
}
export function isFirstRoundActive(){const state=parseRoute(location.href);return !state.error&&state.round===1&&state.type!=='horo';}
export function initializeRoutes({loadR1,mountR1}){
 const $=id=>document.getElementById(id),main=document.querySelector('.main');
 for(const [id,title]of [['events-page','События'],['horo','Хо-ро-шо. По форумному'],['round-information','Сведения второго раунда']]){
  const page=document.createElement('section');page.className='page';page.id=id;page.setAttribute('aria-label',title);main.append(page);
 }
 const stateBox=$('load-state');main.insertBefore(stateBox,main.querySelector('.page'));
 const slot=document.querySelector('.shell-round-label');slot.classList.add('shell-round-picker');
 slot.innerHTML='<label for="round-select">Раунд</label><select id="round-select"><option value="" disabled>Выбор раунда</option><option value="1">1-й отборочный</option><option value="2" data-badge="Скоро">2-й отборочный</option></select>';
 const select=$('round-select');
 let sequence=0,r1Promise,r1UI,r1Context;
 let D,P,fmt,esc,judgeNames,judgeCurrent,judgeSummary,judges,events;
 const date=t=>new Date(t).toLocaleString('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
 const pathFor=type=>basePath+paths[type];
 const target=(type,round,params=new URLSearchParams(),explicit=false)=>{if(round===2||explicit)params.set('round',String(round));return pathFor(type)+(params.size?'?'+params:'');};
 function query(){return new URLSearchParams(location.search);}
 function setQuery(values){const params=query();for(const [k,v]of Object.entries(values))v===null||v===''?params.delete(k):params.set(k,v);history.replaceState(history.state,'',location.pathname+(params.size?'?'+params:''));}
 function activate(id){document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===id));}
 function snapshot(kind,info){
  const caption=document.querySelector('.shell-snapshot>span'),update=document.querySelector('.header-update');
  caption.textContent=kind==='r1'?'Первый раунд':kind==='r2'?'Второй раунд':kind==='horo'?'Глобальный раздел · форумные материалы':'Данные раунда';
  update.firstChild.textContent='';$('updated').textContent='';$('updated').title='';$('deadline-countdown').hidden=kind!=='r1';$('deadline-countdown').setAttribute('aria-hidden',String(kind!=='r1'));
  for(const key of ['runId','policyVersion','sourceSelectionVersion','snapshotKey']){
   if(kind==='r1')document.querySelector('.app').dataset[key]=info[key];else delete document.querySelector('.app').dataset[key];
  }
  document.querySelectorAll('.main>.data-warning').forEach(n=>n.hidden=kind!=='r1');
 }
 function notice(title,message,{retry=false}={}){
  activate(null);stateBox.className=retry?'load-error':'load-pending';stateBox.hidden=false;stateBox.replaceChildren();
  const heading=document.createElement('h2');heading.textContent=title;const p=document.createElement('p');p.textContent=message;stateBox.append(heading,p);
  if(retry){const button=document.createElement('button');button.className='control';button.textContent=isFirstRoundActive()?'Разбудить программиста':'Повторить';button.onclick=()=>route();stateBox.append(button);}
  const a=document.createElement('a');a.href=pathFor('overview');a.textContent='Открыть первый раунд';stateBox.append(a);
 }
 function reveal(){document.querySelector('.app').hidden=false;window.ib19Loader.ready();if(window.ib19BootFailed)window.ib19BootFailure();}
 function emit(ready=false){window.dispatchEvent(new CustomEvent('ib19:route',{detail:{ready}}));}
 function focusAfterRoute(){requestAnimationFrame(()=>select.focus({preventScroll:true}));}
 async function route({focus=false}={}){
  const ticket=++sequence,state=parseRoute(location.href);
  const tip=document.querySelector('.chart-tip');if(tip)tip.style.display='none';
  document.querySelectorAll('dialog[open]').forEach(d=>d.close());emit();
  select.value=state.error?'':String(state.round);
  document.body.dataset.round=state.error?'unsupported':String(state.round);
  document.querySelector('.site-header .navs').hidden=state.round===2;
  $('page-title').textContent=state.error?'Некорректная ссылка':state.round===2?'Второй отборочный':titles[state.type];
  document.title=$('page-title').textContent+' — TUZ19';
  document.querySelector('.head').classList.toggle('overview-head',state.type==='overview');
  document.querySelectorAll('.nav').forEach(b=>{
   const active=b.dataset.tab===routeSections[state.type]||(state.type==='events'&&b.dataset.tab==='dynamics');b.classList.toggle('active',active);b.setAttribute('aria-current',active?'page':'false');
   b.href=target(sectionRoutes[b.dataset.tab],state.round||1,new URLSearchParams(),state.params.has('round'));
  });
  document.querySelector('.site-brand').href=target('overview',state.round||1,new URLSearchParams(),state.params.has('round'));
  window.scrollTo(0,0);
  if(state.error){snapshot('none');notice('Некорректная ссылка',state.error);reveal();if(focus)focusAfterRoute();return;}
  const current=location.pathname+location.search+location.hash;
  if(current!==state.canonical)history.replaceState(history.state,'',state.canonical);
  if(state.round===2){
   snapshot('r2');stateBox.hidden=true;activate('round-information');
   renderPublicRoundTwo($('round-information'),target('overview',1,new URLSearchParams(),true));
   emit();reveal();if(focus)focusAfterRoute();return;
  }
  if(state.type==='horo'){snapshot('horo');activate('horo');openHoro($('horo'));emit();reveal();if(focus)focusAfterRoute();return;}
  // The shell stays usable while the first round is loading.
  if(!r1UI){notice('Загружаем данные…','Первый раунд');reveal();}
  try{
    r1Promise ||= loadR1().catch(e=>{r1Promise=null;throw e;});const context=await r1Promise;if(ticket!==sequence)return;
    if(!r1UI){await window.ib19Loader.preparing?.();if(ticket!==sequence)return;}
    if(!r1UI){r1Context=context;r1UI=mountR1(context);({D,P,fmt,esc,judgeNames,judgeCurrent,judgeSummary}=r1UI);judges=rankPersonalV4(judgeCurrent);$('about').querySelector('h2').insertAdjacentHTML('afterend',voiceInline(selectEditorial('methodology',{})?.text));}
    await r1UI.preparePage?.(state.type);if(ticket!==sequence)return;
    if(state.reportFallback)window.dispatchEvent(new CustomEvent('tuz:report-fallback',{detail:{kind:state.type==='forum-link'?'rappers':state.type}}));
    snapshot('r1',r1Context);stateBox.hidden=true;activate(routeSections[state.type]);
    if(state.type==='events'){events??=buildEvents(D);renderEvents();}if(state.type==='judges')judgeSummary.draw();emit(true);
    if(state.type==='dynamics'||state.type==='overview')window.dispatchEvent(new Event('resize'));
  }catch(error){if(ticket!==sequence)return;snapshot('none');notice(state.round===1?'Не удалось загрузить первый раунд':'Не удалось загрузить сведения R2',error.message,{retry:true});}
  reveal();if(focus)focusAfterRoute();
 }
 function navigate(type){
  const state=parseRoute(location.href);const url=target(type,state.round||1,new URLSearchParams(),state.params.has('round'));
  if(location.pathname+location.search+location.hash!==url){history.pushState(null,'',url);route();}
 }
 // Native links retain copy/new-tab semantics; ordinary clicks use this router.
 main.addEventListener('click',e=>{const a=e.target.closest('a[data-report-link]');if(!a||e.button||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;const url=new URL(a.href);if(url.origin!==location.origin||!url.pathname.startsWith(basePath))return;e.preventDefault();history.pushState(null,'',url.pathname+url.search);route();});
 document.querySelectorAll('.nav').forEach(a=>a.addEventListener('click',e=>{if(e.button||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();navigate(sectionRoutes[a.dataset.tab]);}));
 document.querySelector('.site-brand').addEventListener('click',e=>{if(e.button||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();navigate('overview');});
 select.onchange=()=>{const state=parseRoute(location.href),params=new URLSearchParams(),kind=state.type==='forum-link'?'rappers':state.type;if(reportCatalog[kind]&&(state.params.has('report')||state.params.has('tab')))params.set('report',requestedReport(kind,state.params).id);const url=target(state.type,Number(select.value),params,true);history.pushState(null,'',url);route({focus:true});};
 window.addEventListener('popstate',()=>route());window.addEventListener('hashchange',()=>route());
 window.ib19Navigate=navigate;window.ib19IsR1=isFirstRoundActive;
 // Reveal the initial page only after its data and route-specific presentation are ready.
 route();
 function eventHtml(items){const session=createEditorialSession();return items.map(e=>{const status=e.type==='pass'?'pass':e.type==='fail'?'fail':null,caption=status?session.pick('participants',{status,count:1}):null;return '<article class="event-row"><time>'+date(e.t)+'</time><div><strong>'+esc(e.title)+'</strong><p>'+esc(e.body)+'</p>'+(caption?'<small class="forum-comment">'+esc(caption.text)+'</small>':'')+'</div></article>';}).join('')||'<p class="mini-note">Событий по выбранным условиям нет.</p>';}
 function renderEvents(){const root=$('events-page');root.innerHTML='<div class="panel"><h2>События первого раунда</h2><p class="mini-note">Реконструкция по времени оценок текущей выборки. Официальный специальный проход не датирован и не добавлен в историческую ленту; исходная история исправлений сохранена.</p><select class="control" id="event-type"><option value="all">Все события</option><option value="pass">Проход</option><option value="fail">Математическое выбывание</option><option value="complete">Полностью отсужен</option><option value="judge-first">Первый форумщик судьи</option><option value="one">Единица форумщику</option></select><div id="events-list"></div><button id="events-more" class="control">Показать ещё</button></div>';let limit=40;$('event-type').value=query().get('type')||'all';function render(){const value=$('event-type').value;setQuery({type:value==='all'?null:value});const filtered=events.filter(e=>value==='all'||e.type===value);$('events-list').innerHTML=eventHtml(filtered.slice(0,limit));$('events-more').hidden=limit>=filtered.length;}$('event-type').onchange=()=>{limit=40;render()};$('events-more').onclick=()=>{limit+=40;render()};render();}

 return {route};
}
