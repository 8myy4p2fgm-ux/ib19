import {PUBLIC_R1_CONTRACT} from './r1-public-contract.js';
import {FIXED_R1_CONTRACT} from './r1-fixed-contract.js';
import {loadData} from './data.js';
import {createOfficialR1View} from './r1-official-view.js';
import {ZIPPY_R1_POLICY_V2_VERSION} from './r1-official-policy.js';
import {FIRST_ROUND_ID} from './round-context.js';

// Local-only selection. Rollback changes this value to 'baseline', then rebuilds.
// Source JSON, published metadata and the baseline directory remain untouched.
export const ACTIVE_R1_SOURCE='candidate';
export const R1_SOURCES=Object.freeze({
 candidate:Object.freeze({directory:'../docs/data-candidates/r1-2026-10-22-194208/',runId:'2026-10-22T19:42:08.167Z',policyVersion:ZIPPY_R1_POLICY_V2_VERSION,sourceContract:FIXED_R1_CONTRACT})
});
export async function loadR1ApplicationContext({source='public'}={}){
 if(source!=='public'&&!Object.hasOwn(R1_SOURCES,source))throw new Error('Unsupported local R1 source');
 const selected=source==='public'?{...R1_SOURCES.candidate,directory:'../public-data/r1/',sourceContract:PUBLIC_R1_CONTRACT}:R1_SOURCES[source];
 const D=await loadData({dataRoot:new URL(selected.directory,import.meta.url),includeSource:true,includeHistory:!selected.sourceContract,validateMetadata(meta){
  if(meta?.source?.roundId!==FIRST_ROUND_ID||meta.source.round?.id!==FIRST_ROUND_ID||meta.runId!==selected.runId||meta.exportedAt!==selected.runId||meta.forumExportedAt!==selected.runId)throw new Error('Unexpected local R1 snapshot');
 }});
 return createOfficialR1View(D.sourceSnapshot,{policyVersion:selected.policyVersion,sourceContract:selected.sourceContract});
}
