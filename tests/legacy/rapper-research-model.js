import {selectForumRows} from '../../js/forum-link-model.js';
// Selection only. Counts, totals, membership and outcomes come from buildForumLink.
export function edgeSelection(rows,{group='all',score=15,pending=false}={}){
 if(!['all','current'].includes(group)||![13,14,15,16,17].includes(Number(score)))throw new Error('Invalid edge selection');
 const candidates=rows.filter(row=>group==='all'||row.forum&&!row.veteran),complete=candidates.filter(row=>row.count===5),waiting=candidates.filter(row=>row.count<5&&row.status==='pending');
 return {candidates:candidates.length,complete:complete.length,pending:waiting.length,bins:[13,14,15,16,17].map(value=>({value,count:complete.filter(row=>row.total===value).length})),rows:selectForumRows(pending?waiting:complete.filter(row=>row.total===Number(score)),{sort:'score'})};
}
export function searchRapperRows(rows,query){const q=query.trim().toLocaleLowerCase('ru-RU'),names=selectForumRows(rows,{query,sort:'alpha'}),ids=new Set(names.map(row=>row.id));for(const row of rows)if(row.id.toLocaleLowerCase('ru-RU').includes(q))ids.add(row.id);return selectForumRows(rows.filter(row=>ids.has(row.id)),{sort:'alpha'});}
