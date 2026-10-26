import {buildProfiles} from './judge-profile-model.js';
import {createRankingDialog} from './ranking-dialog.js';
import {renderJudgeCard} from './ranking-profile.js';
export function initializeJudgeProfiles(D){
 const profiles=buildProfiles(D),dialog=createRankingDialog();dialog.element.classList.add('judge-card-dialog');
 const resolve=value=>profiles.has(value)?value:D.judgeIdentities.get(value);
 function open(value,trigger,params){
  if(new URLSearchParams(location.search).get('round')==='2')return;
  const profile=profiles.get(resolve(value));dialog.open('judge-card',profile?.name||'Судья не найден',trigger,body=>renderJudgeCard(body,profile,{round:1,params}));
 }
 window.addEventListener('tuz:judge-card',e=>open(e.detail.key,e.detail.trigger));
 function legacy(e){
  if(!e.detail?.ready||new URLSearchParams(location.search).get('round')==='2')return;
  const url=new URL(location.href),key=url.searchParams.get('judge');
  if(!key||url.pathname!==new URL('../judges/',import.meta.url).pathname)return;
  const params=new URLSearchParams(url.search);for(const name of ['judge','judgeQ','grade','order','jpPage','view'])url.searchParams.delete(name);
  history.replaceState(history.state,'',url.pathname+url.search);open(key,document.querySelector('.site-header [data-tab="judges"]'),params);
 }
 window.addEventListener('ib19:route',legacy);
 return {open};
}
