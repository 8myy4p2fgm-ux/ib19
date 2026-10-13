import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
function checkProbe(text,zone){
 assert.deepEqual([...text.matchAll(/^([\w-]+):/gm)].map(m=>m[1]),['name','on','permissions','concurrency','jobs'],'only valid workflow root keys');
 assert.match(text,/on:\n  schedule:\n    - cron: '\*\/5 \* \* \* \*'\n/);
 assert.match(text,/^  workflow_dispatch:\s*$/m);assert.match(text,/^  contents: read\s*$/m);assert.match(text,/cancel-in-progress: false/);
 assert.match(text,new RegExp('group: ib19-schedule-diagnostic-'+zone+'\\n'));
 if(zone==='moscow')assert.match(text,/^      timezone: 'Europe\/Moscow'\s*$/m);else assert.doesNotMatch(text,/timezone:/);
 assert.doesNotMatch(text,/npm run update|deploy-pages|git push|fetch-data/);
}
test('temporary schedule probes have valid root keys, five-minute events and no collection/publication actions',()=>{
 for(const zone of ['utc','moscow']){const file='.github/workflows/schedule-probe-'+zone+'.yml';if(!fs.existsSync(file))continue;const text=fs.readFileSync(file,'utf8');checkProbe(text,zone);assert.throws(()=>checkProbe(text.replace('  workflow_dispatch:','TIME'+zone+'  workflow_dispatch:'),zone));}
});
