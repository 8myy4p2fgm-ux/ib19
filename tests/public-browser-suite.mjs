import {spawnSync} from 'node:child_process';
for(const file of ['tests/perf02-browser.mjs','tests/public-checkpoint-browser.mjs','tests/rel01-compatible-browser.mjs','tests/mobile-perf03-browser.mjs']){
 const r=spawnSync(process.execPath,[file],{stdio:'inherit'});if(r.error)throw r.error;if(r.status){process.exitCode=r.status;break;}
}
