import {calculateImpactRow} from './impact-calculation.js';
self.onmessage=({data:{basis,kind,items}})=>{
 try{self.postMessage({rows:items.map(item=>calculateImpactRow(basis,kind,item))});}
 catch(error){self.postMessage({error:error.message});}
};
