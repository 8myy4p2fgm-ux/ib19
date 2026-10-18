
(()=>{
const dialog=document.getElementById('method-dialog');
const texts={
 general:`<p><b>ТУЗ показывает, насколько судейство благоприятно для форумщиков по сравнению с остальными участниками.</b> Положительный индекс — форумщикам в целом везёт больше; отрицательный — меньше. Ноль означает, что заметного преимущества по совокупности показателей нет.</p>
 <p>Индекс складывается из трёх частей:</p>
 <div class="tuz-explain-item"><b>Благосклонность · до ±60 баллов</b><p>Сравниваем среднюю оценку форумщиков со средней оценкой остальных. Если форумщикам ставят выше, ТУЗ растёт. Если ниже — падает. Это самая весомая часть индекса.</p></div>
 <div class="tuz-explain-item"><b>Внимание · до ±25 баллов</b><p>Смотрим, кого судьи оценивают раньше: форумщиков или остальных. Сравнение ведётся внутри каждого судьи, чтобы не путать скорость работы разных судей. Более раннее судейство форумщиков добавляет баллы.</p></div>
 <div class="tuz-explain-item"><b>Уважение · до ±15 баллов</b><p>Смотрим на оценки форумщиков сами по себе. Пятёрки и четвёрки повышают индекс, тройки нейтральны, двойки и единицы понижают.</p></div>
`,
 personal:`<p>Личный ТУЗ оценивает отношение каждого судьи к двум группам: Форуму и Ветеранам. Переключатель над таблицей позволяет посмотреть результаты отдельно для каждой группы. В обоих случаях сравниваем её с остальными участниками батла.</p>
<div class="tuz-explain-item"><b>Благосклонность · до ±60 баллов</b><p>Сравниваем среднюю оценку выбранной группы со средней оценкой остальных у этого судьи. Выше — плюс к ТУЗу, ниже — минус.</p></div>
<div class="tuz-explain-item"><b>Внимание · до ±25 баллов</b><p>Смотрим, насколько раньше или позже судья оценивает выбранную группу относительно остальных. Ранние оценки увеличивают показатель.</p></div>
<div class="tuz-explain-item"><b>Уважение · до ±15 баллов</b><p>Учитываем сами оценки выбранной группе: пятёрки и четвёрки повышают показатель, тройки нейтральны, единицы и двойки снижают.</p></div>
<div class="tuz-explain-item"><b>Активность</b><p>Сумма трёх критериев умножается на коэффициент активности. Чем меньше участников группы судья успел оценить, тем меньше вес результата.</p></div>

<p>Если судья ещё не оценил участников обеих сравниваемых групп, личный индекс не рассчитывается.</p>`};
document.addEventListener('click',e=>{const trigger=e.target.closest('[data-method]');if(!trigger)return;document.getElementById('method-dialog-title').textContent=trigger.dataset.method==='personal'?'Как считается личный ТУЗ':'Как считается ТУЗ';document.getElementById('method-dialog-body').innerHTML=texts[trigger.dataset.method]||texts.general;dialog.showModal()});
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
 dialog.showModal();
});
dialog.querySelector('.method-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});


 function refreshDeadlineCountdown(){
  const holder=document.getElementById('deadline-countdown');
  const output=document.getElementById('deadline-countdown-value');
  if(!holder||!output)return;
  // The deadline is site-wide metadata, visible on every page.
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
