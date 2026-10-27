// Exact, explicit preview origin. Production and the earlier standalone preview are excluded.
export const PREVIEW_NAME='tuz19-chat-integration-preview';
export const PREVIEW_ORIGIN='https://tuz19-chat-integration-preview.tdwgv5mk79.workers.dev';
export function isolatedPreviewOrigin(value){
 let u;try{u=new URL(value);}catch{throw Error('Explicit isolated HTTPS preview origin required');}
 if(u.protocol!=='https:'||u.origin!==value||u.username||u.password||u.port||!u.hostname.startsWith(PREVIEW_NAME+'.')||/(^|\.)tuz19\.ru$/i.test(u.hostname))throw Error('Explicit isolated HTTPS integration preview origin required; existing preview is excluded');
 return u.origin;
}
