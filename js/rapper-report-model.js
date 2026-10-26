// Presentation projections only; membership, scores and counterfactuals stay in their existing models.
import {getV58Research} from './v58-research-model.js';
export function rapperR1Model(context){
 const research=getV58Research(context),identities=research.judgeIdentities;
 const project=p=>({...p,group:p.veteran?'veterans':p.forum?'forum':'other',profile:p.battleProfile,scores:p.scores.map(s=>({...s,comment:s.comment||''}))});
 const allMembers=research.all.map(project);
 let impact;
 const current=()=>impact??=research.impacts();
 return {members:allMembers.filter(p=>p.forum),allMembers,judges:research.names.map(name=>({name,id:identities.get(name)})),topic:'Всё, кроме правды',prepareImpacts:()=>research.prepareImpacts('rappers'),get base(){return current().base.index;},get impacts(){return current().rappers.map(r=>({id:r.key,name:r.name,n:r.n,available:r.available,impact:r.impact,without:r.without.index,favor:r.favor,attention:r.attention,respect:r.respect,clipping:r.clippingEffect}));}};
}
export function rapperR2Model(info,reference=null){
 return {members:info.submissions.map(e=>({id:e.userId,name:e.name,battleName:e.name,aliases:[],group:reference?.get(e.userId)||'unknown',veteran:reference?.get(e.userId)==='veterans',profile:e.slug?'https://19ib.ru/artist/'+encodeURIComponent(e.slug):null,status:null,total:null,count:null,admitted:reference?.cohort?.has(e.userId)??null,submittedAt:e.submittedAt,durationSec:e.durationSec,hasLyrics:e.hasLyrics,scores:[]})),judges:[],topic:info.topic,base:null,impacts:[],rosterComplete:false,resultsPublished:info.resultsPublished};
}
