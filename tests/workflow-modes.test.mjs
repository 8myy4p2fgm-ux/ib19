import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {assertUpdateWorkflowModes} from './helpers/update-workflow.mjs';
const current=fs.readFileSync('.github/workflows/update-data-scheduled.yml','utf8');
const manual=current.replace(/^  schedule:\n[\s\S]*?(?=^  workflow_dispatch:)/m,'');
const production=manual.replace('on:\n',"on:\n  schedule:\n    - cron: '*/10 * * * *'\n      timezone: 'Europe/Moscow'\n");
test('both manual-only rollout and ten-minute production are valid',()=>{assert.equal(assertUpdateWorkflowModes(manual),'manual');assert.equal(assertUpdateWorkflowModes(production),'production');assertUpdateWorkflowModes(current);});
test('wrong/missing/duplicate schedules, absent manual launch and unsafe concurrency remain rejected',()=>{
 for(const invalid of [production.replace('*/10','*/5'),production.replace("    - cron: '*/10 * * * *'\n",''),production.replace("    - cron: '*/10 * * * *'","    - cron: '*/10 * * * *'\n    - cron: '*/10 * * * *'"),production.replace('workflow_dispatch:','push:'),production.replace('group: ib19-publish','group: other'),production.replace('cancel-in-progress: false','cancel-in-progress: true'),manual.replace('group: ib19-publish','group: other'),manual.replace('cancel-in-progress: false','cancel-in-progress: true')])assert.throws(()=>assertUpdateWorkflowModes(invalid));
});

test('off-peak phase has exactly six triggers and ten-minute cyclic gaps',()=>{const minutes=Array.from({length:6},(_,i)=>1+i*10);assert.equal(minutes.at(-1),51);for(let i=0;i<minutes.length;i++)assert.equal((minutes[(i+1)%minutes.length]-minutes[i]+60)%60,10);assert.equal(assertUpdateWorkflowModes(production.replace('*/10','1-59/10')),'production');for(const cron of ['*/5 * * * *','*/6 * * * *','1-59/5 * * * *','1-50/10 * * * *'])assert.throws(()=>assertUpdateWorkflowModes(production.replace('*/10 * * * *',cron)));});
test('scheduled collection is explicitly incremental and manual modes remain available',()=>{assert.match(current,/COLLECTION_MODE: \$\{\{ inputs\.mode \|\| 'incremental' \}\}/);assert.match(current,/options: \[auto, incremental, full\]/);});
