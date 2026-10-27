import {maintenanceHTML, formHTML} from './pages.mjs';

const COOKIE = '__Host-tuz19_session';
const HOURS8 = 8 * 60 * 60;
const encoder = new TextEncoder();
const hosts = new Set(['tuz19.ru', 'www.tuz19.ru']);
const encode = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
const decode = value => Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));

function response(body, status = 200, extra = {}) {
  const headers = new Headers(extra);
  headers.set('Cache-Control', 'private, no-store');
  headers.set('CDN-Cache-Control', 'no-store');
  headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
  headers.set('Vary', 'Cookie');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'same-origin');
  headers.set('X-Frame-Options', 'DENY');
  return new Response(body, {status, headers});
}
function page(body, status = 200) {
  return response(body, status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  });
}
const cookie = (value, age) => `${COOKIE}=${value}; Max-Age=${age}; Path=/; Secure; HttpOnly; SameSite=Strict`;
const redirect = (path, value) => response(null, 303, {Location: path, ...(value ? {'Set-Cookie': value} : {})});
async function key(secret) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign', 'verify']);
}
async function passwordMatches(actual, expected) {
  const digest = value => crypto.subtle.digest('SHA-256', encoder.encode(value));
  const a = new Uint8Array(await digest(actual)), b = new Uint8Array(await digest(expected));
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}
async function session(secret, now) {
  const issued = Math.floor(now / 1000);
  const payload = encode(encoder.encode(JSON.stringify({iat: issued, exp: issued + HOURS8, nonce: crypto.randomUUID()})));
  return payload + '.' + encode(await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(payload)));
}
async function authorized(request, secret, now) {
  try {
    const entries = (request.headers.get('Cookie') || '').split(';').map(s => s.trim()).filter(s => s.startsWith(COOKIE + '='));
    if (entries.length !== 1 || entries[0].length > 1024) return false;
    const parts = entries[0].slice(COOKIE.length + 1).split('.');
    if (parts.length !== 2 || !parts.every(s => /^[A-Za-z0-9_-]+$/.test(s))) return false;
    if (!await crypto.subtle.verify('HMAC', await key(secret), decode(parts[1]), encoder.encode(parts[0]))) return false;
    const value = JSON.parse(new TextDecoder().decode(decode(parts[0]))), seconds = Math.floor(now / 1000);
    return Number.isInteger(value.iat) && Number.isInteger(value.exp) && value.iat <= seconds && value.exp > seconds && value.exp - value.iat === HOURS8 && /^[\w-]{16,64}$/.test(value.nonce) ? {until:value.exp*1000,session:value.nonce} : null;
  } catch { return false; }
}

// Only this authenticated gateway writes access context. Never forward the owner cookie.
function chatRequest(request,access,{revoke=false}={}){
 const headers=new Headers(request.headers);
 for(const name of [...headers.keys()])if(name.toLowerCase().startsWith('x-chat-'))headers.delete(name);
 headers.delete('Cookie');
 if(revoke||new URL(request.url).pathname!=='/api/chat/admin')headers.delete('Authorization');
 headers.set('X-Chat-Access-Until',String(access.until));headers.set('X-Chat-Access-Session',access.session);
 if(revoke){for(const name of ['Content-Length','Content-Type','Transfer-Encoding','Content-Encoding'])headers.delete(name);headers.set('Origin',new URL(request.url).origin);headers.set('X-Chat-Gateway-Action','revoke');return new Request(new URL('/api/chat/_gateway/revoke',request.url),{method:'POST',headers});}
 return new Request(request,{headers});
}
function chatHeaders(headers,origin){
 headers.set('Content-Security-Policy',`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' wss://${new URL(origin).host}; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'`);
}

export function createHandler({upstream = fetch, now = Date.now, allowedHosts = hosts} = {}) {
  return async function handle(request, env) {
    try {
      const url = new URL(request.url);
      if (!allowedHosts.has(url.hostname)) return response('Not found', 404);
      if (url.protocol !== 'https:') return response(null, 308, {Location: `https://${url.host}${url.pathname}${url.search}`});
      // A missing secret/binding must never expose the origin.
      if (!env.OWNER_PASSWORD || !env.SESSION_KEY || env.SESSION_KEY.length < 32 || !env.LOGIN_LIMITER?.limit) return response('Service unavailable', 503);
      // Canonical host also makes the __Host- cookie work consistently.
      if (url.hostname === 'www.tuz19.ru') return response(null, 308, {Location: `https://tuz19.ru${url.pathname}${url.search}`});
      const login = url.pathname === '/admin-login', logout = url.pathname === '/admin-logout';
      if (login || logout) {
        if (request.method === 'GET' || request.method === 'HEAD') {
          const result = page(formHTML(logout));
          return request.method === 'HEAD' ? new Response(null, result) : result;
        }
        if (request.method !== 'POST') return response(null, 405, {Allow: 'GET, HEAD, POST'});
        if (request.headers.get('Origin') !== url.origin) return response('Forbidden', 403);
        if (logout) {
          const access=await authorized(request,env.SESSION_KEY,now());
          if(access&&env.CHAT_BACKEND){
            try{const revoked=await env.CHAT_BACKEND.fetch(chatRequest(request,access,{revoke:true}));if(!revoked.ok)return response('Chat logout unavailable',503,{'Set-Cookie':cookie('',0)});}
            catch{return response('Chat logout unavailable',503,{'Set-Cookie':cookie('',0)});}
          }
          return redirect('/', cookie('',0));
        }
        const ip = request.headers.get('CF-Connecting-IP');
        if (!ip) return response('Service unavailable', 503);
        const {success} = await env.LOGIN_LIMITER.limit({key: ip});
        if (!success) return response('Too many attempts', 429, {'Retry-After': '60'});
        if (!(request.headers.get('Content-Type') || '').startsWith('application/x-www-form-urlencoded')) return response('Unsupported media type', 415);
        // Stream-bound the body, including chunked requests without Content-Length.
        const reader = request.body?.getReader();
        let body = '', bytes = 0;
        if (reader) {
          const decoder = new TextDecoder();
          for (;;) {
            const {value, done} = await reader.read();
            if (done) break;
            bytes += value.byteLength;
            if (bytes > 4096) { await reader.cancel(); return response('Request too large', 413); }
            body += decoder.decode(value, {stream: true});
          }
          body += decoder.decode();
        }
        const params = new URLSearchParams(body);
        if (params.getAll('password').length !== 1 || !await passwordMatches(params.get('password'), env.OWNER_PASSWORD)) return page(formHTML(false, true), 401);
        return redirect('/', cookie(await session(env.SESSION_KEY, now()), HOURS8));
      }
      const access=await authorized(request, env.SESSION_KEY, now());
      if (!access) {
        if (url.pathname === '/' && ['GET', 'HEAD'].includes(request.method)) {
          const result = page(maintenanceHTML, 503);
          result.headers.set('Retry-After', '3600');
          return request.method === 'HEAD' ? new Response(null, result) : result;
        }
        return response('Forbidden', 403);
      }
      if(url.pathname.startsWith('/api/chat/')){
        if(!['/api/chat/presence','/api/chat/status','/api/chat/socket','/api/chat/admin'].includes(url.pathname))return response('Not found',404);
        if(env.CHAT_API_ENABLED!=='true'||!env.CHAT_BACKEND)return response('Chat unavailable',503);
        try{
          const result=await env.CHAT_BACKEND.fetch(chatRequest(request,access));
          if(result.status===101)return result; // Preserve the upgraded socket, never wrap it as HTML.
          return response(result.body,result.status,result.headers);
        }catch{return response('Chat unavailable',503);}
      }
      if(url.pathname==='/chat'&&['GET','HEAD'].includes(request.method))return response(null,308,{Location:'/chat/'});
      if (!['GET', 'HEAD'].includes(request.method)) return response(null, 405, {Allow: 'GET, HEAD'});
      const headers = new Headers(request.headers);
      headers.delete('Cookie');
      headers.delete('Authorization');
      headers.set('Cache-Control', 'no-cache, no-store');
      const origin = await upstream(new Request(request, {headers, redirect: 'manual'}), {cf: {cacheTtl: 0, cacheEverything: false}});
      const result = response(request.method === 'HEAD' ? null : origin.body, origin.status, origin.headers);
      result.headers.delete('Set-Cookie');
      if(url.pathname==='/chat/'||url.pathname==='/chat/index.html')chatHeaders(result.headers,url.origin);
      return result;
    } catch {
      // No exception details, credentials, or origin response bodies in logs.
      return response('Service unavailable', 503);
    }
  };
}

export default {fetch: createHandler()};
