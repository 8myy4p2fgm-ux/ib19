import {loadR2GroupReference} from './r2-group-reference.js';
import {rapperR2Model} from './rapper-report-model.js';
import {mountRapperResearch} from './rapper-research.js';
const mounted=new WeakMap();
export function renderR2Rappers(root,info){
 mounted.get(root)?.destroy();
 const placeholder=document.createElement('p');placeholder.setAttribute('role','status');placeholder.textContent='Загружаем участников…';root.replaceChildren(placeholder);
 loadR2GroupReference().then(reference=>{if(!placeholder.isConnected)return;mounted.set(root,mountRapperResearch({root,model:rapperR2Model(info,reference),round:2}));});
}
