// Artist identity for research reports; forum nicknames stay in D.metadata.
export function artistIdentity(D,userId){
 const {artistName=null,artistSlug=null}=D.artists.get(userId)||{};
 return {userId,artistName,artistSlug,displayName:artistName||'Имя неизвестно',
  profileUrl:'https://19ib.ru/artist/'+encodeURIComponent(artistSlug||userId)};
}

export function artistNameElement(D,userId){
 const artist=artistIdentity(D,userId),link=document.createElement('a');
 link.textContent=artist.displayName;
 link.href=artist.profileUrl;link.target='_blank';link.rel='noopener noreferrer';
 link.title='UUID: '+userId;
 link.setAttribute('aria-label',artist.displayName+'. UUID: '+userId);
 if(!artist.artistName){
  const details=document.createElement('details'),summary=document.createElement('summary'),uuid=document.createElement('code');
  summary.textContent=artist.displayName;summary.setAttribute('aria-label',artist.displayName+'. Показать UUID: '+userId);
  uuid.textContent='UUID: '+userId;link.textContent='Карточка на 19ib.ru';
  details.append(summary,uuid,document.createElement('br'),link);
  return details;
 }
 return link;
}
