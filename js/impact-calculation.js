import {generalAt} from './general.js';
// One shared counterfactual implementation for synchronous tests, fallback and
// the browser worker. The established generalAt formula remains unchanged.
export function calculateImpactRow({selected,base,start,asOf},kind,item){
 const isJudge=kind==='judges',key=isJudge?item:item.id,name=isJudge?item:item.name;
 const es=selected.events.filter(e=>isJudge?e.judge!==name:e.userId!==key);
 const without=generalAt(es,selected.forumCount-(isJudge?0:1),selected.otherCount,start,asOf,{historical:false});
 const favor=base.favor-without.favor,attention=.25*(base.priority-without.priority),respect=base.respect-without.respect;
 const impact=Number.isFinite(base.index)&&Number.isFinite(without.index)?base.index-without.index:null;
 const row={key,name,available:Number.isFinite(impact),without,impact,favor,attention,respect,clippingEffect:impact-(favor+attention+respect),personalTuz:isJudge?base.judges.find(j=>j.judge===name)?.tuz:null};
 return isJudge?{...row,n:selected.events.filter(e=>e.judge===name).length,forumN:selected.events.filter(e=>e.judge===name&&e.forum).length}:{...row,n:item.count};
}
