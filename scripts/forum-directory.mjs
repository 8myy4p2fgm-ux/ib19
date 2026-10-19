import {createHash} from 'node:crypto';

export function parseForumCSV(text){
 const rows=[];let row=[],value='',quoted=false;
 text=text.replace(/^\uFEFF/,'');
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}
  else if(!quoted&&(c===','||c==='\n'||c==='\r')){
   row.push(value);value='';if(c!==','){if(c==='\r'&&text[i+1]==='\n')i++;if(row.some(v=>v!==''))rows.push(row);row=[];}
  }else value+=c;
 }
 if(quoted)throw new Error('Unclosed CSV quote');
 if(value||row.length){row.push(value);rows.push(row);}
 const header=rows.shift();if(JSON.stringify(header)!==JSON.stringify(['group','forum_name','userId']))throw new Error('Unexpected forum.csv columns');
 const ids=new Set();return rows.map(r=>{
  if(r.length!==3||!['OG','Ветераны'].includes(r[0])||!r[1].trim()||!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(r[2])||ids.has(r[2]))throw new Error('Invalid/duplicate forum.csv row: '+r.join(','));
  ids.add(r[2]);return {group:r[0],forum_name:r[1],userId:r[2]};
 });
}

export function applyForumDirectory(previous,rows){
 const old=new Map([...(previous.quarantinedMembers||[]),...previous.members].map(p=>[p.userId,p]));
 const members=rows.map(p=>({...old.get(p.userId),...p,veteran:p.group==='Ветераны',scores:old.get(p.userId)?.scores||[]}));
 const canonical=rows.slice().sort((a,b)=>a.userId.localeCompare(b.userId));
 return {...previous,members,...(previous.quarantinedMembers?{quarantinedMembers:[]}:{}),directory:{source:'data/forum.csv',sha256:createHash('sha256').update(JSON.stringify(canonical)).digest('hex'),total:rows.length,og:rows.filter(p=>p.group==='OG').length,veterans:rows.filter(p=>p.group==='Ветераны').length}};
}
