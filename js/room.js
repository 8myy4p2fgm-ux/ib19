// Presentation only: no data, routing or analytics dependencies.
const header=document.querySelector('.site-header');
const wall=document.createElement('div');
wall.className='room-wall';
wall.setAttribute('aria-hidden','true');
wall.innerHTML='<div class="room-layer room-on"></div><div class="room-layer room-off"></div>';
// Analytics gets the connection first; decorative images must not delay startup.
const app=document.querySelector('.app');
function showRoom(){
 if(app.hidden)return;
 document.body.prepend(wall);
 readiness.disconnect();
}
const readiness=new MutationObserver(showRoom);
readiness.observe(app,{attributes:true,attributeFilter:['hidden']});
showRoom();
function lightControl(className){
 const button=document.createElement('button');
 button.type='button';button.className=className;
 button.setAttribute('role','switch');button.setAttribute('aria-label','Свет в комнате');
 return button;
}
const wallSwitch=lightControl('room-switch'),mobileSwitch=lightControl('room-mobile-light');
document.querySelector('.app').append(wallSwitch);
header.querySelector('.site-brand').after(mobileSwitch);
function setLight(on){
 if(!on)document.body.classList.add('room-off-ready');
 document.body.dataset.roomLight=on?'on':'off';
 for(const button of [wallSwitch,mobileSwitch]){
  button.setAttribute('aria-checked',String(on));
  button.title=on?'Выключить свет':'Включить свет';
 }
 mobileSwitch.textContent=on?'Свет: вкл.':'Свет: выкл.';
}
for(const button of [wallSwitch,mobileSwitch])button.addEventListener('click',()=>setLight(document.body.dataset.roomLight!=='on'));
setLight(true);
// Native sticky keeps the header in normal flow and never changes its dimensions.
new ResizeObserver(()=>{
 const height=header.getBoundingClientRect().height;
 if(height)document.documentElement.style.setProperty('--site-header-height',height+'px');
}).observe(header);
