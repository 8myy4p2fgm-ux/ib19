import {mountRapperReport} from './rapper-report-view.js';
const reports=['participants','matrix'];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountRapperResearch({root,model,round=1}){
 const state={tab:0,participant:'',judge:''},mounted=new Map(),shell=document.createElement('section');shell.className='rapper-research rr-shell';
 shell.innerHTML=`<header class="rpt-page-head"><p class="bp-kicker">TUZ19 / РАУНД 0${round} <span aria-hidden="true">|</span><span class="rpt-theme">${esc(model.topic)}</span></p><h1>Реперы</h1><p class="rpt-page-intro">Наши на баттле: результаты, оценки и комментарии.</p></header><div class="rr-mode-link e6-detail-links"><a data-report-link></a></div>${reports.map((name,i)=>`<section class="rr-panel" id="rr-panel-${round}-${i}" aria-label="${i?'Матрица оценок':'Участники'}" ${i?'hidden':''}></section>`).join('')}`;
 root.replaceChildren(shell);
 const byId=new Map((model.allMembers||model.members).map(p=>[p.id,p]));
 function href(page,id=state.participant,judge=''){
  const url=new URL('../rappers/',import.meta.url);url.searchParams.set('round',round);if(page==='matrix')url.searchParams.set('report','matrix');if(byId.has(id))url.searchParams.set('participant',id);if(page==='matrix'&&judge)url.searchParams.set('judge',judge);return url;
 }
 function updateLink(){const a=shell.querySelector('.rr-mode-link a');a.href=href(state.tab?'participants':'matrix');a.textContent=state.tab?'← К участникам':'Матрица оценок →';}
 function updateURL(){if(!root.classList.contains('active')||!location.pathname.endsWith('/rappers/'))return;history.replaceState(history.state,'',href(reports[state.tab],state.participant,state.judge));updateLink();}
 function navigate(page,id,judge=''){history.pushState(null,'',href(page,id,judge));window.dispatchEvent(new PopStateEvent('popstate'));}
 function choose(index,{participant,judge='',write=false}={}){
  index=reports.includes(index)?reports.indexOf(index):Number(index);if(!reports[index])index=0;
  const next=byId.has(participant)?participant:'',changed=state.participant!==next;state.tab=index;state.participant=next;state.judge=judge;
  shell.querySelectorAll('.rr-panel').forEach((p,i)=>p.hidden=i!==index);
  const panel=shell.querySelector('#rr-panel-'+round+'-'+index);
  if(mounted.has(index)&&(changed||panel.firstElementChild?.dataset.participant!==next)){mounted.get(index).destroy();mounted.delete(index);panel.replaceChildren();}
  if(!mounted.has(index)){
   panel.innerHTML='<article class="rr rr-report"><div class="rr-content"></div><dialog class="rr-dialog" aria-label="Участник или оценка"><button type="button" class="rr-close" aria-label="Закрыть">×</button><div class="rr-dialog-body"></div></dialog><p class="rr-live rr-sr" role="status" aria-live="polite"></p></article>';
   mounted.set(index,mountRapperReport(panel.firstElementChild,model,{page:reports[index],round,participantId:next,judgeId:judge,revealSelection:true,allMembers:model.allMembers,onChoose:id=>{state.participant=id;updateURL();},onJudge:id=>{state.judge=id;updateURL();},onNavigate:navigate}));
  }
  updateLink();if(write)updateURL();
 }
 const sync=()=>{if(Number(document.body.dataset.round)!==round||Number(new URLSearchParams(location.search).get('round')||1)!==round||!root.classList.contains('active')||!location.pathname.endsWith('/rappers/'))return;const params=new URLSearchParams(location.search);choose(params.get('report')==='matrix'||params.get('tab')==='1'?1:0,{participant:params.get('participant')||'',judge:params.get('judge')||''});};
 window.addEventListener('ib19:route',sync);
 const fate=e=>{if(Number(document.body.dataset.round)===1&&byId.has(e.detail?.id))navigate('participants',e.detail.id);};
 if(round===1)window.addEventListener('tuz:research-fate',fate);
 const initial=new URLSearchParams(location.search);choose(initial.get('report')==='matrix'||initial.get('tab')==='1'?1:0,{participant:initial.get('participant')||'',judge:initial.get('judge')||''});
 return {state,choose,destroy(){for(const view of mounted.values())view.destroy();window.removeEventListener('ib19:route',sync);window.removeEventListener('tuz:research-fate',fate);}};
}
