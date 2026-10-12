import {unifiedAt} from './calculations.js';
import {config} from './config.js';
export const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
export function generalAt(events,forumCount,otherCount,start,t,options={}){return unifiedAt(events,forumCount,config.scoresPerParticipant,t,{otherCount,judgeAssignments:config.judgeAssignments,...options});}
export function participantStatus(scores){const count=scores.length,total=scores.reduce((a,s)=>a+(Array.isArray(s)?Number(s[1]):s.score),0),remaining=Math.max(0,config.scoresPerParticipant-count),max=total+remaining*config.maxScore;return {count,total,remaining,max,status:total>=config.passScore?'pass':max<config.passScore?'fail':'pending'};}
export function verdict(v){if(!Number.isFinite(v))return ['Недостаточно данных','Нет расчёта индекса','var(--muted)'];return v>=20?['Норма','Хо-ро-шо. По форумному','var(--green)']:v>10?['Менять судей','Требуется корректировка в судейской коллегии','var(--yellow)']:['Менять батол','Требуется перезапуск батола','var(--red)'];}

