import {subscribePresence} from './chat-public-presence.js';
const enabled=document.querySelector('meta[name="tuz19-chat-enabled"]')?.content==='true';
let link=document.querySelector('.site-header .nav-chat');
if(enabled&&!link){link=document.createElement('a');link.className='nav-chat';link.href='/chat/';document.querySelector('.shell-header-tools')?.prepend(link);}
if(enabled&&link){
const active=()=>link.setAttribute('aria-current',document.body.classList.contains('chat-active')?'page':'false');active();window.addEventListener('ib19:route',active);
const label=document.createElement('span');label.textContent='Чат';const badge=document.createElement('span');badge.className='chat-nav-count';badge.textContent='● …';link.replaceChildren(label,badge);
subscribePresence(state=>{const valid=state&&!state.error;badge.textContent='● '+(valid?state.count:'—');badge.classList.toggle('unavailable',!valid);link.setAttribute('aria-label',valid?'Чат, участников онлайн: '+state.count:'Чат, онлайн пока недоступен');link.title=valid?'Состояние на '+new Date(state.updatedAt).toLocaleTimeString('ru-RU'):'Не удалось получить список участников';});

}
