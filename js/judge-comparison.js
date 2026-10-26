// Projection of the already calculated ranking rows; no second analytics engine.
export const comparisonMetrics=Object.freeze([['tuz','Личный ТУЗ'],['scorePoints','Благосклонность'],['speedPoints','Внимание'],['respectPoints','Уважение']].map(Object.freeze));
export function signedComparisonBars(a,b){
 const known=[a,b].filter(Number.isFinite),scale=Math.max(1,...known.map(Math.abs));
 return [a,b].map(value=>Number.isFinite(value)?{left:value<0?50+value/scale*50:50,width:Math.abs(value)/scale*50,value}:null);
}
const identities=new WeakMap();
export function comparisonJudges(model){
 if(!identities.has(model))identities.set(model,model.rows('forum').map(row=>({name:row.judge,id:model.profileKey(row.judge)})));
 return identities.get(model).map(entry=>({...entry}));
}
export function compareRankingJudges(model,group,aId,bId){
 const rows=model.rows(group),keys=comparisonJudges(model),find=id=>{const identity=keys.find(entry=>entry.id===id);return identity?rows.find(row=>row.judge===identity.name):undefined;};
 const a=find(aId),b=find(bId);if(!a||!b)throw new Error('Unknown comparison judge identity');
 const difference=Number.isFinite(a.tuz)&&Number.isFinite(b.tuz)?a.tuz-b.tuz:null;
 return {a,b,aId,bId,group,same:aId===bId,difference,metrics:comparisonMetrics.map(([key,label])=>({key,label,a:a[key],b:b[key],bars:signedComparisonBars(a[key],b[key])}))};
}
