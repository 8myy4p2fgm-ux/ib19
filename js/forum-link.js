import {mountRapperResearch} from './rapper-research.js';
import {rapperR1Model} from './rapper-report-model.js';
// The section uses the official context already loaded by the application.
export function createForumLink({$,context}){
 return mountRapperResearch({root:$('forum-link'),model:rapperR1Model(context)});
}
