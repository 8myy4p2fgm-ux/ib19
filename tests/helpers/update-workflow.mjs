import assert from 'node:assert/strict';
export function assertUpdateWorkflowModes(text){
 const events=text.match(/^on:\n([\s\S]*?)(?=^\S)/m)?.[1];assert.ok(events,'on block is required');
 const names=[...events.matchAll(/^  ([\w]+):/gm)].map(m=>m[1]);
 assert.equal(names.filter(n=>n==='workflow_dispatch').length,1,'manual launch is required exactly once');
 assert.ok(names.every(n=>['workflow_dispatch','schedule'].includes(n)),'unexpected update trigger');
 assert.ok(names.filter(n=>n==='schedule').length<=1,'duplicate schedule block');
 const crons=[...events.matchAll(/cron:\s*['"]([^'"]+)['"]/g)].map(m=>m[1]);
 if(names.includes('schedule')){assert.equal(crons.length,1,'production has exactly one schedule');assert.ok(['*/5 * * * *','1-59/5 * * * *'].includes(crons[0]),'only agreed five-minute phases are allowed');assert.match(events,/timezone: 'Europe\/Moscow'/);}
 else assert.deepEqual(crons,[],'manual-only mode cannot contain cron');
 const concurrency=text.match(/^concurrency:\n((?:[ \t]+[^\n]*\n)+)/m)?.[1];assert.ok(concurrency,'workflow-level concurrency required');
 assert.match(concurrency,/^  group: ib19-publish\s*$/m);assert.match(concurrency,/^  cancel-in-progress: false\s*$/m);
 return names.includes('schedule')?'production':'manual';
}
