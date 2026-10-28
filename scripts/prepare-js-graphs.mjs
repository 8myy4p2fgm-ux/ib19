// Explicit release preparation only. Ordinary build/collector never modifies source archives.
import {currentGraph,addGraph,readGraphs,retirementPlan} from './js-graphs.mjs';
if(process.argv.includes('--retirement-plan')){
 const i=process.argv.indexOf('--retirement-plan'),{registry}=await readGraphs();
 console.log(JSON.stringify({dryRun:true,ownerApprovalRequired:true,graphs:retirementPlan(registry,process.argv.slice(i+1))},null,2));
}else{
 const graph=await currentGraph();console.log(await addGraph({...graph,sourceBase:process.env.GRAPH_SOURCE_BASE||null}));
}
