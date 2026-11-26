/* Original genre-informed practice arrangements, not transcriptions of recordings. */
window.BassAccompaniment=(()=>{
 'use strict';
 const groups=[['worship','Worship'],['praise','Praise'],['gospel','Gospel'],['soul','Soul'],['rnb','R&B'],['jazz','Jazz'],['blues','Blues'],['reggae','Reggae'],['bass-lady','Bass Lady'],['bassmatics','Bassmatics']];
 const removedGroups=[['afrobeat','Afrobeat'],['highlife','Highlife'],['makossa','Makossa']];
 function availableGroups(){
  const D=window.BassPracticeCatalogue;
  const active=groups.filter(([genre])=>window.BassPracticeCore.lines.some(line=>D.visible('basslines',line.id)&&category(line)===genre)||window.BassUploadedCore.items.some(item=>D.visible('uploaded',item.id)&&category(item,true)===genre));
  const additional=removedGroups.filter(([genre])=>window.BassPracticeCore.lines.some(line=>identify(line)===genre&&D.isRestored('basslines',line.id)&&D.visible('basslines',line.id)));
  for(const item of window.BassUploadedCore.items)if(D.isRestored('uploaded',item.id)&&D.visible('uploaded',item.id)){
   const id=category(item,true);if(id&&![...active,...additional].some(([key])=>key===id))additional.push([id,({soukous:'Soukous',soca:'Soca',zouk:'Zouk',african:'African',recordings:'Recordings',highlife:'Highlife',afrobeat:'Afrobeat',makossa:'Makossa'})[id]||id]);
  }
  const methods=window.BassUploadedCore.items.some(item=>item.group==='world-method'&&D.visible('uploaded',item.id))?[['world-method','World Method']]:[];
  const uploads=[];
  for(const item of window.BassUploadedCore.items)if(item.culturalUpload&&D.visible('uploaded',item.id)&&![...active,...uploads,...additional].some(([id])=>id===item.group))uploads.push([item.group,({woro:'Woro',highlife:'Highlife',ariaria:'Ariaria',makossa:'Makossa'})[item.group]||item.group]);
  const result=[...active,...methods,...uploads,...additional];
  for(const item of window.BassUploadedCore.items){
   if(!D.visible('uploaded',item.id))continue;
   const genre=practiceGenre(item);
   if(genre && !result.some(([id])=>id===genre))result.push([genre,genre[0].toUpperCase()+genre.slice(1)]);
  }
  for(const line of window.BassPracticeCore.lines){
   if(!D.visible('basslines',line.id))continue;
   const genre=category(line);
   if(genre && !result.some(([id])=>id===genre))result.push([genre,genre[0].toUpperCase()+genre.slice(1)]);
  }
  return result;
 }
 const recordingStyles={
  'recorded-worship':'worship','recorded-reggae':'reggae','recorded-makossa':'makossa',
  'recorded-soukous':'soukous','recorded-seben':'soukous','recorded-congolese':'soukous',
  'recorded-praise':'praise','recorded-soca':'soca','recorded-zouk':'zouk'
 };
 function namedGenre(item){
  const text=[item.originalTitle,item.sourceFilename,item.title,item.name,item.feel].filter(Boolean).join(' ').toLowerCase();
  for(const [id,re] of [['woro',/wor+o/],['ariaria',/ariaria|aria.?ria/],['reggae',/reggae|raggae|rub.?a.?dub/],['makossa',/makoss?a|mokassa/],['highlife',/high.?life/],['afrobeat',/afro.?beat/],['seben',/seben/],['soukous',/soukous/],['congolese',/congolese/],['soca',/soca/],['zouk',/zouk/],['rnb',/\br\s*&\s*b\b|rhythm.?and.?blues/],['soul',/\bsoul\b/],['jazz',/\bjazz\b/],['blues',/\bblues\b/],['fusion',/\bfunk\b|\bfusion\b/],['worship',/worship/],['praise',/praise/],['gospel',/gospel/]])if(re.test(text))return id;
  return null;
 }
 function recordedStyle(item){
  if(item.practiceStyle&&profiles[item.practiceStyle])return item.practiceStyle;
  const named=namedGenre(item);
  if(named)return ['congolese','seben'].includes(named)?'soukous':named;
  if(recordingStyles[item.collection])return recordingStyles[item.collection];
  const style=identify(item);
  if(style!=='gospel')return style;
  if(item.collection==='recorded-nigerian')return 'afrobeat';
  if(item.collection==='recorded-african')return 'highlife';
  return null;
 }
 // The menu combines related genres. Each individual study still gets its own feel.
 const profiles={
  woro:{label:'Woro',kit:'studio',groove:'woro',sound:'piano'},
  ariaria:{label:'Ariaria',kit:'studio',groove:'ariaria',sound:'piano'},
  worship:{label:'Worship',kit:'vintage',groove:'worship',sound:'piano'},
  gospel:{label:'Gospel',kit:'studio',groove:'gospel',sound:'organ'},
  praise:{label:'Praise',kit:'studio',groove:'praise',sound:'piano'},
  soul:{label:'Soul',kit:'vintage',groove:'pocket',sound:'electric'},
  rnb:{label:'R&B',kit:'vintage',groove:'pocket',sound:'electric'},
  jazz:{label:'Jazz',kit:'jazz',groove:'swing',sound:'piano'},
  blues:{label:'Blues',kit:'vintage',groove:'shuffle',sound:'electric'},
  fusion:{label:'Funk / fusion',kit:'studio',groove:'fusion',sound:'electric'},
  reggae:{label:'Reggae',kit:'vintage',groove:'reggae',sound:'organ'},
  highlife:{label:'Highlife',kit:'studio',groove:'highlife',sound:'piano'},
  afrobeat:{label:'Afrobeat',kit:'vintage',groove:'afrobeat',sound:'electric'},
  makossa:{label:'Makossa',kit:'studio',groove:'makossa',sound:'electric'},
  soukous:{label:'Soukous / Seben',kit:'studio',groove:'soukous',sound:'piano'},
  mbalax:{label:'Mbalax inspired',kit:'studio',groove:'mbalax',sound:'piano'},
  mbaqanga:{label:'Mbaqanga inspired',kit:'vintage',groove:'mbaqanga',sound:'organ'},
  sungura:{label:'Sungura inspired',kit:'studio',groove:'sungura',sound:'piano'},
  soca:{label:'Soca',kit:'studio',groove:'soca',sound:'piano'},
  zouk:{label:'Zouk',kit:'vintage',groove:'zouk',sound:'electric'}
 };
 function identify(item={}){
  if(profiles[item.practiceStyle])return item.practiceStyle;
  const text=[item.name,item.title,item[0],item.feel,item.collection,item.group].filter(Boolean).join(' ').toLowerCase();
  // Specific dance styles take priority over a broad description such as praise.
  for(const [id,match] of [['makossa',/makossa/],['highlife',/highlife/],['afrobeat',/afrobeat/],['soukous',/soukous|seben|congolese|rumba/],['mbalax',/mbalax/],['mbaqanga',/mbaqanga|maskandi/],['sungura',/sungura/],['soca',/soca/],['zouk',/zouk/],['reggae',/reggae|onedrop|one.drop|dub/],['worship',/worship|anthem|prayer/],['praise',/praise/],['soul',/soul/],['gospel',/gospel|church/],['jazz',/jazz|bebop|modal|chromatic|enclosure|dorian/],['blues',/blues|blue.fire|shuffle/],['fusion',/funk|fusion/]])if(match.test(text))return id;
  const genre=item.curated?.genre;
  if(genre==='jazz')return'jazz';if(genre==='blues')return'blues';if(genre==='fusion')return'fusion';if(genre==='pentatonic')return'soul';if(genre==='african')return'highlife';
  if(/walk|pocket|sixths/.test(text))return'soul';
  return'gospel';
 }
 function practiceGenre(item){
  const style=window.BassCulturalStudies?.styleOf(item)||namedGenre(item)||identify(item);
  return ({fusion:'funk',congolese:'soukous'})[style]||style;
 }
 function category(item,recording=false){
  if(item.removedFromPlatform)return null;
  if(!recording && item.practiceStyle)return item.practiceStyle;
  if(recording&&(item.originalMix||['bass-lady','bassmatics'].includes(item.group)))return item.group;
  if(item.id?.startsWith('custom-'))return null;
  const c=item.collection||item.group;
  const named=namedGenre(item);
  if(named&&(recording||['seben','soukous','congolese','soca','zouk','afrobeat','highlife','makossa','reggae'].includes(named)))return named;
  if(recording&&c==='recorded-review')return /gospel/i.test(item.genreNote||'')?'gospel':'recordings';
  if(recording&&['recorded-african','recorded-nigerian'].includes(c))return'african';
  const id=recording?recordedStyle(item)||identify(item):identify(item);
  if(!recording&&id==='soul'&&item.feel==='pocket')return'rnb';
  if(!recording&&item.feel==='walk'&&!/soul|gospel/i.test(item.name||''))return'jazz';
  return {worship:'worship',gospel:'gospel',rnb:'rnb',soul:'soul',jazz:'jazz',blues:'blues',fusion:'soul',praise:'praise',reggae:'reggae',highlife:'highlife',afrobeat:'afrobeat',makossa:'makossa',soukous:'soukous',mbalax:'mbalax',mbaqanga:'mbaqanga',sungura:'sungura',soca:'soca',zouk:'zouk'}[id];
 }
 function profile(plan){
  const item=plan.kind==='basslines'?window.BassPracticeCore.lines[plan.idea]:plan.kind==='runs'?window.BassPracticeCore.runs[plan.idea]:plan.kind==='fills'?window.BassFillCore.styles[plan.idea]:plan;
  const dance=plan.culturalStyle||namedGenre(item);
  const id=profiles[plan.practiceStyle]?plan.practiceStyle:plan.kind==='uploaded'?recordedStyle(plan)||identify(plan):identify(item);
  return {id,dance,style:id,...profiles[id]};
 }
 function resolve(plan,options={}){
  const p=profile(plan),valid=(value,values,fallback)=>values.includes(value)?value:fallback;
  const key=plan.recordedStudy?'culture/'+plan.curated.id:plan.kind==='uploaded'?plan.clipId+'/'+String(plan.part).replace('phrase-',''):[plan.kind,plan.idea,plan.part||0].join('/');
  const assignment=window.BassFlDrums?.assignments[key]||window.BassGrooveLibrary?.assignments[key];
  const source=plan.recordedStudy&&window.BassUploadedCore.find(plan.recordedStudy.sourceId),sourceDrums=source?.sourceDrumLoopId;
  if(sourceDrums&&(!options.kit||options.kit==='auto')&&(!options.groove||options.groove==='auto'))options={...options,groove:sourceDrums};
  if(window.BassSuppliedDrums&&(!options.kit||options.kit==='auto')&&(!options.groove||options.groove==='auto')){
   const measured=window.BassRecordingTiming?.[plan.clipId]?.loop;
   const danceLoop=['seben','soukous'].includes(p.dance)&&window.BassSuppliedDrums.loops.find(loop=>loop.genre==='soukous'&&loop.title.toLowerCase().includes(p.dance));
   const groove=assignment?.[0]||measured||danceLoop?.id;
   if(groove)options={...options,groove};
  }
  if(window.BassSuppliedDrums)return {...p,assignedPhase:assignment?.[1],loop:window.BassSuppliedDrums.choose(p.id,options.kit,options.groove),style:valid(options.style,Object.keys(profiles),p.style),sound:valid(options.sound,['piano','electric','organ'],'piano')};
  return {...p,kit:valid(options.kit,window.BassPracticeDrums.kits.map(x=>x[0]),p.kit),groove:valid(options.groove,window.BassPracticeDrums.grooves.map(x=>x[0]),p.groove),style:valid(options.style,Object.keys(profiles),p.style),sound:valid(options.sound,['piano','electric','organ'],p.sound)};
 }
 const pc=n=>(n%12+12)%12;
 function voicing(notes,previous){
  const pcs=[...new Set(notes.map(n=>pc(n.midi)))].sort((a,b)=>a-b),candidates=[];
  for(let root=48;root<=71;root++)if(pcs.includes(pc(root))){
   const chord=pcs.map(p=>root+pc(p-pc(root))).sort((a,b)=>a-b);
   if(chord.at(-1)<=79)candidates.push(chord);
  }
  const score=chord=>chord.reduce((s,n,i)=>s+Math.abs(n-(previous?.[i]??(57+i*4))),0);
  return candidates.sort((a,b)=>score(a)-score(b))[0]||notes.map(n=>n.midi);
 }
 // [beat, gate, velocity, selection]: selection 'arp' follows the chord tones.
 const rhythms={
  woro:[[0,.6,60,'all'],[1.5,.35,49,'top'],[2,.5,56,'all'],[3.5,.3,49,'top']],
  ariaria:[[0,.7,57,'all'],[1+2/3,.3,48,'top'],[2,.6,55,'all'],[3+2/3,.28,47,'top']],
  worship:[[0,3.8,58,'all'],[2.5,.7,44,'top']],
  gospel:[[0,.7,65,'all'],[1.5,.35,52,'all'],[2.5,.45,61,'all'],[3+2/3,.25,48,'top']],
  praise:[[0,.35,69,'all'],[.75,.25,53,'top'],[1.5,.3,60,'all'],[2.5,.35,66,'all'],[3.5,.3,59,'all']],
  soul:[[0,1.25,57,'all'],[1.75,.45,47,'top'],[2.5,.85,55,'all']],
  jazz:[[0,.65,52,'all'],[1+2/3,.3,47,'all'],[2.5,.3,50,'top'],[3+2/3,.24,46,'all']],
  blues:[[0,.45,80,'all'],[2/3,.22,48,'top'],[1,.45,57,'all'],[1+2/3,.22,49,'top'],[2,.45,60,'all'],[2+2/3,.22,46,'top'],[3,.45,58,'all'],[3+2/3,.22,47,'top']],
  fusion:[[.25,.2,82,'all'],[.75,.16,45,'top'],[1.5,.22,65,'all'],[2.75,.22,61,'all'],[3.5,.2,52,'top']],
  reggae:[[.5,.17,57,'all'],[1.5,.17,62,'all'],[2.5,.17,55,'all'],[3.5,.17,61,'all']],
  highlife:[[0,.22,58,'arp'],[.75,.24,61,'top'],[1.25,.24,55,'arp'],[1.75,.18,49,'top'],[2.5,.24,59,'arp'],[3.25,.24,54,'top'],[3.75,.18,50,'arp']],
  afrobeat:[[.5,.24,56,'all'],[1.25,.18,44,'top'],[1.75,.24,80,'all'],[2.75,.22,54,'all'],[3.5,.22,59,'top']],
  makossa:[[0,.22,80,'all'],[.75,.22,62,'top'],[1.5,.22,54,'arp'],[2.25,.22,83,'all'],[2.75,.18,48,'top'],[3.5,.22,58,'arp']],
  soukous:[[0,.23,55,'arp'],[.5,.23,49,'top'],[1,.23,57,'arp'],[1.5,.23,52,'top'],[2.25,.22,59,'arp'],[2.75,.22,51,'top'],[3.25,.22,58,'arp'],[3.75,.18,48,'top']],
  mbalax:[[0,.24,56,'all'],[.75,.2,54,'top'],[1.25,.2,50,'arp'],[2,.24,58,'all'],[2.75,.2,54,'top'],[3.25,.2,51,'arp']],
  mbaqanga:[[0,.3,60,'all'],[.5,.24,53,'top'],[1.5,.24,57,'all'],[2,.3,62,'all'],[2.75,.24,51,'top'],[3.5,.24,56,'all']],
  sungura:[[0,.2,55,'arp'],[.5,.2,50,'arp'],[1,.2,58,'top'],[1.5,.2,52,'arp'],[2,.2,56,'arp'],[2.5,.2,50,'top'],[3,.2,54,'arp'],[3.5,.2,59,'top']],
  soca:[[.5,.23,62,'all'],[1,.23,54,'top'],[1.5,.23,64,'all'],[2.5,.23,61,'all'],[3,.23,55,'top'],[3.5,.23,65,'all']],
  zouk:[[0,.55,56,'all'],[.75,.3,49,'top'],[1.5,.38,58,'all'],[2.5,.55,54,'arp'],[3.25,.3,50,'all']]
 };
 rhythms.rnb=rhythms.soul;
 function arrange(plan,style='worship'){
  const sections=new Map();for(const n of plan.chords||[]){if(!sections.has(n.beat))sections.set(n.beat,[]);sections.get(n.beat).push(n);}
  const spans=[...sections].sort((a,b)=>a[0]-b[0]),out=[];let previous;
  const grid=plan.pulseSpans||[{start:0,end:plan.beats,pulse:0,scale:1}];
  let first=0;
  for(let s=0;s<spans.length;s++){
   const [start,notes]=spans[s],end=spans[s+1]?.[0]??plan.beats,voice=voicing(notes,previous);previous=voice;
   while(first<grid.length&&grid[first].end<=start)first++;
   for(let g=first;g<grid.length&&grid[g].start<end;g++){
    const span=grid[g],from=Math.max(start,span.start),to=Math.min(end,span.end);
    const pulse=span.pulse+(from-span.start)/span.scale;
    for(let bar=Math.floor((pulse+1e-8)/4)*4;bar<span.pulse+(to-span.start)/span.scale;bar+=4){
     for(const [i,[at,gate,velocity,pick]] of (rhythms[style]||rhythms.worship).entries()){
      const onset=span.start+(bar+at-span.pulse)*span.scale;
      if(onset<from-1e-8||onset>=to-1e-8)continue;
      const beat=Math.max(from,onset);
      const selected=pick==='arp'?[voice[i%voice.length]]:pick==='top'?voice.slice(-2):voice;
      for(const midi of selected)out.push({midi,beat,length:Math.min(gate*span.scale,end-beat),velocity,role:'chord'});
     }
    }
   }
  }
  return out;
 }
 return {groups,availableGroups,practiceGenre,profiles,identify,category,namedGenre,recordedStyle,profile,resolve,arrange};
})();
