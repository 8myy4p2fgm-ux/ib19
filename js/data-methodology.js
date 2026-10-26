import {createRankingDialog} from './ranking-dialog.js';

// Reuse the existing native dialog/focus owner; one instance per R2 page root.
const dialogs=new WeakMap();
const esc=value=>String(value??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountDataMethodology(root,content){
 let dialog=dialogs.get(root);
 if(!dialog){dialog=createRankingDialog();dialog.element.classList.add('jr-dialog');dialog.element.id='data-methodology-'+root.id;const titleId='data-method-title-'+root.id;dialog.element.querySelector('h2').id=titleId;dialog.element.setAttribute('aria-labelledby',titleId);dialog.element.querySelector('header').classList.add('jr-dialog-head');dialogs.set(root,dialog);}
 const button=root.ownerDocument.createElement('button');button.type='button';button.className='control';button.textContent='ⓘ Как считаем';button.dataset.dataMethodology='';button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls',dialog.element.id);
 button.onclick=()=>dialog.open('method','Как считаем',button,body=>{body.innerHTML=content;});
 root.querySelector('article').append(button);
}
export function r2DataMethodology(info){
 return `<p>Показаны подтверждённые сдачи второго раунда. Исходная когорта — участники со статусом «Прошёл» в утверждённом архиве первого раунда. Число ожидающих — когорта за вычетом её участников с подтверждённой сдачей.</p><p>Прочерк означает, что сведений пока нет, а не нулевой результат. Прохождение первого раунда и факт сдачи трека второго учитываются раздельно. Судейские расчёты второго раунда не выполняются.</p>`;
}
