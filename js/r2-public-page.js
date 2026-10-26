// REL-OPEN-01 is a presentation gate. R2 collection and future report modules remain intact.
export function renderPublicRoundTwo(root,firstRoundURL){
 root.innerHTML=`<article class="round-information r2-public" aria-labelledby="r2-public-title"><p class="r2-public-status">Приём треков начался</p><h1 id="r2-public-title">Второй отборочный</h1><p>Аналитика второго раунда скоро появится на ТУЗе. Пока можно изучить итоги первого отборочного и судейские исследования.</p><a class="control" data-report-link>К первому отборочному →</a></article>`;
 root.querySelector('a').href=firstRoundURL;
}
