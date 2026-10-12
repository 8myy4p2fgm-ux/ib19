export function meanDifference(row){return row?.forum.count&&row?.other.count&&Number.isFinite(row.forum.mean)&&Number.isFinite(row.other.mean)?row.forum.mean-row.other.mean:null;}
export function sortByDifference(rows){return [...rows].sort((a,b)=>{const av=meanDifference(a),bv=meanDifference(b);return av===null&&bv!==null?1:bv===null&&av!==null?-1:(av===null?0:bv-av)||a.name.localeCompare(b.name,'ru');});}
export function signedDifference(value,fmt){return Number.isFinite(value)?(value>0?'+':value<0?'−':'')+fmt(Math.abs(value),2):'—';}

