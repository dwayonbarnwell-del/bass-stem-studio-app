// Each row is an original pocket, a short answer, and a longer connecting run.
// Times are twelfths of a beat. Degrees are relative to the sounding chord.
// L and U approach the destination from a semitone below or a scale step above.
window.BassPracticeSeries=(()=>{
 'use strict';
 const P=window.BassPracticeCore,F=window.BassFillCore,G=window.BassStudyGroups;
 const Q=window.BassCuratedStudies,H=window.BassAccompaniment,N=window.BassStudyDisplay;
 const profiles={
  worship:['0 21 33','1 5 1','18 27 33 39 45','3 5 6 U L','12 18 24 27 33 39 45','5 8 6 5 3 U L'],
  gospel:['0 9 21 30 42','1 8 5 1 6','15 24 32 36 40 44','3 5 8 6 U L','9 16 20 24 30 36 40 44','3 5 8 9 8 6 U L'],
  soul:['0 15 24 39','1 3 5 1','15 24 30 39 45','3 6 5 2 L','12 18 21 27 33 39 45','3 5 6 8 5 U L'],
  rnb:['0 10 21 30 40','1 1 8 5 1','20 27 32 39 45','5 3 6 2 L','15 21 27 30 36 42 45','3 6 5 9 8 U L'],
  jazz:['0 12 24 36','1 3 5 7','12 20 24 36 44','3 7 5 U L','8 12 20 24 32 36 44','3 5 7 9 6 U L'],
  blues:['0 12 20 24 36 44','1 3 5 6 5 3','12 20 28 36 44','3 5 6 U L','8 12 20 24 32 36 44','1 3 5 6 5 U L'],
  funk:['0 9 18 24 33 42','1 8 5 1 1 5','9 18 27 36 45','8 1 5 3 L','9 15 18 27 33 39 45','8 1 5 8 3 U L'],
  reggae:['6 18 30 42','1 5 1 3','9 18 30 39 45','1 5 3 2 L','9 18 24 33 39 42 45','1 3 5 8 5 U L'],
  highlife:['0 9 15 24 33 42','1 3 5 8 6 5','9 18 27 33 42','3 6 5 9 U','6 15 21 27 33 39 45','3 6 8 5 9 U L'],
  afrobeat:['0 9 18 27 36','1 5 1 8 5','9 18 24 33 42','1 5 6 5 U','9 18 21 30 36 42 45','1 5 6 5 3 U L'],
  makossa:['0 9 18 27 36 42','1 5 3 8 5 3','9 18 27 36 42','5 8 3 6 U','6 12 21 27 33 39 45','1 8 5 3 6 U L'],
  woro:['0 8 18 26 36 44','1 5 1 3 5 8','8 16 26 36 44','5 1 3 5 U','8 16 20 26 32 40 44','1 5 8 6 5 U L'],
  ariaria:['0 6 15 24 30 39','1 8 5 1 3 5','6 15 24 33 42','8 5 3 6 U','6 12 18 27 33 39 45','1 5 8 5 6 U L'],
  praise:['0 9 18 24 36','1 5 8 1 5','12 21 30 39 45','3 5 8 U L','9 18 24 32 36 40 44','1 3 5 8 6 U L'],
  'african-praise':['0 9 18 27 36 42','1 5 8 3 5 1','9 18 24 36 42','3 8 5 6 U','6 15 21 27 32 40 44','1 3 5 8 6 U L'],
  seben:['0 6 15 21 30 39','1 5 8 6 3 5','6 15 24 33 42','3 8 6 5 U','6 12 18 24 30 39 45','3 5 8 10 6 U L'],
  soukous:['0 9 15 24 33 39','1 3 8 5 6 3','9 15 24 33 42','3 6 8 5 U','6 15 21 24 33 39 45','3 6 8 10 5 U L'],
  sungura:['0 6 15 21 30 39','1 5 8 5 3 5','6 15 24 33 45','1 8 5 3 U','6 12 18 27 33 39 45','1 5 8 10 6 U L'],
  mbalax:['0 9 21 27 39','1 8 5 3 6','9 21 27 36 45','8 5 3 6 U','6 15 21 30 36 42 45','1 8 5 9 6 U L'],
  mbaqanga:['0 6 15 24 36','1 3 5 1 6','12 18 27 36 42','1 3 5 6 U','6 15 21 27 33 39 45','1 3 5 6 8 U L'],
  zouk:['0 9 21 30 39','1 5 1 3 5','15 21 30 39 45','3 5 8 U L','9 15 21 30 33 39 45','1 5 8 6 3 U L']
 };
 // Alternate endings teach a second route into the same chord change.
 const endings={
  worship:['21 27 33 36 40 44','5 6 8 5 U L'],
  gospel:['15 18 24 30 36 40 44','3 5 8 10 6 U L'],
  rnb:['19 24 30 33 40 45','6 5 3 2 U L'],
  soul:['12 21 27 33 39 45','3 5 3 6 U L'],
  jazz:['12 20 24 32 36 44','7 3 5 9 U L'],
  highlife:['9 15 24 30 39 45','3 6 5 8 6 U'],
  afrobeat:['6 18 21 30 36 45','1 5 8 6 5 U'],
  makossa:['9 15 21 30 36 42','8 5 3 6 5 U'],
  ariaria:['6 15 21 27 36 42','1 8 5 6 3 U'],
  woro:['8 16 24 32 38 44','1 5 3 8 5 U'],
  seben:['6 12 21 27 33 42','8 5 10 8 6 U'],
  soukous:['6 15 21 30 36 42','3 8 6 10 5 U']
 };
 const legacy=P.make,rows={basslines:P.lines,fills:F.styles,runs:P.runs};
 const group=(kind,i)=>kind==='basslines'?H.category(P.lines[i]):G.groupOf(kind,i);
 // Give recording-only genres a separate original exercise. Keep the artist takes available.
 for(const genre of Object.keys(profiles)){
  for(const kind of Object.keys(rows)){
   // Highlife and Makossa's old basslines are retired by default. Supply a new
   // playable line without restoring anything the player previously deleted.
   const starter=kind==='basslines'&&['highlife','makossa'].includes(genre);
   if(!starter&&rows[kind].some((r,i)=>group(kind,i)===genre&&!r.curated?.recordedStudy&&!/^(Practice|Prac)\s/.test(N.label(kind,r))))continue;
   const id='practice373-'+kind+'-'+genre,title=genre+' connection';
   if(kind==='basslines')P.lines.push({id,name:title,practiceStyle:genre,feel:genre,degrees:[1,4,2,5],tip:'Keep the low pulse while the upper phrase answers.'});
   else Q.register({id,kind,title,practiceStyle:genre,culturalStyle:genre,genre:'african',mode:'major',rhythm:'f5',notes:'d3 d5 d8 t2 t-1',tier:0,rank:0,tip:'Sing the pickup and land with the kick.'});
  }
 }
 const settings=new Map();
 for(const [kind,list] of Object.entries(rows)){
  const groups=new Map();
  list.forEach((row,i)=>{
   const genre=group(kind,i);if(!profiles[genre])return;
   const set=groups.get(genre)||[];groups.set(genre,set);
   const label=N.label(kind,row),parts=kind==='basslines'?P.phrases(row.degrees).length:1;
   for(let part=0;part<parts;part++)set.push({i,part,genre,label,keep:/^(Practice|Prac)\s/.test(label),single:parts===1,recorded:!!row.curated?.recordedStudy});
  });
  for(const set of groups.values()){
   const used=new Set();let next=1;
   for(const s of set){const m=s.single&&/^Practice (\d+)$/.exec(s.label);if(m&&!used.has(+m[1])){s.number=+m[1];used.add(s.number);}}
   set.sort((a,b)=>Number(list[b.i].id?.startsWith('practice373-'))-Number(list[a.i].id?.startsWith('practice373-')));
   for(const s of set){
    if(s.number==null){while(used.has(next))next++;s.number=next++;used.add(s.number);}
    settings.set([kind,s.i,s.part].join('/'),s);
   }
  }
 }
 const get=(kind,i,part=0)=>settings.get([kind,i,part].join('/'));
 const label=(kind,i,part)=>{const s=get(kind,i,part);return s?'Practice '+String(s.number).padStart(2,'0'):null;};
 const aliases={'african-praise':'praise',seben:'soukous',funk:'fusion'};
 const beds=new Map();
 function band(s){
  const style=aliases[s.genre]||s.genre;
  if(!beds.has(style)){
   const family={fusion:'funk',rnb:'soul'}[style]||style;
   const loops=window.BassSuppliedDrums.available.filter(l=>l.styles?.includes(style)||!l.styles?.length&&l.genre===family);
   beds.set(style,loops);
  }
  const choices=beds.get(style);
  return {practiceStyle:style,seriesDrum:choices[(s.number-1)%Math.max(1,choices.length)]?.id};
 }
 const score=Object.fromEntries(Object.entries(profiles).map(([genre,parts])=>[genre,parts.map((p,i)=>p.split(' ').map(x=>i%2?x:Number(x)/12))]));
 function register(n){while(n<23)n+=12;while(n>59)n-=12;return n;}
 function bar(plan,s,barIndex,section,origin,target,degree,nextDegree){
  const style=score[s.genre],scale=F.scales[plan.mode]||F.scales.major;
  const answer=section===1&&(s.number+barIndex)%2===0&&endings[s.genre];
  const tones=answer?answer[1].split(' '):style[section*2+1].slice();
  const times=answer?answer[0].split(' ').map(x=>Number(x)/12):style[section*2].slice();
  const variation=s.number-1;
  // Move the middle of the answer through the chord, while retaining its resolving pickups.
  if(variation%3===1)[tones[1],tones[2]]=[tones[2],tones[1]];
  if(variation%3===2)tones[2]=section===0?'3':tones[2]==='6'?'9':'6';
  if(variation%4>=2&&times[1]+.25<times[2])times[1]+=.25;
  if(section&&variation%2&&times[0]>.51)times[0]-=.25;
  // More advanced answers borrow a small motif from this study's own melody.
  // Resolve it against the new destination and leave the next downbeat clear.
  const original=plan.bass.filter(n=>n.beat>=barIndex*4&&n.beat<(barIndex+1)*4);
  const borrow=section&&original.length>=4&&variation>=3;
  const notes=[],offset=barIndex*4;
  const add=(beat,midi,length,velocity,role)=>notes.push({beat:offset+beat,midi:register(midi),length,velocity,role});
  if(section)add(0,origin,Math.min(1.65,times[0]*.83),94,'landing');
  for(let i=0;i<times.length;i++){
   const token=tones[i],at=times[i],gap=(times[i+1]??4)-at;
   const distance=d=>scale[(degree+d-2)%7]+12*Math.floor((degree+d-2)/7)-scale[degree-1];
   let midi=token==='L'?target-1:token==='U'?target+(scale[nextDegree%7]+(nextDegree===7?12:0)-scale[nextDegree-1]):origin+distance(Number(token));
   if(borrow&&i>0&&i<tones.length-2&&(variation+i)%3!==0){
    midi=original[(i+Math.floor(variation/3))%original.length].midi;
   }
   if(section&&i===1&&variation%5===3)midi+=12;
   const accent=i===0||i===Math.floor(times.length/2);
   const delay=at%1&&['rnb','soul','worship'].includes(s.genre)?Math.min(.012*plan.bpm/60,gap*.07):0;
   const gate=accent?(s.genre==='funk'?.58:.88):[.62,.76,.54][(i+variation)%3];
   add(at+delay,midi,(gap-delay)*gate,accent?(i===0?93:87):[72,79,68,77][(i+variation)%4],!section&&!i?'landing':'bass');
  }
  return notes;
 }
 function make(kind,opts={}){
  const plan=legacy(kind,opts),s=get(kind,Number(opts.idea)||0,Number(opts.part)||0);
  if(!s||s.keep||s.recorded)return plan;
  const scale=F.scales[plan.mode]||F.scales.major;
  const degrees=kind==='basslines'?plan.degrees:[plan.from,plan.to];
  const roots=degrees.map(d=>{let n=36+plan.key+scale[d-1];while(n>43)n-=12;return n;});
  const bass=degrees.flatMap((d,i)=>{
   const next=(i+1)%degrees.length;
   if(kind!=='basslines'&&i===1)return [{midi:roots[i],beat:4,length:2.8,velocity:97,role:'landing'}];
   const section=kind==='runs'?2:kind==='fills'?1:i%2===0&&i!==degrees.length-1?0:1+(s.number+i)%2;
   return bar(plan,s,i,section,roots[i],roots[next],d,degrees[next]);
  });
  return {...plan,...band(s),bass,source:kind==='basslines'?plan.source:roots[0],target:kind==='basslines'?plan.target:roots[1]};
 }
 P.make=make;
 return {get,label};
})();
