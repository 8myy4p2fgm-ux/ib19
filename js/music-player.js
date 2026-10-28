import {validKey,moveItem,shuffleItems} from './music-model.js';
// Resolver is injected by the application. No source/preload before a user action.
export function createMusicPlayer({audio=document.createElement('audio'),resolveSource=()=>null,onChange=()=>{}}={}){
 audio.preload='none';let queue=[],index=-1,repeat='off',shuffle=false,status='Выберите трек',error='',generation=0;
 const state=()=>({queue:[...queue],index,key:queue[index]??null,repeat,shuffle,status,error,paused:audio.paused,currentTime:audio.currentTime,duration:Number.isFinite(audio.duration)?audio.duration:null,volume:audio.volume});
 const emit=()=>onChange(state());
 const stop=()=>{generation++;audio.pause();audio.removeAttribute('src');audio.load();};
 async function start(i){
  if(i<0||i>=queue.length)return;stop();index=i;error='';const ticket=generation,source=resolveSource(queue[index]);
  if(!source){status='Аудио отключено или источник трека недоступен.';emit();return;}
  audio.src=source;status='Загрузка…';emit();try{await audio.play();if(ticket!==generation)return;status='Воспроизводится';}catch(e){if(ticket!==generation)return;error=e.name==='NotAllowedError'?'Нажмите Play, чтобы разрешить воспроизведение.':'Аудио недоступно. Выберите следующий трек.';status='Воспроизведение остановлено';}emit();
 }
 function step(delta,{ended=false}={}){
  if(!queue.length)return;
  if(ended&&repeat==='one'){start(index);return;}
  let next=index+delta;
  if(shuffle&&delta>0&&queue.length>1){const options=queue.map((_,i)=>i).filter(i=>i!==index);next=options[Math.floor(Math.random()*options.length)];}
  if(next>=queue.length){if(repeat==='all')next=0;else{status='Очередь закончилась';emit();return;}}
  if(next<0)next=repeat==='all'?queue.length-1:0;start(next);
 }
 for(const event of ['timeupdate','durationchange','loadedmetadata','seeked','volumechange','pause','playing'])audio.addEventListener(event,emit);
 audio.addEventListener('ended',()=>step(1,{ended:true}));audio.addEventListener('error',()=>{error='Аудио недоступно. Выберите следующий трек.';status='Ошибка аудио';emit();});
 return {audio,state,
  enqueue(key){if(!validKey(key))return false;if(queue.length>=1000)return false;queue.push(key);emit();return true;},
  replace(keys,{mix=false}={}){if(!keys.length||keys.length>1000||!keys.every(validKey))return;queue=mix?shuffleItems(keys):[...keys];start(0);},
  start,
  playKey(key){if(!validKey(key))return;let i=queue.indexOf(key);if(i<0){if(queue.length>=1000)return;queue.push(key);i=queue.length-1;}start(i);},
  toggle(){if(index<0){if(queue.length)start(0);return;}if(!audio.paused){audio.pause();status='Пауза';emit();}else if(!audio.getAttribute('src'))start(index);else{const ticket=generation;audio.play().then(()=>{if(ticket===generation){status='Воспроизводится';emit();}}).catch(()=>{if(ticket===generation){error='Не удалось продолжить. Нажмите Play или выберите следующий трек.';emit();}});}},
  next(){step(1);},previous(){if(audio.currentTime>3){audio.currentTime=0;emit();}else step(-1);},
  seek(seconds){if(Number.isFinite(audio.duration))audio.currentTime=Math.max(0,Math.min(audio.duration,seconds));},
  volume(value){audio.volume=Math.max(0,Math.min(1,value));},
  setRepeat(){repeat=({off:'all',all:'one',one:'off'})[repeat];emit();},
  setShuffle(){shuffle=!shuffle;emit();},
  mix(){const active=queue[index];queue=shuffleItems(queue);index=active?queue.indexOf(active):-1;emit();},
  move(i,delta){const target=i+delta;if(i<0||i>=queue.length||target<0||target>=queue.length)return;queue=moveItem(queue,i,delta);if(index===i)index=target;else if(index===target)index=i;emit();},
  remove(i){if(i<0||i>=queue.length)return;if(i===index){stop();index=-1;status='Трек удалён из очереди';}else if(i<index)index--;queue.splice(i,1);emit();},
  clear(){stop();queue=[];index=-1;error='';status='Очередь пуста';emit();},
  destroy(){stop();audio.remove();}
 };
}
