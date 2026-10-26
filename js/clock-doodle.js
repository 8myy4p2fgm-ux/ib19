import {activityProfile} from './activity-clock.js';

// Editorial associations with the fixed R1 silhouettes, keyed by exact UUID.
// These are drawings, not inferred personal traits. No name matching or network.
export const clockDoodleCatalog=Object.freeze({
 all:['hedgehog','Ёж'],
 'd4cfd881-3f3d-4605-bdbe-eb470aa001e9':['duck','Утка'],
 '6c0fc11a-b532-4108-8aa7-b73e121892dc':['rocket','Ракета'],
 '10b6e6ea-9706-4f8a-bbc3-378fc078b809':['balloon','Воздушный шар'],
 '151c5486-8840-4506-af66-0da88f6800e6':['fish','Рыба'],
 '66a95aaa-96c3-406a-9566-0042b136c337':['ray','Скат'],
 'df69c076-dd85-4503-939f-12dc1ef397ba':['hourglass','Песочные часы'],
 '1bc6525f-3ac7-448e-80c2-af66dbac79da':['bag','Пакет'],
 'c4b430b0-bd0c-4ec5-9dd0-3282b1aeb276':['leaf','Лист'],
 '7560f2cb-d45e-465e-b299-064eb58b0726':['moose','Лось'],
 '86168a35-7df8-4ab5-ba67-46dc6bc22944':['owl','Сова'],
 'be27b094-a420-4dca-a8e2-4875207b45ec':['glove','Перчатка'],
 '413a9a04-e9e1-4e0e-9aa0-9745863cba49':['bear','Медведь'],
 '268ce437-27f9-45e2-a9a5-960387c81f0f':['ghost','Привидение'],
 'a2181b3e-81a6-4e7d-b9b2-d10f4cb20b2b':['submarine','Подводная лодка'],
 'ba786673-683d-4468-96d2-86b5dc794f4e':['snail','Улитка'],
 '1674e7b9-683c-47ae-82c5-00671353f5df':['kettle','Чайник'],
 '07c45f94-ba8d-4487-8e22-dee4374d1af3':['penguin','Пингвин'],
 '676cd622-f063-452f-9a05-6ddaaf86f111':['cat','Кот'],
 '11b78b45-fad9-40b0-ad50-5221fa0f9b37':['crocodile','Крокодил'],
 '0fc8d2fb-4129-4cc0-96b7-4322d553403a':['boot','Ботинок'],
 'da7f934d-eedd-416f-9b4e-51da465203de':['iron','Утюг'],
 '0965e5cc-ff25-4aef-85fa-b0fafef7decc':['starfish','Морская звезда']
});

export function clockDoodle(bins,judgeId='all'){
 if(!Object.hasOwn(clockDoodleCatalog,judgeId)||!Array.isArray(bins)||bins.length!==24||bins.some(n=>!Number.isFinite(n)||n<0))return null;
 const total=bins.reduce((s,n)=>s+n,0);if(!total)return null;
 const peak=Math.max(...bins),hour=bins.indexOf(peak),[kind,title]=clockDoodleCatalog[judgeId];
 // Reuse the analytical path byte for byte. Details live in a separate SVG group.
 const {path}=activityProfile(bins),points=[...path.matchAll(/[ML]([^, ]+),([^ ]+)/g)].map(m=>[+m[1],+m[2]]);
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys),w=right-left,h=bottom-top,cx=(left+right)/2,cy=(top+bottom)/2;
 const point=(a,r)=>[320+Math.cos((a*15-90)*Math.PI/180)*r,320+Math.sin((a*15-90)*Math.PI/180)*r];
 const [fx,fy]=point(hour,peak/total>.32?145:120);
 const stroke=d=>`<path d="${d}" fill="none"/>`,circle=(x,y,r,fill='none')=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
 const eye=(x,y)=>circle(x,y,13,'#252a28')+circle(x+3,y-2,4,'currentColor');
 let marks=eye(fx-17,fy)+eye(fx+17,fy)+stroke(`M${fx-15} ${fy+26} Q${fx} ${fy+38} ${fx+16} ${fy+24}`);
 switch(kind){
 case 'hedgehog':
  for(let i=0;i<24;i++)if(bins[i]>peak*.45)marks+=stroke(`M${point(i,250*bins[i]/peak+5)} L${point(i,250*bins[i]/peak+34)}`);
  marks+=stroke(`M${left+w*.3} ${bottom-8} l-8 26 24 -3 M${left+w*.65} ${bottom-8} l10 23 19 -5`);break;
 case 'duck':
  marks+=stroke(`M${left+18} ${cy-12} l-58 13 60 13 M${cx-15} ${bottom+4} l-8 28 -25 0 M${cx+30} ${bottom+4} l-3 28 26 0 M${cx} ${cy+12} q25 30 65 6`);break;
 case 'rocket':
  marks=circle(fx,fy,45)+marks+stroke('M300 320 l-25 44 31 -18 14 32 16 -37 25 11 -18 -35');break;
 case 'balloon':
  marks+=stroke(`M${cx-40} ${bottom-22} l9 30 38 0 10 -30 M${cx-30} ${bottom+8} l0 28 38 0 0 -28 M${left+w*.35} ${top+28} q-28 22 -25 60`);break;
 case 'fish':
  marks+=stroke(`M${left+12} ${cy} l-48 -36 4 72 Z M${cx} ${top+15} l-20 -32 48 16`);
  for(let i=0;i<3;i++)marks+=circle(right+25+i*17,cy-i*34,8+i*3);break;
 case 'ray':
  marks+=stroke(`M320 320 q80 95 10 145 q-30 20 -40 -5 M${fx-65} ${fy+30} q-20 -50 -60 -20 M${fx+50} ${fy+35} q30 -45 65 -20`);break;
 case 'hourglass':
  marks=stroke(`M${cx-50} ${top-10} h100 M${cx-50} ${bottom+10} h100 M${cx-50} ${top-10} V${bottom+10} M${cx+50} ${top-10} V${bottom+10} M${cx-35} ${top+50} l35 16 32 -16 M${cx} ${cy-15} v30 M${cx-35} ${bottom-25} l35 -25 35 25 Z`);break;
 case 'bag':
  marks+=stroke(`M${cx-45} ${top+28} v-43 q45 -46 90 0 v43 M${cx-45} ${top+37} q45 18 90 0 M${left+25} ${bottom-30} l12 -20 M${right-25} ${bottom-30} l-12 -20`);break;
 case 'leaf':
  marks=stroke(`M${left+30} ${bottom-20} Q${cx} ${cy} ${right-20} ${top+20} M${left+30} ${bottom-20} l-26 42`);
  for(const t of [.25,.45,.65]){const x=left+w*t,y=bottom-h*t;marks+=stroke(`M${x} ${y} l-28 -45 M${x} ${y} l44 6`);}break;
 case 'moose':
  marks+=stroke(`M${fx-26} ${fy-20} l-25 -65 -40 -20 M${fx-51} ${fy-85} l-2 -30 M${fx-68} ${fy-94} l-12 -20 M${fx+26} ${fy-20} l25 -65 40 -20 M${fx+51} ${fy-85} l2 -30 M${fx+68} ${fy-94} l12 -20 M${fx-22} ${fy+20} q22 35 44 0`);break;
 case 'owl':
  marks+=circle(fx-17,fy,22)+circle(fx+17,fy,22)+stroke(`M${fx-42} ${fy-22} l-7 -35 28 24 M${fx+42} ${fy-22} l7 -35 -28 24 M${fx-6} ${fy+23} l6 13 7 -13`);break;
 case 'glove':
  marks=stroke(`M${left+w*.25} ${bottom-20} l0 30 ${w*.5} 0 0 -30 M${left+w*.25} ${bottom+2} h${w*.5}`);
  for(let i=0;i<5;i++)marks+=stroke(`M${left+w*(.28+i*.1)} ${bottom+2} v8`);break;
 case 'bear':
  marks+=circle(fx-36,fy-35,23)+circle(fx+36,fy-35,23)+circle(fx,fy+20,15)+circle(fx,fy+15,5,'currentColor')+stroke(`M${fx-18} ${fy+40} q18 12 36 0`);break;
 case 'ghost':
  marks+=stroke(`M${left+w*.2} ${bottom-5} l10 34 22 -20 22 20 24 -26 M${fx-40} ${fy-30} Q${fx} ${fy-80} ${fx+40} ${fy-30}`);break;
 case 'submarine':
  marks=stroke(`M${cx-12} ${top+4} v-50 h43 v15 h-25 v35 M${left+5} ${cy} h-25 m0 -24 v48 M${right-12} ${cy-10} q28 10 0 20`);
  for(let i=0;i<3;i++)marks+=circle(left+w*(.35+i*.18),cy,17);break;
 case 'snail':
  marks+=stroke(`M${fx-22} ${fy-17} l-12 -37 M${fx+22} ${fy-17} l12 -37 M${left+w*.4} ${cy} c-60 -65 85 -110 92 -30 c7 65 -82 78 -65 24 c10 -28 42 -15 32 5`);break;
 case 'kettle':
  marks+=stroke(`M${left+25} ${cy-45} c-120 -45 -120 135 0 90 M${right-20} ${cy-25} l65 -40 -22 65 -30 18 M${cx-55} ${top+10} q55 -22 110 0 M${cx-10} ${top-2} v-15 h20 v15`);break;
 case 'penguin':
  marks+=stroke(`M${fx-8} ${fy+17} l8 16 9 -16 Z M${fx-43} ${fy+45} q-35 45 -25 85 M${fx+43} ${fy+45} q35 45 25 85 M${cx-45} ${bottom-3} l-22 22 42 0 M${cx+25} ${bottom-3} l-3 22 42 0`);break;
 case 'cat':
  marks+=stroke(`M${fx-30} ${fy-20} l-15 -40 36 24 M${fx+30} ${fy-20} l15 -40 -36 24 M${fx-45} ${fy+10} l-35 -8 M${fx-45} ${fy+20} l-35 6 M${fx+45} ${fy+10} l35 -8 M${fx+45} ${fy+20} l35 6 M${fx-5} ${fy+15} l5 6 6 -6`);break;
 case 'crocodile':
  marks+=stroke(`M${left+w*.2} ${cy+25} Q${cx} ${cy+38} ${right-15} ${cy+10}`);
  for(let i=0;i<6;i++)marks+=stroke(`M${left+w*(.25+i*.1)} ${cy+26} l8 14 7 -16`);break;
 case 'boot':
  marks=stroke(`M${left+15} ${bottom-8} q${w/2} 30 ${w-30} 0 M${cx-35} ${top+30} l40 45 M${cx+5} ${top+30} l-40 45 M${cx-30} ${top+75} l40 45 M${cx+10} ${top+75} l-40 45`);break;
 case 'iron':
  marks=stroke(`M${left+w*.25} ${cy-10} q40 -85 100 -25 l18 25 Z M${left+18} ${bottom-10} L${right-18} ${bottom-10} M${left+20} ${cy} q-65 -15 -50 35 q10 20 -20 32`);break;
 case 'starfish':
  for(let i=0;i<24;i+=2){const [x,y]=point(i,bins[i]/peak*155);marks+=circle(x,y,3,'currentColor');}break;
 }
 return {kind,title,path,svg:`<svg viewBox="${left-85} ${top-85} ${w+170} ${h+170}" aria-hidden="true" focusable="false"><path class="clock-doodle-outline" d="${path}"/><g class="clock-doodle-marks">${marks}</g></svg>`};
}
export function renderClockDoodle(bins,judgeId='all'){
 const d=clockDoodle(bins,judgeId);return d?`<figure class="clock-doodle" data-doodle-kind="${d.kind}">${d.svg}<figcaption><strong>${d.title}</strong></figcaption></figure>`:'';
}
