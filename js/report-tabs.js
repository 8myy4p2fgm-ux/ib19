// Keep scrolling local to the report strip, including when a hidden section returns.
export function keepActiveReportVisible(nav){
 let frame;
 const reveal=()=>{
  cancelAnimationFrame(frame);
  frame=requestAnimationFrame(()=>{
   if(!nav.clientWidth)return;
   const active=nav.querySelector('[aria-selected="true"]');
   if(!active)return;
   const strip=nav.getBoundingClientRect(),tab=active.getBoundingClientRect();
   if(tab.left<strip.left)nav.scrollLeft+=tab.left-strip.left;
   else if(tab.right>strip.right)nav.scrollLeft+=tab.right-strip.right;
  });
 };
 new MutationObserver(reveal).observe(nav,{subtree:true,attributes:true,attributeFilter:['aria-selected']});
 new ResizeObserver(reveal).observe(nav);
 reveal();
}
