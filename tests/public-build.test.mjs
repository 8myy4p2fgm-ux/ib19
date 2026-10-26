import test from 'node:test';import assert from 'node:assert/strict';import {checkPublicData} from '../scripts/check-public-data.mjs';
test('Whole dist respects the public allowlist',async()=>{assert.equal((await checkPublicData('dist')).forbiddenFields,0);});
