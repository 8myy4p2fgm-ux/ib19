import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseForumCSV} from '../scripts/forum-directory.mjs';
import {normalizeData} from '../js/data.js';
import {buildForumLink,selectForumRows} from '../js/forum-link-model.js';
import {unifiedAt} from '../js/calculations.js';
const read=name=>JSON.parse(fs.readFileSync('data/'+name));
test('both LT artists have unique Forum identities, source grades and participation in the stored Forum TUZ',()=>{
 const rows=parseForumCSV(fs.readFileSync('data/forum.csv','utf8'));
 const normalized=s=>s.normalize('NFKC').replace(/\s+/gu,'').toLocaleLowerCase('ru-RU');
 assert.equal(new Set(rows.map(r=>r.userId)).size,rows.length);assert.equal(new Set(rows.map(r=>normalized(r.forum_name))).size,rows.length);
 const main=read('19ib_all_judges_REPAIRED.json'),forum=read('forum_judges_export.json'),D=normalizeData(main,forum),model=buildForumLink(D);
 const group=new Set(forum.members.filter(p=>D.byId.has(p.userId)&&p.group!=='Ветераны'&&!p.veteran).map(p=>p.userId));
 for(const [id,name,slug,total] of [['efa254a2-623f-4850-81f7-b193a948330c','Эталон Этанола [ЛТ]','etalon-etanola-lt',23],['d6f9868b-d11c-42fe-8646-f2307fb96666','VladisLOVE [ЛТ]','vladislove-lt',16]]){
  assert.deepEqual(rows.filter(r=>r.userId===id),[{group:'OG',forum_name:name,userId:id}]);
  const p=D.byId.get(id),m=D.metadata.get(id);assert.equal(p.artistName,name);assert.equal(p.artistSlug,slug);assert.equal(m.veteran,false);assert.deepEqual(m.scores,p.scores);
  assert.equal(p.scores.length,5);assert.equal(p.scores.reduce((n,s)=>n+s.score,0),total);
  const matches=selectForumRows(model.forum,{query:name.toLowerCase(),group:'current'});assert.deepEqual(matches.map(p=>p.id),[id]);assert.equal(matches[0].battleProfile,'https://19ib.ru/artist/'+slug);
  assert(!model.other.some(p=>p.id===id));assert(!model.veterans.some(p=>p.id===id));assert(group.has(id));
 }
 const events=D.events.map(s=>({...s,forum:group.has(s.userId)}));
 const index=unifiedAt(events,group.size,5,Date.parse(main.exportedAt),{otherCount:main.members.length-group.size,historical:false}).index;
 assert.equal(read('history.json').snapshots.at(-1).indices.forum.index,index);
});
