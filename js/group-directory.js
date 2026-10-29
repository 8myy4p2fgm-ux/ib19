import {GROUP_DIRECTORY_V2} from './group-directory-v2.js';
import {contentHash} from './r1-correction.js';
const fail=message=>{throw Error('Group directory: '+message);};
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
function normalized(members){
 if(!Array.isArray(members))fail('missing members');
 const ids=new Set();
 return members.map(p=>{
  if(!uuid.test(p.userId)||ids.has(p.userId))fail('invalid or duplicate UUID');ids.add(p.userId);
  if(!['OG','Форум','Ветераны'].includes(p.group)||typeof p.veteran==='boolean'&&p.veteran!==(p.group==='Ветераны'))fail('inconsistent exclusive group');
  return {userId:p.userId,group:p.group==='Ветераны'?'Ветераны':'OG',current:p.current!==false};
 }).sort((a,b)=>a.userId.localeCompare(b.userId));
}
// Source directories stay immutable. An unknown source/version fails closed.
export function versionedGroupDirectory(value,version){
 if(version!==GROUP_DIRECTORY_V2.version)fail('unsupported version');
 const directory=GROUP_DIRECTORY_V2,hash=contentHash(normalized(value?.members));
 if(hash!==directory.baseFingerprint&&hash!==directory.fingerprint)fail('unapproved source membership');
 if(contentHash(normalized(directory.members))!==directory.fingerprint)fail('version checksum mismatch');
 return {version:directory.version,members:structuredClone(directory.members)};
}
// Called only on caller-owned data after the archive and score policy validate.
export function applyR1GroupDirectory(data,observedEvents,version){
 const directory=versionedGroupDirectory({members:[...data.referenceMetadata.values()]},version),reference=new Map();
 for(const entry of directory.members){
  const person=data.byId.get(entry.userId)||data.archivedById.get(entry.userId),previous=data.referenceMetadata.get(entry.userId);
  if(!person&&entry.current)fail('member outside official snapshot');
  if(!previous&&!person)fail('new UUID outside official snapshot');
  reference.set(entry.userId,{...previous,...entry,scores:structuredClone(person?.scores||previous?.scores||[])});
 }
 data.referenceMetadata=reference;
 data.metadata=new Map([...reference].filter(([id])=>data.byId.has(id)));
 data.people=data.people.map(p=>{const row=p.slice();row[2]=data.metadata.get(p[0])?.group||'';return row;});
 for(const event of data.events)event.forum=data.metadata.has(event.userId);
 for(const event of observedEvents)event.forum=data.metadata.has(event.userId);
 data.groupDirectoryVersion=directory.version;
 return directory.version;
}
