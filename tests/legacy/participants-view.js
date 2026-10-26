import {config} from '../../js/config.js';
import {isTrul} from '../../js/forum-link-model.js';

export const participantLabels={pass:'Прошёл',fail:'Вылетел',pending:'Исход не определён'};

export function participantsSummary(model,{fmt,esc,updated}){
 const stats=model.forumStats;
 const metric=(n,label)=>`<div><strong>${fmt(n,0)}</strong><span>${label}</span></div>`;

 return `<header class="participants-heading"><div><h2>Участники Форума и ветераны</h2><p>Все наши участники: найти, посмотреть результат и открыть оценки.</p></div><button type="button" class="control" data-participants-method aria-haspopup="dialog" aria-controls="participants-method">Методология</button></header>
 <div class="participants-stats">${metric(stats.total,'Форум и ветераны')}${metric(stats.total-model.veterans.length,'Текущий Форум')}${metric(model.veterans.length,'Ветераны')}</div>
 <div class="participants-outcomes" aria-hidden="true">${[['passed','pass'],['pending','pending'],['failed','fail']].map(([key,tone])=>`<span class="${tone}" style="flex-grow:${stats[key]}"></span>`).join('')}</div>
 <p class="participants-legend"><span>Прошли <b>${stats.passed}</b></span><span>Ожидают <b>${stats.pending}</b></span><span>Вылетели <b>${stats.failed}</b></span></p>
 <p class="participants-snapshot">Сводка всей выборки; фильтры применяются к списку.</p>
 <div class="participants-access"><button type="button" class="control" data-participants-matrix>Матрица оценок ↓</button><span>Все оценки и комментарии — в существующей матрице ниже.</span></div>`;
}

export function participantRow(r,{esc,safeUrl}){
 return `<tr data-fl-row="${esc(r.id)}"><th scope="row" data-label="Участник"><a class="participant-name fl-profile-link" href="${esc(safeUrl(r.battleProfile)||('https://19ib.ru/artist/'+encodeURIComponent(r.id)))}" target="_blank" rel="noopener noreferrer" aria-label="Открыть страницу ${esc(r.name)} на 19ib.ru">${esc(r.name)}<span class="fl-external-mark" aria-hidden="true">↗</span></a>${isTrul(r)?' <span class="fl-ltb" title="Трул · ЛТБ">ЛТБ</span>':''}<button type="button" class="participants-details" data-fl-open="${esc(r.id)}" aria-label="Оценки и комментарии: ${esc(r.name)}" aria-haspopup="dialog" aria-controls="fl-participant-dialog">Оценки и комментарии</button></th><td data-label="Группа">${r.veteran?'Ветераны':'Форум'}</td><td data-label="Баллы" class="participants-total">${r.count?r.total:'—'}</td><td data-label="Оценено">${r.count} / ${config.scoresPerParticipant}</td><td data-label="Статус" class="fl-status fl-text-${r.status}">${participantLabels[r.status]}</td></tr>`;
}

export function participantsMethodology({updated,esc}){
 return `<h3>Кто входит в список</h3><p>Участники первого раунда из форумного списка. Это выборка Форума и Ветеранов, а не все участники баттла. Совпадение ника не добавляет человека в группу; архивные участники здесь не перечислены.</p>
 <h3>Форум и Ветераны</h3><p>Форум — OG, база, основа, фундамент. Ветераны — бывшие OG, которые больше не заходят на форум. Группы заданы справочником; интерфейс не определяет их по активности или похожим именам.</p>
 <h3>Оценки и статусы</h3><p>Баллы — сумма действительных оценок. «Оценено» показывает число полученных оценок из ${config.scoresPerParticipant}.</p><p>Порог прохода — ${config.passScore} баллов. Стандартный проход гарантирован, если сумма уже полученных баллов и минимально возможных оставшихся оценок достигает порога. Вылет гарантирован, если даже максимальные оставшиеся оценки (до ${config.maxScore} за каждую) не позволят его достичь. Иначе исход не определён. При полностью выставленных оценках сравнивается итоговая сумма с порогом.</p>
 <h3>Что означает «По Трулу»</h3><p>Это специальная форумная сортировка: участник с отдельным словом «трул», «trul» или «trool» в нике, батловом имени либо подтверждённом псевдониме показывается первым. Такие строки отмечены «ЛТБ». Это не балл и не аналитический индекс.</p>
 <h3>Поиск, фильтры и сортировки</h3><p>Поиск без учёта регистра проверяет форумный ник, батловое имя и подтверждённые псевдонимы. Поиск, группа и статус действуют одновременно. «По баллам» — от большей суммы к меньшей; равные суммы — по алфавиту. «По алфавиту» — по имени. «По Трулу» сначала выделяет Трула, далее использует баллы и алфавит. Сброс очищает поиск, возвращает все группы и статусы и сортировку по баллам.</p><p>Сводные показатели относятся ко всей выборке. Поиск, группа и статус также фильтруют строки матрицы ниже; её сортировки сохраняются отдельно. Ник со стрелкой открывает внешний профиль; кнопка «Оценки и комментарии» — карточку участника здесь.</p>
 `;
}

// A native dialog local to Participants. INT-04's factory owns fixed IDs and is
// deliberately not generalized here; ranking/profile dialogs stay unchanged.
export function mountParticipantsMethodology(root,options){
 const dialog=document.createElement('dialog');
 dialog.id='participants-method';dialog.className='participants-method';dialog.setAttribute('aria-labelledby','participants-method-title');
 dialog.innerHTML='<header><h2 id="participants-method-title">Методология списка участников</h2><button type="button" aria-label="Закрыть методологию">×</button></header><div class="participants-method-body" tabindex="0" role="region" aria-label="Текст методологии">'+participantsMethodology(options)+'</div>';
 document.body.append(dialog);
 const trigger=root.querySelector('[data-participants-method]'),close=dialog.querySelector('button');
 let saved=null,downOutside=false;
 const outside=e=>{const r=dialog.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;};
 const restore=()=>{
  if(!saved)return;
  document.documentElement.style.overflow=saved.html;document.body.style.overflow=saved.body;saved=null;
  if(trigger.getClientRects().length)trigger.focus({preventScroll:true});
 };
 const finish=()=>{if(dialog.open){dialog.close();restore();}};
 trigger.onclick=()=>{
  if(dialog.open)return;
  saved={html:document.documentElement.style.overflow,body:document.body.style.overflow};
  dialog.showModal();document.documentElement.style.overflow='hidden';document.body.style.overflow='hidden';
  dialog.querySelector('.participants-method-body').scrollTop=0;close.focus();
 };
 close.onclick=finish;
 dialog.addEventListener('cancel',e=>{e.preventDefault();finish();});
 dialog.addEventListener('pointerdown',e=>{downOutside=e.target===dialog&&outside(e);});
 dialog.addEventListener('click',e=>{if(downOutside&&e.target===dialog&&outside(e))finish();downOutside=false;});
 dialog.addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();(document.activeElement===close?dialog.querySelector('.participants-method-body'):close).focus();}if(e.key==='Escape'){e.preventDefault();finish();}});
 dialog.addEventListener('close',()=>{if(!dialog.open)restore();});
 window.addEventListener('ib19:route',finish);
}
