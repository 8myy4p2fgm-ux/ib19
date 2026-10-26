import {isFirstRoundActive} from './routes.js';
// Keep ranking/profile aggregation and styles out of other pages' initial load.
export function installJudgeRanking(context,data){
 const judgesPath=new URL('../judges/',import.meta.url).pathname;
 let ready,initialized=false;
 const activate=()=>{
  if(!isFirstRoundActive()||location.pathname!==judgesPath)return;
  const modules=ready ||= Promise.all([
   import('./judge-ranking.js'),
   Promise.all(['judge-ranking.css','judge-research.css'].map(file=>new Promise((resolve,reject)=>{
    const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('../css/'+file,import.meta.url);
    link.onload=resolve;link.onerror=()=>{link.remove();reject(new Error('Не удалось загрузить стили рейтинга'));};document.head.append(link);
   })))
  ]);
  return modules.then(([module])=>{if(!initialized&&isFirstRoundActive()&&location.pathname===judgesPath){initialized=true;module.initializeJudgeRanking(context,data);}}).catch(error=>{
   ready=null;console.error(error);
  });
 };
 return activate;
}
