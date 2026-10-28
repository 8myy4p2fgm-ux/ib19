import {SMILIES} from './chat-smilies-catalog.js';
const knownCodes=new Set(SMILIES.map(s=>s.code));
const sorted=[...SMILIES].sort((a,b)=>b.code.length-a.code.length);
// Return text and allowlisted tokens only. URLs and unknown codes stay text.
export function tokenizeSmilies(text){
 const tokens=[];let plain='',i=0;
 const flush=()=>{if(plain){tokens.push({text:plain});plain='';}};
 while(i<text.length){
  const url=text.slice(i).match(/^https?:\/\/[^\s]+/i);
  if(url){plain+=url[0];i+=url[0].length;continue;}
  const named=text.slice(i).match(/^:[\p{L}\p{N}_-]+:/u);
  if(named&&!knownCodes.has(named[0])){plain+=named[0];i+=named[0].length;continue;}
  const item=sorted.find(s=>text.startsWith(s.code,i)&&!(s.code.length===2&&/[\p{L}\p{N}]/u.test(text[i+2]||'')));
  if(item){flush();tokens.push({smiley:item});i+=item.code.length;}else plain+=text[i++];
 }
 flush();return tokens;
}
function imageFor(item){const img=document.createElement('img');img.className='forum-smiley';img.src=new URL('../chat/smilies/'+item.file,import.meta.url).href;img.alt=item.code;img.title=item.name+' '+item.code;img.width=item.width;img.height=item.height;img.decoding='async';img.addEventListener('error',()=>img.replaceWith(document.createTextNode(item.code)),{once:true});return img;}
export function renderSmilies(container,text){
 const fragment=document.createDocumentFragment();for(const token of tokenizeSmilies(text))fragment.append(token.smiley?imageFor(token.smiley):document.createTextNode(token.text));container.replaceChildren(fragment);
}
export function setupSmileyPicker(){
 const input=document.getElementById('message'),toggle=document.getElementById('smiley-toggle'),panel=document.getElementById('smiley-panel'),search=document.getElementById('smiley-search'),grid=document.getElementById('smiley-grid'),status=document.getElementById('smiley-status');
 let start=0,end=0;
 const remember=()=>{start=input.selectionStart;end=input.selectionEnd;};
 for(const event of ['select','keyup','click','input','blur'])input.addEventListener(event,remember);
 function close(){panel.hidden=true;toggle.setAttribute('aria-expanded','false');input.focus();input.setSelectionRange(start,end);}
 function display(){
  const query=search.value.trim().toLocaleLowerCase('ru-RU');const items=SMILIES.filter(s=>(s.code+' '+s.name).toLocaleLowerCase('ru-RU').includes(query));
  grid.replaceChildren(...items.map(s=>{const button=document.createElement('button');button.type='button';button.className='smiley-choice';button.title=s.name+' '+s.code;button.setAttribute('aria-label',s.name+' '+s.code);const code=document.createElement('span');code.textContent=s.code;button.append(imageFor(s),code);
   button.addEventListener('click',()=>{const value=input.value,first=Math.min(start,value.length),last=Math.min(end,value.length);const next=value.slice(0,first)+s.code+value.slice(last);if(next.length>input.maxLength){status.textContent='Смайл не помещается: максимум 500 символов.';return;}input.value=next;start=end=first+s.code.length;input.dispatchEvent(new Event('input',{bubbles:true}));start=end=first+s.code.length;close();});return button;}));
  status.textContent=items.length?'Найдено: '+items.length:'Ничего не найдено';
 }
 toggle.addEventListener('click',()=>{if(!panel.hidden){close();return;}remember();panel.hidden=false;toggle.setAttribute('aria-expanded','true');search.value='';display();search.focus();});
 document.getElementById('smiley-close').addEventListener('click',close);search.addEventListener('input',display);
 panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}});
}
