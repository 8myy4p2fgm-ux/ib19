import {fixedR1Contract} from './r1-fixed-contract.js';
export const PUBLIC_R1_CONTRACT='r1-public-v1';
// Hashes identify the deterministic, allowlisted projection of the accepted source.
// Original source approvals and their hashes remain unchanged.
const hashes=Object.freeze({"main":"511b9b32c4111d29059fe0349885542f73fafa340ba9d9d1872ad94d7f57e103","forum":"48491cfe4ae0401250691db5ee6c7d9c111ed3efad1871ad7fcf0e9ae2933a44","metadata":"227e6de31e8ec44cf36a0815ed2a4d1778fe3249ca8aedbfd76da9fc6d26330a"});
export function publicR1Contract(snapshot,policy,hash){
 const fixed=fixedR1Contract(snapshot,policy);
 if(snapshot.forum?.publicSchema!==PUBLIC_R1_CONTRACT)throw Error('Unsupported public R1 schema');
 for(const key of ['main','forum','metadata'])if(hash(snapshot[key])!==hashes[key])throw Error('Public R1 content mismatch: '+key);
 return fixed;
}
