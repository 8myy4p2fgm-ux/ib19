import {personalTuz} from './calculations.js';
import {participantStatus} from './general.js';
export function rankRows(rows,key){const sorted=[...rows].filter(r=>Number.isFinite(r[key])).sort((a,b)=>b[key]-a[key]||(a.judge||a.name).localeCompare(b.judge||b.name,'ru'));let rank=0,last;return sorted.map((r,i)=>{if(i===0||r[key]!==last)rank=i+1;last=r[key];return {...r,rank};});}
export function calculateSimulation(params){return personalTuz(params);}
export function buildEvents(data){const members=new Map(data.people.map(p=>[p[0],p])),states=new Map(),seenJudges=new Set(),events=[];
 for(const score of data.events){const p=members.get(score.userId),scores=states.get(score.userId)||[],before=participantStatus(scores);scores.push(score);states.set(score.userId,scores);const after=participantStatus(scores);if(!score.forum)continue;const name=p[1],add=(type,title,body)=>events.push({id:type+':'+score.userId+':'+score.judge+':'+score.t,type,title,body,t:score.t,userId:score.userId,judge:score.judge,score:score.score});
 if(!seenJudges.has(score.judge)){add('judge-first',score.judge+' впервые оценил форумщика',name+' · '+score.score+' балл(ов)');seenJudges.add(score.judge);}
 if(before.status!=='pass'&&after.status==='pass')add('pass',name+' прошёл в следующий раунд',after.total+' баллов после '+after.count+' оценок.');
 if(before.status!=='fail'&&after.status==='fail')add('fail',name+' математически выбыл','Даже с оставшимися пятёрками максимум '+after.max+' из необходимых 15.');
 if(before.count<5&&after.count===5)add('complete',name+' полностью отсужен',after.total+' баллов · 5 оценок.');
 if(score.score===1)add('one',name+' получил единицу','Судья: '+score.judge+'. Оценка снижает личный ТУЗ по правилу штрафов.');
 }
 return events.sort((a,b)=>b.t-a.t||a.id.localeCompare(b.id));
}

