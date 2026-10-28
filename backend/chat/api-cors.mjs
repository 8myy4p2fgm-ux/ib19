// Exact site origin only. Preflight grants no authentication or data access.
export function preflight(request,origin,method,allowedHeaders=[]){
 if(request.method!=='OPTIONS')return null;
 const requested=(request.headers.get('Access-Control-Request-Headers')||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
 const allowed=request.headers.get('Origin')===origin&&request.headers.get('Access-Control-Request-Method')===method&&requested.every(h=>allowedHeaders.includes(h));
 return new Response(null,{status:allowed?204:403,headers:{'Cache-Control':'no-store','Vary':'Origin, Access-Control-Request-Method, Access-Control-Request-Headers',...(allowed?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':method,'Access-Control-Allow-Headers':allowedHeaders.join(', '),'Access-Control-Max-Age':'300'}:{})}});
}
export function withCors(response,request,origin){
 // A WebSocket upgrade must retain its webSocket object; Origin was checked before dispatch.
 if(response.status===101||request.headers.get('Origin')!==origin)return response;
 const headers=new Headers(response.headers);headers.set('Access-Control-Allow-Origin',origin);headers.set('Vary',[headers.get('Vary'),'Origin'].filter(Boolean).join(', '));headers.set('Cache-Control','no-store');
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
