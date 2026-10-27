import {DatabaseSync} from 'node:sqlite';
// Node-only simulator of the documented runtime auto-response and attachment
// contract. Actual workerd behavior is independently exercised in runtime tests.
globalThis.WebSocketRequestResponsePair??=class {constructor(request,response){this.request=request;this.response=response;}getRequest(){return this.request;}getResponse(){return this.response;}};
export function harness(Room,{db=new DatabaseSync(':memory:'),sockets=[],times=new Map()}={}){
 let alarm,pair;const metrics={statements:0,changedRows:0,alarmWrites:0,handlerCalls:0};
 const sql={exec(query,...args){let result=[];const parts=query.split(';').filter(s=>s.trim());for(const q of parts){const before=db.prepare('SELECT total_changes() AS n').get().n;result=db.prepare(q).all(...(parts.length===1?args:[]));if(/^\s*(INSERT|UPDATE|DELETE)/i.test(q))metrics.statements++;metrics.changedRows+=db.prepare('SELECT total_changes() AS n').get().n-before;}return result;}};
 const ctx={storage:{sql,async getAlarm(){return alarm;},async setAlarm(t){metrics.alarmWrites++;alarm=t;},async deleteAlarm(){alarm=null;}},getWebSockets:()=>sockets.filter(s=>!s.closed),setWebSocketAutoResponse(p){pair=p;},getWebSocketAutoResponseTimestamp:s=>times.has(s)?new Date(times.get(s)):null};
 const env={ADMIN_TOKEN:'test-admin-token-at-least-32-chars',CHAT_ENABLED:'true'};let room=new Room(ctx,env);
 const api={db,ctx,env,sockets,times,metrics,get room(){return room;},get alarm(){return alarm;},reset(){for(const k of Object.keys(metrics))metrics[k]=0;},recreate(){room=new Room(ctx,env);return room;},socket(network='net'){let a={network,opened:Date.now()};const out=[];const ws={out,deserializeAttachment:()=>a,serializeAttachment:v=>{a=v;},send(raw){out.push(JSON.parse(raw));},close(code){this.closed=true;this.code=code;}};sockets.push(ws);return ws;},async send(ws,data){const raw=JSON.stringify(data);if(pair&&raw===pair.getRequest()){times.set(ws,Date.now());ws.send(pair.getResponse());return;}metrics.handlerCalls++;await room.webSocketMessage(ws,raw);},async closeSocket(ws){await room.webSocketClose(ws);ws.closed=true;},close(){db.close();}};
 return api;
}
