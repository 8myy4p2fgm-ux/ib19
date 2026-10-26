import {reportCatalog,reportURL} from './report-catalog.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const chronicleIcons={outcomes:'<path d="m4 12 5 5L20 6 M4 21h16"/>',chronicle:'<path d="M3 3v18h18 M6 16l4-5 4 2 6-8"/>',hours:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',distribution:'<path d="M3 21h18 M5 21V14h4v7 M10 21V4h4v17 M15 21V9h4v12"/>'};
const card=(kind,r,round)=>`<a class="home-report-card" data-report-link data-report-kind="${kind}" data-report-id="${r.id}" href="${esc(reportURL(kind,r.id,round))}"><span class="home-report-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${chronicleIcons[r.id]}</svg></span><span class="home-report-copy"><strong>${r.label}</strong><small>${r.caption}</small></span><span class="home-report-arrow" aria-hidden="true">→</span></a>`;
export function chronicleLinks(round=1){return reportCatalog.dynamics.map(r=>card('dynamics',r,round)).join('');}
const digestIcons={
 ranking:'<path d="M8 3h8v6a4 4 0 0 1-8 0Z M8 5H4v2a4 4 0 0 0 4 4 M16 5h4v2a4 4 0 0 1-4 4 M12 13v5 M8 21h8 M9 18h6v3"/>',
 tinder:'<path d="M12 20S3 14.5 3 8.5a4.5 4.5 0 0 1 9-1 4.5 4.5 0 0 1 9 1C21 14.5 12 20 12 20Z"/>',
 dissidents:'<path d="M5 20v-4c0-4 14-4 14-8V4 M5 4v4c0 4 14 4 14 8v4 M2 7l3-3 3 3 M16 7l3-3 3 3"/>',
 speedsters:'<circle cx="12" cy="14" r="7"/><path d="M9 2h6 M12 2v5 M17 7l2-2 M12 10v4l3 2"/>',
 verdict:'<path d="M12 3v18 M8 21h8 M4 7h16 M5 7l-3 7h6Z M19 7l-3 7h6Z"/>',
 participants:'<circle cx="12" cy="7" r="3"/><path d="M6 21v-3a6 6 0 0 1 12 0v3 M5 5a3 3 0 0 0 0 6 M19 5a3 3 0 0 1 0 6 M2 20v-3a4 4 0 0 1 3-4 M22 20v-3a4 4 0 0 0-3-4"/>',
 matrix:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18 M15 3v18 M3 9h18 M3 15h18"/>',
 'tuz-impact':'<path d="M2 12h5l3-8 4 16 3-8h5"/>'
};
const digestCard=(kind,r,round)=>`<a class="home-report-card home-digest-card${r.id==='tinder'?' home-digest-tinder':''}" data-report-link data-report-kind="${kind}" data-report-id="${r.id}" href="${esc(reportURL(kind,r.id,round))}"><span class="home-report-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${digestIcons[r.id]}</svg></span><span class="home-report-copy"><strong>${r.label}</strong><small>${r.caption}</small></span><span class="home-report-arrow" aria-hidden="true">→</span></a>`;
export function digestLinks(round=1){return `<nav class="home-digest-grid" aria-label="Исследования Дайджеста ТУЗа">${['judges','rappers'].flatMap(kind=>reportCatalog[kind].map(r=>digestCard(kind,r,round))).join('')}</nav>`;}
export function mountHomeReportLinks(root,round=1){root.querySelector('[data-home-report-chronicle]').innerHTML=chronicleLinks(round);root.querySelector('[data-home-report-digest]').innerHTML=digestLinks(round);}
export function r2HomeReports(){return `<section class="r2-home-section home-research-navigation"><header class="r2-home-section-head"><h2>Хроника судейства</h2></header><p class="r2-home-research-intro">В отчётах — только доступные данные второго раунда.</p><nav class="home-chronicle-grid" aria-label="Отчёты о ходе баттла">${chronicleLinks(2)}</nav></section><section class="r2-home-section home-research-navigation"><header class="r2-home-section-head"><h2>Дайджест ТУЗа</h2></header>${digestLinks(2)}</section>`;}
