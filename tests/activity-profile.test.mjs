import test from 'node:test';import assert from 'node:assert/strict';
import {activityProfile} from '../js/activity-clock.js';
test('approved B profile passes all 24 real radii and stays between adjacent extrema',()=>{
 const bins=[493,267,298,356,173,91,45,105,204,260,321,389,743,826,1152,834,1159,1196,1479,1489,1483,1344,951,722],before=[...bins];
 const {radii,path}=activityProfile(bins),coords=[...path.matchAll(/[ML]([^ ,]+),([^ Z]+)/g)].map(m=>[+m[1],+m[2]]);
 assert.equal(coords.length,288);assert.deepEqual(bins,before);
 coords.forEach(([x,y],i)=>{const h=Math.floor(i/12),r=Math.hypot(x-320,y-320),lo=Math.min(radii[h],radii[(h+1)%24]),hi=Math.max(radii[h],radii[(h+1)%24]);assert.ok(r>=lo-1e-8&&r<=hi+1e-8);if(i%12===0)assert.ok(Math.abs(r-250*bins[h]/1489)<1e-8);});
 assert.ok(path.endsWith(' Z'));
});
test('zero hours collapse to zero radius without NaN or invented measurements',()=>{
 const {radii,path}=activityProfile(Array(24).fill(0));assert.deepEqual(radii,Array(24).fill(0));assert.ok(!/NaN|Infinity/.test(path));assert.equal(new Set([...path.matchAll(/[ML]([^ Z]+)/g)].map(m=>m[1])).size,1);
});
