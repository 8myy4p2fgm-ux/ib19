// Presentation only: the caller supplies the existing 24 Moscow-hour counts.
const hh=h=>String(h).padStart(2,'0');
const range=h=>`${hh(h)}:00–${hh(h)}:59`;
const scoreForm=n=>{const a=n%100,u=n%10;return a>=11&&a<=14?'оценок':u===1?'оценка':u>=2&&u<=4?'оценки':'оценок'};
export const clockGeometry=Object.freeze({size:640,center:320,radius:250,ring:266,label:286});
const polar=(h,r)=>{const a=(h*15-90)*Math.PI/180;return [320+Math.cos(a)*r,320+Math.sin(a)*r];};
// Monotone radial interpolation links the hourly samples without inventing extrema.
export function activityProfile(bins){
 const max=Math.max(1,...bins),radii=bins.map(n=>250*n/max),points=[];
 for(let h=0;h<24;h++)for(let j=0;j<12;j++){const t=j/12,s=t*t*(3-2*t);points.push(polar(h+t,radii[h]+(radii[(h+1)%24]-radii[h])*s));}
 return {radii,path:points.map((p,i)=>(i?'L':'M')+p.join(',')).join(' ')+' Z'};
}
export function mountActivityClock(root,{bins,total,peakHour,selectedHour,fmt,onSelect,readoutHost}){
 const {radii,path}=activityProfile(bins),p=polar;
 const line=(h,r1,r2,cls)=>{const a=p(h,r1),b=p(h,r2);return `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" class="${cls}"/>`;};
 const a=p(-.5,266),b=p(5.5,266);
 let ground=`<defs>
 <radialGradient id="bp-profile-ink" gradientUnits="userSpaceOnUse" cx="320" cy="320" r="250"><stop offset="0" stop-color="#a6bdc7" stop-opacity=".035"/><stop offset=".58" stop-color="#a6bdc7" stop-opacity=".13"/><stop offset="1" stop-color="#bacbd2" stop-opacity=".29"/></radialGradient>
 <radialGradient id="bp-night-wash" gradientUnits="userSpaceOnUse" cx="320" cy="320" r="266"><stop offset="0" stop-color="#9b87b7" stop-opacity=".02"/><stop offset="1" stop-color="#9b87b7" stop-opacity=".18"/></radialGradient>
 <pattern id="bp-engrained" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="1" cy="2" r=".45" fill="#d9ded7" fill-opacity=".14"/><circle cx="5" cy="5" r=".35" fill="#d9ded7" fill-opacity=".09"/></pattern>
 </defs><circle class="profile-ground" cx="320" cy="320" r="266"/><path class="night-sector" d="M320 320 L${a} A266 266 0 0 1 ${b} Z"/><circle cx="320" cy="320" r="266" fill="url(#bp-engrained)"/>`;
 for(let h=0;h<24;h++)ground+=line(h,0,266,h%6===0?'hour-ray major-ray':'hour-ray');
 for(const ratio of [.25,.5,.75,1])ground+=`<circle class="profile-ring" cx="320" cy="320" r="${250*ratio}"/>`;
 ground+=`<path class="night-arc" d="M${a} A266 266 0 0 1 ${b}"/>`;
 for(let h=0;h<24;h++)ground+=line(h,260,h%6===0?269:265,'engraved-tick');
 const sectors=bins.map((count,h)=>{
  const start=p(h-.5,274),end=p(h+.5,274),dot=p(h,radii[h]),label=p(h,286);
  return `<g class="clock-sector ${h<6?'clock-night':''} ${count>0&&h===peakHour?'clock-peak':''}" data-hour="${h}" data-count="${count}" role="button" aria-label="${range(h)} · ${fmt(count)} ${scoreForm(count)}">
   <circle class="profile-dot" cx="${dot[0]}" cy="${dot[1]}" r="${h===peakHour?6:4}" data-radius="${radii[h]}"/>
   <path class="clock-hit" d="M320 320 L${start} A274 274 0 0 1 ${end} Z"/>
  </g><text class="profile-label ${h<6?'is-night':''} ${h===peakHour?'is-peak':''}" x="${label[0]}" y="${label[1]}" text-anchor="middle" dominant-baseline="central" aria-hidden="true">${hh(h)}</text>`;
 }).join('');
 root.innerHTML=`<svg viewBox="0 0 640 640" role="group" aria-label="Активность по 24 часам, МСК. Стрелки — выбор часа.">
 <g aria-hidden="true">${ground}<path class="profile-fill" d="${path}"/><line class="selection-ray" x1="320" y1="320"/><circle class="selected-ring" r="11"/></g>${sectors}</svg>
 <div class="profile-readout" role="status" aria-live="polite" aria-atomic="true"><div><span>Выбранный час</span><strong data-clock-hour></strong></div><div><span data-clock-count></span><small data-clock-share></small></div></div>`;
 const readout=root.querySelector('.profile-readout');if(readoutHost)readoutHost.append(readout);
 const nodes=[...root.querySelectorAll('.clock-sector')],labels=[...root.querySelectorAll('.profile-label')];
 const ray=root.querySelector('.selection-ray'),ring=root.querySelector('.selected-ring');
 let selected=selectedHour;
 function commit(i,announce=true){
  selected=i;root.dataset.selectedHour=String(i);root.dataset.displayHour=String(i);
  readout.querySelector('[data-clock-hour]').textContent=range(i);
  readout.querySelector('[data-clock-count]').textContent=fmt(bins[i])+' '+scoreForm(bins[i]);
  readout.querySelector('[data-clock-share]').textContent=fmt(total?100*bins[i]/total:0,1)+'% от всех';
  nodes.forEach((n,h)=>{n.setAttribute('tabindex',h===i?'0':'-1');n.setAttribute('aria-pressed',String(h===i));n.classList.toggle('is-selected',h===i);labels[h].classList.toggle('is-selected',h===i);});
  const dot=p(i,radii[i]),end=p(i,271);ring.setAttribute('cx',dot[0]);ring.setAttribute('cy',dot[1]);ray.setAttribute('x2',end[0]);ray.setAttribute('y2',end[1]);
  if(announce)onSelect?.(i);
 }
 nodes.forEach((node,i)=>{
  node.onpointermove=e=>{if(e.pointerType==='mouse'&&(e.movementX||e.movementY))commit(i);};
  node.onclick=()=>commit(i);
  node.onfocus=()=>commit(i);
  node.onkeydown=e=>{
   if(e.key==='Enter'||e.key===' '){e.preventDefault();commit(i);}
   else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key)){
    e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?23:(i+(['ArrowRight','ArrowDown'].includes(e.key)?1:23))%24;commit(next);nodes[next].focus({preventScroll:true});
   }else if(e.key==='Escape'){e.preventDefault();nodes[selected].focus({preventScroll:true});}
  };
 });
 function resize(){const width=root.getBoundingClientRect().width;if(width>0)labels.forEach(n=>n.style.setProperty('font-size',Math.max(18,12*640/width)+'px','important'));}
 const observer=new ResizeObserver(resize);observer.observe(root);resize();
 root.dataset.total=String(total);commit(selected,false);
 return {selectedHour:()=>selected,destroy:()=>observer.disconnect()};
}
