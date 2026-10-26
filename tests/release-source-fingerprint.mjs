import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
// A gate must describe one candidate, even when several chats share the checkout.
export function sourceFingerprint(){
 const files=[];
 function walk(dir){if(!fs.existsSync(dir))return;for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,entry.name);if(entry.isDirectory())walk(f);else if(/\.(js|css|json|csv)$/.test(f))files.push(f);}}
 for(const dir of ['js','css','data','docs/data-candidates/r1-2026-10-22-194208'])walk(dir);
 files.push('index.html','scripts/build.mjs');
 return Object.fromEntries(files.sort().map(f=>[f,createHash('sha256').update(fs.readFileSync(f)).digest('hex')]));
}
