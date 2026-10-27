// Loaded by local Node commands. Tests may use loopback fixtures, never upstream APIs.
const originalFetch = globalThis.fetch;
globalThis.fetch = function localFetch(input, options) {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (!['http:', 'https:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    return Promise.reject(new Error('TUZ19 local-only: external fetch blocked: ' + url.origin));
  }
  return originalFetch.call(globalThis, input, options);
};
