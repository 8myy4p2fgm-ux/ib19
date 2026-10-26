// Presentation only: native round selection and URL routing retain their owners.
const header=document.querySelector('.site-header'),inner=header.querySelector('.site-header-inner');
const toggle=header.querySelector('.header-menu-toggle'),panel=header.querySelector('.header-navigation');
const nav=header.querySelector('.navs'),brand=header.querySelector('.site-brand');
const canvas=document.createElement('canvas'),measure=canvas.getContext('2d');
let open=false,frame;
header.classList.add('header-polished');toggle.hidden=false;
function setOpen(value,{focus=false}={}){
 open=value&&header.classList.contains('header-compact');
 header.classList.toggle('header-menu-open',open);toggle.setAttribute('aria-expanded',String(open));
 if(focus)toggle.focus({preventScroll:true});
}
function layout(){
 cancelAnimationFrame(frame);
 frame=requestAnimationFrame(()=>{
  // Measure text intrinsically, including future links, while the disclosure is
  // closed or stacked. A single compact mode handles both viewport and content.
  const links=[...nav.querySelectorAll('.nav')];let width=0;
  for(const link of links){
   const style=getComputedStyle(link);
   measure.font=`${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
   width+=measure.measureText(link.textContent.trim()).width;
  }
  const needed=brand.getBoundingClientRect().width+width+Math.max(0,links.length-1)*16+160+40+28;
  const compact=inner.clientWidth<needed||inner.clientWidth<900;
  const was=header.classList.contains('header-compact'),focused=document.activeElement;header.classList.toggle('header-compact',compact);
  if(was!==compact){setOpen(false,{focus:compact&&panel.contains(focused)});if(!compact&&focused===toggle)nav.querySelector('.nav.active')?.focus({preventScroll:true});}
 });
}
toggle.addEventListener('click',()=>{setOpen(!open);toggle.focus({preventScroll:true});});
document.addEventListener('keydown',e=>{
 // Select owns its native popup keyboard handling, including Escape.
 if(e.key==='Escape'&&open&&!e.target.closest('#round-select')){e.preventDefault();setOpen(false,{focus:true});}
});
document.addEventListener('pointerdown',e=>{if(open&&!header.contains(e.target))setOpen(false)});
header.addEventListener('focusout',e=>{if(open&&e.relatedTarget&&!header.contains(e.relatedTarget))setOpen(false)});
nav.addEventListener('click',e=>{if(e.target.closest('a'))setOpen(false,{focus:open})});
window.addEventListener('ib19:route',()=>{
 if(open&&document.activeElement?.closest('#round-select'))return;
 setOpen(false,{focus:open&&panel.contains(document.activeElement)});
});
// The router creates the native select. Its label remains accessible while the
// visible caption disappears. No replacement control or duplicate state.
const enhance=()=>{
 const select=header.querySelector('#round-select');if(!select||select.dataset.headerPolished)return;
 select.dataset.headerPolished='true';
 select.setAttribute('aria-label','Выбор раунда');header.querySelector('label[for="round-select"]').textContent='Выбор раунда';
 select.querySelector('option[value=""]')?.remove();
 // Chromium's customizable native picker opens with Space by default. Make
 // Enter equivalent while retaining browser-owned selection and focus.
 select.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&CSS.supports('appearance','base-select')&&!select.matches(':open')){
   select.showPicker();e.preventDefault();
  }
 });
};
new MutationObserver(enhance).observe(header.querySelector('.shell-round-label'),{childList:true});
new MutationObserver(layout).observe(nav,{childList:true,subtree:true,characterData:true});
new ResizeObserver(layout).observe(inner);
document.fonts.ready.then(layout);enhance();layout();
