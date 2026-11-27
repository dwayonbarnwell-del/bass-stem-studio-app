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
 // Keep catalogue indices stable for saved choices and uploaded drum assignments.
 for(const [kind,list] of Object.entries(rows)){
  window.BassPracticeCatalogue.exclude(list.filter((r,i)=>group(kind,i)==='reggae'&&!r.curated?.recordedStudy).map(row=>({kind,id:row.id})));
 }
 // Retain the source index for numbering. Exclude these recordings and their
 // practice adaptations even on devices that previously restored them.
 const removedWorld=new Set([
  'method-69fbf742a97e98ec', // World 01
  'method-537e38cd0e05a369', // World 02
  'method-30484fdf68cc4a14', // World 04
  'method-e56c5c08cd300fb0', // World 05
  'method-2d6ba1158cff9f7e', // World 06
  'method-1b6f79f27cfdd535', // World 08
  'method-32dac4275645a139', // World 09
  'method-a6b0718a3ff1af32', // World 10
  'method-830dd4dac8d212d3', // World 11
  'method-6f46c3033b00c566', // World 16
  'method-0d1341beea8e3b9c', // World 18
  'method-9a94f4afb0726ecb', // World 21
  'method-bf0f93b5c2b15f9e', // World 22
  'method-75b8c11dc5dd76b8', // World 23
  'method-e007e16fcc560ed9', // World 24
  'method-1a6d6e96d7d4428e', // World 27
  'method-08d42208d781dadc', // World 29
  'method-656c936cdae6015a', // World 30
  'method-671783f09f0bedd8', // World 31
  'method-59522906753e82a5', // World 34
  'method-cd25d353a890e243', // World 35
  'method-3cafb24484cad6cd', // World 36
  'method-39a7db8899eb6c3d', // World 37
  'method-9df75450a1446280', // World 38
  'method-6da95ebc3eec29be', // World 47
  'method-560a5c052fdb8df4', // World 48
  'method-ca84499125ad7baf', // World 55
  'method-f02e4a64dc32169c', // World 56
  'method-45ce32a4971f59d5', // World 57
  'method-73aa025bc2c4ad94', // World 58
  'method-28435f5d3dd22881', // World 60
  'method-2c7bdac12f59a9c2', // World 63
 ]);
 const removed=Array.from(removedWorld,id=>({kind:'uploaded',id}));
 for(const entry of Q.entries){
  if(removedWorld.has(entry.recordedStudy?.sourceId))removed.push({kind:entry.kind,id:entry.id});
 }
 window.BassPracticeCatalogue.exclude(removed);
 window.BassUploadedCore.excludeWorldAliases();
 // emmyB, "How to play Worship Licks and Fill like a Pro Bassist", 4:30–4:34.
 // Onsets estimated from the supplied take. Relative to its low F# landing,
 // the upper C#–C–B turn descends through A and F# before the octave drop.
 const turnId='worship379-emmyb-turn';
 Q.rhythms[turnId]=[.49,.79,1.21,1.54,1.67,1.85,2.08,2.40,2.81,3.25];
 const worshipTurn=Q.register({
  id:turnId,kind:'fills',title:'emmyB turn',practiceStyle:'worship',genre:'contemporary',
  mode:'major',rhythm:turnId,notes:'t14 t15 t8 t12 t17 t19 t18 t17 t15 t12',
  accents:[70,74,63,83,94,87,76,89,85,90],gates:[.94,.40,.38,.94,.90,.96,.96,.96,.97,.96],
  tier:0,rank:0,tip:'Let the upper notes fall together, then drop an octave onto the next root.'
 });
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
 function label(kind,i,part){
  const s=get(kind,i,part);if(!s)return null;
  if(s.lessonTitle)return s.lessonTitle;
  let number=s.number;
  if(kind==='basslines'&&s.genre==='afrobeat'){
   if(P.lines[i].id==='afrobeat366-cross')number=1;
   else if(number===1)number=5;
  }
  return 'Practice '+String(number).padStart(2,'0');
 }
 // Keep the two praise repertoires in one menu without renumbering their music.
 const praiseMax={};
 for(const [key,s] of settings)if(s.genre==='praise'){
  const kind=key.split('/')[0];praiseMax[kind]=Math.max(praiseMax[kind]||0,s.number);
 }
 function menuLabel(kind,idea,part,genre){
  const s=get(kind,idea,part);
  return s&&genre==='african-praise'?'Practice '+String(s.number+(praiseMax[kind]||0)).padStart(2,'0'):label(kind,idea,part);
 }
 const aliases={'african-praise':'praise',seben:'soukous',funk:'fusion'};
 // Keep existing study-to-recording assignments stable when removing drum takes.
 const retainedRotations={"worship":["correct-worship-018d1997f3","correct-worship-018d1997f3","owner-purepop-verse01","owner-crispy-verse03","owner-theworld-chorus03","owner-purepop-verse01","owner-purepop-verse10","owner-crispy-verse07","owner-theworld-chorus04","owner-crispy-verse03","owner-purepop-verse06","owner-crispy-verse06","owner-theworld-verse01","owner-theworld-chorus03","owner-purepop-verse13","owner-crispy-verse04","owner-purepop-verse10","owner-crispy-verse07","owner-theworld-chorus04","owner-purepop-verse06","owner-crispy-verse06"],"highlife":["correct-highlife-77e55d558a","correct-highlife-4fb33faa0d","correct-highlife-ce0b9d6300","correct-highlife-40eb410ab0","correct-highlife-77e55d558a","correct-highlife-4fb33faa0d","correct-highlife-ce0b9d6300","correct-highlife-40eb410ab0","gmd-highlife-1","gs-highlife-palm-bell","gs-highlife-coast-swing","gmd-highlife-2","gmd-highlife-3","gmd-highlife-4","gmd-highlife-5","gmd-highlife-6","correct-highlife-77e55d558a","correct-highlife-4fb33faa0d","correct-highlife-ce0b9d6300","correct-highlife-40eb410ab0","gmd-highlife-1","gs-highlife-palm-bell","gs-highlife-coast-swing","gmd-highlife-2","gmd-highlife-3","gmd-highlife-4","gmd-highlife-5","gmd-highlife-6"],"makossa":["correct-makossa-90e3c1e52e","correct-makossa-1961c22140","correct-makossa-92baa4991e","correct-makossa-90e3c1e52e","correct-makossa-1961c22140","correct-makossa-92baa4991e","correct-makossa-90e3c1e52e-bar1","correct-makossa-1961c22140-bar1","correct-makossa-90e3c1e52e-bar7","correct-makossa-1961c22140-bar3","correct-makossa-1961c22140-bar7"],"ariaria":["ariaria-praise-drive","ariaria-high-praise","ariaria-praise-bell","ariaria-praise-drive","ariaria-high-praise","ariaria-praise-bell","ariaria-praise-drive","ariaria-high-praise","ariaria-praise-bell","ariaria-praise-drive","ariaria-high-praise","ariaria-praise-bell","ariaria-praise-drive","ariaria-high-praise","ariaria-praise-bell","ariaria-praise-drive","ariaria-high-praise","ariaria-praise-bell","ariaria-praise-drive","ariaria-high-praise"]};
 const beds=new Map();
 function band(s,kind){
  const style=aliases[s.genre]||s.genre;
  if(retainedRotations[style]){
   const ids=retainedRotations[style];
   return {practiceStyle:style,seriesDrum:ids[(s.number-1+({basslines:0,fills:3,runs:7}[kind]))%ids.length]};
  }
  if(!beds.has(style)){
   const family={fusion:'funk',rnb:'soul'}[style]||style;
   const loops=window.BassSuppliedDrums.available.filter(l=>l.styles?.includes(style)||!l.styles?.length&&l.genre===family);
   if(['worship','gospel'].includes(style)){
    const takes=window.BassSuppliedDrums.available.filter(l=>style==='worship'?/^owner-(purepop|theworld|crispy)/.test(l.id):/^owner-(bigbass|clyde|crispy)/.test(l.id));
    loops.push(...takes);
   }
   // Alternate performances before returning to another bar of the same take.
   const families=new Map();
   for(const loop of loops){
    const name=loop.base||loop.title.replace(/(?:Verse|Chorus)\d+| · .*| \d+$/gi,'').trim();
    if(!families.has(name))families.set(name,[]);
    families.get(name).push(loop);
   }
   const ordered=[];
   for(let i=0;ordered.length<loops.length;i++)for(const family of families.values())if(family[i])ordered.push(family[i]);
   beds.set(style,ordered);
  }
  const choices=beds.get(style);
  return {practiceStyle:style,seriesDrum:choices[(s.number-1+({basslines:0,fills:3,runs:7}[kind]))%Math.max(1,choices.length)]?.id};
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
   // Give repeated roots a clean release and let neighbouring passing notes connect.
   const near=i>0&&Math.abs(register(midi)-notes.at(-1).midi)<=2;
   const linked=section&&near&&i<times.length-1&&(i+variation)%3===1;
   const length=linked?(gap-delay)*.94:(!section&&i===1&&s.genre==='worship'?Math.min(.29,gap*.72):(gap-delay)*gate);
   add(at+delay,midi,length,accent?(i===0?93:87):[72,79,68,77][(i+variation)%4],!section&&!i?'landing':'bass');
   const note=notes.at(-1);
   note.articulation=linked?'legato':'detached';
   if(linked&&['soul','rnb'].includes(s.genre)&&Math.abs(note.midi-notes.at(-2).midi)===2){
    note.slideFrom=notes.at(-2).midi;note.slideSeconds=.04;
   }
  }
  return notes;
 }
 // Scores are fixed at release time so saved deletions never trigger replacements.
 const additions=new Map(),lastNumbers=new Map();
 for(const [key,s] of settings){
  const kind=key.split('/')[0],genre=s.genre==='african-praise'?'praise':s.genre;
  const number=s.genre==='african-praise'?s.number+(praiseMax[kind]||0):s.number;
  const group=kind+'/'+genre;lastNumbers.set(group,Math.max(lastNumbers.get(group)||0,number));
 }
 function addStudy(kind,genre,index,score){
  const group=kind+'/'+genre,number=(lastNumbers.get(group)||0)+1;
  lastNumbers.set(group,number);
  settings.set([kind,index,0].join('/'),{number,genre});
  additions.set(kind+'/'+index,{...band({number,genre},kind),...score});
 }
 function readNotes(text){
  return text.split(' ').map(word=>{
   const [pitch,at]=word.split('@');
   return {pitch,beat:Number(at)/12};
  });
 }
 function touch(notes,genre){
  const sustain=['worship','soul','rnb','zouk'].includes(genre);
  return notes.map((n,i)=>{
   const gap=(notes[i+1]?.beat??4)-n.beat;
   const accent=Number.isInteger(n.beat)||i===0;
   const linked=sustain&&!accent&&gap<=.5;
   const highPoint=i>0&&Number(n.pitch.slice(1))>Number(notes[i-1].pitch.slice(1))&&Number(n.pitch.slice(1))>=Number(notes[i+1]?.pitch.slice(1));
   const pickup=n.pitch[0]==='t'&&gap<=.35;
   return {...n,length:gap*(linked?.95:accent?(sustain?.88:.69):.74),
    velocity:pickup?70:highPoint?91:accent?94:linked?76:82,articulation:linked?'legato':accent?'held':'detached'};
  });
 }
 function installScores(){
  for(const [genre,types] of Object.entries(window.BassGenreScores||{}))for(const [kind,scores] of Object.entries(types)){
   for(const [i,text] of scores.entries()){
    const id='study382-'+genre+'-'+kind+'-'+(i+1);
    const [call,answer,chords]=text.split(' | ');
    const notes=touch(readNotes(call),genre);
    const title=genre+' '+kind+' '+(i+1);
    if(kind==='basslines'){
     const index=P.lines.length;
     const writtenPractice={notes,answer:touch(readNotes(answer),genre)};
     P.lines.push({id,name:title,practiceStyle:genre,feel:genre,degrees:[...chords].map(Number),writtenPractice});
     addStudy(kind,genre,index,writtenPractice);
    }else{
     Q.rhythms[id]=notes.map(n=>n.beat);
     const entry=Q.register({id,kind,title,practiceStyle:genre,culturalStyle:genre,genre,mode:'major',rhythm:id,
      notes:notes.map(n=>n.pitch),writtenNotes:notes,accents:notes.map(n=>n.velocity),tier:0,rank:0});
     addStudy(kind,genre,entry.index,{notes});
    }
   }
  }
  for(const [kind,sourceId,sourcePart,nativeBpm,interval,raw] of window.BassReggaeTransitions||[]){
   const source=window.BassUploadedCore.find(sourceId),id='study382-'+kind+'-'+sourceId;
   const events=raw.map(([beat,offset,length,velocity,sourceTime,confidence])=>({beat,offset,length,velocity,sourceTime,confidence,review:confidence<.76}));
   const changes=[];
   for(let from=1;from<=7;from++)for(let to=1;to<=7;to++)if(from!==to)changes.push([from,to]);
   const recordedStudy={sourceKind:'uploaded',sourceId,sourcePart,family:'Reggae recordings',sourceTitle:source.title,style:'reggae',
    start:events[0].sourceTime,end:events.at(-1).sourceTime,events,interval,nativeBpm,estimated:true,changes,
    nativeChanges:changes.filter(([a,b])=>(F.scales.major[b-1]-F.scales.major[a-1]-interval)%12===0)};
   const entry=Q.register({id,kind,title:source.title,practiceStyle:'reggae',culturalStyle:'reggae',genre:'reggae',
    mode:'major',rhythm:'recorded',notes:[],recordedStudy,tier:0,rank:0});
   entry.original=false;
   window.BassCulturalStudies.entries.push(entry);
   addStudy(kind,'reggae',entry.index,{recorded:true});
  }
 }
 function playScore(kind,opts,score){
  const mix={practiceStyle:score.practiceStyle,seriesDrum:score.seriesDrum};
  if(kind!=='basslines'){
   const plan=Q.make(kind,opts);
   return {...window.BassRegister.plan(plan),...mix};
  }
  const plan=legacy(kind,opts),scale=F.scales[plan.mode]||F.scales.major;
  function degree(d){return plan.key+scale[(d-1)%7]+12*Math.floor((d-1)/7);}
  const roots=plan.degrees.map(d=>24+(degree(d)%12));
  const bass=plan.degrees.flatMap((d,i)=>{
   const root=roots[i],target=roots[(i+1)%roots.length];
   return (score.bars?.[i]||(i%2?score.answer:score.notes)).map(n=>{
    const value=Number(n.pitch.slice(1));
    const midi=n.pitch[0]==='d'?root+degree(d+value-1)-degree(d):n.pitch[0]==='t'?target+value:root+value;
    return {beat:i*4+n.beat,midi,...(n.slide?{slideFrom:midi-2,slideSeconds:.045}:{}),length:n.length,velocity:n.velocity,articulation:n.articulation,role:n.beat===0?'landing':'bass'};
   });
  });
  return {...window.BassRegister.plan({...plan,bass}),...mix};
 }
 function make(kind,opts={}){
  const score=additions.get(kind+'/'+Number(opts.idea));
  if(score)return playScore(kind,opts,score);
  const s=get(kind,Number(opts.idea)||0,Number(opts.part)||0);
  if(kind==='fills'&&Number(opts.idea)===worshipTurn.index){
   const turn=Q.make(kind,opts);
   return {...window.BassRegister.plan(turn),...band(s,kind)};
  }
  const plan=legacy(kind,opts);
  if(!s||s.keep||s.recorded)return plan;
  const scale=F.scales[plan.mode]||F.scales.major;
  const degrees=kind==='basslines'?plan.degrees:[plan.from,plan.to];
  const roots=[];
  for(const d of degrees){
   const pitch=(plan.key+scale[d-1])%12,previous=roots.at(-1)??34;
   const candidates=[24+pitch,36+pitch,48+pitch].filter(n=>n<=47);
   roots.push(candidates.reduce((best,n)=>Math.abs(n-previous)<Math.abs(best-previous)?n:best));
  }
  const bass=degrees.flatMap((d,i)=>{
   const next=(i+1)%degrees.length;
   if(kind!=='basslines'&&i===1)return [{midi:roots[i],beat:4,length:2.8,velocity:97,role:'landing'}];
   const section=kind==='runs'?2:kind==='fills'?1:i%2===0&&i!==degrees.length-1?0:1+(s.number+Math.floor(i/2))%2;
   return bar(plan,s,i,section,roots[i],roots[next],d,degrees[next]);
  });
  return {...plan,...band(s,kind),bass,source:kind==='basslines'?plan.source:roots[0],target:kind==='basslines'?plan.target:roots[1]};
 }
 window.BassUploadedCore.restoreLegacy('clip-33');
 window.BassCulturalStudies.completeArtistStudies();
 installScores();
 for(const score of window.BassTransitionScores?.entries()||[]){
  const {kind,genre,id,title,notes}=score;
  let index;
  if(kind==='basslines'){
   index=P.lines.length;
   P.lines.push({id,name:title,practiceStyle:genre,feel:genre,degrees:score.degrees,writtenPractice:score});
  }else{
   Q.rhythms[id]=notes.map(n=>n.beat);
   index=Q.register({id,kind,title,practiceStyle:genre,culturalStyle:genre,genre,mode:'major',rhythm:id,
    notes:notes.map(n=>n.pitch),writtenNotes:notes,accents:notes.map(n=>n.velocity),tier:0,rank:0}).index;
  }
  addStudy(kind,genre,index,score);
 }
 // Great Moses Music Academy, Holy Forever lesson 1, user-supplied clip-48.
 // Adaptations of estimated bass events. Their chord changes are practice choices.
 const holyStudies=[
  {kind:'basslines',id:'holy-pocket',title:'Holy Forever · Bass',degrees:[1,6,2,5],
   pocket:'d1@0 d5@15 d1@32',answer:'d1@0 d3@26 d5@31 t0@39'},
  {kind:'runs',id:'holy-rise',title:'Holy Forever · Rise',phrase:'s0@24 s4@28 s7@33 t12@39',
   tip:'Adapted from 0:08–0:10. Try 1 to 6. Climb through C, E and G, touch the upper A and land on low A.'},
  {kind:'fills',id:'holy-pickup',title:'Holy Forever · Fill',phrase:'t-11@32 t-7@35 t-6@37 t-5@39 t0@44',
   tip:'Adapted from 0:25–0:26. Try 1 to 4. Play the last few notes close together, then settle on the new root.'}
 ];
 for(const study of holyStudies){
  const {kind,id,title}=study;
  let index;
  if(kind==='basslines'){
   const score={notes:touch(readNotes(study.pocket),'worship'),answer:touch(readNotes(study.answer),'worship')};
   index=P.lines.length;
   P.lines.push({id,name:title,practiceStyle:'worship',feel:'worship',degrees:study.degrees,writtenPractice:score});
   addStudy(kind,'worship',index,score);
  }else{
   const notes=touch(readNotes(study.phrase),'worship');
   Q.rhythms[id]=notes.map(n=>n.beat);
   index=Q.register({id,title,kind,practiceStyle:'worship',culturalStyle:'worship',genre:'worship',
    mode:'major',rhythm:id,notes:notes.map(n=>n.pitch),writtenNotes:notes,
    accents:notes.map(n=>n.velocity),tip:study.tip,tier:0,rank:0}).index;
   addStudy(kind,'worship',index,{notes});
  }
  get(kind,index,0).lessonTitle=title;
  additions.get(kind+'/'+index).seriesDrum='owner-crispy-verse07';
 }
 P.make=make;
 return {get,label,menuLabel};
})();
