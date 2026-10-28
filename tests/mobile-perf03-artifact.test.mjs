import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';import {legacyAssets} from '../scripts/release-assets.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
test('Release graph is fully versioned, aliases are identical, and all already published JS names still resolve',()=>{
 const html=fs.readFileSync('dist/index.html','utf8'),entries=[...html.matchAll(/src="\.\/(js\/[^\"]+\.js)"/g)].map(m=>m[1]);assert(entries.length>0);const versions=new Set(entries.map(f=>f.match(/\.([a-f0-9]{16})\.js$/)?.[1]));assert.equal(versions.size,1);assert(!versions.has(undefined));const tag=[...versions][0];
 const files=fs.readdirSync('dist/js');const versioned=files.filter(f=>f.endsWith('.'+tag+'.js'));assert(versioned.length>=85);
 for(const file of versioned){const source=fs.readFileSync('dist/js/'+file,'utf8');const alias='js/'+file.replace('.'+tag+'.js','.js');if(Object.hasOwn(legacyAssets,alias))assert.equal(hash(fs.readFileSync('dist/'+alias)),legacyAssets[alias]);else assert.equal(source,fs.readFileSync('dist/'+alias,'utf8'));for(const m of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*|\bnew\s+URL\(\s*)['"](\.[^'"]+\.js)['"]/g)){assert(m[1].endsWith('.'+tag+'.js'),m[1]);assert(fs.existsSync(new URL(m[1],new URL('../dist/js/'+file,import.meta.url))));}}
 const old=JSON.parse(fs.readFileSync('tests/fixtures/mobile-perf03-legacy.json'));assert.equal(old.commit,'8c45765747463234e9fab1405ba2c28a97a8e23a');assert.equal(Object.keys(old.modules).length,85);for(const name of Object.keys(old.modules))assert(fs.existsSync('dist/'+name),name);
 for(const [file,expected]of Object.entries(legacyAssets))assert.equal(hash(fs.readFileSync('dist/'+file)),expected);
});
test('Legacy public data URLs are byte-exact aliases of the approved source, never a regenerated or private snapshot',()=>{
 const manifest=JSON.parse(fs.readFileSync('public-data/manifest.json'));for(const [file,expected]of Object.entries(manifest)){assert.equal(hash(fs.readFileSync('dist/public-data/'+file)),expected);assert.deepEqual(fs.readFileSync('dist/public-data/'+file),fs.readFileSync('public-data/'+file));}
 const core=JSON.parse(fs.readFileSync('dist/public-data/r1/core.json'));assert.equal(JSON.stringify(core).includes('"comment":'),false);
});

test('Main integration can include normal versioned R2 modules while preserving exact legacy R2 imports',async()=>{
 const {default:os}=await import('node:os'),{default:path}=await import('node:path'),{versionModule}=await import('../scripts/release-assets.mjs'),{checkPublicData}=await import('../scripts/check-public-data.mjs');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tuz-mobile03-main-graph-'));
 try{
  fs.cpSync('dist',dir,{recursive:true});const html=fs.readFileSync(path.join(dir,'index.html'),'utf8'),tag=html.match(/app\.([a-f0-9]{16})\.js/)[1];
  for(const file of Object.keys(legacyAssets)){const compiled=versionModule(fs.readFileSync('public-compat/'+file,'utf8'),tag);fs.writeFileSync(path.join(dir,file.replace(/\.js$/,'.'+tag+'.js')),compiled);}
  for(const name of ['app.js','app.'+tag+'.js'])fs.appendFileSync(path.join(dir,'js',name),"\nimport './r2-group-reference."+tag+".js';\n");
  assert.equal((await checkPublicData(dir)).forbiddenFields,0);
  fs.appendFileSync(path.join(dir,'js/r2-group-reference.js'),'\n// changed');await assert.rejects(checkPublicData(dir),/Legacy module checksum mismatch/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('Whole dist respects the public allowlist',async()=>{const {checkPublicData}=await import('../scripts/check-public-data.mjs');assert.equal((await checkPublicData('dist')).forbiddenFields,0);});
