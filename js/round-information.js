import {validateR2Submissions} from './r2-submissions.js';
import {loadData} from './data.js';
export const SECOND_ROUND_ID='235f6600-5224-4adf-bbcc-a220f4572251';
export const R2_SOURCE_HASH='d9db6a68cb1fed8b01e2538c078911c74fd464ab42a53d9ffe4690151fbeda25';
const validDate=v=>typeof v==='string'&&/Z$/.test(v)&&Number.isFinite(Date.parse(v));
const assert=(ok,why)=>{if(!ok)throw new Error('Некорректный информационный ресурс R2: '+why);};
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
export function validateRoundInformation(value){
 assert(value?.schemaVersion===1&&value.resourceVersion==='r2-information-v1'&&value.kind==='round-information','версия схемы');
 assert(value.roundId===SECOND_ROUND_ID&&value.tournamentId==='9345a642-d1fb-4ac7-aebc-b59f2628170b'&&value.roundOrder===2&&value.type==='solo','идентификатор');
 assert(typeof value.name==='string'&&!!value.name.trim()&&value.status==='pending'&&value.resultsPublished===false,'описание');
 const p=value.sourceParameters;
 assert(p&&p.judgesRequired===7&&p.scoreScale===10&&p.maxScore===70&&p.advanceCount===256&&p.passThreshold===null&&p.maxParticipants===null&&p.minDurationSec===90&&p.maxDurationSec===120,'параметры сохранённого ответа');
 assert(value.times?.deadline==='2026-11-23T20:59:00.000Z'&&value.times.judgingStartsAt==='2026-11-19T21:00:00.000Z'&&value.times.judgingDeadline==='2027-01-05T20:59:00.000Z'&&value.times.startedAt===null&&value.times.judgingStartedAt===null&&validDate(value.times.updatedAt),'сроки');
 assert(value.capabilities?.information===true&&['roster','submissions','scores','judges','analytics'].every(k=>value.capabilities[k]===false),'доступные возможности');
 assert(['roster','submissions','scores'].every(k=>value.unavailable?.[k]?.count===null&&typeof value.unavailable[k].reason==='string'),'неизвестные значения');
 assert(value.unknownRules&&Object.keys(value.unknownRules).length>=12&&Object.values(value.unknownRules).every(v=>v===null),'неизвестные правила');
 const source=value.provenance;
 assert(source?.sha256===R2_SOURCE_HASH&&source.bytes===852&&source.reportedEndpoint===`https://api.19ib.ru/rounds/${SECOND_ROUND_ID}/full`&&source.serverResponseAt===null&&source.browserRetrievedAt===null&&validDate(source.importedAt),'происхождение');
 assert(value.publication?.version===R2_SOURCE_HASH&&value.publication.retrievedAt===null&&value.publication.importedAt===source.importedAt,'версия публикации');
 assert(value.topic?.confirmation==='source-placeholder; actual topic unknown','неподтверждённая тема');
 return freeze(structuredClone(value));
}
export function loadRoundInformation(){return loadData({resource:new URL('../data/rounds/r2-submissions.v1/snapshot.json',import.meta.url),validateResource:validateR2Submissions});}
