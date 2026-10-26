import {mountRapperReport} from './rapper-report-view.js';
import {keepActiveReportVisible} from './report-tabs.js';
import {onReportFallback,nextAvailableReport} from './report-availability.js';
const reports=['participants','matrix','tuz-impact'],labels=['Участники','Матрица оценок','Влияние на ТУЗ'];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountRapperResearch({root,model,round=1}){
 let selectionTicket=0;
 const state={tab:0,participant:'',judge:''},mounted=new Map(),shell=document.createElement('section');shell.className='rapper-research rr-shell';
 shell.innerHTML=`<header class="rpt-page-head"><p class="bp-kicker">TUZ19 / РАУНД 0${round} <span aria-hidden="true">|</span><span class="rpt-theme">${esc(model.topic)}</span></p><h1>Реперы</h1><p class="rpt-page-intro">Наши на баттле: результаты, оценки и влияние на общий ТУЗ.</p></header><nav class="rr-nav report-tabs" role="tablist" aria-label="Отчёты о реперах">${labels.map((label,i)=>`<button type="button" role="tab" data-rapper-tab="${i}" id="rr-tab-${round}-${i}" aria-controls="rr-panel-${round}-${i}" aria-selected="${i===0}" tabindex="${i===0?0:-1}">${label}</button>`).join('')}</nav>${labels.map((_,i)=>`<div class="rr-panel" id="rr-panel-${round}-${i}" role="tabpanel" aria-labelledby="rr-tab-${round}-${i}" ${i?'hidden':''}></div>`).join('')}`;
 root.replaceChildren(shell);keepActiveReportVisible(shell.querySelector('.report-tabs'));
 const byId=new Map((model.allMembers||model.members).map(p=>[p.id,p]));
 function updateURL(){if(!root.classList.contains('active')||!location.pathname.endsWith('/rappers/'))return;const url=new URL(location.href);url.searchParams.set('report',reports[state.tab]);if(state.participant)url.searchParams.set('participant',state.participant);else url.searchParams.delete('participant');if(state.tab===1&&state.judge)url.searchParams.set('judge',state.judge);else url.searchParams.delete('judge');history.replaceState(history.state,'',url);}
 async function choose(index,{participant,judge='',focus=false,write=true,preserve=false}={}){
  const ticket=++selectionTicket;
  index=reports.includes(index)?reports.indexOf(index):Number(index);if(!reports[index])index=0;
  const explicit=participant!==undefined;if(explicit)state.participant=byId.has(participant)?participant:'';
  state.tab=index;state.judge=preserve&&index===1&&mounted.has(index)?mounted.get(index).getJudge():judge;
  shell.querySelectorAll('[data-rapper-tab]').forEach(b=>{const active=+b.dataset.rapperTab===index;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;if(active&&focus)b.focus({preventScroll:true});});
  shell.querySelectorAll('.rr-panel').forEach((p,i)=>p.hidden=i!==index);
  const panel=shell.querySelector('#rr-panel-'+round+'-'+index);
  if(explicit&&mounted.has(index)&&(!preserve||panel.firstElementChild?.dataset.participant!==state.participant)){mounted.get(index).destroy();mounted.delete(index);panel.replaceChildren();}
  if(!mounted.has(index)&&index===2&&model.prepareImpacts){
   panel.innerHTML='<p role="status">Готовим исследование…</p>';
   try{await model.prepareImpacts();}catch(error){if(ticket===selectionTicket)panel.textContent='Не удалось подготовить исследование';console.error(error);return;}
   if(ticket!==selectionTicket||!shell.isConnected)return;
  }
  if(!mounted.has(index)){
   panel.innerHTML='<article class="rr rr-report"><div class="rr-content"></div><dialog class="rr-dialog" aria-label="Участник или оценка"><button type="button" class="rr-close" aria-label="Закрыть">×</button><div class="rr-dialog-body"></div></dialog><p class="rr-live rr-sr" role="status" aria-live="polite"></p></article>';
   mounted.set(index,mountRapperReport(panel.firstElementChild,model,{page:reports[index],round,participantId:state.participant,judgeId:state.judge,revealSelection:!preserve,allMembers:model.allMembers,onChoose:id=>{state.participant=id;updateURL();},onJudge:id=>{state.judge=id;updateURL();},onNavigate:(page,id,j)=>choose(page,{participant:id,judge:j})}));
  }
  if(write)updateURL();
 }
 for(const b of shell.querySelectorAll('[data-rapper-tab]')){b.onclick=()=>choose(+b.dataset.rapperTab,{participant:state.participant,preserve:true});b.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();choose(nextAvailableReport('rappers',+b.dataset.rapperTab,e.key),{participant:state.participant,focus:true,preserve:true});}};}
 const sync=()=>{if(Number(document.body.dataset.round)!==round||Number(new URLSearchParams(location.search).get('round')||1)!==round||!root.classList.contains('active')||!location.pathname.endsWith('/rappers/'))return;const params=new URLSearchParams(location.search),page=params.get('report')||params.get('tab');let index=reports.indexOf(page);if(index<0&&/^[012]$/.test(page))index=+page;if(index<0)index=0;const id=params.get('participant')||'';if(index!==state.tab||id!==state.participant||!mounted.size)choose(index,{participant:id,judge:params.get('judge')||'',write:false});};
 window.addEventListener('ib19:route',sync);
 if(round===1){onReportFallback('rappers',()=>choose(0,{participant:''}));window.addEventListener('tuz:research-fate',e=>{if(Number(document.body.dataset.round)!==1||!byId.has(e.detail?.id))return;choose(0,{participant:e.detail.id});});}
 const initial=new URLSearchParams(location.search),page=initial.get('report')||initial.get('tab');choose(reports.includes(page)?page:/^[012]$/.test(page)?Number(page):0,{participant:initial.get('participant')||'',judge:initial.get('judge')||'',write:false});
 return {state,choose,destroy(){selectionTicket++;for(const view of mounted.values())view.destroy();window.removeEventListener('ib19:route',sync);}};
}
