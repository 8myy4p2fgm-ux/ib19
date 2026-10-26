// Presentation availability only; remaining report indices stay stable.
const visible=Object.freeze({dynamics:Object.freeze([0,1,2,3]),judges:Object.freeze([0,2,3,4,5]),rappers:Object.freeze([0,1,2])});
export const availableReports=kind=>visible[kind]??Object.freeze([]);
export const availableReportIndex=(kind,index)=>availableReports(kind).includes(Number(index))?Number(index):0;
export function nextAvailableReport(kind,current,key){
 const indices=availableReports(kind),at=Math.max(0,indices.indexOf(current));
 return key==='Home'?indices[0]:key==='End'?indices.at(-1):indices[(at+(key==='ArrowRight'?1:indices.length-1))%indices.length];
}
const removedAliases={dynamics:['decisive','speedsters','fastest'],judges:['compare','comparison','impact'],rappers:['edge','fate']};
// Legacy numeric selectors/DOM anchors were not public routes. Clean hidden requests
// in place and ask the existing section to select its first available report.
export function removeHiddenReportRequest(type,params,hash='',legacy=''){
 const kind=type==='forum-link'?'rappers':type;
 if(!visible[kind])return false;
 let fallback=kind==='judges'&&legacy==='compare';
 const hidden=value=>removedAliases[kind].includes(value)||(/^\d+$/.test(value)&&!visible[kind].includes(Number(value))&&Number(value)<({dynamics:6,judges:6,rappers:5})[kind]);
 for(const key of ['report','tab'])if(params.getAll(key).some(hidden)){params.delete(key);fallback=true;}
 const anchor=hash.match(/^#int(08|09|10)-(?:tab|panel|report)-(\d+)$/);
 if(anchor&&({dynamics:'08',judges:'09',rappers:'10'})[kind]===anchor[1]&&hidden(anchor[2]))fallback=true;
 if(fallback)params.delete('judge');
 return fallback;
}
export function onReportFallback(kind,choose){
 window.addEventListener('tuz:report-fallback',event=>{if(event.detail?.kind===kind)choose(0);});
}
