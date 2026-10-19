import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseForumCSV} from '../scripts/forum-directory.mjs';
import {normalizeData} from '../js/data.js';
import {buildForumLink,selectForumRows} from '../js/forum-link-model.js';
import {temporaryExclusionRules} from '../js/analytics-selection.js';

test('Zippy Kid belongs to the published forum table and search; over-scored Zippy stays quarantined',()=>{
 const retained='0460e777-7403-40dd-8176-fd168c93a530',excluded='52385ac3-2e09-4df9-a04c-ca4348cf42d6';
 const rows=parseForumCSV(fs.readFileSync('data/forum.csv','utf8'));
 assert.deepEqual(rows.filter(r=>r.forum_name.toLowerCase()==='zippy kid'),[{group:'OG',forum_name:'Zippy kid',userId:retained}]);
 assert(!rows.some(r=>r.userId===excluded));
 assert(temporaryExclusionRules.some(r=>r.userId===excluded&&r.enabled));
 assert(!temporaryExclusionRules.some(r=>r.userId===retained&&r.enabled));
 const main=JSON.parse(fs.readFileSync('data/19ib_all_judges_REPAIRED.json'));
 const forum=JSON.parse(fs.readFileSync('data/forum_judges_export.json'));
 const person=main.members.find(p=>p.userId===retained);
 assert.equal(person.artistName,'Zippy Kid');assert.equal(person.scores.length,5);
 assert.deepEqual(forum.members.find(p=>p.userId===retained).scores,person.scores);
 assert(!forum.members.some(p=>p.userId===excluded));
 assert.equal(main.quarantinedMembers.find(p=>p.userId===excluded).scores.length,6);
 const D=normalizeData(main,forum),model=buildForumLink(D);
 assert(D.metadata.has(retained));assert(!D.byId.has(excluded));
 assert(model.forum.some(p=>p.id===retained));assert(!model.other.some(p=>p.id===retained));
 assert.deepEqual(selectForumRows(model.forum,{query:'Zippy'}).map(p=>p.id),[retained]);
 assert.deepEqual(selectForumRows(model.forum,{query:'zippy kid'}).map(p=>p.id),[retained]);
});
