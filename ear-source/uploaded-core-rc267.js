/* Bass studies and timed excerpts from the owner's supplied recordings. */
window.BassUploadedCore=(()=>{
 'use strict';
 const items=[...(window.BassUploadedStudies||[]),...(window.BassLessonStudies||[]),...(window.BassReggaeStudies||[]),...(window.BassAfricanStudies||[])].filter(c=>c.id!=='clip-04'&&c.id!=='clip-62'&&!/open the eyes of my heart|holy forever|worship.*easy bass lesson|african praise.*bass study|african praise.*winner man/i.test(c.title||'')).map(c=>({...c})),groups=[['studies','Original studies'],['recorded-worship','Worship · recordings'],['recorded-reggae','Reggae · recordings'],['recorded-makossa','Makossa · recordings'],['recorded-soukous','Soukous · Bass Lady recording'],['recorded-seben','Seben · recordings'],['recorded-praise','African Praise · recordings'],['recorded-nigerian','Nigerian styles · mixed recordings'],['recorded-soca','Soca · recordings'],['recorded-congolese','Congolese · lessons'],['recorded-african','African styles · lessons'],['recorded-zouk','Zouk · lessons'],['recorded-review','Other recordings · genre to review']];
 for(const c of items){
  c.originalTitle=c.title;
  if(c.collection)continue;
  if(c.group==='bass-lady'){c.collection=/makossa/i.test(c.title)?'recorded-makossa':'recorded-soukous';c.title=c.title.replace('Bass Lady - ','').replace(/^(Makossa|Soukous)(.*)$/,'$1 · Bass Lady$2');}
  else if(c.group==='bassmatics'){c.collection='recorded-seben';c.title=c.title.replace('Bassmatics - Seben','Seben · Bassmatics');}
  else if(/African praise/i.test(c.title)){c.collection='recorded-praise';c.title='African Praise · bass study';}
  else if(/Five Nigerian/i.test(c.title)){c.collection='recorded-nigerian';c.title='Nigerian bass styles · five-style demonstration';}
  else if(/Soca/i.test(c.title)){c.collection='recorded-soca';c.title='Soca · Hookin Meh cover';}
  else {c.collection='recorded-review';c.title=c.title.replace(/^Uploaded groove /,'Bass recording ').replace(/^Groove - /,'Bass study · ').replace(/grooves/gi,'bass studies').replace(/groove/gi,'bass study');if(/subscribers|overload|locked|weep|mad bass|^Bass recording/i.test(c.title))c.title='Bass study · '+c.id.replace('clip-','Recording ');}
 }

 // Display names are independent of source filenames and saved recording IDs.
 const titles={'clip-05':'Mad Grooves 01','clip-08':'Mad Grooves 02','clip-12':'Locked Groove',
  'clip-13':'Groove de Weep','clip-17':'Sweetness Overload','clip-19':'Bass study 19','clip-11':'Everyday bass','clip-14':'Bass study 14','clip-16':'Bass study 16','clip-21':'Bass study 21',
  'clip-69':'African bass lesson · Updated edition','clip-56':'Gospel bass cover'};
 for(const c of items)if(titles[c.id])c.title=titles[c.id];
 // Positions use source seconds, so a passage has the same pulse when opened
 // on its own or reached during the full recording.
 function pulseSpans(plan,points){
  const spans=[];
  for(let i=1;i<(points?.length||0);i++){
   const [a,p]=points[i-1],[b,q]=points[i];
   const from=Math.max(a,plan.sourceStart),to=Math.min(b,plan.sourceEnd);
   if(to<=from)continue;
   const interval=(b-a)/(q-p),start=(from-plan.sourceStart)/plan.step;
   spans.push({start,end:(to-plan.sourceStart)/plan.step,pulse:p+(from-a)/interval,scale:interval/plan.step});
  }
  if(!spans.length)return [{start:0,end:plan.beats,pulse:plan.phase,scale:1}];
  spans[0].start=0;spans.at(-1).end=plan.beats;
  if(plan.recording){
   // This byte-range excerpt has a fixed, whole-bar length. Match its
   // starting phase and return to that phase on every pass.
   return [{start:0,end:plan.beats,pulse:spans[0].pulse,scale:1}];
  }
  return spans;
 }
 const time=t=>Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0');
 function loop(id){
  const row=window.BassRecordingGrids?.[id];
  if(!row)return null;
  const [start,step,beats,firstByte,lastByte,offset]=row;
  return {start,end:start+step*beats,step,beats,firstByte,lastByte,offset};
 }
 function phrase(id,part){
  if(typeof part!=='string'||!/^phrase-\d+$/.test(part))return null;
  const row=window.BassRecordedPhrases?.[id]?.[Number(part.slice(7))];
  if(!row)return null;
  const [start,end,beats,offset,bytes,hasDrums,drumPhase=0]=row;
  return {start,end,beats,step:(end-start)/beats,pack:'./ear-assets/phrases-rc334/'+id+'.bin',offset,bytes,drumPhase,hasDrums:!!hasDrums};
 }
 function plan(id,part=0,speed=100,transpose=0){
  const clip=items.find(c=>c.id===id);if(!clip)return null;
  const recording=part==='beat'?loop(id):phrase(id,part);
  const index=recording?part:Math.max(0,Math.min(clip.parts.length-1,Math.round(Number(part)||0)));
  const range=recording||clip.parts[index],step=recording?.step||1;
  const ratio=Math.max(25,Math.min(150,Number(speed)||100)),shift=Math.max(-12,Math.min(12,Math.round(Number(transpose)||0)));
  const bass=clip.notes.filter(n=>n.start<range.end&&n.end>range.start).map(n=>({midi:n.midi+shift,beat:Math.max(0,n.start-range.start)/step,length:(Math.min(n.end,range.end)-Math.max(n.start,range.start))/step,velocity:n.velocity||80,role:'bass',review:!!n.review,confidence:n.confidence,sourceTime:Math.max(n.start,range.start)})).filter(n=>n.length*step>.01&&n.midi>=21&&n.midi<=108);
  return {kind:'uploaded',collection:clip.collection,recording,audio:clip.audio,clipId:clip.id,title:clip.title,heading:clip.title,bpm:60*ratio/(100*step),beats:recording?.beats??range.end-range.start,bass,chords:[],sourceStart:range.start,sourceEnd:range.end,part:index,speed:ratio,transpose:shift,check:bass.some(n=>n.review),status:time(range.start)+'–'+time(range.end)+' · '+ratio+'% speed · Automatic notes'};
 }

 // The guide follows the supplied bass transcription. These are suggested
 // harmonies: a bass recording alone cannot establish every chord quality.
 function practicePlan(id,part,bpm){
  const clip=items.find(c=>c.id===id),grid=loop(id);
  const style=window.BassAccompaniment.profile({...clip,kind:'uploaded'}).id;
  const timing=window.BassRecordingTiming?.[id];
  const value=plan(id,part);
  const points=timing?.pulse||[];
  let measuredBeats=0;
  if(!value.recording)for(let i=1;i<points.length;i++){
   const [a,p]=points[i-1],[b,q]=points[i];
   const duration=Math.min(b,value.sourceEnd)-Math.max(a,value.sourceStart);
   if(duration>0)measuredBeats+=duration*(q-p)/(b-a);
  }
  const fallback=style==='reggae'?77:window.BassSuppliedDrums.choose(style).bpm;
  const originalBpm=value.recording?60/value.recording.step:measuredBeats?60*measuredBeats/(value.sourceEnd-value.sourceStart):fallback;
  const step=60/originalBpm,tempo=Number(bpm)||(id==='clip-46'&&value.recording?.pack?82.9:!grid&&style==='reggae'?77:originalBpm);
  if(!value.recording){
   for(const n of value.bass){n.beat/=step;n.length/=step;}
   value.beats/=step;
  }
  Object.assign(value,{bpm:tempo,originalBpm,speed:100*tempo/originalBpm,step,phase:0});
  value.pulseSpans=pulseSpans(value,timing?.pulse);
  value.phase=value.pulseSpans[0].pulse;
  const starts=[0];
  for(const span of value.pulseSpans){
   const firstBar=Math.ceil((span.pulse-1e-8)/4)*4;
   for(let bar=firstBar; ;bar+=4){
    const beat=span.start+(bar-span.pulse)*span.scale;
    if(beat>=span.end-1e-8)break;
    if(beat>starts.at(-1)+.12)starts.push(beat);
   }
  }
  if(value.recording?.pack){
   starts.length=0;for(let beat=0;beat<value.beats;beat+=2)starts.push(beat);
  }
  const bars=starts.map(()=>new Float64Array(12)),total=new Float64Array(12);
  for(const n of value.bass){
   let lo=0,hi=starts.length;
   while(lo+1<hi){const mid=(lo+hi)>>>1;if(starts[mid]<=n.beat)lo=mid;else hi=mid;}
   const pc=n.midi%12,weight=Math.min(2,n.length)*(n.review?.45:1)*(n.beat-starts[lo]<.35?2:1);
   bars[lo][pc]+=weight;total[pc]+=weight;
  }
  let best=-Infinity,tonic=0,scale;
  for(const steps of [[0,2,4,5,7,9,11],[0,2,3,5,7,8,10]])for(let root=0;root<12;root++){
   const score=steps.reduce((s,v,i)=>s+total[(root+v)%12]*(i===0?1.35:i===4?1.1:1),0);
   if(score>best){best=score;tonic=root;scale=steps;}
  }
  value.tonic=tonic;value.minor=scale[2]===3;value.degrees=[];

  bars.forEach((weights,i)=>{
   if(!weights.some(Boolean))return;
   let best=-Infinity,degree=0;
   for(let d=0;d<7;d++){
    const pc=j=>(tonic+scale[(d+j)%7])%12;
    const score=weights[pc(0)]+.25*weights[pc(2)]+.4*weights[pc(4)];
    if(score>best){best=score;degree=d;}
   }
   value.degrees.push(degree+1);
   const beat=starts[i],root=48+(tonic+scale[degree])%12;
   for(const j of [0,2,4])value.chords.push({beat,midi:root+(scale[(degree+j)%7]-scale[degree]+12)%12,length:Math.min(4,value.beats-beat),velocity:65});
  });
  return value;
 }

 function rehearsalShape(id){
  const section=plan(id,'beat');
  if(!section?.recording)return [];
  const bars=[];
  for(let bar=0;bar<section.beats;bar+=4){
   const notes=section.bass.filter(n=>n.beat>=bar&&n.beat<bar+4&&n.midi>=23&&n.midi<=59&&
    (!n.review||n.confidence>=.76&&n.length*section.recording.step>=.08));
   if(notes.length<4||!notes.some(n=>Math.abs(n.beat-Math.round(n.beat))>=.12))continue;
   const weight=new Map();
   for(const n of notes.filter(n=>!n.review)){
    const pc=n.midi%12;
    weight.set(pc,(weight.get(pc)||0)+Math.min(1,n.length)*(1+(Math.abs(n.beat-Math.round(n.beat))<.1)));
   }
   const root=[...weight].sort((a,b)=>b[1]-a[1])[0]?.[0];
   const anchor=notes.find(n=>!n.review&&n.midi%12===root)?.midi;
   const role=n=>{
    if(n.review||anchor===undefined)return 'root';
    const interval=(n.midi-anchor+36)%12;
    if(!interval&&n.midi>anchor)return 'octave';
    return ({3:'third',4:'third',7:'fifth'})[interval]||'root';
   };
   bars.push(notes.map(n=>({beat:n.beat-bar,length:Math.min(n.length,bar+4-n.beat),role:role(n)})));
  }
  return bars.sort((a,b)=>b.length-a.length)[0]||[];
 }
 return {items,groups,plan,practicePlan,time,loop,rehearsalShape};
})();
