// Reproducible public checks. Archive/source-history and infrastructure suites
// remain intact and are run separately with their explicitly provisioned inputs.
import {spawnSync} from 'node:child_process';
const files=['public-checkpoint','rel01-compatible','focus-matrix','perf02','r2-submissions','report-availability','release-hotfix-navigation'];
const result=spawnSync(process.execPath,['--test',...files.map(f=>'tests/'+f+'.test.mjs')],{stdio:'inherit'});
if(result.error)throw result.error;process.exitCode=result.status??1;
