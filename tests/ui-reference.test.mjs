import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const reference=fs.readFileSync('docs/IB19_V95_WHITE_TUZ_HEADING.html','utf8');
const names={1:'forum-link',2:'forum-link-model',3:'config',4:'general',5:'calculations',9:'personal',13:'methodology',15:'judge-summary',16:'judge-presentation',20:'pace-page',21:'score-economy',22:'pace-model'};
function moduleCode(n){const m=reference.match(new RegExp('const module'+n+'=\\(\\(\\)=>\\{([\\s\\S]*?)\\nreturn \\{([^\\n]*?)\\};\\}\\)\\(\\);'));let code=m[1].replace(/^\n/,'').replace(/const \{([^}]+)\}=module(\d+);/g,(_,exports,id)=>`import {${exports}} from './${names[id]}.js';`);for(const ex of m[2].split(',').map(s=>s.trim()).filter(Boolean))code=code.replace(new RegExp('\\b((?:async )?function|const|let|class) '+ex+'\\b'),'export $1 '+ex);return code+'\n';}
const overview=fs.readFileSync('docs/TUZ_V95_overview_v6.html','utf8'),loader=fs.readFileSync('docs/TUZ_V95_carrot_loader_preview.html','utf8');
test('overview styles and loader match approved references with faster loading, zone index colors and five-score highlighting',()=>{const blocks=s=>[...s.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]);const loaderCSS=blocks(loader).find(s=>s.includes('@keyframes carrot-spin'))
 .replace('opacity:1;visibility:visible;transition:opacity .3s ease,visibility .3s ease}', 'opacity:0;visibility:hidden;transition:opacity .18s ease,visibility .18s ease!important}')
 .replace('#carrot-loader.is-hidden', '#carrot-loader.is-visible{opacity:1;visibility:visible}\n#carrot-loader.is-hidden')
 .replace('#carrot-loader .carrot{animation:carrot-spin 1s linear infinite!important}#carrot-loader{transition:opacity .3s ease,visibility .3s ease!important}', '#carrot-loader .carrot{animation:none!important}#carrot-loader{transition:none!important}');
 assert.equal(fs.readFileSync('css/styles.css','utf8'),(blocks(overview).join('\n')+'\n'+loaderCSS).replace('#home #index-main{color:#68D99A!important}','#home #index-main{--green:#68D99A}').replace('.home-rating-item:last-child .home-rating-track i','.home-rating-item.home-rating-complete .home-rating-track i').split('\n').filter(line=>!line.startsWith('.calculator-grid')).join('\n'));});
test('Judge renderer preserves the reference with the approved heat disclosure',()=>{
 // The accepted disclosure wraps only the heat table; keep exact comparison
 // for every calculation, row, sorting handler and the rest of the renderer.
 const approved=moduleCode(15)
  .replace('<section class="judge-summary"><h2>Кому ставят выше</h2>', '<section class="judge-summary judge-heat-disclosure"><details class="judge-heat-details"><summary>Кому ставят выше<span class="judge-heat-chevron" aria-hidden="true">⌄</span></summary><div class="judge-heat-content">')
  .replace('<tbody id="judge-heat-body"></tbody></table></div></section>', '<tbody id="judge-heat-body"></tbody></table></div></div></details></section>');
 assert.equal(fs.readFileSync('js/judge-summary.js','utf8'),approved);
});
test('Approved rapper reports use the shared official context and existing selection models',()=>{
 const entry=fs.readFileSync('js/forum-link.js','utf8'),model=fs.readFileSync('js/rapper-report-model.js','utf8'),view=fs.readFileSync('js/rapper-report-view.js','utf8');
 assert.match(entry,/rapperR1Model\(context\)/);assert.match(model,/getV58Research\(context\)/);assert.match(model,/current\(\)\.rappers/);assert.match(view,/selectForumRows/);assert.match(view,/selectMatrixRows/);
 assert(!/fetch\(|packedData|reviewData|generalAt\(/.test(entry+model+view));
});
test('shared HTML contains no embedded demo data and exactly one analytics script',()=>{const html=fs.readFileSync('index.html','utf8');assert.equal((html.match(/static\.cloudflareinsights\.com\/beacon\.min\.js/g)||[]).length,1);assert.ok(!html.includes('packedData'));assert.ok(!html.includes('reviewData'));
 // POLISH-01.18R removed the inline methodology scale. Its current entry
 // remains in the index card; numeric verdict boundaries are tested below.
 assert.doesNotMatch(html,/От 20 — Норма|От 10 до 20 — Менять судей/);
 assert.match(html,/class="home-method-link" href="#\/round\/1\/methodology"/);
});
test('The removed inline scale retains its exact verdict boundaries in the model',async()=>{
 const {verdict}=await import('../js/general.js');
 assert.equal(verdict(20)[0],'Норма');assert.equal(verdict(19.99)[0],'Менять судей');
 assert.equal(verdict(10.01)[0],'Менять судей');assert.equal(verdict(10)[0],'Менять батол');
});
