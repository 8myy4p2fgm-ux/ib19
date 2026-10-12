import {config} from './config.js';
// Extra scores cannot fill another participant's missing slots.
export function judgingProgress(members){
 const rappers=members.length,required=rappers*config.scoresPerParticipant;
 const placed=members.reduce((total,p)=>total+p.scores.length,0);
 const credited=members.reduce((total,p)=>total+Math.min(config.scoresPerParticipant,p.scores.length),0);
 return {rappers,required,placed,credited,remaining:required-credited,percent:required?credited/required*100:0};
}
// Editorial adaptations of the archive's conversational tone, not forum quotations.
export const progressCaptions=[
 {min:0,max:0,text:'Пока ни одной оценки. Ждём судей.'},
 {min:0,max:10,text:'Первые оценки есть. Остальные ждут.'},
 {min:10,max:25,text:'Начало положено. До половины ещё далеко.'},
 {min:25,max:50,text:'Больше половины ещё впереди, брад.'},
 {min:50,max:75,text:'Половину уже поставили. Ждём остальных.'},
 {min:75,max:100,text:'Большая часть позади. Осталось дослушать.'},
 {min:100,max:100,text:'Всех отсудили. Всем спасибо.'}
];
export function progressCaption(percent){
 if(percent<=0)return progressCaptions[0].text;
 if(percent>=100)return progressCaptions.at(-1).text;
 return progressCaptions.find((p,i)=>i>0&&percent>=p.min&&percent<p.max).text;
}

