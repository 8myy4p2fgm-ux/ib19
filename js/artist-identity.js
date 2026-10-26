// Participant display identity is resolved exclusively by official UUID.
export function artistIdentity(D,userId){
 const {artistName=null,artistSlug=null}=D.artists.get(userId)||{};
 return {userId,artistName,artistSlug,displayName:artistName||'Имя недоступно',
  profileUrl:'https://19ib.ru/artist/'+encodeURIComponent(artistSlug||userId)};
}

export function artistNameElement(D,userId){
 const artist=artistIdentity(D,userId),link=document.createElement('a');
 link.textContent=artist.displayName;
 link.href=artist.profileUrl;link.target='_blank';link.rel='noopener noreferrer';
 link.setAttribute('aria-label',artist.displayName+'. Профиль участника на 19ib.ru');
 return link;
}
