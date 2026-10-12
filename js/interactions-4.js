
(function(){
  const tip=document.createElement('div');tip.id='fl-banger-floating';tip.textContent='прослушать бенгер';document.body.appendChild(tip);
  let current=null;
  function show(a){
    if(!a)return;current=a;
    tip.style.display='block';
    const r=a.getBoundingClientRect();
    const w=tip.offsetWidth;
    let left=r.left-w-12;
    if(left<8)left=Math.min(window.innerWidth-w-8,r.right+12);
    tip.style.left=Math.max(8,left)+'px';
    tip.style.top=Math.max(8,Math.min(window.innerHeight-tip.offsetHeight-8,r.top+(r.height-tip.offsetHeight)/2))+'px';
  }
  function hide(){current=null;tip.style.display='none';}
  document.addEventListener('pointerover',e=>{const a=e.target.closest?.('#forum-link #fl-people a.fl-profile-link');if(a)show(a);});
  document.addEventListener('pointerout',e=>{if(current && !current.contains(e.relatedTarget))hide();});
  document.addEventListener('focusin',e=>{const a=e.target.closest?.('#forum-link #fl-people a.fl-profile-link');if(a)show(a);else hide();});
  document.addEventListener('focusout',e=>{if(current)hide();});
  document.addEventListener('scroll',()=>{if(current)show(current);},true);
})();
