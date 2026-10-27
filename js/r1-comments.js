import {gradeKey} from './r1-core-contract.js';
// Hydrate only caller-owned projections after the complete comments resource has
// passed integrity, round and exact grade-binding checks. Never edit source bytes.
export async function ensureR1Comments(context,data){
 if(!context?.comments)return data;
 const full=await context.comments.load();
 if(!data)return full;
 const put=(p,source)=>{const actual=source.get(p.userId);if(!actual)return;const map=new Map(actual.scores.map(s=>[gradeKey(p.userId,s.judgeName,s.scoredAt),s.comment]));for(const s of p.scores||[]){const key=gradeKey(p.userId,s.judgeName,s.scoredAt);if(map.has(key))s.comment=map.get(key);}};
 const originals=new Map([...full.byId,...full.archivedById]);
 for(const key of ['byId','archivedById','metadata','referenceMetadata'])for(const p of data[key]?.values()||[])put(p,key==='archivedById'?full.archivedById:originals);
 for(const s of data.events||[]){const p=full.byId.get(s.userId);const actual=p?.scores.find(x=>x.judgeName===s.judgeName&&x.scoredAt===s.scoredAt);if(actual)s.comment=actual.comment;}
 return data;
}
const actions=new WeakMap();
// A small in-place status keeps the rest of the page interactive. Failed loads
// never masquerade as empty comments, and the same action can be retried.
export async function commentsAction(load,host,action,isCurrent=()=>true,{loading='Загружаем комментарии…',error='Не удалось загрузить комментарии. '}={}){
 const note=document.createElement('p');note.className='mini-note';note.setAttribute('role','status');note.dataset.commentsState='loading';note.textContent=loading;actions.get(host)?.remove();actions.set(host,note);host.append(note);
 try{await load();note.remove();if(actions.get(host)===note&&host.isConnected&&isCurrent())return await action();}
 catch{if(actions.get(host)!==note||!host.isConnected||!isCurrent()){note.remove();return;}note.dataset.commentsState='error';note.textContent=error;const retry=document.createElement('button');retry.type='button';retry.className='control';retry.textContent='Повторить';retry.onclick=()=>{note.remove();commentsAction(load,host,action,isCurrent,{loading,error});};note.append(retry);}
}
