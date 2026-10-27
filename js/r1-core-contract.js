import {fixedR1Contract} from './r1-fixed-contract.js';
export const CORE_R1_CONTRACT='r1-public-core-v1';
// Deterministic transport projection of the approved public snapshot, not new results.
export const CORE_R1_HASH="92c3e131b7e93d6f25cff2f5ef809a5474f3e8012a3393e91556abd22dacf118";
export function coreR1Contract(snapshot,policy,hash){
 const fixed=fixedR1Contract(snapshot,policy);
 if(snapshot.coreVersion!==CORE_R1_CONTRACT||hash(snapshot)!==CORE_R1_HASH)throw Error('Public R1 core content mismatch');
 return fixed;
}
export const gradeKey=(participantId,judgeName,scoredAt)=>JSON.stringify([participantId,judgeName,scoredAt]);
