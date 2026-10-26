// INT-04 only: no changes to the other pages' dialog systems or URL profiles.
export function createRankingDialog(){
 const dialog=document.createElement('dialog');dialog.className='ranking-dialog';dialog.setAttribute('aria-labelledby','ranking-dialog-title');
 dialog.innerHTML='<header class="ranking-dialog-head"><h2 id="ranking-dialog-title"></h2><button type="button" data-ranking-close aria-label="Закрыть окно">×</button></header><div class="ranking-dialog-body"></div>';
 document.body.append(dialog);
 const body=dialog.querySelector('.ranking-dialog-body');
 let origin=null,position=null,restore=true,styles=null,downOutside=false;
 const outside=e=>{const r=dialog.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;};
 function close(returnToOrigin=true){restore=returnToOrigin;if(dialog.open)dialog.close();}
 dialog.querySelector('[data-ranking-close]').onclick=()=>close();
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 dialog.addEventListener('pointerdown',e=>{downOutside=e.target===dialog&&outside(e);});
 dialog.addEventListener('click',e=>{if(downOutside&&e.target===dialog&&outside(e))close();downOutside=false;});
 dialog.addEventListener('close',()=>{
  if(styles){document.documentElement.style.overflow=styles.html;document.body.style.overflow=styles.body;styles=null;}
  if(restore&&origin?.isConnected){window.scrollTo({...position,behavior:'instant'});origin.focus({preventScroll:true});}
  body.replaceChildren();dialog.removeAttribute('data-kind');
 });
 dialog.addEventListener('keydown',e=>{
  // Search fields may otherwise consume Escape to clear their text first.
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();return;}
  if(e.key!=='Tab')return;
  const targets=[...dialog.querySelectorAll('button,a[href],input,select,textarea,[tabindex="0"]')].filter(el=>!el.disabled&&el.getClientRects().length);
  const first=targets[0],last=targets.at(-1);
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
 },true);
 window.addEventListener('ib19:route',()=>close(false));
 return {
  body,element:dialog,close,
  open(kind,title,trigger,render){
   if(dialog.open)return;
   origin=trigger??document.activeElement;position={left:scrollX,top:scrollY};restore=true;
   styles={html:document.documentElement.style.overflow,body:document.body.style.overflow};
   dialog.dataset.kind=kind;dialog.querySelector('h2').textContent=title;body.replaceChildren();render(body);
   dialog.showModal();document.documentElement.style.overflow='hidden';document.body.style.overflow='hidden';body.scrollTop=0;
   dialog.querySelector('[data-ranking-close]').focus();
  }
 };
}
