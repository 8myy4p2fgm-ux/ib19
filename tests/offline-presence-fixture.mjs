// UI-only fixtures. Production API/CORS/WebSocket tests keep their independent service harness.
export function isOfflinePresence(route){const u=new URL(route.request().url());return ['localhost','127.0.0.1','[::1]'].includes(u.hostname)&&u.pathname==='/api/chat/presence';}
export function replyPresence(route){return route.fulfill({json:{users:[],count:0,updatedAt:Date.now()}});}
