import {loadR1ApplicationContext} from './r1-application.js';
import {r2CohortReference} from './r2-home-model.js';
let pending;
// Reuse the existing R1 view when it is already mounted; direct R2 URLs keep
// the same approved loader and the same retryable reference promise.
export function primeR2GroupReference(context,data){
 pending??=Promise.resolve(r2CohortReference(context,data));
}
// One validated UUID directory for all R2 projections. Failures are retryable;
// each consumer retains its own unavailable/unknown presentation.
export function loadR2GroupReference(){
 return pending??=loadR1ApplicationContext().then(r2CohortReference).catch(()=>{pending=null;return null;});
}
