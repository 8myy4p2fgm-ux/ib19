import {loadR1ApplicationContext} from './r1-application.js';
import {r2CohortReference} from './r2-home-model.js';
let pending;
// One validated UUID directory for all R2 projections. Failures are retryable;
// each consumer retains its own unavailable/unknown presentation.
export function loadR2GroupReference(){
 return pending??=loadR1ApplicationContext().then(r2CohortReference).catch(()=>{pending=null;return null;});
}
