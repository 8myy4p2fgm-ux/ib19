import {maintenanceHTML, formHTML} from '../../../cloudflare/maintenance/pages.mjs';

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
    return Number.isInteger(value.iat) && Number.isInteger(value.exp) && value.iat <= seconds && value.exp > seconds && value.exp - value.iat === HOURS8;
  } catch { return false; }
}

export function createHandler({upstream = fetch, now = Date.now} = {}) {
  return async function handle(request, env) {
    try {
      const url = new URL(request.url);
      if (!hosts.has(url.hostname)) return response('Not found', 404);
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
        if (logout) return redirect('/', cookie('', 0));
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
      if (!await authorized(request, env.SESSION_KEY, now())) {
        if (url.pathname === '/' && ['GET', 'HEAD'].includes(request.method)) {
          const result = page(maintenanceHTML, 503);
          result.headers.set('Retry-After', '3600');
          return request.method === 'HEAD' ? new Response(null, result) : result;
        }
        return response('Forbidden', 403);
      }
      if (!['GET', 'HEAD'].includes(request.method)) return response(null, 405, {Allow: 'GET, HEAD'});
      const headers = new Headers(request.headers);
      headers.delete('Cookie');
      headers.delete('Authorization');
      headers.set('Cache-Control', 'no-cache, no-store');
      const origin = await upstream(new Request(request, {headers, redirect: 'manual'}), {cf: {cacheTtl: 0, cacheEverything: false}});
      const result = response(request.method === 'HEAD' ? null : origin.body, origin.status, origin.headers);
      result.headers.delete('Set-Cookie');
      return result;
    } catch {
      // No exception details, credentials, or origin response bodies in logs.
      return response('Service unavailable', 503);
    }
  };
}

export default {fetch: createHandler()};
