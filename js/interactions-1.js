
(()=>{
const dialog=document.getElementById('method-dialog');
let methodOrigin,methodOverflow,methodOutside=false;
function openMethod(origin){
 if(dialog.open)return;
 methodOrigin=origin;methodOverflow={html:document.documentElement.style.overflow,body:document.body.style.overflow};
 dialog.showModal();document.documentElement.style.overflow='hidden';document.body.style.overflow='hidden';dialog.querySelector('.method-close').focus({preventScroll:true});
}
dialog.addEventListener('close',()=>{if(methodOverflow){document.documentElement.style.overflow=methodOverflow.html;document.body.style.overflow=methodOverflow.body;methodOverflow=null;}if(methodOrigin?.isConnected&&methodOrigin.getClientRects().length)methodOrigin.focus({preventScroll:true});});
dialog.addEventListener('keydown',e=>{
 if(e.key!=='Tab')return;
 const targets=[...dialog.querySelectorAll('button,a[href],[tabindex="0"]')].filter(el=>!el.disabled&&el.getClientRects().length);
 const first=targets[0],last=targets.at(-1);
 if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
});
const outsideMethod=e=>{const r=dialog.getBoundingClientRect();return e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom);};
dialog.addEventListener('pointerdown',e=>{methodOutside=outsideMethod(e);});

const texts={
 general:`<p>Индекс ТУЗа показывает, как судьи относятся к форумным участникам и ветеранам баттла. Для каждой группы он рассчитывается отдельно.</p>
 <p>Мы смотрим на три вещи:</p>
 <p class="method-component"><strong>Благосклонность</strong> — насколько высокие оценки получает группа по сравнению с остальными участниками.</p>
 <p class="method-component"><strong>Внимание</strong> — насколько раньше судьи оценивают участников группы относительно остальных.</p>
 <p class="method-component"><strong>Уважение</strong> — какие оценки получает сама группа: высокие повышают показатель, низкие понижают, средние нейтральны.</p>
 <p>Из этих показателей складывается общий индекс. Чем он выше, тем благоприятнее отношение судей к группе в рамках этой методики.</p>
 `,
 personal:`<p>Личный ТУЗ оценивает отношение каждого судьи к двум группам: Форуму и Ветеранам. Переключатель над таблицей позволяет посмотреть результаты отдельно для каждой группы. В обоих случаях сравниваем её с остальными участниками батла.</p>
<div class="tuz-explain-item method-component"><b>Благосклонность · до ±60 баллов</b><p>Сравниваем среднюю оценку выбранной группы со средней оценкой остальных у этого судьи. Выше — плюс к ТУЗу, ниже — минус.</p></div>
<div class="tuz-explain-item method-component"><b>Внимание · до ±25 баллов</b><p>Смотрим, насколько раньше или позже судья оценивает выбранную группу относительно остальных. Ранние оценки увеличивают показатель.</p></div>
<div class="tuz-explain-item method-component"><b>Уважение · до ±15 баллов</b><p>Учитываем сами оценки выбранной группе: пятёрки и четвёрки повышают показатель, тройки нейтральны, единицы и двойки снижают.</p></div>
<div class="tuz-explain-item"><b>Активность</b><p>Сумма трёх критериев умножается на коэффициент активности. Чем меньше участников группы судья успел оценить, тем меньше вес результата.</p></div>

<p>Если судья ещё не оценил участников обеих сравниваемых групп, личный индекс не рассчитывается.</p>`};
document.addEventListener('click',e=>{const trigger=e.target.closest('[data-method]');if(!trigger)return;document.getElementById('method-dialog-title').textContent=trigger.dataset.method==='personal'?'Как считается личный ТУЗ':'Как считается ТУЗ';document.getElementById('method-dialog-body').innerHTML=(texts[trigger.dataset.method]||texts.general);openMethod(trigger)});
// Convert expandable methodology notes to compact dialogs without moving the page.
document.addEventListener('click',e=>{
 const summary=e.target.closest('#dynamics .pace-method summary, #judges .judge-index-method summary, #home .home-tuz-method summary');
 if(!summary)return;
 e.preventDefault();
 const details=summary.closest('details');
 if(!details)return;
 details.open=false;
 const body=details.querySelector(':scope > div');
 const parts=body ? body.innerHTML : [...details.children].filter(x=>x!==summary).map(x=>x.outerHTML).join('');
 document.getElementById('method-dialog-title').textContent=summary.textContent.trim()||'Как считается';
 document.getElementById('method-dialog-body').innerHTML=parts || '<p>Описание пока отсутствует.</p>';
 openMethod(summary);
});
dialog.querySelector('.method-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',e=>{if(methodOutside&&outsideMethod(e))dialog.close();methodOutside=false;});


 function refreshDeadlineCountdown(){
  const holder=document.getElementById('deadline-countdown');
  const output=document.getElementById('deadline-countdown-value');
  if(!holder||!output)return;
  if(window.ib19IsR1&&!window.ib19IsR1()){holder.hidden=true;holder.setAttribute('aria-hidden','true');return;}
  // R1 deadline must not appear under another round or the global forum page.
  holder.hidden=false;
  holder.setAttribute('aria-hidden','false');
  const raw=holder.dataset.deadline || '2026-10-22T23:59:00+03:00';
  const deadlineMs=raw?Date.parse(raw):NaN;
  if(!Number.isFinite(deadlineMs)){output.textContent='Дата не задана';return;}
  const remaining=deadlineMs-Date.now();
  if(remaining<=0){output.textContent='Дедлайн прошёл';return;}
  const diff=Math.floor(remaining/1000);
  const days=Math.floor(diff/86400),hours=Math.floor(diff%86400/3600),minutes=Math.floor(diff%3600/60);
  output.textContent=`${days}д ${hours}ч ${minutes}м`;
 }
 window.addEventListener('ib19:route',refreshDeadlineCountdown);
 window.addEventListener('deadline-data-ready',refreshDeadlineCountdown);
 // Recheck after data loads and when navigation changes active sections.
 setInterval(refreshDeadlineCountdown,1000);
 document.addEventListener('DOMContentLoaded',refreshDeadlineCountdown);
 window.addEventListener('load',refreshDeadlineCountdown);
 refreshDeadlineCountdown();

})();
