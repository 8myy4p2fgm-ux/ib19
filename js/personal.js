import {unifiedAt} from './calculations.js';
export function personalV4(events,forumCount,options={}){return unifiedAt(events,forumCount,5,options.asOf,options).judges;}
export function rankPersonalV4(rows){
 const sorted=[...rows].sort((a,b)=>{const av=Number.isFinite(a.tuz),bv=Number.isFinite(b.tuz);return av&&!bv?-1:!av&&bv?1:(av?b.tuz-a.tuz:0)||a.judge.localeCompare(b.judge,'ru');});
 let last,rank=0;return sorted.map((r,i)=>{if(!Number.isFinite(r.tuz))return {...r,rank:null};if(i===0||r.tuz!==last)rank=i+1;last=r.tuz;return {...r,rank};});
}

