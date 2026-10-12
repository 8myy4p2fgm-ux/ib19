export function createCharts({daily,fmt,$}){
const chartTooltip=document.createElement('div');chartTooltip.className='chart-tip';document.body.appendChild(chartTooltip);
function attachChartTip(svg,series,times,L,R,xFn){
  svg.onpointermove=ev=>{
    const pt=svg.createSVGPoint();pt.x=ev.clientX;pt.y=ev.clientY;
    const ctm=svg.getScreenCTM();if(!ctm)return;
    const loc=pt.matrixTransform(ctm.inverse());if(loc.x<L||loc.x>R){chartTooltip.style.display='none';return}
    chartTooltip.classList.toggle('home-chart-tip',svg.id==='chart-main');
    let lo=0,hi=times.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(xFn(mid instanceof Object?mid:times[mid])<loc.x)lo=mid+1;else hi=mid}
    let i=lo;if(i>0&&Math.abs(xFn(times[i-1])-loc.x)<Math.abs(xFn(times[i])-loc.x))i--;
    const date=new Date(times[i]).toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Europe/Moscow'});
    chartTooltip.innerHTML='<strong>'+date+'</strong>'+series.map(a=>{const v=a.values[i];return Number.isFinite(v)&&!svg.hiddenSeries?.has(a.name)?'<div><span style="color:'+a.color+'">●</span> '+a.name+': <b>'+(a.format?a.format(v):a.precision==='exact'?v.toLocaleString('ru-RU',{maximumSignificantDigits:17}):fmt(v,a.name==='Форум'||a.name==='Остальные'||a.name.includes('оцен')||a.name==='Факт'||a.name==='Прогноз'||a.name==='Нужный темп'?0:1))+'</b></div>':''}).join('');
    chartTooltip.style.display='block';chartTooltip.style.left=Math.max(8,Math.min(ev.clientX+14,window.innerWidth-chartTooltip.offsetWidth-10))+'px';chartTooltip.style.top=Math.max(8,Math.min(ev.clientY+14,window.innerHeight-chartTooltip.offsetHeight-8))+'px';
  };svg.onclick=svg.onpointermove;svg.onpointerleave=()=>chartTooltip.style.display='none';
}

return {attachChartTip,chartTooltip};
}

