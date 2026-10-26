// Local presentation adapter: native options remain the source of judge values.
export function mountHourJudgeSelect(select){
 const root=select.parentElement,doc=select.ownerDocument,abort=new AbortController();
 const options=[...select.options];let index=select.selectedIndex,search='',lastKey=0;
 select.hidden=true;
 const button=doc.createElement('button');button.type='button';button.id='bp-hour-judge-trigger';button.className='hour-judge-trigger';button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','bp-hour-judge-options');button.setAttribute('aria-label','Судья: '+options[index].text);button.textContent=options[index].text;
 const list=doc.createElement('div');list.id='bp-hour-judge-options';list.className='hour-judge-options';list.role='listbox';list.setAttribute('aria-label','Судья');list.hidden=true;
 const items=options.map((o,i)=>{const el=doc.createElement('div');el.role='option';el.tabIndex=-1;el.textContent=o.text;el.setAttribute('aria-selected',String(o.selected));el.onclick=()=>choose(i);list.append(el);return el;});
 root.append(button,list);root.classList.add('hour-judge-select');
 function close(focus=false){list.hidden=true;button.setAttribute('aria-expanded','false');if(focus)button.focus({preventScroll:true});}
 function focus(i){index=(i+items.length)%items.length;items[index].focus({preventScroll:true});items[index].scrollIntoView({block:'nearest'});}
 function open(i=select.selectedIndex){list.hidden=false;button.setAttribute('aria-expanded','true');focus(i);}
 function choose(i){select.value=options[i].value;close(true);select.dispatchEvent(new Event('change',{bubbles:true}));}
 button.onclick=()=>list.hidden?open():close();
 button.onkeydown=e=>{if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();open(e.key==='Home'?0:e.key==='End'?items.length-1:select.selectedIndex);}};
 list.onkeydown=e=>{
  if(['ArrowDown','ArrowUp','Home','End','Enter',' ','Escape'].includes(e.key)){e.preventDefault();if(e.key==='Escape')close(true);else if(e.key==='Enter'||e.key===' ')choose(index);else focus(e.key==='Home'?0:e.key==='End'?items.length-1:index+(e.key==='ArrowDown'?1:-1));}
  else if(e.key==='Tab'){close();button.focus({preventScroll:true});}
  else if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();const now=Date.now();search=now-lastKey<700?search+e.key:e.key;lastKey=now;const start=search.length===1?index+1:index;for(let n=0;n<items.length;n++){const i=(start+n)%items.length;if(options[i].text.toLocaleLowerCase('ru').startsWith(search.toLocaleLowerCase('ru'))){focus(i);break;}}}
 };
 root.addEventListener('focusout',e=>{if(!root.contains(e.relatedTarget))close();},{signal:abort.signal});
 doc.addEventListener('pointerdown',e=>{if(!root.contains(e.target))close();},{signal:abort.signal});
 return {destroy(){abort.abort();button.remove();list.remove();select.hidden=false;}};
}
