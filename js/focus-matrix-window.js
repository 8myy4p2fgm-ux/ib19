// Geometry and navigation only. No scores, analytics, loaders or round rules.
export function matrixLayout(width){
 const mobile=width>0&&width<600;
 const nameWidth=Math.min(125,Math.max(104,width*.4));
 return {mobile,nameWidth,size:mobile?(width>=nameWidth+3*72+3*4?3:2):null};
}
export function windowForJudge(judges,id,size){
 const i=judges.findIndex(j=>j.id===id);
 return Math.min(Math.floor(Math.max(0,i)/size)*size,Math.max(0,judges.length-size));
}
export function stepWindow(start,delta,size,count){
 const last=Math.max(0,count-size),current=Math.max(0,Math.min(start,last));
 // The final full window may overlap the previous regular group. Keep the
 // same group boundaries in both directions, so Previous/Next are reversible.
 const next=delta>0?(Math.floor(current/size)+1)*size:delta<0?(Math.ceil(current/size)-1)*size:current;
 return Math.max(0,Math.min(last,next));
}
