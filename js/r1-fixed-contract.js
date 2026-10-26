import {FIRST_ROUND_ID} from './round-context.js';
export const FIXED_R1_CONTRACT='r1-fixed-facts-v1';
const contract=Object.freeze({
 version:FIXED_R1_CONTRACT,roundId:FIRST_ROUND_ID,runId:'2026-10-22T19:42:08.167Z',policyVersion:'r1-official-zippy-v2',
 coreHashes:Object.freeze({main:'025c7aafbe85061b4205c2a63a850637d6f797e1b9900c950ce677630f627198',forum:'3a66f8d990fecf641fb69f29d41509779616944f14b66805ba6148b0d7b324a0',metadata:'429f73f0be292b47779a395857c4ff80a4c20b3726b2bfa0ab8dfe3c0fb34469'}),
 archiveHistoryHash:'2428468738d8be580594ae8a9fff68be2ec98f49ce66db364227576d36eacb46',
 // Reviewed quality facts from the archived log, not synthetic score events.
 // Preserve the existing attribution exclusions without loading the log.
 chronologyUncertainIds:Object.freeze([
  '5d899be2-93bd-4309-9c83-75b11add6b41','46b0006f-be87-4411-861c-b7ef57a82c3d','c81585a1-8f8a-412f-8c60-659524417908',
  '8c0ebea1-0c85-4281-a209-d9672abbd0b9','d3562480-3f06-45f7-bb64-7cbc4cb996bb','1a5a3e39-6b23-4067-8a96-4077575fe107',
  '7d7a4fe3-02b9-485c-9888-3c4b874522a9','f23a2cf8-504a-495c-bfe1-c18fa5c26dc0','f804d725-659e-43f9-a7be-f132ced6661c',
  'cc7acc06-c1ee-46a4-a8d4-0686dadc6fe6','019b22ab-024d-4c3d-92a0-ec15b516fa94','dd3140c9-bbce-41c2-9be7-50930b735543'
 ])
});
// This contract is chosen by trusted application code, never API metadata.
export function fixedR1Contract(snapshot,policy){
 const m=snapshot.metadata;
 if(snapshot.history!==undefined||m?.source?.roundId!==contract.roundId||m.source.round?.id!==contract.roundId||m.runId!==contract.runId||m.exportedAt!==contract.runId||m.forumExportedAt!==contract.runId||policy.roundId!==contract.roundId||policy.version!==contract.policyVersion)throw Error('Unsupported fixed R1 facts contract');
 return contract;
}
