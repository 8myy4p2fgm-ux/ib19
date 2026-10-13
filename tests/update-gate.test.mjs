import test from 'node:test';import assert from 'node:assert/strict';import {shouldCollect} from '../scripts/update-gate.mjs';
const now=Date.parse('2026-10-13T14:17:00Z');
test('manual collection is not suppressed',()=>assert.equal(shouldCollect({event:'workflow_dispatch',lastSuccessfulAt:'2026-10-13T14:16:00Z',now}),true));
test('queued and delayed runs collect from the current five-minute bucket',()=>{
 for(const lastSuccessfulAt of ['2026-10-13T14:14:59Z','invalid',undefined,'2026-10-13T15:00:00Z'])assert.equal(shouldCollect({event:'schedule',lastSuccessfulAt,now}),true);
});
test('already fresh five-minute bucket is skipped',()=>{
 for(const lastSuccessfulAt of ['2026-10-13T14:15:00Z','2026-10-13T14:16:59Z'])assert.equal(shouldCollect({event:'schedule',lastSuccessfulAt,now}),false);
});
