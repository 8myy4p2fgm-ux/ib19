// One shared provider per document. No spectator WebSocket or user session.
const INTERVAL=30000,MAX_AGE=45000,KEY='chat03:public';
const listeners=new Set();let state=null,timer,inflight,controller,socketActive=false,lastAttempt=0,failures=0;
function publish(value){state=value;for(const listener of listeners)listener(value);}
function save(value){try{sessionStorage.setItem(KEY,JSON.stringify(value));}catch{}}
try{const cached=JSON.parse(sessionStorage.getItem(KEY));if(cached&&Date.now()-cached.updatedAt<MAX_AGE&&Array.isArray(cached.users))state=cached;}catch{}
function plan(delay=INTERVAL){clearTimeout(timer);if(!socketActive&&!document.hidden&&listeners.size)timer=setTimeout(refresh,delay);}
export function refreshPublicPresence(){return refresh();}
async function refresh(){
 clearTimeout(timer);if(socketActive||document.hidden||!listeners.size)return;
 if(inflight)return inflight;
 const wait=lastAttempt+INTERVAL-Date.now();if(wait>0){plan(wait);return;}
 lastAttempt=Date.now();controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),8000);
 inflight=(async()=>{
  try{
   const response=await fetch('/api/chat/presence',{credentials:'same-origin',cache:'no-store',signal:controller.signal});
   if(!response.ok)throw Error('Status unavailable');const data=await response.json();
   if(!Array.isArray(data.users)||data.users.some(n=>typeof n!=='string'||n.length>48)||!Number.isInteger(data.count)||data.count!==data.users.length||!Number.isFinite(data.updatedAt))throw Error('Invalid status');
   if(socketActive)return;
   const value={users:data.users,count:data.count,updatedAt:data.updatedAt,error:false};save(value);publish(value);failures=0;
  }catch{if(!socketActive){publish({error:true});failures++;}}
  finally{clearTimeout(timeout);inflight=null;plan(Math.min(120000,INTERVAL*2**failures));}
 })();return inflight;
}
export function subscribePresence(listener){listeners.add(listener);listener(state);if(listeners.size===1){if(state)plan(Math.max(0,INTERVAL-(Date.now()-state.updatedAt)));else refresh();}return()=>{listeners.delete(listener);if(!listeners.size){clearTimeout(timer);controller?.abort();}};}
export function useSocketPresence(users){const value={users,count:users.length,updatedAt:Date.now(),error:false};save(value);publish(value);}
export function setSocketPresenceActive(active){
 socketActive=active;clearTimeout(timer);
 if(active){controller?.abort();return;}
 // A connection/leave transition may revalidate once after a 5s cooldown;
 // ordinary page loads and visibility changes retain the 30s shared cadence.
 publish(null);try{sessionStorage.removeItem(KEY);}catch{}
 lastAttempt=Math.min(lastAttempt,Date.now()-INTERVAL+5000);plan(Math.max(0,lastAttempt+INTERVAL-Date.now()));
}
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(timer);controller?.abort();}else refresh();});
window.addEventListener('pagehide',()=>{clearTimeout(timer);controller?.abort();});
window.addEventListener('pageshow',e=>{if(e.persisted)refresh();});
