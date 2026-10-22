// Presentation only: use the existing model result, never recalculate the forecast.
export function paceStatus(m,originalDeadline,now=Date.now()){
 const status=m.remaining===0?'Успевают':!m.enough||!Number.isFinite(m.projected)?'Недостаточно данных':m.verdict==='Пока непонятно'?'Недостаточно данных':m.verdict==='Не успевают'?'Не успевают обхватывать':m.verdict;
 const original=typeof originalDeadline==='number'?originalDeadline:Date.parse(originalDeadline);
 // Owner-approved label for the active extended window; the exact forecast stays separate.
 const secondChance=m.remaining>0&&m.enough&&Number.isFinite(m.projected)&&Number.isFinite(original)&&original<m.deadline&&now<m.deadline&&m.projected>original;
 const day=t=>new Date(t).toLocaleDateString('ru-RU',{day:'numeric',month:'long',timeZone:'Europe/Moscow'});
 return {text:secondChance?'Успевают. Со второго раза.':status,tone:secondChance||m.remaining===0||status==='Успевают'?'positive':status==='Не успевают обхватывать'?'negative':'neutral',caption:secondChance?'Дедлайн продлён до '+day(m.deadline)+'. Первоначальный дедлайн — '+day(original):null};
}
