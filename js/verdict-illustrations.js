// Original grotesque pen drawings. Fictional decorative characters, not judge portraits.
const portraitTemplates={
pass:`<svg class="verdict-portrait angel" viewBox="0 0 160 150" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
<!-- Bent halo, a wire repair and plucked, mismatched wings. -->
<path d="M53 20C44 12 79 6 101 9l9 7-16 2-8 6C67 29 48 27 53 20Zm6 1c9 3 24 0 32-4M100 10l-3 8m5-7-2 7M68 26l-4 10"/>
<path d="M59 88C36 77 26 59 18 46l2 28-11-4 12 19-10 1 20 14-8 5 26 10M103 92c15-8 23-29 29-40l-1 22 12-9-5 22 12-3-15 17 11 2-29 18" fill="currentColor" fill-opacity=".04"/>
<path d="m23 66 23 31m-26-12 24 18m-11 5 15 5m82-41-18 26m24-10-21 16m16 0-14 8M12 114l-4 8m136-12 5 9"/>
<!-- Too-large lopsided head, sparse hair, heavy lids and uneven teeth. -->
<path d="M54 51C50 36 66 30 79 34c10-9 28 1 28 14l-1 15c15-5 15 12 3 15l-5 8c3 13-14 18-25 16-10 5-25-3-26-14l-4-13c-12 2-15-13-4-15l8 4Z" fill="#292b2b"/>
<path d="M57 37l-6-6m14 3-2-9m12 8 4-6M49 63l-4 5 5 2m59-1 5-1-5 5"/>
<g data-verdict-face>__ANGEL_FACE__</g>
<path d="M56 68l15 2m15-1 13-3M78 57l-5 15c-9 5 3 10 12 5l-2-9"/>
<path d="M57 76l-3 4m46-8 3 5m-40 18 5 2m20 0 4-2"/>
<!-- Frayed robe and a visibly crooked patch. -->
<path d="m64 103-13 9-10 28 15-3 7 7 13-5 12 5 11-7 20 2-12-29-14-8M64 106l14 9 13-11m-13 11-6 22m16-24 11 20M56 119l-4 12"/>
<path d="m94 119 12-3 4 12-13 3Zm2 1 1 3m5-6 1 3m5 1-3 1m4 5-3 1m-7 1 1-3M64 117l4 3m-6 4 4 2"/>
</svg>`,
fail:`<svg class="verdict-portrait devil" viewBox="0 0 160 150" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
<!-- One broken horn, one crooked horn; a tail tied in a knot. -->
<path d="M59 43C44 35 43 19 50 12l4 10 6-3 1 11 10 6M93 35c13-9 16-12 15-26 16 16 11 29-5 36" fill="currentColor" fill-opacity=".08"/>
<path d="m47 25 9 7m48-6 9-6m-5 11 7-5M116 132c30 11 40-5 28-16-10-10-19 2-10 8 9 5 13-3 8-9l-4-19-8 8 12 2"/>
<!-- Bulging asymmetrical face and a nasty toothy grin. -->
<path d="M53 46c4-15 23-14 31-11 20-9 28 7 25 23l13-5-7 15-9 3c7 19-1 28-21 28-12 8-31-1-35-16l-8-12-8-12 17 4Z" fill="#292b2b"/>
<g data-verdict-face>__DEVIL_FACE__</g>
<path d="M79 56l-5 16 14-1-5 6M51 74l4 6m48-11 3 6"/>
<path d="M75 100l7 13 7-13M54 88l-3 5m6 1-3 5m45-6 4 5"/>
<circle cx="101" cy="72" r="2"/><path d="m103 70 3-2m-54-1-5 1M69 40l4 3m15-4 5 2"/>
<!-- Shabby jacket, skewed tie and bent fork. -->
<path d="m65 103-16 8-8 29 28-4 17 6 34-5-10-30-14-5M62 107l9 20 10-15 12 14 9-19M80 113l-4 6 5 6-1 13 9-3-5-10 4-7Z"/>
<path d="m51 123 9 3m-12 4 10 3m44-14 9 7m-6 3 8 2M26 138l3-62m-12-3-4-20m28 19 2-17M17 68c0 16 23 15 24 0M29 78l-2-34m-4 6 4-9 4 9m-22 8 3-8 5 7m21 3 5-8 3 8M24 111c7-6 13-3 11 3l-8 2"/>
</svg>`
};

// Relative visual scale across judges with decisive events. It does not alter
// event attribution or displayed shares. Equal/absent ranges use neutral faces.
export function verdictExpression(judge,group){
 if(!judge?.n||!Number.isFinite(judge.pass))return 2;
 const shares=group.filter(j=>j.n>0&&Number.isFinite(j.pass)).map(j=>j.pass/j.n);
 if(!shares.length)return 2;
 const low=Math.min(...shares),high=Math.max(...shares);
 if(high===low)return 2;
 return Math.max(0,Math.min(4,Math.floor((judge.pass/judge.n-low)/(high-low)*5)));
}
function expressionFace(level,devil){
 const eyebrows=[
 'M55 53 L72 47 M85 47 L102 53',
 'M55 53 L72 50 M85 50 L102 53',
 'M55 51 L72 52 M85 52 L102 51',
 'M55 49 Q63 45 72 49 M85 49 Q94 45 102 49',
 'M54 46 Q64 39 74 47 M84 47 Q94 39 104 46'
 ][level];
 const eyes=level===4?'<path d="M55 62 Q64 48 74 62 M85 62 Q94 48 103 62"/>':
 '<path d="M55 59 q9 -8 18 2 q-10 8 -18 -2 Z M85 60 q9 -9 18 -1 q-8 9 -18 1 Z"/><path d="M63 58 v5 M94 57 v5"/>';
 const mouths=[
 '<path d="M58 92 Q79 66 101 90 Q81 78 58 92 Z" fill="#202624"/>',
 '<path d="M60 89 Q80 74 100 87"/>',
 '<path d="M60 85 Q79 86 100 83"/>',
 '<path d="M58 80 Q79 103 101 78"/>',
 '<path d="M57 78 Q79 94 102 76 L96 91 Q80 109 63 91 Z" fill="#202624"/>'+
 (devil?'<path d="M64 83 l5 10 5 -8 M86 84 l5 8 5 -12"/>':'<path d="M64 82 l2 8 7 1 -1 -6 M84 86 l1 7 6 -2 1 -9"/>')
 ][level];
 return `<g data-expression="${level}"><path d="${eyebrows}"/>${eyes}${mouths}</g>`;
}
export function renderVerdictIllustrations(level=2){
 const state=Number.isInteger(level)?Math.max(0,Math.min(4,level)):2;
 return {pass:portraitTemplates.pass.replace('__ANGEL_FACE__',expressionFace(state,false)),fail:portraitTemplates.fail.replace('__DEVIL_FACE__',expressionFace(4-state,true))};
}
export const verdictIllustrations=renderVerdictIllustrations(2);
