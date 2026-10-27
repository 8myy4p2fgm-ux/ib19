import {subscribePresence,useSocketPresence,setSocketPresenceActive} from './chat-public-presence.js';
import {renderSmilies,setupSmileyPicker} from './chat-smilies.js';
const $=id=>document.getElementById(id),log=$('chat-log');
const store={get(key){try{return sessionStorage.getItem('chat01:'+key);}catch{return null;}},set(key,value){try{if(value==null)sessionStorage.removeItem('chat01:'+key);else sessionStorage.setItem('chat01:'+key,value);}catch{}}};
let ws,heartbeat,retry,retryCount=0,joined=false,stopped=true,token=store.get('token'),nick=store.get('nick')||'',lastPong=0,reconnectAfter=0,syncCursor=0,deletionCursor=0,initialized=false,syncing=false,syncTimer,syncRequest,targets,liveHigh=0,liveDeletion=0,draftVersion=0;
const messages=new Map();let pending;try{pending=JSON.parse(store.get('pending'));}catch{}
$('nickname').value=nick;
const palette=['#cdb184','#9fc5b3','#b7b1db','#d2a9af','#a9bdd5','#b8c896'];
function color(n){let h=0;for(const c of n)h=(h*31+c.codePointAt(0))>>>0;return palette[h%palette.length];}
function send(data){if(ws?.readyState===WebSocket.OPEN){ws.send(JSON.stringify(data));return true;}return false;}
function bottom(){return log.scrollHeight-log.scrollTop-log.clientHeight<55;}
function scrollBottom(){log.scrollTop=log.scrollHeight;$('new-messages').hidden=true;}
function draw({older=false,notify=false}={}){
 const near=bottom(),height=log.scrollHeight,top=log.scrollTop,fragment=document.createDocumentFragment();
 for(const row of [...messages.values()].sort((a,b)=>a.id-b.id)){
  const item=document.createElement('div');item.className='chat-row '+(row.kind==='system'?'system':'')+(row.deleted?' deleted':'');item.dataset.id=row.id;
  const time=document.createElement('time');time.dateTime=new Date(row.ts).toISOString();time.title=new Date(row.ts).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'});time.textContent=new Date(row.ts).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Moscow'});item.append(time);
  if(row.kind!=='system'){const name=document.createElement('span');name.className='chat-nick';name.style.color=color(row.nick);name.textContent=row.nick+':';item.append(name);}
  const body=document.createElement('span');body.className=row.kind==='system'?'system-body':'message-body';if(!row.deleted&&row.kind==='user')renderSmilies(body,row.body);else body.textContent=row.deleted?'Сообщение удалено модератором.':'*** '+row.body;item.append(body);fragment.append(item);
 }
 log.replaceChildren(fragment);
 if(older)log.scrollTop=top+log.scrollHeight-height;else if(near)scrollBottom();else{log.scrollTop=top;if(notify)$('new-messages').hidden=false;}
}
function merge(rows,options={}){const max=Math.max(0,...messages.keys()),notify=rows.some(r=>r.id>max);for(const row of rows)messages.set(row.id,row);expire();draw({...options,notify});}
function expire(before=Date.now()-86400000){for(const [id,m] of messages)if(m.ts<=before)messages.delete(id);}
function queuePending(){if(pending&&joined)send({type:'message',id:pending.id,text:pending.text});}
function requestSync(delay=0){clearTimeout(syncTimer);syncTimer=setTimeout(()=>{if(!joined||!syncing)return;syncRequest=crypto.randomUUID();send({type:'sync',after:syncCursor,deletionsAfter:deletionCursor,...targets,requestId:syncRequest});},delay);}
function removeMessages(ids){for(const id of ids){const row=messages.get(id);if(row){row.deleted=true;row.body=null;}}}
$('message').addEventListener('input',()=>draftVersion++);
function error(text){$('chat-error').textContent=text;}
function reset(){
 stopped=true;joined=false;initialized=false;syncing=false;syncCursor=0;deletionCursor=0;clearTimeout(syncTimer);setSocketPresenceActive(false);$('public-room').hidden=false;clearTimeout(retry);clearInterval(heartbeat);ws?.close();ws=null;token=null;pending=null;messages.clear();store.set('token',null);store.set('pending',null);$('room').hidden=true;$('join-form').hidden=false;$('leave').hidden=true;$('connection').textContent='Вы вышли из чата';$('online-count').textContent='…';$('online-list').replaceChildren();
}
function connect(){
 if(stopped)return;clearTimeout(retry);clearInterval(heartbeat);joined=false;setSocketPresenceActive(false);$('send').disabled=true;$('connection').textContent='Подключение…';
 clearTimeout(syncTimer);syncing=initialized;reconnectAfter=initialized;
 const socket=new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/api/chat/socket`);ws=socket;
 socket.onopen=()=>send({type:'join',nick,token});
 socket.onmessage=event=>{
  if(ws!==socket)return;
  const d=JSON.parse(event.data);
  if(d.type==='joined'){
   joined=true;setSocketPresenceActive(true);$('public-room').hidden=true;retryCount=0;token=d.token;nick=d.nick;store.set('token',token);store.set('nick',nick);$('nickname').value=nick;
   $('join-form').hidden=true;$('room').hidden=false;$('leave').hidden=false;$('connection').textContent='В сети · #tuz19';$('own-nick').textContent=nick;$('send').disabled=false;error('');lastPong=Date.now();
   heartbeat=setInterval(()=>{if(Date.now()-lastPong>65000){socket.close();return;}send({type:'ping'});expire();draw();},d.heartbeat);
   queuePending();
  }else if(d.type==='pong')lastPong=Date.now();
  else if(d.type==='history'){
   merge(d.messages,{older:!d.initial});$('older').disabled=!d.more;
   if(d.initial){targets={until:d.highWatermark,deletionUntil:d.deletionWatermark};liveHigh=d.highWatermark;liveDeletion=d.deletionWatermark;if(!initialized){syncCursor=d.highWatermark;deletionCursor=d.deletionWatermark;initialized=true;syncing=false;scrollBottom();}else requestSync();}
  }else if(d.type==='sync'){
   if(d.requestId!==syncRequest)return;error('');merge(d.messages);if(d.deletedIds?.length){removeMessages(d.deletedIds);draw();}syncCursor=d.nextAfter;deletionCursor=d.nextDeletionCursor;if(d.more)requestSync(1100);else{syncing=false;syncCursor=Math.max(syncCursor,liveHigh);deletionCursor=Math.max(deletionCursor,liveDeletion);}
  }else if(d.type==='message'){merge([d.message]);if(syncing)liveHigh=Math.max(liveHigh,d.message.id);else syncCursor=Math.max(syncCursor,d.message.id);}
  else if(d.type==='ack'){
   merge([d.message]);if(pending?.id===d.id){if(pending.draftVersion===draftVersion&&$('message').value===pending.text)$('message').value='';pending=null;store.set('pending',null);error('');}
  }else if(d.type==='delete'){removeMessages([d.id]);draw();if(syncing)liveDeletion=Math.max(liveDeletion,d.deletionCursor||0);else deletionCursor=Math.max(deletionCursor,d.deletionCursor||0);}
  else if(d.type==='presence'){
   useSocketPresence(d.users);$('online-count').textContent=d.users.length;
   $('online-list').replaceChildren(...d.users.map(n=>{const li=document.createElement('li');li.textContent=n;li.style.color=color(n);return li;}));
  }else if(d.type==='expire'){expire(d.before);draw();}
  else if(d.type==='error'){
   error(d.error);if(d.command==='message'&&d.code==='invalid_message'&&pending?.id===d.id){pending=null;store.set('pending',null);}if(d.command==='history')$('older').disabled=false;if(d.command==='sync'&&syncing&&d.requestId===syncRequest)requestSync(Math.max(1100,d.retryAfterMs||0)+100);if(!joined){stopped=true;socket.close();$('join-form').hidden=false;$('room').hidden=true;$('connection').textContent='Вход не выполнен';}
  }
 };
 socket.onclose=e=>{
  if(ws!==socket)return;clearInterval(heartbeat);clearTimeout(syncTimer);joined=false;$('send').disabled=true;
  if(stopped)return;
  if(e.code===4000||e.code===4001){reset();error('Сессия завершена. Можно войти снова.');return;}
  $('connection').textContent='Нет связи · переподключаемся…';
  retry=setTimeout(connect,Math.min(15000,1000*2**Math.min(retryCount++,4)));
 };
 socket.onerror=()=>error('Нет связи с комнатой. Проверьте подключение.');
}
$('join-form').addEventListener('submit',event=>{event.preventDefault();nick=$('nickname').value.trim();if(store.get('nick')!==nick)token=null;stopped=false;error('');connect();});
$('composer').addEventListener('submit',event=>{
 event.preventDefault();if(!joined){error('Подождите восстановления связи.');return;}
 const text=$('message').value;if(!text.trim())return;
 if([...text].length>500){error('До 500 символов.');return;}
 if(pending&&pending.text!==text){error('Сначала повторите отправку предыдущего сообщения.');return;}
 pending??={id:crypto.randomUUID(),text,draftVersion};store.set('pending',JSON.stringify(pending));queuePending();
});
$('message').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();$('composer').requestSubmit();}});
$('leave').addEventListener('click',()=>{send({type:'leave'});reset();});
$('older').addEventListener('click',()=>{const first=Math.min(...messages.keys());if(Number.isFinite(first)){$('older').disabled=true;send({type:'history',before:first});}});
$('online-toggle').addEventListener('click',()=>{const open=$('online-panel').classList.toggle('open');$('online-toggle').setAttribute('aria-expanded',String(open));});
$('new-messages').addEventListener('click',scrollBottom);log.addEventListener('scroll',()=>{if(bottom())$('new-messages').hidden=true;});
window.addEventListener('online',()=>{if(!stopped&&ws?.readyState!==WebSocket.OPEN)connect();});
window.addEventListener('pagehide',()=>{clearInterval(heartbeat);clearTimeout(retry);ws?.close();});
window.addEventListener('pageshow',event=>{if(event.persisted&&!stopped)connect();});
if(pending){$('message').value=pending.text;pending.draftVersion=draftVersion;}
if(nick&&token){stopped=false;connect();}

subscribePresence(state=>{
 const valid=state&&!state.error;
 $('public-count').textContent=valid?'· '+state.count:'· —';
 $('public-state').textContent=!state?'Получаем список участников…':state.error?'Не удалось получить список участников':state.count?'Участников: '+state.count:'Пока никого нет. Можешь быть первым';
 $('public-users').replaceChildren(...(valid?state.users:[]).map(n=>{const li=document.createElement('li');li.textContent=n;li.style.color=color(n);return li;}));
 $('public-updated').textContent=valid?'Актуально на '+new Date(state.updatedAt).toLocaleTimeString('ru-RU',{timeZone:'Europe/Moscow'}):'';
 if(!joined)$('online-count').textContent=valid?state.count:'—';
});
setupSmileyPicker();
