import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {assertUpdateWorkflowModes} from './helpers/update-workflow.mjs';
const current=fs.readFileSync('.github/workflows/update-data-scheduled.yml','utf8');
const manual=current.replace(/^  schedule:\n[\s\S]*?(?=^  workflow_dispatch:)/m,'');
const production=manual.replace('on:\n',"on:\n  schedule:\n    - cron: '*/5 * * * *'\n      timezone: 'Europe/Moscow'\n");
test('both manual-only rollout and five-minute production are valid',()=>{assert.equal(assertUpdateWorkflowModes(manual),'manual');assert.equal(assertUpdateWorkflowModes(production),'production');assertUpdateWorkflowModes(current);});
test('wrong/missing/duplicate schedules, absent manual launch and unsafe concurrency remain rejected',()=>{
 for(const invalid of [production.replace('*/5','*/10'),production.replace("    - cron: '*/5 * * * *'\n",''),production.replace("    - cron: '*/5 * * * *'","    - cron: '*/5 * * * *'\n    - cron: '*/5 * * * *'"),production.replace('workflow_dispatch:','push:'),production.replace('group: ib19-publish','group: other'),production.replace('cancel-in-progress: false','cancel-in-progress: true'),manual.replace('group: ib19-publish','group: other'),manual.replace('cancel-in-progress: false','cancel-in-progress: true')])assert.throws(()=>assertUpdateWorkflowModes(invalid));
});

test('off-peak phase has exactly twelve triggers and five-minute cyclic gaps',()=>{const minutes=Array.from({length:12},(_,i)=>1+i*5);assert.equal(minutes.at(-1),56);for(let i=0;i<minutes.length;i++)assert.equal((minutes[(i+1)%12]-minutes[i]+60)%60,5);assert.equal(assertUpdateWorkflowModes(production.replace('*/5','1-59/5')),'production');for(const cron of ['*/6 * * * *','1-59/10 * * * *','1-55/5 * * * *'])assert.throws(()=>assertUpdateWorkflowModes(production.replace('*/5 * * * *',cron)));});
