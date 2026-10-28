// Operator-only client. Never imported into a public browser module or asset graph.
import {readFile,lstat} from 'node:fs/promises';import {fileURLToPath} from 'node:url';import path from 'node:path';
import {isolatedPreviewOrigin} from './preview-policy.mjs';
export async function controlChat({action,credentialsFile,expectedPreviewOrigin,fetchImpl=fetch}){
 if(!['status','off','on'].includes(action))throw Error('Action must be status, off or on');
 const info=await lstat(credentialsFile);if(!info.isFile()||info.isSymbolicLink()||(info.mode&0o077))throw Error('Operator credential file must be a private regular file (0600)');
 let credentials;try{credentials=JSON.parse(await readFile(credentialsFile,'utf8'));}catch{throw Error('Invalid operator credentials file');}
 const url=new URL(credentials.origin);
 const preview=expectedPreviewOrigin?isolatedPreviewOrigin(expectedPreviewOrigin):null;
 const loopback=['127.0.0.1','localhost','[::1]'].includes(url.hostname);
 if((preview&&url.origin!==preview)||url.origin!==credentials.origin||(!loopback&&!['https://tuz19.ru','https://api.tuz19.ru'].includes(url.origin)&&url.origin!==preview)||url.username||url.password)throw Error('Refusing unknown operator origin');
 const publicAccess=credentials.access==='public';
 if(typeof credentials.adminToken!=='string'||! /^[A-Za-z0-9_-]{24,256}$/.test(credentials.adminToken))throw Error('Independent ADMIN_TOKEN required');
 if(publicAccess){if(preview||credentials.cookie)throw Error('Public operator must not use MAINT cookie or preview mode');}
 else if(!/^__Host-tuz19_session=[\w.-]+$/.test(credentials.cookie||''))throw Error('Owner session cookie and independent ADMIN_TOKEN required');
 const headers={Origin:url.origin==='https://api.tuz19.ru'?'https://tuz19.ru':url.origin,...(publicAccess?{}:{Cookie:credentials.cookie})};
 if(action!=='status'){
  const response=await fetchImpl(url.origin+'/api/chat/admin',{method:'POST',redirect:'manual',headers:{...headers,Authorization:'Bearer '+credentials.adminToken,'Content-Type':'application/json'},body:JSON.stringify({action:'enabled',value:action==='on'}),signal:AbortSignal.timeout(15000)});
  if(response.status!==200)throw Error('Admin request rejected, HTTP '+response.status+'; verify MAINT session and operator access');
 }
 const health=await fetchImpl(url.origin+'/api/chat/status',{headers,redirect:'manual',signal:AbortSignal.timeout(15000)});
 if(![200,503].includes(health.status))throw Error('Health rejected, HTTP '+health.status+'; verify MAINT session');
 const enabled=health.status===200;if(action==='off'&&enabled||action==='on'&&!enabled)throw Error('Unexpected room state');
 return {origin:url.origin,enabled,status:health.status};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{if(!process.env.CHAT_OPERATOR_CREDENTIALS_FILE)throw Error('Set CHAT_OPERATOR_CREDENTIALS_FILE to a private credentials file');console.log(JSON.stringify(await controlChat({action:process.argv[2],credentialsFile:process.env.CHAT_OPERATOR_CREDENTIALS_FILE,expectedPreviewOrigin:process.env.CHAT_OPERATOR_PREVIEW_ORIGIN})));}catch(e){console.error(e.message);process.exitCode=1;}
}
