// Presentation adapter only. Existing selects retain options, values and handlers.
const controls=new Map();let serial=0;
const valueProperty=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value');
function enhance(select){
 if(controls.has(select)||select.id==='bp-hour-judge'||select.multiple||select.size>1)return;
 const wrapper=document.createElement('span');wrapper.className='site-select';
 select.before(wrapper);wrapper.append(select);select.classList.add('site-select-source');select.tabIndex=-1;select.setAttribute('aria-hidden','true');
 const button=document.createElement('button');button.type='button';button.className='site-select-trigger';button.dataset.selectId=select.id||'';
 const label=document.createElement('span');button.append(label);button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-expanded','false');
 const list=document.createElement('div');list.className='site-select-options';list.id='site-select-options-'+(++serial);list.role='listbox';list.hidden=true;
 if(typeof list.showPopover==='function')list.setAttribute('popover','manual');
 button.setAttribute('aria-controls',list.id);wrapper.append(button,list);
 if(select.id==='round-select')wrapper.classList.add('site-select-round');
 let items=[],options=[],index=0,search='',lastKey=0,signature='';
 const caption=()=>select.getAttribute('aria-label')||[...select.labels].map(l=>[...l.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join(' ').trim()).filter(Boolean).join(' ')||'Выбор';
 function decorate(target,option){
  target.textContent=option?.text||'—';
  if(select.id==='round-select'&&option?.dataset.badge){const badge=document.createElement('small');badge.className='site-select-badge';badge.textContent=option.dataset.badge;target.append(' ',badge);}
 }
 function sync(){
  decorate(label,select.selectedOptions[0]);button.disabled=select.disabled;
  button.setAttribute('aria-label',caption()+': '+label.textContent);list.setAttribute('aria-label',caption());
  options=[...select.options];const next=options.map(o=>[o.text,o.value,o.disabled||o.parentElement.disabled,o.hidden]);
  if(JSON.stringify(next)!==signature){signature=JSON.stringify(next);list.replaceChildren();items=options.map((o,i)=>{const item=document.createElement('div');item.role='option';item.tabIndex=-1;decorate(item,o);item.hidden=o.hidden;item.setAttribute('aria-disabled',String(!!(o.disabled||o.parentElement.disabled)));item.onclick=()=>choose(i);list.append(item);return item;});}
  items.forEach((item,i)=>item.setAttribute('aria-selected',String(i===select.selectedIndex)));
 }
 function close(focus=false){if(list.hidePopover&&list.matches(':popover-open'))list.hidePopover();list.hidden=true;button.setAttribute('aria-expanded','false');if(focus&&button.isConnected)button.focus({preventScroll:true});}
 function enabled(i){return items[i]&&!items[i].hidden&&items[i].getAttribute('aria-disabled')!=='true';}
 function focus(i,direction=1){for(let n=0;n<items.length;n++,i+=direction){const j=(i+items.length)%items.length;if(enabled(j)){index=j;items[j].focus({preventScroll:true});items[j].scrollIntoView({block:'nearest'});return;}}}
 function position(){const r=button.getBoundingClientRect(),below=innerHeight-r.bottom-12,above=r.top-12,up=below<180&&above>below;list.style.width=Math.min(r.width,innerWidth-16)+'px';list.style.left=Math.max(8,Math.min(r.left,innerWidth-parseFloat(list.style.width)-8))+'px';list.style.maxHeight=Math.max(44,Math.min(340,up?above:below))+'px';list.style.top=up?'auto':r.bottom+6+'px';list.style.bottom=up?innerHeight-r.top+6+'px':'auto';}
 function open(edge){sync();if(button.disabled)return;list.hidden=false;position();if(list.showPopover)list.showPopover();button.setAttribute('aria-expanded','true');focus(edge==='last'?items.length-1:edge==='first'?0:Math.max(0,select.selectedIndex),edge==='last'?-1:1);}
 function choose(i){if(!enabled(i))return;const changed=select.selectedIndex!==i;select.selectedIndex=i;sync();close(true);if(changed){select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));queueMicrotask(()=>{if(!button.isConnected&&(document.activeElement===document.body||!document.activeElement?.isConnected)){const replacement=select.id&&document.getElementById(select.id);controls.get(replacement)?.button.focus({preventScroll:true});}});}}
 button.onclick=()=>button.getAttribute('aria-expanded')==='true'?close():open();
 button.onkeydown=e=>{if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();open(e.key==='Home'?'first':e.key==='End'?'last':undefined);}};
 list.onkeydown=e=>{
  if(['ArrowDown','ArrowUp','Home','End','Enter',' ','Escape'].includes(e.key)){e.preventDefault();e.stopPropagation();if(e.key==='Escape')close(true);else if(e.key==='Enter'||e.key===' ')choose(index);else focus(e.key==='Home'?0:e.key==='End'?items.length-1:index+(e.key==='ArrowDown'?1:-1),['ArrowUp','End'].includes(e.key)?-1:1);}
  else if(e.key==='Tab'){close(true);}
  else if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();const now=Date.now();search=now-lastKey<700?search+e.key:e.key;lastKey=now;for(let n=0;n<items.length;n++){const i=(index+(search.length===1?1:0)+n)%items.length;if(enabled(i)&&options[i].text.toLocaleLowerCase('ru').startsWith(search.toLocaleLowerCase('ru'))){focus(i);break;}}}
 };
 list.addEventListener('toggle',e=>{if(e.newState==='closed'){list.hidden=true;button.setAttribute('aria-expanded','false');}});
 wrapper.addEventListener('focusout',e=>{if(!wrapper.contains(e.relatedTarget))close();});
 select.addEventListener('focus',()=>button.focus({preventScroll:true}));
 select.addEventListener('change',sync);select.addEventListener('input',sync);
 // Programmatic resets and existing focus restoration still reach the visible control.
 Object.defineProperty(select,'value',{configurable:true,get(){return valueProperty.get.call(this);},set(v){valueProperty.set.call(this,v);sync();}});
 select.focus=options=>button.focus(options);
 controls.set(select,{button,wrapper,sync,close,position,list});sync();
}
function scan(){for(const [select,c]of controls)if(!select.isConnected){c.close();controls.delete(select);}document.querySelectorAll('select').forEach(enhance);}
new MutationObserver(records=>{
 let changed=false;const dirty=new Set();
 for(const r of records){if(['SELECT','OPTION','OPTGROUP'].includes(r.target.tagName)){const select=r.target.closest('select');if(select)dirty.add(select);}
  if(r.type==='childList'&&[...r.addedNodes,...r.removedNodes].some(n=>n.nodeType===1&&(n.matches('select')||n.querySelector('select'))))changed=true;
 }
 if(changed)scan();for(const select of dirty)controls.get(select)?.sync();
}).observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['disabled','selected','label','value']});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){const c=[...controls.values()].find(c=>c.list.contains(e.target)&&!c.list.hidden);if(c){e.preventDefault();e.stopPropagation();c.close(true);}}},true);
document.addEventListener('pointerdown',e=>{for(const c of controls.values())if(!c.wrapper.contains(e.target))c.close();});
document.addEventListener('reset',()=>queueMicrotask(()=>{for(const c of controls.values())c.sync();}));
window.addEventListener('resize',()=>{for(const c of controls.values())c.close();});
window.addEventListener('ib19:route',()=>{for(const c of controls.values()){c.close();c.sync();}});
scan();
