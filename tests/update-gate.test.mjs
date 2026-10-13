import test from 'node:test';
import assert from 'node:assert/strict';
import {shouldCollect} from '../scripts/update-gate.mjs';

const now=Date.parse('2026-10-13T14:17:00Z');
test('primary schedule and manual launch are never suppressed by fresh data',()=>{
 for(const event of ['schedule','workflow_dispatch'])assert.equal(shouldCollect({event,
  schedule:'0 * * * *',lastSuccessfulAt:'2026-10-13T14:10:00Z',now}),true);
});
test('fallback collects if this hour has no successful export, including failed attempts',()=>{
 for(const lastSuccessfulAt of ['2026-10-13T13:59:59.999Z','invalid',undefined,'2026-10-13T15:00:00Z'])
  assert.equal(shouldCollect({event:'schedule',schedule:'17 * * * *',lastSuccessfulAt,now}),true);
});
test('fallback skips only a successful export within the current hour',()=>{
 for(const lastSuccessfulAt of ['2026-10-13T14:00:00Z','2026-10-13T14:16:59Z'])
  assert.equal(shouldCollect({event:'schedule',schedule:'17 * * * *',lastSuccessfulAt,now}),false);
});
