// Reuse the existing client once per document; the player belongs to the shell.
let ready;
export function openChat(root){
 if(!ready)ready=(async()=>{
  const style=document.createElement('link');style.rel='stylesheet';style.href=new URL('../chat/style.css',import.meta.url).href;
  const styles=new Promise((resolve,reject)=>{style.onload=resolve;style.onerror=()=>{style.remove();reject(Error('Не удалось загрузить стили чата'));};});document.head.append(style);
  const markup=fetch(new URL('../chat/view.html',import.meta.url)).then(r=>{if(!r.ok)throw Error('Не удалось загрузить чат');return r.text();});
  try{const [,html]=await Promise.all([styles,markup]);root.innerHTML=html;root.classList.add('chat-page');await import('./chat-client.js');}
  catch(e){style.remove();throw e;}
 })().catch(e=>{ready=null;throw e;});
 return ready;
}
