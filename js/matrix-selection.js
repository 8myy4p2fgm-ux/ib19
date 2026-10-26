import {selectForumRows} from './forum-link-model.js';
export function selectMatrixRows(rows,state){
  const list=selectForumRows(rows,{...state,sort:state.matrixSort.startsWith('alpha')?'alpha':'score'});
  if(state.judgeSort)list.sort((a,b)=>{const av=a.scores.find(s=>s.judgeName===state.judgeSort)?.score,bv=b.scores.find(s=>s.judgeName===state.judgeSort)?.score;
   if(Number.isInteger(av)!==Number.isInteger(bv))return Number.isInteger(av)?-1:1;
   if(Number.isInteger(av)&&av!==bv)return state.judgeDirection==='desc'?bv-av:av-bv;
   return a.name.localeCompare(b.name,'ru')||a.id.localeCompare(b.id);});
  else if(state.matrixSort==='alpha-desc')list.reverse();
  else if(state.matrixSort==='status')list.sort((a,b)=>({pass:0,pending:1,fail:2}[a.status]-{pass:0,pending:1,fail:2}[b.status])||a.name.localeCompare(b.name,'ru'));
  return list;
 }

