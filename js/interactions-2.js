
/* Navigate to the roster, apply status/group filters, then scroll to its table. */
(function(){
 let pending=null;
 function apply(){
  if(!pending||!document.getElementById('forum-link')?.classList.contains('active'))return false;
  const root=document.getElementById('forum-link');
  const table=document.getElementById('fl-people');
  if(!root||!table||root.hidden||root.closest('[hidden]')||!root.classList.contains('active'))return false;
  const status=root.querySelector('[data-fl-status="'+pending.status+'"]');
  const all=root.querySelector('[data-fl-status="all"]');
  const groupButtons=root.querySelectorAll('[data-fl-group]');
  const search=root.querySelector('#fl-search');
  if(!status||!all||!groupButtons.length)return false;
  if(search&&search.value){search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));}
  // Always reset to all before applying the target status, including repeat visits.
  all.click();
  const desiredGroup=pending.group==='veterans'?'veterans':pending.group==='current'?'current':'all';
  const groupButton=root.querySelector('[data-fl-group="'+desiredGroup+'"]');
  if(groupButton)groupButton.click();
  if(pending.status!=='all')status.click();
  const scroll=()=>{if(root.classList.contains('active'))table.scrollIntoView({block:'start',behavior:'instant'});};
  requestAnimationFrame(()=>requestAnimationFrame(scroll));
  setTimeout(scroll,120);
  pending=null;
  return true;
 }
 function navigate(status,group){
  pending={status,group};
  window.ib19Navigate('forum-link');
  // Routing updates synchronously; allow one frame for rendering.
  requestAnimationFrame(apply);setTimeout(apply,80);setTimeout(apply,260);
 }
 document.addEventListener('click',e=>{
  const el=e.target.closest('#home [data-forum-status]');
  if(!el)return;
  e.preventDefault();e.stopPropagation();
  navigate(el.dataset.forumStatus||'all',el.dataset.forumGroup||'all');
 },true);
 document.addEventListener('keydown',e=>{
  const el=e.target.closest('#home [data-forum-status]');
  if(el&&(e.key==='Enter'||e.key===' ')){e.preventDefault();navigate(el.dataset.forumStatus||'all',el.dataset.forumGroup||'all');}
 });
 window.addEventListener('ib19:route',()=>{if(pending)setTimeout(apply,0);});
})();
