import fs from 'node:fs/promises';

await fs.rm('dist',{recursive:true,force:true});
await fs.mkdir('dist',{recursive:true});
for(const file of ['index.html','css','js','data','horo'])await fs.cp(file,'dist/'+file,{recursive:true});
const html=await fs.readFile('index.html','utf8');
for(const [route,title] of [['dynamics','Судейские обхваты'],['judges','Судьи'],['rappers','Реперы'],['events','События'],['horo','Хо-ро-шо. По форумному']]){
 await fs.mkdir(`dist/${route}`,{recursive:true});
 await fs.writeFile(`dist/${route}/index.html`,html.replace('<title>Обзор — TUZ19</title>',`<title>${title} — TUZ19</title>`).replaceAll('="./','="../'));
}
await fs.writeFile('dist/.nojekyll','');
