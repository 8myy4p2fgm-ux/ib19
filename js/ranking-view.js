import {formatRankingNumber} from './judge-ranking-model.js';
export const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const number=formatRankingNumber;
export const count=value=>number(value,{signed:false,integer:true});
export function date(value){return Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value))+' МСК':'Время неизвестно';}
export function metric(value,options){return `<span title="${Number.isFinite(value)?value:'Нет данных для расчёта'}">${number(value,options)}</span>`;}
