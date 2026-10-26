import {isFirstRoundActive} from './routes.js';
// Keep profile code, CSS and aggregation out of the overview's initial load.
export function installJudgeProfiles(D){
 const judgesPath=new URL('../judges/',import.meta.url).pathname;
 let ready,initialized=false;
 const activate=()=>{
  if(!isFirstRoundActive()||location.pathname!==judgesPath)return;
  const modules=ready ||= Promise.all([
   import('./judge-profile.js'),
   new Promise((resolve,reject)=>{const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('../css/judge-profile.css',import.meta.url);link.onload=resolve;link.onerror=()=>{link.remove();reject(Error('Profile styles unavailable'))};document.head.append(link);})
  ]);
  return modules.then(([module])=>{if(!initialized&&isFirstRoundActive()&&location.pathname===judgesPath){initialized=true;return module.initializeJudgeProfiles(D);}}).catch(()=>{ready=null;});
 };
 return activate;
}
