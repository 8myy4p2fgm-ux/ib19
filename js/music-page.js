import {createMusicShareClient} from './music-share.js';
import {createCatalog,selectTracks,loadPlaylists,savePlaylists,addUnique,moveItem,localMusicEnabled} from './music-model.js';
import {createMusicPlayer} from './music-player.js';
import {musicAudioEnabled,createMusicSourceResolver} from './music-source.js';
import {validateR2Submissions} from './r2-submissions.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(action,label,extra='')=>`<button type="button" data-music="${action}" ${extra}>${label}</button>`;
const time=n=>Number.isFinite(n)?Math.floor(n/60)+':'+String(Math.floor(n%60)).padStart(2,'0'):'—:—';
let application;
export async function openMusic(root,context){
 if(!localMusicEnabled(location.hostname))return;
 if(!application)application=initialize(root,context).catch(e=>{application=null;throw e;});
 const app=await application;app.showShared();return app;
}
async function initialize(root,context){
 const styles=document.createElement('link');styles.rel='stylesheet';styles.href=new URL('../css/music.css',import.meta.url).href;
 await new Promise((resolve,reject)=>{styles.onload=resolve;styles.onerror=()=>{styles.remove();reject(Error('Не удалось загрузить стили плеера'));};document.head.append(styles);});
 let r2=null,r2Warning='';try{const response=await fetch(new URL('../data/rounds/r2-submissions.v1/snapshot.json',import.meta.url));if(!response.ok)throw Error();r2=validateR2Submissions(await response.json());}catch{r2Warning='Сохранённые сдачи R2 недоступны. Каталог R1 работает.';}
 const catalog=createCatalog(context,r2),byKey=new Map(catalog.map(p=>[p.key,p]));
 let storage;try{storage=window.localStorage;}catch{}const loaded=loadPlaylists(storage);let lists=loaded.lists,warning=loaded.warning,active=lists[0]?.id??'',shared=null,sharedError='',lastURL='',limit=12,menuKey='',pickerTarget='';
 const shareClient=createMusicShareClient();let sharedGeneration=0,sharedController,sharingGeneration=0,pendingShare=null;
 const filters={query:'',round:'all',group:'all',complete:false,order:'desc'};
 const getTrack=key=>byKey.get(key)??{key,name:'Неизвестный или недоступный трек',round:key.startsWith(context.roundId)?1:r2&&key.startsWith(r2.roundId)?2:'?',confirmed:false,total:null,count:0,required:null};
 const caption=t=>`R${t.round} · ${t.total===null?'Нет оценок':`${t.total} баллов · ${t.count}/${t.required} оценок`}${t.confirmed?'':' · недоступен'}`;
 const toast=document.createElement('p');toast.className='music-toast';toast.setAttribute('role','status');document.body.append(toast);let toastTimer;
 function announce(text){clearTimeout(toastTimer);toast.textContent=text;toast.hidden=false;toastTimer=setTimeout(()=>toast.hidden=true,3500);}
 function persist(){warning=savePlaylists(storage,lists);renderLists();if(warning)announce(warning);}
 function saveCopy(p){if(lists.length>=100){announce('Не больше 100 плейлистов.');return;}const copy={v:1,id:crypto.randomUUID(),name:p.name.trim(),tracks:[...p.tracks]};lists.push(copy);active=copy.id;persist();announce(warning||'Сохранена независимая локальная копия');}
 const currentList=()=>lists.find(p=>p.id===active);
 const playerRoot=document.createElement('aside');playerRoot.className='music-player';playerRoot.setAttribute('aria-label','Плеер TUZ19');
 playerRoot.innerHTML=`<div class="music-now"><strong data-now>Трек не выбран</strong><small data-round>Выберите трек из каталога</small><p data-status role="status"></p></div><div class="music-transport"><div class="music-control-row">${button('previous','⏮','aria-label="Предыдущий трек"')}${button('toggle','▶','class="music-primary music-play" aria-label="Воспроизвести или приостановить"')}${button('next','⏭','aria-label="Следующий трек"')}${button('current-add','+','aria-label="Добавить текущий трек"')}${button('queue','Очередь <span data-queue-count>0</span>')}</div><label class="music-progress"><span data-time>0:00 / —:—</span><input type="range" min="0" max="1000" value="0" data-seek aria-label="Перемотка" disabled></label></div><div class="music-options">${button('shuffle','⇄','aria-label="Случайный порядок" aria-pressed="false"')}${button('repeat','↻','aria-label="Повтор: выключен" aria-pressed="false"')}<label class="music-volume">Громкость<input type="range" min="0" max="100" value="70" data-volume aria-label="Громкость"></label></div>`;
 document.body.append(playerRoot);document.body.classList.add('music-mounted');
 let playerState;
 const queueDialog=document.createElement('dialog');queueDialog.className='music-dialog music-queue';queueDialog.setAttribute('aria-label','Очередь воспроизведения');
 queueDialog.innerHTML=`<header><h2>Очередь</h2>${button('close','×','aria-label="Закрыть очередь"')}</header><div class="music-actions">${button('queue-clear','Очистить')}${button('queue-mix','Перемешать')}</div><div data-queue-items></div>`;document.body.append(queueDialog);
 const audioEnabled=musicAudioEnabled(location);
 const player=createMusicPlayer({resolveSource:audioEnabled?createMusicSourceResolver(catalog):()=>null,onChange:s=>{playerState=s;renderPlayer();}});player.audio.hidden=true;player.audio.volume=.7;playerRoot.append(player.audio);playerState=player.state();
 // ResizeObserver reserves the actual player height, including wrapped status text.
 const resize=new ResizeObserver(()=>document.body.style.setProperty('--music-height',playerRoot.offsetHeight+'px'));resize.observe(playerRoot);
 function renderPlayer(){
  if(!playerState)return;const s=playerState,t=s.key?getTrack(s.key):null;
  playerRoot.querySelector('[data-now]').textContent=t?.name||'Трек не выбран';playerRoot.querySelector('[data-round]').textContent=t?caption(t):'Выберите трек';
  playerRoot.querySelector('[data-status]').textContent=s.error||s.status;
  playerRoot.querySelector('[data-music="toggle"]').textContent=s.paused?'▶':'❚❚';playerRoot.querySelector('[data-music="current-add"]').disabled=!t?.confirmed;
  playerRoot.querySelector('[data-time]').textContent=time(s.currentTime)+' / '+(s.duration===null?'—:—':time(s.duration));
  const seek=playerRoot.querySelector('[data-seek]');seek.disabled=!s.duration;seek.value=s.duration?Math.round(s.currentTime/s.duration*1000):0;
  playerRoot.querySelector('[data-queue-count]').textContent=s.queue.length;
  const shuffle=playerRoot.querySelector('[data-music="shuffle"]'),repeat=playerRoot.querySelector('[data-music="repeat"]');shuffle.setAttribute('aria-pressed',s.shuffle);repeat.setAttribute('aria-pressed',s.repeat!=='off');repeat.textContent=s.repeat==='one'?'↻ 1':'↻';repeat.setAttribute('aria-label','Повтор: '+({off:'выключен',all:'очередь',one:'один трек'})[s.repeat]);
  if(queueDialog.open)renderQueue();
 }
 function trackRows(keys,{mode='list'}={}){return keys.map((key,i)=>{const t=getTrack(key);return `<div class="music-track" data-key="${esc(key)}"><div><strong>${esc(t.name)}</strong><small>${esc(caption(t))}</small></div><div class="music-actions">${button(mode==='queue'?'queue-play':'track-play','▶',`data-index="${i}" aria-label="Выбрать ${esc(t.name)}" ${!t.confirmed?'disabled':''}`)}${mode==='catalog'?button('add','+',`aria-label="Добавить ${esc(t.name)}"`):mode==='shared'?button('enqueue','+ очередь'):button(mode==='queue'?'queue-up':'list-up','↑',`data-index="${i}" aria-label="Поднять ${esc(t.name)}" ${i===0?'disabled':''}`)+button(mode==='queue'?'queue-down':'list-down','↓',`data-index="${i}" aria-label="Опустить ${esc(t.name)}" ${i===keys.length-1?'disabled':''}`)+button(mode==='queue'?'queue-remove':'list-remove','×',`data-index="${i}" aria-label="Удалить ${esc(t.name)}"`)}</div></div>`;}).join('');}
 function renderQueue(){const scroll=queueDialog.scrollTop;queueDialog.querySelector('[data-queue-items]').innerHTML=trackRows(playerState.queue,{mode:'queue'})||'<p>Очередь пуста</p>';queueDialog.scrollTop=scroll;}
 root.classList.add('music-page');root.innerHTML=`<header class="ds-page-head"><p class="music-kicker">TUZ19 / МУЗЫКА</p><h1>Слушать баттл</h1><p>Треки подряд, очередь и свои плейлисты. Без регистрации.</p></header><p class="music-note">${audioEnabled?'Аудио предоставлено 19ib.ru. Воспроизведение начинается по нажатию.':'Локальная проверка без аудио.'}</p><div data-shared></div><div class="music-grid"><section class="music-card music-catalog"><header><h2>Треки баттла</h2>${button('queue','Очередь')}</header><label>Поиск по нику<input type="search" data-search placeholder="Найти среди всех участников" autocomplete="off"></label>${button('filters','Фильтры','class="music-filter-toggle" aria-expanded="false" aria-controls="music-filters"')}<div class="music-filter-panel" id="music-filters"><div class="music-filters"><label>Раунд<select data-filter="round"><option value="all">Все</option><option value="1">R1</option><option value="2">R2</option></select></label><label>Группа<select data-filter="group"><option value="all">Все</option><option value="forum">Форум</option><option value="veterans">Ветераны</option></select></label><label class="music-sort">Сортировка<select data-filter="order"><option value="desc">Баллы: больше → меньше</option><option value="asc">Баллы: меньше → больше</option><option value="alpha">Ник: А → Я</option></select></label></div><label class="music-check"><input type="checkbox" data-complete> Полностью оценены</label></div><p data-results class="music-muted" role="status"></p><div data-picker-note></div><div data-catalog></div>${button('more','Показать ещё','class="music-more"')}<p class="music-note">R1 — принятый финальный снимок. R2 — сохранённые сдачи без судейской аналитики. ${esc(r2Warning)}</p></section><section class="music-card"><header><h2>Мои плейлисты</h2>${button('create','+ Создать','class="music-primary"')}</header><p class="music-note">Плейлисты хранятся в этом браузере и могут исчезнуть при очистке его данных. Между устройствами не синхронизируются.</p><p data-storage-warning role="status"></p><div data-lists></div><div data-detail></div></section></div>`;
 const menu=document.createElement('dialog');menu.className='music-dialog';menu.setAttribute('aria-label','Добавить трек');document.body.append(menu);
 const edit=document.createElement('dialog');edit.className='music-dialog';edit.setAttribute('aria-label','Название плейлиста');edit.innerHTML=`<header><h2>Название плейлиста</h2>${button('close','×','aria-label="Закрыть"')}</header><form><label>Название<input name="name" maxlength="120" required autocomplete="off"></label><p data-edit-error role="alert"></p><button class="music-primary" type="submit">Сохранить</button></form>`;document.body.append(edit);let editMode='create',pendingKey='';
 const sharing=document.createElement('dialog');sharing.className='music-dialog';sharing.setAttribute('aria-label','Поделиться плейлистом');sharing.innerHTML=`<header><h2>Поделиться</h2>${button('close','×','aria-label="Закрыть"')}</header><p>По ссылке доступен сохранённый снимок. Локальный оригинал не меняется. Ссылка доступна любому, у кого она есть. Удаление локального плейлиста не удаляет снимок по ссылке.</p><label>Ссылка<textarea readonly rows="5" data-share-url></textarea></label>${button('copy','Копировать')}${button('retry-share','Повторить','hidden')}<p data-share-error role="status"></p>`;document.body.append(sharing);
 function renderCatalog(){
  const rows=selectTracks(catalog,filters);root.querySelector('[data-results]').textContent=`Найдено ${rows.length} · всего ${catalog.length}`;
  const host=root.querySelector('[data-catalog]');host.innerHTML=trackRows(rows.slice(0,limit).map(t=>t.key),{mode:'catalog'})||'<p>По этим условиям треков нет.</p>';
  if(pickerTarget){const p=lists.find(p=>p.id===pickerTarget);root.querySelector('[data-picker-note]').innerHTML=p?`<p class="music-note">Добавление в «${esc(p.name)}» · нажимайте + у треков ${button('picker-done','Готово')}</p>`:'';for(const b of host.querySelectorAll('[data-music="add"]')){const key=b.closest('[data-key]').dataset.key;if(p?.tracks.includes(key)){b.textContent='✓';b.disabled=true;}}}else root.querySelector('[data-picker-note]').textContent='';
  root.querySelector('[data-music="more"]').hidden=rows.length<=limit;
 }
 function renderLists(){
  root.querySelector('[data-storage-warning]').textContent=warning;
  root.querySelector('[data-lists]').innerHTML=lists.map(p=>`<div class="music-list ${p.id===active?'is-active':''}">${button('select',`<strong>${esc(p.name)}</strong><small>${p.tracks.length} треков</small>`,`data-list="${p.id}" aria-pressed="${p.id===active}"`)}${button('delete','×',`data-list="${p.id}" aria-label="Удалить плейлист ${esc(p.name)}"`)}</div>`).join('')||'<p class="music-muted">Создайте свой первый плейлист.</p>';
  const p=currentList();root.querySelector('[data-detail]').innerHTML=p?`<div class="music-detail"><header><h3>${esc(p.name)}</h3>${button('rename','Переименовать')}</header><div class="music-actions">${button('list-play','▶ Всё','class="music-primary"')}${button('list-mix','⇄ Перемешать')}${button('share','↗ Поделиться')}${button('picker','Добавить треки')}</div>${trackRows(p.tracks)||'<p class="music-muted">Плейлист пуст</p>'}</div>`:'';
 }
 function openMenu(key){const t=getTrack(key);if(!t.confirmed){announce('Источник трека не подтверждён');return;}menuKey=key;menu.innerHTML=`<header><h2>Добавить трек</h2>${button('close','×','aria-label="Закрыть"')}</header><p>${esc(t.name)} · R${t.round}</p><div class="music-menu">${button('enqueue-menu','Добавить в очередь')}${lists.map(p=>button('add-to-list',esc(p.name),`data-list="${p.id}"`)).join('')}${button('create-from-menu','Создать плейлист')}</div>`;menu.showModal();}
 function openEdit(mode,key=''){editMode=mode;pendingKey=key;edit.querySelector('input').value=mode==='rename'?currentList()?.name??'':'';edit.querySelector('[data-edit-error]').textContent='';edit.showModal();edit.querySelector('input').focus();}
 edit.querySelector('form').onsubmit=e=>{e.preventDefault();const name=edit.querySelector('input').value.trim();if(!name){edit.querySelector('[data-edit-error]').textContent='Введите название';return;}if(editMode==='rename'){currentList().name=name;persist();}else{if(lists.length>=100){edit.querySelector('[data-edit-error]').textContent='Не больше 100 плейлистов';return;}const p={v:1,id:crypto.randomUUID(),name,tracks:pendingKey?[pendingKey]:[]};lists.push(p);active=p.id;persist();}edit.close();renderCatalog();announce(warning||'Плейлист сохранён');};
 function addToList(id,key){const p=lists.find(p=>p.id===id);if(!p)return;const before=p.tracks.length;try{p.tracks=addUnique(p.tracks,key);persist();renderCatalog();announce(before===p.tracks.length?'Трек уже в плейлисте':'Трек добавлен в плейлист');}catch(e){announce(e.message);}}
 function renderShared(){root.querySelector('[data-shared]').innerHTML=shared?`<section class="music-card music-shared"><header><h2>${esc(shared.name)}</h2>${button('save-shared','Сохранить себе','class="music-primary"')}</header><p class="music-muted">Плейлист по ссылке · ${shared.tracks.length} треков</p><div class="music-actions">${button('shared-play','▶ Всё')}</div>${trackRows(shared.tracks,{mode:'shared'})||'<p>Плейлист пуст</p>'}</section>`:sharedError?`<p class="music-note" role="alert">${esc(sharedError.message)} ${sharedError.retryable?button('retry-shared-load','Повторить загрузку'):''}</p>`:'';}
 async function showShared({force=false}={}){
  if(!force&&lastURL===location.href)return;lastURL=location.href;const url=lastURL,ticket=++sharedGeneration;
  sharedController?.abort();sharedController=new AbortController();shared=null;sharedError=null;
  const params=new URL(url).searchParams;
  if(!params.has('share')&&!params.has('list')){renderShared();return;}
  root.querySelector('[data-shared]').innerHTML='<p class="music-note" role="status">Загружаем плейлист по ссылке…</p>';
  try{const value=await shareClient.load(url,{signal:sharedController.signal});if(ticket!==sharedGeneration||url!==location.href)return;shared=value;}
  catch(error){if(ticket!==sharedGeneration||url!==location.href||error.name==='AbortError')return;sharedError=error;}
  renderShared();
 }
 sharing.addEventListener('close',()=>sharingGeneration++);
 async function publishShare(playlist){
  if(playlist)pendingShare=structuredClone(playlist);if(!pendingShare)return;
  const ticket=++sharingGeneration,field=sharing.querySelector('[data-share-url]'),message=sharing.querySelector('[data-share-error]'),copy=sharing.querySelector('[data-music="copy"]'),retry=sharing.querySelector('[data-music="retry-share"]');
  field.value='';copy.disabled=true;retry.hidden=true;message.textContent='Создаём короткую ссылку…';if(!sharing.open)sharing.showModal();
  try{const url=await shareClient.publish(pendingShare);if(ticket!==sharingGeneration)return;field.value=url;copy.disabled=false;message.textContent='Короткая ссылка готова. Снимок сохранён в сервисе ссылок.';}
  catch(error){if(ticket!==sharingGeneration)return;message.textContent=error.message;retry.hidden=!error.retryable;}
 }
 async function action(e){
  const b=e.target.closest('[data-music]');if(!b||b.disabled)return;const a=b.dataset.music,key=b.closest('[data-key]')?.dataset.key,p=currentList(),i=Number(b.dataset.index);
  try{
  if(a==='close'){b.closest('dialog').close();return;}
  if(a==='filters'){const open=root.querySelector('.music-filter-panel').classList.toggle('is-open');b.setAttribute('aria-expanded',String(open));}
  if(a==='track-play')player.playKey(key);
  if(a==='add'){if(pickerTarget)addToList(pickerTarget,key);else openMenu(key);}
  if(a==='enqueue'||a==='enqueue-menu'){if(player.enqueue(a==='enqueue'?key:menuKey))announce('Трек добавлен в очередь');else announce('Очередь заполнена');if(menu.open)menu.close();}
  if(a==='add-to-list'){addToList(b.dataset.list,menuKey);menu.close();}
  if(a==='create-from-menu'){menu.close();openEdit('create',menuKey);}
  if(a==='create')openEdit('create');if(a==='rename'&&p)openEdit('rename');
  if(a==='select'){active=b.dataset.list;pickerTarget='';renderLists();renderCatalog();}
  if(a==='delete'&&confirm('Удалить этот плейлист из браузера?')){lists=lists.filter(p=>p.id!==b.dataset.list);active=lists[0]?.id??'';pickerTarget='';persist();renderCatalog();}
  if(a==='list-up'||a==='list-down'){p.tracks=moveItem(p.tracks,i,a==='list-up'?-1:1);persist();}
  if(a==='list-remove'){p.tracks.splice(i,1);persist();}
  if(a==='list-play'||a==='list-mix'){if(p.tracks.length)player.replace(p.tracks,{mix:a==='list-mix'});else announce('Плейлист пуст');}
  if(a==='picker'){pickerTarget=p.id;filters.query='';root.querySelector('[data-search]').value='';renderCatalog();root.querySelector('[data-search]').focus();root.querySelector('.music-catalog').scrollIntoView({block:'start'});}
  if(a==='picker-done'){pickerTarget='';renderCatalog();}
  if(a==='share')await publishShare(p);
  if(a==='retry-share')await publishShare();
  if(a==='retry-shared-load')await showShared({force:true});
  if(a==='copy'){const text=sharing.querySelector('[data-share-url]').value;if(!text)return;try{await navigator.clipboard.writeText(text);sharing.querySelector('[data-share-error]').textContent='Ссылка скопирована';}catch{sharing.querySelector('[data-share-error]').textContent='Выделите и скопируйте ссылку вручную';sharing.querySelector('textarea').select();}}
  if(a==='save-shared'&&shared)saveCopy(shared);if(a==='shared-play'&&shared)player.replace(shared.tracks);
  if(a==='current-add'&&playerState.key)openMenu(playerState.key);
  if(a==='toggle')player.toggle();if(a==='next')player.next();if(a==='previous')player.previous();
  if(a==='shuffle')player.setShuffle();if(a==='repeat')player.setRepeat();
  if(a==='queue'){renderQueue();queueDialog.showModal();}
  if(a==='queue-play')player.start(i);if(a==='queue-up'||a==='queue-down')player.move(i,a==='queue-up'?-1:1);
  if(a==='queue-remove')player.remove(i);if(a==='queue-clear')player.clear();if(a==='queue-mix')player.mix();
  if(a==='more'){limit+=12;renderCatalog();}
  }catch(error){announce(error.message||'Не удалось выполнить действие');}
 }
 document.addEventListener('click',action);
 playerRoot.querySelector('[data-seek]').oninput=e=>player.seek(Number(e.target.value)/1000*playerState.duration);
 playerRoot.querySelector('[data-volume]').oninput=e=>player.volume(Number(e.target.value)/100);
 root.querySelector('[data-search]').oninput=e=>{filters.query=e.target.value;limit=12;renderCatalog();};
 root.querySelector('[data-complete]').onchange=e=>{filters.complete=e.target.checked;limit=12;renderCatalog();};
 root.querySelectorAll('[data-filter]').forEach(el=>el.onchange=()=>{filters[el.dataset.filter]=el.value;limit=12;renderCatalog();});
 window.addEventListener('ib19:route',()=>{for(const d of [menu,edit,sharing,queueDialog])if(d.open)d.close();});
 renderCatalog();renderLists();renderPlayer();showShared();
 return {showShared,addArtist(userId,round){const track=catalog.find(t=>t.userId===userId&&t.round===round);if(track)openMenu(track.key);else announce('Подтверждённый трек не найден');}};
}
