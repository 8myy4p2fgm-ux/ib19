// Forum materials are independent of the analytical snapshot and loaded on demand.
let ready;
export function openHoro(root){
 if(root.dataset.ready)return;
 root.textContent='Загружаем форумное…';
 ready ||= import('./horo.js');
 ready.then(module=>module.renderHoro(root)).catch(()=>{
  ready=null;root.textContent='Не удалось загрузить материалы. ';
  const retry=document.createElement('button');retry.className='control';retry.textContent='Повторить';retry.onclick=()=>openHoro(root);root.append(retry);
 });
}
