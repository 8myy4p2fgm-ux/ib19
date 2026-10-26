import {renderVerdictIllustrations,verdictExpression} from './verdict-illustrations.js';
// Presentation only: the existing research model owns every decisive event.
export function mountVerdictReport(panel,source,{selectedJudge='',onJudge=()=>{}}={}){
 const passShare=j=>j.n>0?j.pass/j.n:-1;
 const judges=[...source.executionCounts].sort((a,b)=>passShare(b)-passShare(a)||b.n-a.n||a.name.localeCompare(b.name,'ru'));
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=n=>n.toLocaleString('ru-RU'),pct=n=>n.toLocaleString('ru-RU',{maximumFractionDigits:1});
 panel.innerHTML=`<div class="jr-title"><h2>Палачи и спасатели</h2><p>Кто поставил оценку, после которой исход стал неизбежным?</p></div><div class="verdict-report"><section class="hero" aria-label="Выбранный судья"><header class="selected-heading"><h3></h3><p class="total-count"></p></header><div class="composition"><div class="stat pass"><strong></strong><span>проходов</span><b></b></div><div class="art" aria-hidden="true"><i class="glow green"></i><i class="glow neutral"></i><i class="glow red"></i><div class="portraits"></div></div><div class="stat fail"><strong></strong><span>вылетов</span><b></b></div></div><div class="balance" aria-hidden="true"><i></i></div><footer><button type="button" data-step="-1" aria-label="Предыдущий судья">← Предыдущий</button><span class="position" role="status"></span><button type="button" data-step="1" aria-label="Следующий судья">Следующий →</button></footer></section><section class="ranking" aria-labelledby="verdict-ranking-title"><div class="section-heading"><h3 id="verdict-ranking-title">Судьи решающего момента</h3><span>По доле проходов · по убыванию</span></div><div class="rank-key" aria-hidden="true"><span>№</span><span>Судья</span><span>Проходы</span><span>Вылеты</span><span>Соотношение</span></div><div class="judge-list" aria-label="Рейтинг судей"></div></section></div>`;
 const root=panel.querySelector('.verdict-report'),$=s=>root.querySelector(s);
 if(!judges.length){root.textContent='Нет решающих оценок';return;}
 let index=Math.max(0,judges.findIndex(j=>j.key===selectedJudge));
 $('.judge-list').innerHTML=judges.map((j,i)=>`<button type="button" class="judge-row" data-judge="${i}" data-execution="${esc(j.key)}" aria-pressed="false" aria-label="${esc(j.name)}: ${j.pass} проходов, ${j.fail} вылетов"><span class="place">${i+1}</span><span class="judge-name">${esc(j.name)}</span><span class="pass">${fmt(j.pass)}</span><span class="fail">${fmt(j.fail)}</span><span class="balance" aria-hidden="true"><i style="width:${j.n?j.pass/j.n*100:0}%"></i></span></button>`).join('');
 function show(){const j=judges[index],level=verdictExpression(j,judges),art=renderVerdictIllustrations(level);$('.hero').dataset.state=level;$('.selected-heading h3').textContent=j.name;$('.total-count').textContent=fmt(j.n)+' решающих оценок';
 for(const key of ['pass','fail']){$('.stat.'+key+' strong').textContent=fmt(j[key]);$('.stat.'+key+' b').textContent=pct(j.n?j[key]/j.n*100:0)+'%';}
 // Keep glow nodes mounted so opacity crossfades between existing states.
 $('.portraits').innerHTML=level<2?art.fail:level>2?art.pass:art.pass+art.fail;
 $('.hero>.balance i').style.width=(j.n?j.pass/j.n*100:0)+'%';$('.position').textContent=(index+1)+' / '+judges.length;
 root.querySelectorAll('[data-judge]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.judge===index)));
 root.querySelectorAll('[data-step]').forEach(b=>b.disabled=judges.length<2);
 }
 root.addEventListener('click',e=>{const row=e.target.closest('[data-judge]'),step=e.target.closest('[data-step]');if(!row&&!step)return;index=row?+row.dataset.judge:(index+Number(step.dataset.step)+judges.length)%judges.length;show();onJudge(judges[index].key);if(row)$('.hero').scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});
 show();
}
