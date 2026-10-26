// Presentation only: selection indexes the existing factual series unchanged.
export function mountPulseControls(chart,days,draw,fmt){
 if(!days.length)return {index:()=>null};
 let selected=days.length-1,points=[],down=null;
 const readout=chart.parentElement.querySelector('.r1-chart-heading>span');
 readout.setAttribute('aria-live','polite');readout.setAttribute('aria-atomic','true');
 chart.setAttribute('tabindex','0');chart.setAttribute('role','group');chart.setAttribute('aria-roledescription','Интерактивный график');chart.setAttribute('aria-label','Накопление оценок. Стрелки — соседняя дата, Home — первая, End — последняя.');
 function update(){const p=days[selected];const date=new Date(p.t).toLocaleDateString('ru-RU',{day:'numeric',month:'long',timeZone:'Europe/Moscow'});readout.textContent=date+' · '+fmt(p.cumulative,0)+' оценок накоплено · '+fmt(p.count,0)+' за день'+(p.partial?' · неполный день':'');chart.dataset.selectedDate=String(p.t);chart.dataset.selectedIndex=String(selected);}
 function select(i){if(i===selected)return;selected=Math.max(0,Math.min(days.length-1,i));update();draw();}
 chart.addEventListener('keydown',e=>{const changes={ArrowLeft:selected-1,ArrowRight:selected+1,Home:0,End:days.length-1};if(e.key in changes){e.preventDefault();select(changes[e.key]);}});
 const nearestAt=e=>{const box=chart.getBoundingClientRect(),x=(e.clientX-box.left)*chart.viewBox.baseVal.width/box.width;let nearest=0;for(let i=1;i<points.length;i++)if(Math.abs(points[i].x-x)<Math.abs(points[nearest].x-x))nearest=i;return nearest;};
 chart.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'&&!e.buttons)select(nearestAt(e));});
 chart.addEventListener('pointerdown',e=>{if(e.button===0)down={x:e.clientX,y:e.clientY,id:e.pointerId};});
 chart.addEventListener('pointercancel',()=>{down=null;});
 chart.addEventListener('pointerup',e=>{if(!down||down.id!==e.pointerId)return;const start=down;down=null;if(Math.hypot(e.clientX-start.x,e.clientY-start.y)>12)return;select(nearestAt(e));});
 update();return {index:()=>selected,points:value=>{points=value;}};
}
