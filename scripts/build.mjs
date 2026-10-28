import {createHash} from 'node:crypto';
import {versionModule,versionHTML,versionPath,legacyAssets} from './release-assets.mjs';
import {currentGraph,requirePrepared} from './js-graphs.mjs';
import fs from 'node:fs/promises';
import {checkPublicData} from './check-public-data.mjs';
import {writeSplitPublicData} from './public-data.mjs';

const graph=await currentGraph(),retained=await requirePrepared(graph);
await fs.rm('dist',{recursive:true,force:true});
await fs.mkdir('dist',{recursive:true});
for(const file of ['index.html','css'])await fs.cp(file,'dist/'+file,{recursive:true});
// Horo has an explicit content resource and only its referenced media.
const horo=JSON.parse(await fs.readFile('horo/content.json','utf8'));
await fs.mkdir('dist/horo/media',{recursive:true});await fs.copyFile('horo/content.json','dist/horo/content.json');
for(const file of new Set(horo.images.flatMap(image=>[image.src,...(image.frames||[])]))){
 if(!/^media\/[\w-]+\.(png|webp)$/.test(file))throw Error('Unexpected Horo media path');
 await fs.copyFile('horo/'+file,'dist/horo/'+file);
}
// Publish only the module graph reachable from HTML entry scripts, including
// literal lazy imports. Fail closed on unresolved local dependencies.
const {entryHTML,chatHTML,sources,version}=graph,reachable=new Set(sources.keys());
await fs.mkdir('dist/js',{recursive:true});
for(const [file,source]of retained.assets)await fs.writeFile('dist/'+file,source);
for(const file of [...reachable].sort()){const compiled=versionModule(sources.get(file),version);await fs.writeFile('dist/'+versionPath(file,version),compiled);await fs.writeFile('dist/'+file,compiled);}
await fs.writeFile('dist/index.html',versionHTML(entryHTML,version));
for(const [file,expected]of Object.entries(legacyAssets)){const raw=await fs.readFile('public-compat/'+file);if(createHash('sha256').update(raw).digest('hex')!==expected)throw Error('Legacy module checksum mismatch: '+file);await fs.writeFile('dist/'+file,raw);}
console.log('Asset graph version:',version);
// Original high-resolution logo remains in source; published UI uses DPR2 PNG.
await fs.rm('dist/css/assets/tuz-drawn.webp',{force:true});
console.log('Runtime modules:',reachable.size);
await writeSplitPublicData('dist/public-data');
// The only raw public resource needed by R2; never copy the entire data tree.
await fs.mkdir('dist/data/rounds/r2-submissions.v1',{recursive:true});
await fs.copyFile('data/rounds/r2-submissions.v1/snapshot.json','dist/data/rounds/r2-submissions.v1/snapshot.json');
const html=versionHTML(entryHTML,version);
for(const [route,title] of [['dynamics','Судейские обхваты'],['judges','Судьи'],['rappers','Реперы'],['events','События'],['horo','Хо-ро-шо. По форумному']]){
 await fs.mkdir(`dist/${route}`,{recursive:true});
 await fs.writeFile(`dist/${route}/index.html`,html.replace('<title>Обзор — TUZ19</title>',`<title>${title} — TUZ19</title>`).replaceAll('="./','="../'));
}
await fs.mkdir('dist/chat/smilies',{recursive:true});
await fs.writeFile('dist/chat/index.html',versionHTML(chatHTML,version));
for(const file of ['style.css','nav.css'])await fs.copyFile('chat/'+file,'dist/chat/'+file);
const {SMILIES}=await import('../js/chat-smilies-catalog.js');
for(const item of SMILIES){if(!/^[\w-]+\.gif$/.test(item.file))throw Error('Invalid smiley asset');const bytes=await fs.readFile('chat/smilies/'+item.file);if(createHash('sha256').update(bytes).digest('hex')!==item.sha256)throw Error('Smiley checksum mismatch');await fs.writeFile('dist/chat/smilies/'+item.file,bytes);}
await fs.writeFile('dist/.nojekyll','');

console.log('Public boundary:',await checkPublicData('dist'));
