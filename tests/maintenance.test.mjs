import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHandler} from '../cloudflare/maintenance/worker.mjs';
import {maintenanceHTML} from '../cloudflare/maintenance/pages.mjs';

function fixture() {
  let time = 1800000000000, attempts = 0, calls = [];
  const env = {OWNER_PASSWORD: crypto.randomUUID(), SESSION_KEY: crypto.randomUUID(), LOGIN_LIMITER: {limit: async () => ({success: ++attempts <= 5})}};
  const handle = createHandler({now: () => time, upstream: async (request, options) => {
    calls.push({request, options});
    return new Response('FULL SITE', {headers: {'Cache-Control': 'public, max-age=600', 'Set-Cookie': 'upstream=bad', 'Content-Type': 'application/json'}});
  }});
  const request = (path = '/', options = {}) => handle(new Request('https://tuz19.ru' + path, options), env);
  const login = (password = env.OWNER_PASSWORD, headers = {}) => request('/admin-login', {method: 'POST', headers: {Origin: 'https://tuz19.ru', 'CF-Connecting-IP': '192.0.2.1', 'Content-Type': 'application/x-www-form-urlencoded', ...headers}, body: new URLSearchParams({password})});
  return {env, calls, request, login, advance: milliseconds => time += milliseconds};
}
const cookieOf = response => response.headers.get('Set-Cookie').split(';')[0];

test('standalone HTML equals Worker HTML; exact approved public text', () => {
  assert.equal(readFileSync(new URL('../cloudflare/maintenance/maintenance.html', import.meta.url), 'utf8'), maintenanceHTML);
  for (const text of ['ТУЗ19', 'Ведутся технические работы', 'Всё под контролем программиста. Будить не надо.', 'Скоро вернёмся.']) assert.ok(maintenanceHTML.includes(text));
  assert.ok(!maintenanceHTML.includes('<script'));
});
test('anonymous maintenance, login, HEAD and resource denial never call origin', async () => {
  const f = fixture();
  const page = await f.request();
  assert.equal(page.status, 503); assert.equal(await page.text(), maintenanceHTML);
  for (const path of ['/js/app.js', '/css/styles.css', '/data/metadata.json', '/data/history.json', '/judges', '/index.html', '/?x=1/../data/a']) {
    const r = await f.request(path); assert.ok([403, 503].includes(r.status)); assert.ok(!(await r.text()).includes('FULL SITE'));
  }
  assert.equal((await f.request('/admin-login')).status, 200);
  assert.equal(await (await f.request('/', {method: 'HEAD'})).text(), '');
  assert.equal(f.calls.length, 0);
});
test('successful login creates secure eight-hour cookie and proxies paths without credentials', async () => {
  const f = fixture(), r = await f.login();
  assert.equal(r.status, 303); assert.equal(r.headers.get('Location'), '/');
  for (const flag of ['Max-Age=28800', 'Secure', 'HttpOnly', 'SameSite=Strict', 'Path=/']) assert.ok(r.headers.get('Set-Cookie').includes(flag));
  const cookie = cookieOf(r);
  for (const path of ['/', '/js/app.js', '/css/styles.css', '/data/metadata.json', '/judges?uuid=abc']) {
    const result = await f.request(path, {headers: {Cookie: cookie, Authorization: 'Bearer test'}});
    assert.equal(await result.text(), 'FULL SITE');
    assert.equal(result.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(result.headers.get('Set-Cookie'), null);
    assert.equal(result.headers.get('Vary'), 'Cookie');
    assert.equal(result.headers.get('Cloudflare-CDN-Cache-Control'), 'no-store');
    const call = f.calls.at(-1);
    assert.equal(call.request.url, 'https://tuz19.ru' + path);
    assert.equal(call.request.headers.get('Cookie'), null);
    assert.equal(call.request.headers.get('Authorization'), null);
    assert.equal(call.request.redirect, 'manual');
    assert.deepEqual(call.options.cf, {cacheTtl: 0, cacheEverything: false});
  }
  assert.equal((await f.request('/data/metadata.json')).status, 403);
});
test('incorrect password, CSRF, methods and oversized input rejected', async () => {
  const f = fixture();
  assert.equal((await f.login('wrong')).status, 401);
  assert.equal((await f.login(undefined, {Origin: 'https://evil.example'})).status, 403);
  assert.equal((await f.request('/admin-login', {method: 'DELETE'})).status, 405);
  assert.equal((await f.login('x'.repeat(5000))).status, 413);
  assert.equal((await f.login(undefined, {'Content-Type': 'application/json'})).status, 415);
  assert.equal((await f.login(undefined, {'CF-Connecting-IP': ''})).status, 503);
  assert.equal(f.calls.length, 0);
});
test('expired, malformed, duplicate and forged cookies rejected', async () => {
  const f = fixture(), cookie = cookieOf(await f.login());
  for (const value of ['__Host-tuz19_session=fake.signature', cookie + 'x', cookie + '; ' + cookie]) assert.equal((await f.request('/data/a.json', {headers: {Cookie: value}})).status, 403);
  f.advance(28800000);
  assert.equal((await f.request('/data/a.json', {headers: {Cookie: cookie}})).status, 403);
  assert.equal(f.calls.length, 0);
});
test('logout requires same-origin POST and clears cookie', async () => {
  const f = fixture();
  assert.equal((await f.request('/admin-logout')).headers.get('Set-Cookie'), null);
  assert.equal((await f.request('/admin-logout', {method: 'POST'})).status, 403);
  const r = await f.request('/admin-logout', {method: 'POST', headers: {Origin: 'https://tuz19.ru'}});
  assert.equal(r.status, 303); assert.ok(r.headers.get('Set-Cookie').includes('Max-Age=0'));
  assert.equal((await f.request('/data/a.json', {headers: {Cookie: '__Host-tuz19_session='}})).status, 403);
});
test('limiter checked on every login and blocks sixth attempt even with correct password', async () => {
  const f = fixture();
  for (let i = 0; i < 5; i++) assert.equal((await f.login('wrong')).status, 401);
  const r = await f.login(); assert.equal(r.status, 429); assert.equal(r.headers.get('Retry-After'), '60');
});
test('missing configuration, limiter failure and origin failure fail closed', async () => {
  for (const field of ['OWNER_PASSWORD', 'SESSION_KEY', 'LOGIN_LIMITER']) {
    const f = fixture(); delete f.env[field]; assert.equal((await f.request()).status, 503); assert.equal(f.calls.length, 0);
  }
  const f = fixture(); f.env.LOGIN_LIMITER.limit = async () => {throw Error('secret diagnostic');};
  assert.equal(await (await f.login()).text(), 'Service unavailable');
  const g = fixture(), cookie = cookieOf(await g.login());
  const handler = createHandler({upstream: async () => {throw Error('upstream');}, now: () => 1800000000000});
  assert.equal((await handler(new Request('https://tuz19.ru/', {headers: {Cookie: cookie}}), g.env)).status, 503);
});
test('HTTPS and canonical redirect; unknown host denied', async () => {
  const f = fixture();
  const handler = createHandler();
  assert.equal((await handler(new Request('http://tuz19.ru/data/a'), f.env)).headers.get('Location'), 'https://tuz19.ru/data/a');
  assert.equal((await handler(new Request('https://www.tuz19.ru/admin-login'), f.env)).headers.get('Location'), 'https://tuz19.ru/admin-login');
  assert.equal((await handler(new Request('https://other.example/'), f.env)).status, 404);
});
