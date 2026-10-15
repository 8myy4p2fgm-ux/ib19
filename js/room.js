// Presentation only: no data, routing or analytics dependencies.
const header=document.querySelector('.site-header');
const wall=document.createElement('div');
wall.className='room-wall';
wall.setAttribute('aria-hidden','true');
wall.innerHTML='<div class="room-layer room-on"></div><div class="room-layer room-off"></div>';
const mobile=matchMedia('(max-width:760px)');
const images=new Map();
function loadPhoto(state,quality){
 const small=mobile.matches,key=(small?'mobile-':'')+state+'-'+quality;
 if(!images.has(key)){
  const image=new Image();
  image.fetchPriority='low';
  image.src=new URL('../css/assets/room-'+(small?'mobile-':'')+'light-'+state+(quality==='preview'?'-preview':'')+'.webp',import.meta.url).href;
  images.set(key,image.decode().catch(error=>{images.delete(key);throw error;}));
 }
 images.get(key).then(()=>{
  if(mobile.matches===small)wall.classList.add('room-'+state+'-'+quality+'-ready');
 }).catch(()=>{}); // The room is decorative; failed images cannot block analytics.
}
function preparePhotos(state){loadPhoto(state,'preview');loadPhoto(state,'full');}
mobile.addEventListener('change',()=>{
 wall.classList.remove('room-on-preview-ready','room-on-full-ready','room-off-preview-ready','room-off-full-ready');
 preparePhotos(document.body.dataset.roomLight||'on');
});
// Fetch images at low priority while analytics loads; insert the wall only when the UI is ready.
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
function setLight(on,persist=true){
 preparePhotos(on?'on':'off');
 document.body.dataset.roomLight=on?'on':'off';
 if(persist)try{localStorage.setItem('tuz19-room-light',on?'on':'off');}catch{}
 for(const button of [wallSwitch,mobileSwitch]){
  button.setAttribute('aria-checked',String(on));
  button.title=on?'Выключить свет':'Включить свет';
 }
 mobileSwitch.textContent=on?'Свет: вкл.':'Свет: выкл.';
}
for(const button of [wallSwitch,mobileSwitch])button.addEventListener('click',()=>setLight(document.body.dataset.roomLight!=='on'));
let savedLight='on';
try{savedLight=localStorage.getItem('tuz19-room-light')||'on';}catch{}
setLight(savedLight!=='off',false);
// Native sticky keeps the header in normal flow and never changes its dimensions.
new ResizeObserver(()=>{
 const height=header.getBoundingClientRect().height;
 if(height)document.documentElement.style.setProperty('--site-header-height',height+'px');
}).observe(header);
