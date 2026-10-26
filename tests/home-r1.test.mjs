import {chronicleLinks,digestLinks} from '../js/home-report-links.js';
import {reportCatalog} from '../js/report-catalog.js';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createOfficialR1View} from '../js/r1-official-view.js';
import {ZIPPY_R1_POLICY_V2_VERSION,ZIPPY_ID} from '../js/r1-official-policy.js';
import {pulseSvg} from '../js/home-r1.js';
const read=f=>JSON.parse(fs.readFileSync('docs/data-candidates/r1-2026-10-22-194208/'+f));
const snapshot={main:read('19ib_all_judges_REPAIRED.json'),forum:read('forum_judges_export.json'),metadata:read('metadata.json'),history:read('history.json')};
const view=createOfficialR1View(snapshot,{policyVersion:ZIPPY_R1_POLICY_V2_VERSION}),fmt=n=>String(n);
test('R1 home inputs share the official snapshot, outcome accounting and exact TUZ for both groups',()=>{
 const original=JSON.stringify(snapshot),history=JSON.stringify(view.history),activity=view.activity();
 assert.deepEqual(view.analytics.outcomes(),{participants:3276,standardPasses:2217,specialOfficialPasses:1,totalPassed:2218,failed:1058,pending:0});
 assert.equal(view.analytics.participantOutcome(ZIPPY_ID).standardOutcome,null);assert.equal(view.analytics.participantOutcome(ZIPPY_ID).officialOutcome,'pass');
 assert.equal(view.analytics.summary({group:'forum'}).index,20.884382840066547);assert.equal(view.analytics.summary({group:'veterans'}).index,32.123232268736096);
 assert.equal(view.analytics.summary({group:'forum'}).index,20.884382840066547);
 assert.equal(activity.factual.count,16380);assert.equal(activity.sourceObserved.count,16381);assert.equal(activity.annulled.count,1);
 assert.equal(activity.accounting.standardSlots,16380);assert.equal(activity.accounting.standardCompletionPercent,100);
 assert.equal(activity.factual.days.at(-1).cumulative,16380);assert.equal(activity.officialRoundCompletionConfirmed,false);
 assert.equal(activity.factual.events.filter(e=>e.userId===ZIPPY_ID&&e.judge==='Игорь Кедо').length,0);
 assert.equal(JSON.stringify(snapshot),original);assert.equal(JSON.stringify(view.history),history);
});
test('Pulse renderer draws each factual cumulative point without mutation or extrapolation, including empty input',()=>{
 const days=[{t:100,count:1,cumulative:1},{t:200,count:2,cumulative:3}],before=structuredClone(days);
 for(const width of [240,292,900]){const result=pulseSvg(days,width,fmt);assert.equal((result.markup.match(/<path/g)||[]).length,2);assert.match(result.markup,/class="r1-pulse-area"/);assert.match(result.markup,/class="r1-pulse-line"/);assert.match(result.markup,/d="M[^\"]+ L[^\"]+"/);assert(!/NaN|Infinity|undefined/.test(result.markup));}
 assert.deepEqual(days,before);assert.match(pulseSvg([],320,fmt).markup,/Нет подтверждённых оценок/);
 const one=pulseSvg([days[0]],320,fmt);assert(!/NaN|Infinity/.test(one.markup));
});
test('Home links point to implemented sections and no duplicate HTML IDs or static baseline KPIs are embedded',()=>{
 const html=fs.readFileSync('index.html','utf8'),home=html.slice(html.indexOf('<section class="page active" id="home">'),html.indexOf('<section class="page" id="dynamics"'));
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
 const chronicle=chronicleLinks(1),digest=digestLinks(1);
 assert.equal((chronicle.match(/data-report-link /g)||[]).length,4);
 assert.equal((digest.match(/data-report-link /g)||[]).length,8);
 assert.equal((digest.match(/class="home-report-group"/g)||[]).length,0);
 assert.equal((digest.match(/class="home-report-icon"/g)||[]).length,8);
 assert.equal((digest.match(/home-digest-tinder/g)||[]).length,1);
 assert.deepEqual([...chronicle.matchAll(/<strong>([^<]+)<\/strong>/g)].map(m=>m[1]),reportCatalog.dynamics.map(r=>r.label));
 assert.deepEqual([...digest.matchAll(/<strong>([^<]+)<\/strong>/g)].map(m=>m[1]),[...reportCatalog.judges,...reportCatalog.rappers].map(r=>r.label));
 assert.doesNotMatch(chronicle+digest,/>\s*(?:Скоро|В разработке|Ожидается)\s*<|disabled|href="#"/);
 assert.match(home,/data-home-report-chronicle/);assert.match(home,/data-home-report-digest/);
 assert.match(home,/Дайджест ТУЗа/);assert.doesNotMatch(home,/Что выяснило следствие|r1-report-soon/);
 assert.match(home,/<span>В следующий раунд<\/span>/);assert.match(home,/<span>В следующий батол<\/span>/);
 assert(!/20\.884382|32\.123232|16.?380|3.?276|2.?218/.test(home));
});
test('V58 composition uses two outcome blocks and a text verdict; history and technical details stay outside cards',()=>{
 const html=fs.readFileSync('index.html','utf8'),summary=html.slice(html.indexOf('<div class="r1-summary">'),html.indexOf('<section class="r1-stage r1-pulse"'));
 assert.match(html,/<h1>Итоги первого отбора<\/h1>/);assert.match(summary,/<h2>Все прошли<\/h2>/);
 assert.match(summary,/<strong id="verdict-main"><\/strong>/);assert(!summary.includes('id="index-main"'));assert(!summary.includes('id="chart-main"'));
 assert.match(html,/<h2 id="r1-pulse-title">Хроника судейства<\/h2>/);assert.match(html,/class="r1-pace-links home-chronicle-grid"/);
 assert.match(html,/18\.10 · Прикол дедлайн/);assert.match(html,/<strong id="r1-pace-verdict">Успели\.<br>Со второго раза\.<\/strong><small>Три часа технических проблем с сайтом — продление дедлайна на четыре дня\. Математика баттла\.<\/small>/);
});

test('Homepage has no extra source link; technical source dialog is absent',()=>{
 const html=fs.readFileSync('index.html','utf8'),js=fs.readFileSync('js/home-r1.js','utf8');
 assert(!html.includes('Источник пульса, история индекса и подробная статистика'));
 assert(!html.includes('id="r1-source-open"'));assert(!html.includes('<footer class="r1-source"'));assert(!html.includes('class="r1-more"'));assert(!html.includes('class="r1-index-history"'));
 assert.match(html,/<p class="r1-subtitle">Судейство завершено 22 октября\. Справились\.<\/p>/);assert(!html.includes('<div class="r1-source"><span>Данные 19ib.ru'));
 assert(!html.includes('id="r1-source-dialog"'));
 assert.match(html,/id="r1-render-targets" hidden inert aria-hidden="true"/);
});

test('V58 Pulse uses the actual series, exact confirmed time and a distinct historical marker',()=>{
 const activity=view.activity(),days=activity.factual.days,original=JSON.stringify(days);
 for(const width of [230,292,620,660]){
  const result=pulseSvg(days,width,fmt,{deadline:activity.slots.deadline});
  assert.match(result.markup,/data-kind="historical" data-time="1792357140000"/);
  assert.match(result.markup,new RegExp('data-kind="confirmed" data-time="'+activity.slots.deadline+'"'));
  assert.match(result.markup,/>16380<\/text>/);assert(!result.markup.includes('13944'));
  assert.equal((result.markup.match(/class="r1-deadline-mark"/g)||[]).length,2);
  const point=result.markup.match(/class="r1-pulse-point" cx="([^"]+)" cy="([^"]+)"/);
  const label=result.markup.match(/class="r1-pulse-end" data-time="[^\"]+" x="([^"]+)" y="([^"]+)"/);
  if(width>=580)assert(Number(label[1])>Number(point[1]));else assert(Number(label[2])<Number(point[2]));
  assert.match(result.markup,new RegExp('class="r1-pulse-end" data-time="'+days.at(-1).t+'"'));
  assert(!/NaN|Infinity|undefined/.test(result.markup));
 }
 assert.equal(JSON.stringify(days),original);
 assert(!pulseSvg(days,292,fmt).markup.includes('data-kind="confirmed"'));
});
