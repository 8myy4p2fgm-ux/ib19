import {mountDataMethodology,r2DataMethodology} from './data-methodology.js';
import {renderR2Submissions} from './r2-submissions-view.js';
const esc=v=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const informationDate=v=>v?new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',dateStyle:'short',timeStyle:'short'}).format(new Date(v))+' МСК':'—';
const descriptions={overview:'Состав участников и число сдавших треки не подтверждены.',dynamics:'Данных для графика пока недостаточно.',judges:'Рейтинг судей появится, когда будут доступны оценки второго раунда.','forum-link':'Список участников пока недоступен.',events:'История событий пока недоступна.'};
export function renderRoundInformation(root,info,type,{judge,firstRoundURL}={}){
 if(info.kind==='round-submissions')return renderR2Submissions(root,info,type,{judge,firstRoundURL});
 const row=(k,v)=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`;
 root.innerHTML=`<header class="ds-page-head"><div class="ds-kicker"><span>TUZ19 / РАУНД 02</span><span aria-hidden="true">|</span><strong>2-й отборочный</strong></div><h1>${esc(root.ownerDocument.getElementById('page-title').textContent)}</h1><p>${esc(descriptions[type]||descriptions.overview)}</p></header><article class="round-information"><h2>${esc(info.name)}</h2>${judge?`<p role="status">Профиль судьи второго раунда недоступен. <a href="${esc(firstRoundURL)}">Открыть профиль первого раунда</a>.</p>`:''}

 <dl>${row('Обязательных оценок',info.sourceParameters.judgesRequired)}${row('Верх шкалы оценки',info.sourceParameters.scoreScale)}${row('Максимальная сумма',info.sourceParameters.maxScore)}${row('Количество проходящих',info.sourceParameters.advanceCount)}${row('Длительность трека','90–120 секунд')}${row('Плановое начало судейства',informationDate(info.times.judgingStartsAt))}${row('Дедлайн сдачи',informationDate(info.times.deadline))}${row('Дедлайн судейства',informationDate(info.times.judgingDeadline))}${row('Фактическое начало раунда','— · не подтверждено')}${row('Фактическое начало судейства','— · не подтверждено')}${row('Участники / сдавшие / оценки','—')}${row('Официальный регламент и равенство баллов','— · не подтверждены')}</dl>

</article>`;
 mountDataMethodology(root,r2DataMethodology(info));
}
