import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {tokenizeSmilies} from '../chat/smilies.js';import {SMILIES} from '../chat/smilies-catalog.js';
test('fixed catalog: original GIF bytes, dimensions, safe filenames and unique codes',async()=>{
 assert.equal(SMILIES.length,92);assert.equal(new Set(SMILIES.map(s=>s.code)).size,92);
 for(const s of SMILIES){assert.match(s.file,/^[a-z0-9-]+\.gif$/);assert.equal(new URL(s.source).origin,'https://www.hip-hop.ru');assert(s.source.endsWith('/'+s.file));const b=await readFile(new URL('../chat/smilies/'+s.file,import.meta.url));assert.match(b.toString('ascii',0,6),/^GIF8[79]a$/);assert.equal(b.readUInt16LE(6),s.width);assert.equal(b.readUInt16LE(8),s.height);assert.equal(createHash('sha256').update(b).digest('hex'),s.sha256);assert.equal(b.length,s.bytes);}
});
test('tokenizer preserves all surrounding text, unknown codes, case and URLs without HTML parsing',()=>{
 for(const text of ['До:horosho:после :):D','<img src=x onerror=alert(1)> :)','http://example.test/:D :unknown: :other: :d', ':unknown:) :horosho: \n текст']){
  const tokens=tokenizeSmilies(text);assert.equal(tokens.map(t=>t.text??t.smiley.code).join(''),text);for(const t of tokens)if(t.smiley)assert(SMILIES.includes(t.smiley));
 }
 assert.equal(tokenizeSmilies('http://example.test/:D :unknown: :other: :d').filter(t=>t.smiley).length,0);
 assert.equal(tokenizeSmilies(':o: :D: :p:').filter(t=>t.smiley).length,0);
 assert.equal(tokenizeSmilies(':):D').filter(t=>t.smiley).length,2);
});
