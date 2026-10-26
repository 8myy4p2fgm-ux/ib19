const pending=new Map();
// Styles retain their original cascade position. A failed request can be retried.
export function prepareSectionStyles(section){
 const slots=[...document.querySelectorAll('template[data-section-style]')].filter(slot=>slot.dataset.sectionStyle.split(' ').includes(section));
 return Promise.all(slots.map(slot=>{
  if(pending.has(slot))return pending.get(slot);
  const promise=new Promise((resolve,reject)=>{
   const link=slot.content.querySelector('link').cloneNode();
   // SPA navigation changes location; resolve against the module base, not the current route.
   link.href=new URL('../css/'+link.getAttribute('href').split('/').at(-1),import.meta.url).href;
   link.onload=()=>resolve();link.onerror=()=>{link.remove();pending.delete(slot);reject(Error('Не удалось загрузить стили раздела'));};
   slot.after(link);
  });pending.set(slot,promise);return promise;
 }));
}
