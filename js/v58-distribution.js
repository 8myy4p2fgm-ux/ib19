// Both series use the same selected sample and the existing model's unrounded bins.
export function mountV58Distribution(element,groups){
 const fmt=(n,d=0)=>Number.isFinite(n)?n.toLocaleString('ru-RU',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
 const pct=n=>Number.isFinite(n)?fmt(n*100,1)+'%':'—';
 const signed=n=>Number.isFinite(n)?(n<0?'−':'+')+fmt(Math.abs(n),1):'—';
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const labels={all:'Все МС',forum:'Форум',veterans:'Ветераны'};
 let group='all',normal=false,selected=15;
 const root=element,$=s=>root.querySelector(s),current=()=>groups[group];
 root.innerHTML=`<div class="sd-main">
 <header class="sd-heading"><div><h2>Распределение баллов</h2><p>Сколько участников набрали каждую сумму баллов?</p></div></header>
 <section class="sd-frame" aria-label="Распределение итоговых баллов">
 <div class="sd-upper"><div class="sd-groups" role="group" aria-label="Выбор группы">${Object.entries(labels).map(([k,label])=>`<button type="button" data-sd-group="${k}" aria-pressed="${k===group}">${label}</button>`).join('')}</div>
 <button type="button" class="sd-model-control" data-sd-model role="switch" aria-label="Модель Гаусса" aria-checked="false"><span>Модель Гаусса: <span data-sd-model-state>Выкл</span></span><span class="sd-switch" aria-hidden="true"></span></button></div>
 <h3 class="sd-chart-title">Итоговые баллы · 5–25</h3>
 <div class="sd-plot"><svg class="sd-y-axis" viewBox="0 0 58 306" aria-hidden="true"></svg><div class="sd-chartbox" role="region" aria-label="График сумм от 5 до 25" tabindex="0"><svg id="sd-chart" role="group" aria-label="Распределение итоговых баллов"></svg></div><div class="sd-bin-tooltip" role="status" aria-live="polite" hidden><strong></strong><span></span><span class="sd-tooltip-model" hidden></span></div></div>
 <p class="sd-unavailable" role="status" hidden></p>
 <div class="sd-selection" aria-live="polite"><span id="sd-selected-score">—</span><span id="sd-selected-count">—</span></div>
 </section></div>`;
 const tooltip=$('.sd-bin-tooltip');
 const closeTooltip=()=>{tooltip.hidden=true;};
 function positionTooltip(){
  if(tooltip.hidden)return;
  const hit=$(`[data-sd-bin="${selected}"]`),bar=$(`[data-sd-score="${selected}"]`);
  if(!hit||!bar){closeTooltip();return;}
  const frame=$('.sd-plot').getBoundingClientRect(),box=$('.sd-chartbox').getBoundingClientRect(),target=hit.getBoundingClientRect(),column=bar.getBoundingClientRect();
  if(target.right<=box.left||target.left>=box.right){closeTooltip();return;}
  const left=Math.max(4,Math.min(frame.width-tooltip.offsetWidth-4,target.left-frame.left+target.width/2-tooltip.offsetWidth/2));
  tooltip.style.left=left+'px';tooltip.style.top=Math.max(0,column.top-frame.top-tooltip.offsetHeight-10)+'px';
 }
 function showTooltip(){
  const bin=current().bins.find(b=>b.score===selected);if(!current().n||!bin)return;
  const count=bin.count,a=count%100,u=count%10,word=a>=11&&a<=14?'реперов':u===1?'репер':u>=2&&u<=4?'репера':'реперов';
  tooltip.querySelector('strong').textContent=selected+' баллов';
  tooltip.querySelector('span').textContent=(normal?'Факт: ':'')+fmt(count)+' '+word;
  const model=tooltip.querySelector('.sd-tooltip-model');
  const expected=Math.round(bin.expected),last=expected%10,lastTwo=expected%100;
  const expectedWord=lastTwo>=11&&lastTwo<=14?'реперов':last===1?'репер':last>=2&&last<=4?'репера':'реперов';
  model.hidden=!normal;model.textContent=normal?'По Гауссу: '+fmt(expected)+' '+expectedWord:'';
  tooltip.hidden=false;positionTooltip();
 }
 root.ownerDocument.addEventListener('pointerdown',e=>{if(!tooltip.hidden&&!tooltip.contains(e.target)&&!e.target.closest?.('[data-sd-bin]'))closeTooltip();});
 root.addEventListener('keydown',e=>{if(e.key==='Escape')closeTooltip();});
 $('.sd-chartbox').addEventListener('scroll',positionTooltip,{passive:true});
 function updateValues(){
  const d=current();if(!d.curve)normal=false;
  const b=d.bins.find(b=>b.score===selected);
  $('#sd-selected-score').textContent=selected+' баллов';
  $('#sd-selected-count').textContent=!d.n?'—':normal?`Факт: ${fmt(b.count)} · Модель: ${fmt(b.expected,1)} · Разница: ${signed(b.count-b.expected)}`:`${fmt(b.count)} МС · ${pct(b.share)}`;
  root.querySelectorAll('[data-sd-group]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.sdGroup===group)));
  $('[data-sd-model]').setAttribute('aria-checked',String(normal));$('[data-sd-model]').disabled=!d.curve;
  $('[data-sd-model-state]').textContent=normal?'Вкл':'Выкл';
  $('.sd-unavailable').hidden=!!d.n;
  $('.sd-unavailable').textContent='Пока нет полностью отсуженных участников для этой выборки.';
  $('.sd-plot').hidden=!d.n;
  root.querySelectorAll('[data-sd-score]').forEach(el=>el.classList.toggle('sd-selected-bar',+el.dataset.sdScore===selected));
  root.querySelectorAll('[data-sd-bin]').forEach(el=>el.setAttribute('aria-pressed',String(+el.dataset.sdBin===selected)));
 }
 function chart(){
  closeTooltip();const svg=$('#sd-chart'),d=current();if(!d.n){svg.innerHTML='';return;}
  // A minimum 44 px slot keeps every discrete sum reachable by touch on mobile.
  const W=Math.max(934,Math.round(svg.parentElement.clientWidth)),H=306,L=0,R=10,T=26,B=39,plotH=H-T-B,slot=(W-L-R)/21;
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.style.width=W+'px';svg.style.height=H+'px';
  const value=n=>n,top=Math.max(1,...d.bins.flatMap(b=>normal?[value(b.count),value(b.expected)]:[value(b.count)]))*1.14;
  const y=v=>H-B-v/top*plotH,safe=n=>n.toFixed(2);let parts=[],axis=[];
  for(let i=0;i<=4;i++){const v=top*i/4,yy=y(v);parts.push(`<path d="M${L} ${safe(yy)} H${W-R}" class="sd-grid"/>`);axis.push(`<text x="49" y="${safe(yy+4)}" text-anchor="end">${fmt(v)}</text>`);}
  const boundary=L+10*slot;
  parts.push(`<line x1="${safe(boundary)}" x2="${safe(boundary)}" y1="${T}" y2="${H-B}" class="sd-threshold"/><text x="${safe(boundary+7)}" y="15" class="sd-threshold-label">Проход от 15</text>`);
  for(const [i,b]of d.bins.entries()){
   const x=L+i*slot,bar=(n,offset,width,cls)=>`<rect data-sd-score="${b.score}" data-sd-value="${n}" x="${safe(x+offset*slot)}" y="${safe(y(value(n)))}" width="${safe(slot*width)}" height="${safe(H-B-y(value(n)))}" class="${cls}${b.score===selected?' sd-selected-bar':''}"/>`;
   parts.push(bar(b.count,.1,normal?.48:.8,b.score<15?'sd-low':'sd-high'));
   if(normal)parts.push(bar(b.expected,.62,.28,'sd-model-bar'));
   parts.push(`<text x="${safe(x+slot/2)}" y="${H-14}" text-anchor="middle">${b.score}</text>`);
  }
  for(const [i,b]of d.bins.entries()){
   const label=`${b.score} баллов: фактически ${fmt(b.count)} МС, ${pct(b.share)}${normal?`, по модели ${fmt(b.expected,1)} МС, разница ${signed(b.count-b.expected)} МС`:''}`;
   parts.push(`<rect x="${safe(L+i*slot)}" y="${T}" width="${safe(slot)}" height="${plotH}" class="sd-hit" tabindex="${b.score===selected?0:-1}" role="button" aria-pressed="${b.score===selected}" data-sd-bin="${b.score}" aria-label="${esc(label)}"></rect>`);
  }
  svg.innerHTML=parts.join('');$('.sd-y-axis').innerHTML=axis.join('');
  svg.querySelectorAll('[data-sd-bin]').forEach(el=>{
   const score=+el.dataset.sdBin;
   const choose=()=>{selected=score;updateValues();svg.querySelectorAll('[data-sd-bin]').forEach(b=>b.setAttribute('tabindex',+b.dataset.sdBin===score?'0':'-1'));};
   el.onclick=()=>{choose();showTooltip();};el.onfocus=()=>{const wasOpen=!tooltip.hidden;choose();revealSelected();if(wasOpen)showTooltip();};
   el.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();choose();showTooltip();}else if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const target=e.key==='Home'?5:e.key==='End'?25:Math.max(5,Math.min(25,score+(e.key==='ArrowRight'?1:-1)));svg.querySelector(`[data-sd-bin="${target}"]`).focus();}};
  });
 }
 function revealSelected(){const box=$('.sd-chartbox'),el=$(`[data-sd-bin="${selected}"]`);if(!el)return;const a=el.getBoundingClientRect(),b=box.getBoundingClientRect();if(a.left<b.left||a.right>b.right)box.scrollLeft+=a.left-b.left-box.clientWidth/2+a.width/2;}
 function update(){updateValues();chart();revealSelected();}
 root.querySelectorAll('[data-sd-group]').forEach(b=>b.onclick=()=>{group=b.dataset.sdGroup;selected=current().modes[0]??15;update();});
 $('[data-sd-model]').onclick=()=>{normal=!normal;update();};
 const observer=new ResizeObserver(()=>{if(root.isConnected&&root.offsetParent!==null){chart();revealSelected();}});observer.observe($('.sd-chartbox'));
 selected=current().modes[0]??15;update();
 return {draw(){chart();revealSelected();}};
}
