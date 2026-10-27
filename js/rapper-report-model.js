// Presentation projections only; membership and scores stay in their existing models.
import {ensureR1Comments} from './r1-comments.js';
import {getV58Research} from './v58-research-model.js';
export function rapperR1Model(context){
 const research=getV58Research(context),identities=research.judgeIdentities;
 const project=p=>({...p,group:p.veteran?'veterans':p.forum?'forum':'other',profile:p.battleProfile,scores:p.scores.map(s=>({...s,comment:s.comment||''}))});
 const allMembers=research.all.map(project);
 let hydrated=!context.comments;const ensureComments=async()=>{const D=await ensureR1Comments(context);if(!D)return;for(const p of allMembers){const original=D.byId.get(p.id)||D.archivedById.get(p.id);for(const s of p.scores){const score=original?.scores.find(x=>x.judgeName===s.judgeName&&x.scoredAt===s.scoredAt);if(score)s.comment=score.comment;}}hydrated=true;};
 return {ensureComments,commentsReady:()=>hydrated,members:allMembers.filter(p=>p.forum),allMembers,judges:research.names.map(name=>({name,id:identities.get(name)})),topic:'Всё, кроме правды'};
}
export function rapperR2Model(info,reference=null){
 return {members:info.submissions.map(e=>({id:e.userId,name:e.name,battleName:e.name,aliases:[],group:reference?.get(e.userId)||'unknown',veteran:reference?.get(e.userId)==='veterans',profile:e.slug?'https://19ib.ru/artist/'+encodeURIComponent(e.slug):null,status:null,total:null,count:null,admitted:reference?.cohort?.has(e.userId)??null,submittedAt:e.submittedAt,durationSec:e.durationSec,hasLyrics:e.hasLyrics,scores:[]})),judges:[],topic:info.topic,base:null,impacts:[],rosterComplete:false,resultsPublished:info.resultsPublished};
}
