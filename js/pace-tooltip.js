// Read-only interaction with the already calculated daily series.
export function mountPaceTooltip(target,{days,mode,x,y,W,H,L,R,T,B,fmt}){
 if(!days.length)return;
 const chart=target.querySelector('svg'),tip=document.createElement('div');
 tip.className='pace-tooltip';tip.id='pace-value-tip';tip.hidden=true;tip.setAttribute('role','status');target.append(tip);
 chart.setAttribute('tabindex','0');chart.setAttribute('role','group');chart.setAttribute('aria-label','Оценки по датам. Стрелки влево и вправо — выбрать день.');chart.setAttribute('aria-describedby',tip.id);
 let selected=0;
 const ns='http://www.w3.org/2000/svg',marker=document.createElementNS(ns,'circle');marker.setAttribute('r','4');marker.setAttribute('fill','#d1e0d5');marker.setAttribute('stroke','#202322');marker.setAttribute('stroke-width','2');marker.style.pointerEvents='none';marker.style.display='none';chart.append(marker);
 const hide=()=>{tip.hidden=true;marker.style.display='none';};
 function show(i){selected=Math.max(0,Math.min(days.length-1,i));const d=days[selected],value=mode==='daily'?d.count:d.cumulative,px=x(d.t+43200000),py=y(value);
 tip.replaceChildren();const date=document.createElement('strong'),text=document.createElement('span');date.textContent=new Date(d.t).toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Moscow'});text.textContent=`${fmt(value)} оценок ${mode==='daily'?'за день':'накоплено'}${d.partial?' · неполный день':''}`;tip.append(date,text);tip.hidden=false;
 marker.setAttribute('cx',px);marker.setAttribute('cy',py);marker.style.display='';
 const scale=chart.getBoundingClientRect().width/W,left=px*scale-tip.offsetWidth/2;
 tip.style.left=Math.max(0,Math.min(left,target.clientWidth-tip.offsetWidth))+'px';tip.style.top=Math.max(0,py*scale-tip.offsetHeight-12)+'px';
 }
 function pointer(e){const box=chart.getBoundingClientRect(),px=(e.clientX-box.left)*W/box.width,py=(e.clientY-box.top)*H/box.height;if(px<L||px>W-R||py<T||py>H-B){hide();return;}let nearest=0;for(let i=1;i<days.length;i++)if(Math.abs(x(days[i].t+43200000)-px)<Math.abs(x(days[nearest].t+43200000)-px))nearest=i;show(nearest);}
 chart.addEventListener('pointermove',pointer);chart.addEventListener('pointerdown',pointer);chart.addEventListener('pointerleave',e=>{if(e.pointerType!=='touch')hide();});chart.addEventListener('focus',()=>show(selected));chart.addEventListener('blur',hide);
 chart.addEventListener('keydown',e=>{if(e.key==='Escape'){hide();return;}const moves={ArrowLeft:selected-1,ArrowRight:selected+1,Home:0,End:days.length-1};if(e.key in moves){e.preventDefault();show(moves[e.key]);}});
}
