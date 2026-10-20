const contentUrl=new URL('../horo/content.json',import.meta.url);
const media=path=>new URL(path,contentUrl).href;
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let content;
export async function renderHoro(root){
 if(root.dataset.ready)return;
 content ||= fetch(contentUrl).then(r=>{if(!r.ok)throw Error('Forum content unavailable');return r.json();}).catch(e=>{content=null;throw e;});
 const data=await content;
 if(root.dataset.ready)return;
 root.innerHTML=`<p class="horo-credits">отдельный респект за весь этот вайб-контент: <a href="https://www.hip-hop.ru/forum/id202646-kyler" target="_blank" rel="noopener noreferrer">kyler</a>, <a href="https://www.hip-hop.ru/forum/id72227-mc-ebihara" target="_blank" rel="noopener noreferrer">MC Ebihara</a> со всей семьёй, <a href="https://www.hip-hop.ru/forum/id208541-kanon" target="_blank" rel="noopener noreferrer">КаньОн</a>, <a href="https://www.hip-hop.ru/forum/id227610-medroh" target="_blank" rel="noopener noreferrer">медрох</a> и остальные причастные. без вас тут было бы слишком нормально.</p>
 <section class="horo-panel"><h2>Краткое изложение происходящего в теме от сына Ебихары</h2><div class="horo-notes">${data.summaries.map(n=>`<details class="horo-note"><summary><span class="horo-issue">ВЫПУСК №${esc(n.number)}</span><strong>${esc(n.title)}</strong><span aria-hidden="true" class="horo-more">⌄</span></summary><div class="horo-note-body">${n.paragraphs.map(p=>`<p>${esc(p)}</p>`).join('')}</div></details>`).join('')}</div></section>
 <section class="horo-panel"><h2>Видосы</h2>${data.videos.map(v=>`<div class="horo-video"><iframe src="${esc(v.url)}" title="${esc(v.title)}" loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div><p class="horo-video-link"><a href="${esc(v.link)}" target="_blank" rel="noopener noreferrer">Смотреть на YouTube</a></p>`).join('')}</section>
 <section class="horo-panel"><h2>Картинки</h2><div class="horo-gallery">${data.images.map((m,i)=>`<button type="button" class="horo-image${m.frames?' horo-series':''}" data-horo-image="${i}" aria-label="Открыть: ${esc(m.alt)}"><img src="${esc(media(m.src))}" alt="${esc(m.alt)}" loading="lazy" decoding="async"></button>`).join('')}</div></section>
 <footer class="horo-footer"><span>андер</span><span class="horo-footer-right">считали ради интереса. появились вопросы. <a href="https://t.me/gleb_grr" target="_blank" rel="noopener noreferrer">тележка 🍊🍊🍊</a></span></footer>`;
 root.dataset.ready='true';
 const box=document.createElement('dialog');box.className='horo-lightbox';box.setAttribute('aria-label','Полноразмерный просмотр изображения');
 box.innerHTML='<div class="horo-view-controls"><button type="button" class="horo-zoom" aria-pressed="false">Увеличить</button><button type="button" class="horo-close" aria-label="Закрыть просмотр">×</button></div><div class="horo-view-scroll" tabindex="0"><div class="horo-view-images"></div></div>';
 document.body.append(box);
 const scroll=box.querySelector('.horo-view-scroll'),images=box.querySelector('.horo-view-images'),zoom=box.querySelector('.horo-zoom');
 let previousOverflow='',opener;
 function setZoom(on){box.classList.toggle('is-zoomed',on);zoom.setAttribute('aria-pressed',String(on));zoom.textContent=on?'Уместить':'Увеличить';}
 root.querySelectorAll('[data-horo-image]').forEach(button=>button.addEventListener('click',()=>{
  const item=data.images[Number(button.dataset.horoImage)],frames=item.frames||[item.src];
  images.classList.toggle('horo-view-series',frames.length>1);
  images.innerHTML=frames.map((src,i)=>`<img src="${esc(media(src))}" alt="${esc(item.alt)}${frames.length>1?' · '+(i+1):''}">`).join('');
  opener=button;setZoom(false);previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';box.showModal();scroll.scrollTo(0,0);
 }));
 box.querySelector('.horo-close').onclick=()=>box.close();
 zoom.onclick=()=>setZoom(!box.classList.contains('is-zoomed'));
 images.addEventListener('click',()=>setZoom(!box.classList.contains('is-zoomed')));
 scroll.addEventListener('click',e=>{if(e.target===scroll)box.close();});
 box.addEventListener('close',()=>{document.body.style.overflow=previousOverflow;setZoom(false);images.replaceChildren();opener?.focus({preventScroll:true});});
 window.addEventListener('ib19:route',()=>{if(!root.classList.contains('active')&&box.open)box.close();});
}
