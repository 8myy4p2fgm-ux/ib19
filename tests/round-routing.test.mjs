import test from 'node:test';import assert from 'node:assert/strict';
import {parseRoute} from '../js/routes.js';
const parse=(path,base='/')=>parseRoute('http://local'+path,base);
test('Single router resolves default/explicit rounds, all sections and profile query',()=>{
 for(const path of ['/','/dynamics/','/judges/','/rappers/','/events/','/horo/'])for(const round of [1,2]){
  const state=parse(path+'?round='+round);assert.equal(state.round,round);assert.equal(state.error,null);assert.equal(state.canonical,round===2?'/?round=2':path+'?round=1');if(round===2){assert.equal(state.type,'overview');assert.equal(state.params.toString(),'round=2');}
 }
 assert.equal(parse('/').round,1);assert.equal(parse('/judges/?judge=id').round,1);assert.equal(parse('/judges/?round=2&judge=id').params.get('judge'),null);
});
test('Unsupported, duplicate, empty and conflicting URL values remain explicit errors',()=>{
 for(const path of ['/?round=3','/?round=','/?round=01','/?round=1&round=2','/?round=1&round=1','/?round=2#/round/1/judges','/?round=2#/round/2/judges?round=1','/?round=1#forum?round=2','/#/round/3/judges','/#/round/2/judges?round=1']){assert(parse(path).error,path);assert.equal(parse(path).round,null);}
});
test('Legacy hash and basePath retain profile/filter parameters without another router',()=>{
 assert.equal(parse('/#/round/1/judges?judge=id&grade=1').canonical,'/judges/?judge=id&grade=1');
 assert.equal(parse('/#/round/2/judges').canonical,'/?round=2');
 assert.equal(parse('/#forum').canonical,'/rappers/');
 for(const legacy of ['judge/id','compare/id'])assert.equal(parse('/#/round/1/'+legacy).canonical,'/judges/');
 assert.equal(parse('/ib19/#/round/1/participant/id','/ib19/').canonical,'/ib19/rappers/');
 assert.equal(parse('/ib19/judges/?round=2&judge=id','/ib19/').canonical,'/ib19/?round=2');
});
