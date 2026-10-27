import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {versionModule,versionHTML,assetVersion,legacyAssets} from '../scripts/release-assets.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex'),v='0123456789abcdef';
test('Versioning covers static/lazy/side-effect imports and Workers without changing data, styles or basePath',()=>{
 const source=`import {x} from './a.js';import './b.js';const m=import('./c.js');new Worker(new URL('./w.js',import.meta.url));new URL('../public-data/r1/core.json',import.meta.url);new URL('../css/x.css',import.meta.url);`;
 const actual=versionModule(source,v);assert.equal(actual,source.replaceAll('./a.js','./a.'+v+'.js').replaceAll('./b.js','./b.'+v+'.js').replaceAll('./c.js','./c.'+v+'.js').replaceAll('./w.js','./w.'+v+'.js'));
 assert.equal(versionHTML('<script src="./js/app.js"></script>',v),'<script src="./js/app.'+v+'.js"></script>');
 assert.throws(()=>versionModule(source,'invalid'));const modules=new Map([['js/a.js','a'],['js/b.js','b']]);assert.equal(assetVersion('html',modules,'compiler'),assetVersion('html',new Map([...modules].reverse()),'compiler'));assert.notEqual(assetVersion('html',modules,'compiler'),assetVersion('html',modules,'compiler2'));
});
