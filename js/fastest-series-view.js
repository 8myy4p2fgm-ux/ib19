import {stopwatchSvg} from './fastest-stopwatch.js';
import {formatFastestInterval} from './fastest-series.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Keep the accepted editorial exceptions separate from calculated rankings.
const noMarathon=new Set(['0965e5cc-ff25-4aef-85fa-b0fafef7decc','6c0fc11a-b532-4108-8aa7-b73e121892dc']);
const profileURL=row=>{const url=new URL('../judges/',import.meta.url);url.searchParams.set('judge',row.judgeId);url.searchParams.set('round','1');return esc(url.pathname+url.search);};
const duration=row=>esc(formatFastestInterval(row.intervalMs).replace(/(\d) (мин|сек\.)/g,'$1\u00a0$2'));
export function renderFastestSeries(panel,rows){
 const eligible=rows.filter(r=>!noMarathon.has(r.judgeId)),excluded=rows.filter(r=>noMarathon.has(r.judgeId));
 // sprint-story remains the mount marker used by the caller; no time-axis layout.
 panel.innerHTML=`<section class="sprint-story speedsters-report" aria-labelledby="fastest-title">
 <header class="fastest-heading"><div><h2 id="fastest-title">Скорострелы</h2><p>Для каждого судьи нашли самую быструю серию из 30 треков подряд и посчитали среднее время между оценками.<br>А рэп-то вы слушаете?</p></div></header>
 ${eligible.length?`<div class="speedsters-surface">${stopwatchSvg}<table class="speedsters-table" aria-label="Рейтинг по самой быстрой серии из 30 оценок"><thead><tr><th scope="col">№</th><th scope="col">Судья</th><th scope="col">Средний интервал</th></tr></thead><tbody>${eligible.map((r,i)=>`<tr data-speedsters-judge="${esc(r.judgeId)}" data-interval-ms="${r.intervalMs}"><td>${String(i+1).padStart(2,'0')}</td><th scope="row"><a class="speedsters-name" href="${profileURL(r)}" data-fastest-judge="${esc(r.judgeId)}">${esc(r.judgeName)}</a></th><td><strong>${duration(r)}</strong></td></tr>`).join('')}</tbody></table></div>`:'<p class="fastest-empty" role="status">Пока недостаточно оценок: нужна серия из 30 оценок одного судьи.</p>'}
 ${excluded.length?`<p class="speedsters-excluded">${excluded.map(r=>`<a href="${profileURL(r)}" data-fastest-judge="${esc(r.judgeId)}">${esc(r.judgeName)}</a>`).join(' и ')} — в таких марафонах не участвовали.</p>`:''}
 </section>`;
 return {draw(){},destroy(){}};
}
