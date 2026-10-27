import {createHash} from 'node:crypto';
// Byte-exact public modules from published 8c457657, retained only for cached
// old app imports. Fresh R2 stays the existing coming-soon page; no R2 source edits.
export const legacyAssets=Object.freeze({"js/r2-group-reference.js":"0ae086d9de66b14babf88770cb586b1bb982c9208d2547d4c5583979a3abbec8","js/r2-home-model.js":"dbc8802384feddb92b31df0dd955e4dadd6d83b1cb7007fd0ce4fe1a8770d6fb","js/r2-submissions.js":"ad8b09918689501cf3c488b77ee3f4116a58e439d41cd39401ec3a0ca5fd8dc6"});
export const moduleReference=/(\bfrom\s*|\bimport\s*\(\s*|\bimport\s*|\bnew\s+URL\(\s*)(['"])(\.[^'"]+\.js)(\2)/g;
export function versionPath(file,version){if(!/^[a-f0-9]{16}$/.test(version))throw Error('Invalid asset graph version');return file.replace(/\.js$/,'.'+version+'.js');}
export function versionModule(source,version){return source.replace(moduleReference,(_,prefix,quote,url)=>prefix+quote+versionPath(url,version)+quote);}
export function versionHTML(source,version){return source.replace(/(<script\b[^>]*\bsrc=)(['"])((?:\.\/|\.\.\/)js\/[^'"]+\.js)\2/g,(_,prefix,quote,url)=>prefix+quote+versionPath(url,version)+quote);}
// No timestamps, data-update times or locale-dependent ordering in the graph ID.
export function assetVersion(html,modules,compiler){const hash=createHash('sha256');hash.update(html);hash.update(compiler);for(const [file,source]of [...modules].sort(([a],[b])=>a<b?-1:a>b?1:0)){hash.update(file);hash.update('\0');hash.update(source);}return hash.digest('hex').slice(0,16);}
