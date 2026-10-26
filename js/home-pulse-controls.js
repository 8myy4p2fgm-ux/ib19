// Presentation only: selection indexes the existing factual series unchanged.
export function mountPulseControls(chart,days,draw,fmt){
 if(!days.length)return {index:()=>null};
 let selected=days.length-1,points=[],down=null;
 const controls=document.createElement('div');controls.className='r1-pulse-controls';
 controls.innerHTML='<div class="r1-pulse-date"><button type="button" data-pulse-prev aria-label="Предыдущая дата">←</button><span data-pulse-date></span><button type="button" data-pulse-next aria-label="Следующая дата">→</button><button type="button" data-pulse-last>К последней</button></div><output class="r1-pulse-readout" aria-live="polite" aria-atomic="true"></output>';
 chart.after(controls);const prev=controls.querySelector('[data-pulse-prev]'),next=controls.querySelector('[data-pulse-next]'),last=controls.querySelector('[data-pulse-last]'),date=controls.querySelector('[data-pulse-date]'),readout=controls.querySelector('output');
 chart.setAttribute('tabindex','0');chart.setAttribute('role','group');chart.setAttribute('aria-roledescription','Интерактивный график');chart.setAttribute('aria-label','Накопление оценок. Стрелки — соседняя дата, Home — первая, End — последняя.');
 function update(){const p=days[selected];date.textContent=new Date(p.t).toLocaleDateString('ru-RU',{day:'numeric',month:'long',timeZone:'Europe/Moscow'});readout.textContent=fmt(p.cumulative,0)+' оценок накоплено · '+fmt(p.count,0)+' за день'+(p.partial?' · неполный день':'');controls.dataset.selectedDate=String(p.t);controls.dataset.selectedIndex=String(selected);prev.disabled=selected===0;next.disabled=last.disabled=selected===days.length-1;}
 function select(i){selected=Math.max(0,Math.min(days.length-1,i));update();draw();}
 prev.onclick=()=>select(selected-1);next.onclick=()=>select(selected+1);last.onclick=()=>select(days.length-1);
 chart.addEventListener('keydown',e=>{const changes={ArrowLeft:selected-1,ArrowRight:selected+1,Home:0,End:days.length-1};if(e.key in changes){e.preventDefault();select(changes[e.key]);}});
 chart.addEventListener('pointerdown',e=>{if(e.button===0)down={x:e.clientX,y:e.clientY,id:e.pointerId};});
 chart.addEventListener('pointercancel',()=>{down=null;});
 chart.addEventListener('pointerup',e=>{if(!down||down.id!==e.pointerId)return;const start=down;down=null;if(Math.hypot(e.clientX-start.x,e.clientY-start.y)>12)return;const box=chart.getBoundingClientRect(),x=(e.clientX-box.left)*chart.viewBox.baseVal.width/box.width;let nearest=0;for(let i=1;i<points.length;i++)if(Math.abs(points[i].x-x)<Math.abs(points[nearest].x-x))nearest=i;select(nearest);});
 update();return {index:()=>selected,points:value=>{points=value;}};
}
