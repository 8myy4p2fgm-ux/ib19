import test from 'node:test';import assert from 'node:assert/strict';import {shouldCollect} from '../scripts/update-gate.mjs';
const now=Date.parse('2026-10-13T14:27:00Z');
test('manual collection is not suppressed',()=>assert.equal(shouldCollect({event:'workflow_dispatch',lastSuccessfulAt:'2026-10-13T14:26:00Z',now}),true));
test('queued and delayed runs collect from the current ten-minute bucket',()=>{
 for(const lastSuccessfulAt of ['2026-10-13T14:19:59Z','invalid',undefined,'2026-10-13T15:00:00Z'])assert.equal(shouldCollect({event:'schedule',lastSuccessfulAt,now}),true);
});
test('already fresh ten-minute bucket is skipped',()=>{
 for(const lastSuccessfulAt of ['2026-10-13T14:20:00Z','2026-10-13T14:26:59Z'])assert.equal(shouldCollect({event:'schedule',lastSuccessfulAt,now}),false);
});
test('new ten-minute boundary allows collection, even across an hour',()=>{
 for(const [now,lastSuccessfulAt] of [['2026-10-13T14:30:00Z','2026-10-13T14:29:59Z'],['2026-10-13T15:00:00Z','2026-10-13T14:59:59Z']])assert.equal(shouldCollect({event:'schedule',now:Date.parse(now),lastSuccessfulAt}),true);
});
