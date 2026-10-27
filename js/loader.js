// The shell is visible immediately; data loading belongs to its inline status.
// A full-screen overlay must not hide ready navigation or block R1/R2 switching.
(() => {
 document.getElementById('carrot-loader')?.remove();
 // Hint the same loader resource early, while the module graph is downloading.
 // R2, Horo and ambiguous/legacy URLs keep their existing route-owned loading.
 const url=new URL(location.href),rounds=url.searchParams.getAll('round'),base=new URL('../',document.currentScript.src);
 const path=url.pathname.slice(base.pathname.length);
 if(/\.[a-f0-9]{16}\.js$/.test(new URL(document.currentScript.src).pathname)&&!url.hash&&(!rounds.length||(rounds.length===1&&rounds[0]==='1'))&&['','judges/','rappers/','dynamics/','events/'].includes(path)){
  const hint=document.createElement('link');hint.rel='preload';hint.as='fetch';hint.crossOrigin='anonymous';hint.href=new URL('public-data/r1/core.json',base).href;document.head.append(hint);
 }

 window.ib19Loader={
  async preparing(){await new Promise(resolve=>requestAnimationFrame(resolve));},
  ready(){document.getElementById('carrot-loader')?.remove();}
 };
})();
