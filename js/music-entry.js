import {localMusicEnabled} from './music-model.js';
export function musicAddButton(userId,round=1){return typeof location!=='undefined'&&localMusicEnabled(location.hostname)?`<button type="button" class="music-artist-add" data-music="artist-add" data-user="${userId}" data-round="${round}" aria-label="Добавить трек в очередь или плейлист">+</button>`:'';}
export function installMusicAddition({root,loadR1}){
 if(!localMusicEnabled(location.hostname))return;
 document.addEventListener('click',async e=>{const b=e.target.closest('[data-music="artist-add"]');if(!b)return;
  try{const [{openMusic},context]=await Promise.all([import('./music-page.js'),loadR1()]);const app=await openMusic(root,context);app.addArtist(b.dataset.user,Number(b.dataset.round));}
  catch{b.title='Не удалось загрузить музыкальный раздел. Откройте «Плейлисты» и повторите.';}
 });
}
