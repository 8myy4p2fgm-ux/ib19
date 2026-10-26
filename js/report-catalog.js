// Public report IDs are stable URL state; renderer indices remain section-local.
export const reportCatalog=Object.freeze({
 dynamics:Object.freeze([
  {id:'outcomes',index:0,label:'Итоги отбора',caption:'Кто прошёл отбор'},
  {id:'chronicle',index:1,label:'Хроника сугейства',caption:'Как судили день за днём'},
  {id:'hours',index:2,label:'Судейские сутки',caption:'В какие часы ставили оценки'},
  {id:'distribution',index:3,label:'Распределение баллов',caption:'От пятёрок до двадцати пяти'}]),
 judges:Object.freeze([
  {id:'ranking',index:0,label:'Рейтинг',caption:'Кто выше по системе ТУЗ'},
  {id:'tinder',index:2,label:'Судейский Tinder',caption:'Кто судит в унисон'},
  {id:'dissidents',index:3,label:'Диссиденты',caption:'Кто расходится с коллегами'},
  {id:'speedsters',index:4,label:'Скорострелы',caption:'Самые быстрые судейские серии'},
  {id:'verdict',index:5,label:'Палачи и спасатели',caption:'Оценки, решившие судьбу трека'}]),
 rappers:Object.freeze([
  {id:'participants',index:0,label:'Участники',caption:'Наши на баттле'},
  {id:'matrix',index:1,label:'Матрица оценок',caption:'Каждая оценка и комментарий'}])
});
const paths={dynamics:'dynamics/',judges:'judges/',rappers:'rappers/'};
export function requestedReport(kind,params=new URLSearchParams()){
 const value=params.get('report')??params.get('tab');return reportCatalog[kind]?.find(r=>r.id===value||String(r.index)===value)??reportCatalog[kind]?.[0];
}
export function reportURL(kind,id,round=1){const url=new URL(paths[kind],new URL('../',import.meta.url));url.searchParams.set('round',String(round));if(kind!=='rappers'||id==='matrix')url.searchParams.set('report',id);return url.pathname+url.search;}
export function writeReportURL(kind,index){
 const report=reportCatalog[kind]?.find(r=>r.index===index);if(!report)return;
 const expected=new URL(paths[kind],new URL('../',import.meta.url)).pathname;if(location.pathname!==expected)return;
 const url=new URL(location.href);url.searchParams.set('report',report.id);url.searchParams.delete('tab');history.replaceState(history.state,'',url);
}
export function bindReportURL(kind,root,select,round=1){
 const sync=()=>{if(!root.classList.contains('active')||location.pathname!==new URL(paths[kind],new URL('../',import.meta.url)).pathname||Number(new URLSearchParams(location.search).get('round')||1)!==round)return;select(requestedReport(kind,new URLSearchParams(location.search)).index,false,false);};
 window.addEventListener('ib19:route',sync);return ()=>window.removeEventListener('ib19:route',sync);
}
