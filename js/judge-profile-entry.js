// Keep profile code, CSS and aggregation out of the overview's initial load.
export function installJudgeProfiles(D){
 const judgesPath=new URL('../judges/',import.meta.url).pathname;
 let ready;
 const activate=()=>{
  if(location.pathname!==judgesPath)return;
  ready ||= Promise.all([
   import('./judge-profile.js'),
   new Promise((resolve,reject)=>{const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('../css/judge-profile.css',import.meta.url);link.onload=resolve;link.onerror=()=>{link.remove();reject(Error('Profile styles unavailable'))};document.head.append(link);})
  ]).then(([module])=>module.initializeJudgeProfiles(D)).catch(()=>{ready=null;});
 };
 window.addEventListener('ib19:route',activate);
 return activate;
}
