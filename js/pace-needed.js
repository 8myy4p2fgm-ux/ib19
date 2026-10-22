import {DAY} from './config.js';
import {moscowDay} from './pace-model.js';

// Card presentation only. The forecast continues to use the exact deadline.
export function paceNeeded(m,now,fmt){
 if(m.remaining===0)return {label:'До дедлайна',value:'Завершено',caption:true,detail:'',help:'Все необходимые оценки выставлены.'};
 if(m.deadline!==null&&now>=m.deadline)return {label:'До дедлайна',value:'Дедлайн прошёл',caption:true,detail:'',help:'Судейство не завершено. Прогноз завершения показан ниже.'};
 const time=m.deadline===null?'':new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'Europe/Moscow'}).format(m.deadline)+' МСК';
 if(m.deadline!==null&&moscowDay(now)===moscowDay(m.deadline))return {label:'До дедлайна',value:'Сегодня',caption:false,detail:time,help:'Оставшиеся '+fmt(m.remaining,0)+' оценок нужно выставить сегодня до '+time+'.'};
 const daysLeft=m.deadline===null?null:(m.deadline-now)/DAY;
 const needRate=daysLeft>0?Math.ceil(m.remaining/daysLeft):null;
 const day=m.deadline===null?'':new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',timeZone:'Europe/Moscow'}).format(m.deadline);
 return {label:'Нужно в день',value:needRate===null?'—':fmt(needRate,0),caption:false,detail:'',help:needRate===null?'Нельзя рассчитать без актуального дедлайна.':'Осталось '+fmt(m.remaining,0)+' оценок на '+fmt(daysLeft,1)+' дня до дедлайна '+day+', '+time+'. Нужно в среднем '+fmt(needRate,0)+' оценок в день.'};
}
