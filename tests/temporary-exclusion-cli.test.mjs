import test from 'node:test';import {assertR1Archive} from '../scripts/r2-submissions-collection.mjs';
test('scheduled R2 update accepts the byte-identical frozen R1 archive',async()=>{await assertR1Archive();});
