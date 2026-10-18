// Presentation only: use the existing model result, never recalculate the forecast.
export function paceStatus(m,originalDeadline){
 const status=m.remaining===0?'Успевают':!m.enough||!Number.isFinite(m.projected)?'Недостаточно данных':m.verdict==='Пока непонятно'?'Недостаточно данных':m.verdict==='Не успевают'?'Не успевают обхватывать':m.verdict;
 const original=typeof originalDeadline==='number'?originalDeadline:Date.parse(originalDeadline);
 const secondChance=m.remaining>0&&status==='Успевают'&&Number.isFinite(original)&&m.projected>original&&m.projected<=m.deadline;
 const day=t=>new Date(t).toLocaleDateString('ru-RU',{day:'numeric',month:'long',timeZone:'Europe/Moscow'});
 return {text:secondChance?'Успевают. Со второго раза.':status,tone:m.remaining===0||status==='Успевают'?'positive':status==='Не успевают обхватывать'?'negative':'neutral',caption:secondChance?'По текущему темпу судейство завершится до '+day(m.deadline)+'. Первоначальный дедлайн — '+day(original):null};
}
