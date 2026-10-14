import {Clock,GitHub} from './clock-core.mjs';
export class Scheduler {
 constructor(ctx,env){this.env=env;this.tail=Promise.resolve();this.clock=new Clock(ctx.storage,new GitHub(env),{enabled:env.ENABLED==='true',dryRun:env.DRY_RUN!=='false'});}
 async fetch(request){
  if(request.method!=='POST'||new URL(request.url).pathname!=='/tick')return new Response('Not found',{status:404});
  const {scheduledAt}=await request.json();
  const task=this.tail.then(()=>this.clock.tick(scheduledAt));this.tail=task.catch(()=>{});
  try{return Response.json(await task);}catch{return Response.json({status:'error'},{status:502});}
 }
}
export default {
 async scheduled(controller,env,ctx){
  if(env.ENABLED!=='true'){console.log(JSON.stringify({component:'tuz19-clock',status:'disabled',scheduledAt:controller.scheduledTime}));return;}
  ctx.waitUntil((async()=>{const stub=env.SCHEDULER.get(env.SCHEDULER.idFromName('ib19-clock'));const response=await stub.fetch('https://scheduler.internal/tick',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scheduledAt:controller.scheduledTime})});if(!response.ok)throw new Error('Clock failed; inspect redacted Durable Object log');})());
 },
 fetch(){return new Response('Not found',{status:404});}
};
