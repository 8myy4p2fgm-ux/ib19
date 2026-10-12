import {DAY} from './config.js';
export function snapshotTimes(start,end){if(!Number.isFinite(start)||!Number.isFinite(end))return Number.isFinite(end)?[end]:[];const times=[];const offset=3*3600000;let t=Math.floor((start+offset)/DAY)*DAY-offset+DAY;while(t<end){times.push(t);t+=DAY;}times.push(end);return times;}

