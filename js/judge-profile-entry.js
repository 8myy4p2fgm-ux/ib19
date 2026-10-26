import {isFirstRoundActive} from './routes.js';
// One lazy component owns every judge-card entry point. Exact identities only.
export function installJudgeProfiles(D){
 let ready;
 const activate=()=>{
  if(!isFirstRoundActive())return;
  return ready ||= Promise.all([import('./judge-profile.js'),new Promise((resolve,reject)=>{const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('../css/judge-profile.css',import.meta.url);link.onload=resolve;link.onerror=()=>{link.remove();reject(Error('Profile styles unavailable'));};document.head.append(link);})]).then(([m])=>m.initializeJudgeProfiles(D)).catch(e=>{ready=null;throw e;});
 };
 function target(e){return e.target.closest('[data-judge-card],[data-ranking-profile],[data-fastest-judge],[data-jp-open],[data-jump-judge]');}
 async function show(e){const button=target(e);if(!button||!isFirstRoundActive()||e.button>0)return;e.preventDefault();e.stopImmediatePropagation();const key=button.dataset.judgeCard||button.dataset.rankingProfile||button.dataset.fastestJudge||button.dataset.jpOpen||button.dataset.jumpJudge;const originURL=location.href;const view=await activate();if(isFirstRoundActive()&&location.href===originURL)view.open(key,button);}
 document.addEventListener('click',show,true);
 document.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)&&e.target.matches('[data-judge-card]:not(button):not(a)'))show(e);},true);
 return activate;
}
