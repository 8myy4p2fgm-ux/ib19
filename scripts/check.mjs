import {assertR1Archive,loadR2State} from './r2-submissions-collection.mjs';
await assertR1Archive();
const {model}=await loadR2State();
console.log('R1 archive byte-identical; R2 submissions snapshot valid: '+model.confirmedSubmissionCount+' submissions.');
