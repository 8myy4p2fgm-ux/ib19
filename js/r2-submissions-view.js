import {renderR2ReportShell} from './r2-report-shell.js';
import {renderR2Rappers} from './rapper-r2.js';
import {mountDataMethodology,r2DataMethodology} from './data-methodology.js';
import {renderR2Home} from './r2-home.js';
import {selectR2Submissions} from './r2-submissions.js';
const esc=v=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=v=>v?new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',dateStyle:'short',timeStyle:'medium'}).format(new Date(v))+' МСК':'Не указано';
export function renderR2Submissions(root,info,type,{judge,firstRoundURL}={}){
 const doc=root.ownerDocument;
 root.dataset.r2Snapshot=info.snapshotId;
 if(type==='overview')return renderR2Home(root,info);
 if(type==='forum-link')return renderR2Rappers(root,info);
 if(type==='judges'||type==='dynamics')return renderR2ReportShell(root,info,type,{judge,firstRoundURL});
 const submissionsURL=doc.querySelector('.nav[data-tab="forum-link"]').href;
 const heading=type==='overview'?'Второй отборочный':doc.getElementById('page-title').textContent;
 const row=(label,value)=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
 const table=(rows)=>rows.length?`<div class="r2-submission-list">${rows.map(e=>`<article class="r2-submission" data-r2-user="${esc(e.userId)}"><h3>${esc(e.name)}</h3><dl>${row('Сдано',date(e.submittedAt))}${row('Длительность',e.durationSec===null?'Не указана':e.durationSec+' сек')}${row('Текст',e.hasLyrics===null?'Неизвестно':e.hasLyrics?'Есть':'Нет')}</dl></article>`).join('')}</div>`:'<p class="r2-empty" role="status">Подтверждённые сдачи не найдены.</p>';
 const judging=`<p>${info.times.judgingStartedAt?'Судейство началось '+esc(date(info.times.judgingStartedAt))+'. ':''}${info.entries.every(e=>e.scoredCount===0)&&info.entries.length?'В доступных данных оценок пока нет.':'Судейская аналитика второго раунда пока недоступна.'}</p>`;
 const deadlines=[['Дедлайн сдачи',info.times.deadline],['Дедлайн судейства',info.times.judgingDeadline]].filter(([,v])=>v).sort((a,b)=>Date.parse(a[1])-Date.parse(b[1]));const upcoming=deadlines.find(([,v])=>Date.parse(v)>=Date.now())||deadlines.at(-1);
 let content='';
 if(type==='forum-link')content=`<h2>Подтверждённые сдачи</h2><div class="r2-submission-controls"><label>Поиск по имени<input type="search" class="control" id="r2-search" autocomplete="off" placeholder="Имя участника"></label><label>Время сдачи<select class="control" id="r2-order"><option value="asc">Сначала ранние</option><option value="desc">Сначала поздние</option></select></label></div><p id="r2-results" role="status"></p><div id="r2-list">${table(info.submissions)}</div>`;
 else if(type==='dynamics')content=`<h2>Сдача треков</h2><p>Подтверждённых сдач: <strong>${info.confirmedSubmissionCount}</strong>.</p><dl>${row('Первая подтверждённая сдача',date(info.submissions[0]?.submittedAt))}${row('Последняя подтверждённая сдача',date(info.submissions.at(-1)?.submittedAt))}${row('Дедлайн сдачи',date(info.times.deadline))}${row('Плановое начало судейства',date(info.times.judgingStartsAt))}${row('Дедлайн судейства',date(info.times.judgingDeadline))}</dl>${judging}<h3>Последние подтверждённые события сдачи</h3>${table([...info.submissions].reverse().slice(0,10))}`;
 else if(type==='judges')content=`<h2>Судьи второго раунда</h2>${judge?`<p role="status">Профиль судьи второго раунда недоступен. <a href="${esc(firstRoundURL)}">Открыть профиль первого раунда</a>.</p>`:''}<p>Для трека — 7 оценок по шкале до 10, максимум 70 баллов. Состав судей пока неизвестен. Рейтинг и профили второго раунда недоступны.</p>${judging}`;
 else if(type==='events')content=`<h2>Подтверждённые события сдачи</h2>${table([...info.submissions].reverse())}<p>История пересдач и удалений недоступна. Это текущие записи, а не полный журнал событий.</p>`;
 else content=`<h2>${esc(info.name)}</h2><div class="r2-submission-kpi"><span>Подтверждённых сдач</span><strong>${info.confirmedSubmissionCount}</strong></div>${upcoming?`<p>${esc(upcoming[0])}: <strong>${esc(date(upcoming[1]))}</strong>.</p>`:'<p>Подтверждённые сроки не указаны.</p>'}<p><a class="r2-submission-link" href="${esc(submissionsURL)}">К списку сдавших →</a></p>${judging}`;
 root.innerHTML=`<header class="ds-page-head"><div class="ds-kicker"><span>TUZ19 / РАУНД 02</span><span aria-hidden="true">|</span><strong>${esc(info.topic)}</strong></div><h1>${esc(heading)}</h1><p>Сдачи и участники второго отбора.</p></header><article class="round-information r2-submissions">${content}${type==='judges'?'':'<p>Полный состав и число ожидающих неизвестны.</p>'}</article>`;
 mountDataMethodology(root,r2DataMethodology(info));
 if(type==='forum-link'){
  const search=root.querySelector('#r2-search'),order=root.querySelector('#r2-order');const draw=()=>{const rows=selectR2Submissions(info.entries,{query:search.value,order:order.value});root.querySelector('#r2-list').innerHTML=table(rows);root.querySelector('#r2-results').textContent=`Показано ${rows.length} из ${info.confirmedSubmissionCount} подтверждённых сдач`;};search.addEventListener('input',draw);order.addEventListener('change',draw);draw();
 }
}
