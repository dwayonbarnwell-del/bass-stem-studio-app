/* Match visible source patterns to a rehearsal's rhythm and actual harmony.
 * Suggestions are explicitly adaptations. They never replace saved chords. */
window.BassRehearsalIdeas=(()=>{
 'use strict';
 const C=window.BassRehearsalCore,U=window.BassUploadedCore,P=window.BassPracticeCore,F=window.BassFillCore,G=window.BassStudyGroups,Q=window.BassCuratedStudies,D=window.BassPracticeCatalogue,H=window.BassAccompaniment,X=window.BassCulturalStudies,N=window.BassStudyDisplay;
 const M=window.BassRehearsalHarmony;
 const pc=n=>(n%12+12)%12,cache=new Map(),derivatives=new Map(),families={'bass-lady':'Bass Lady',bassmatics:'Bassmatics','world-method':'World Methods'};
 function family(row){return row.sourceFamily||families[row.group]||(row.group==='reggae'?'Reggae recordings':'Recorded bass');}
 function genre(row){
  const group=H.recordingGroup(row);
  return families[group]?X.styleOf(row)||H.recordedStyle(row):group;
 }
 function sourceOptions(){return Object.entries(families).filter(([,name])=>U.items.some(row=>D.visible('uploaded',row.id)&&family(row)===name)).map(([id,label])=>['source:'+id,label]);}
 function matches(style,rowStyle,rowFamily){return style.startsWith('source:')?families[style.slice(7)]===rowFamily:!Object.values(families).includes(rowFamily)&&style===rowStyle;}
 function availableStyles(){
  const styles=[...C.styles],known=new Set(styles.map(([id])=>id));
  for(const row of U.items)if(D.visible('uploaded',row.id)){const id=genre(row);if(id&&H.profiles[id]&&!known.has(id)){styles.push([id,H.profiles[id].label]);known.add(id);}}
  return styles;
 }
 function sourceNumber(row){return N.recordingNumber(row);}
 U.items.forEach(sourceNumber);
 function describe(row){
  const entry=row.entry||row.originEntry,study=entry?.recordedStudy,sourceId=study?.sourceId||row.sourceId,source=U.find(sourceId);
  const sourceFamily=study?.family||row.family||'Practice',practice=/^Practice/.test(sourceFamily),genreLabel=C.styles.find(([id])=>id===row.style)?.[1]||H.profiles[row.style]?.label||'Genre unconfirmed';
  let number,variant=0,part=study?.sourcePart??row.sourcePart??0;
  if(source&&!practice)number=sourceNumber(source);
  else if(study?.sourceKind==='basslines'||!entry)number=P.lines.findIndex(r=>r.id===sourceId)+1;
  else number=Q.entries.findIndex(r=>r.id===(study?.sourceId||entry.id))+1;
  if(study){
   variant=entry.rehearsalVariant||X.entries.filter(r=>r.kind===entry.kind&&r.recordedStudy.sourceKind===study.sourceKind&&r.recordedStudy.sourceId===sourceId&&r.recordedStudy.sourcePart===part).findIndex(r=>r.id===entry.id)+1;
  }
  const sourceLabel=practice?'Practice':sourceFamily.replace(/ recordings$/,'');
  const code=String(number||1).padStart(2,'0')+((window.BassRecordedPhrases?.[sourceId]?.length||0)>1?'.'+(part+1):'')+(variant?'.'+variant:'');
  const line=P.lines.find(r=>r.id===sourceId);
  const label=entry?.expressive?N.short(entry.title):line?.expressive?N.short(line.name):N.sourceName(sourceLabel,code);
  const detail=[practice?'Practice':sourceFamily,...sourceLabel===genreLabel?[]:[genreLabel],'Adapted'].join(' · ');
  const original=source?.originalTitle||P.lines.find(r=>r.id===sourceId)?.name||entry?.title||'';
  return {label,detail,source:practice?'Practice':sourceFamily,genre:genreLabel,sourceId,original};
 }
 function derived(source){
  const key=source.kind+'/'+source.id+'/'+source.part;
  if(!derivatives.has(key)){
   const list=[];
   for(const kind of ['runs','fills']){
    if(X.entries.some(e=>e.kind===kind&&e.recordedStudy.sourceId===source.id&&e.recordedStudy.sourcePart===source.part))continue;
    const candidates=X.candidates(source,kind,{maxSeconds:8,allowTempoAdaptation:true}).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
    const shapes=new Set();
    for(const row of candidates){
     if(shapes.has(row.shape))continue;
     try{for(let interval=0;interval<12;interval++)X.retarget({events:row.events,interval:row.interval},interval);}catch{continue;}
     shapes.add(row.shape);
     list.push({id:row.id,kind,title:source.title,rehearsalVariant:list.filter(r=>r.kind===kind).length+1,recordedStudy:{sourceKind:source.kind,sourceId:source.id,sourcePart:source.part,family:source.family,sourceTitle:source.title,style:source.style,interval:row.interval,nativeBpm:60/source.step,events:row.events,estimated:true}});
     if([...list].filter(r=>r.kind===kind).length===12)break;
    }
   }
   derivatives.set(key,list);
  }
  return derivatives.get(key).filter(entry=>D.visible(entry.kind,entry.id));
 }
 function score(grid,rhythm,shape,bpm,automatic){
  const distance=grid&&bpm?Math.abs(Math.log(grid.bpm/bpm)):0;
  if(automatic&&distance>.48)return -10;
  return C.patternScore(grid,rhythm,shape)-Math.min(.3,distance*.18);
 }
 function diverse(rows,limit){
  const sorted=rows.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)),out=[],seen=new Set(),used=new Set();
  function add(row){if(!row||used.has(row.id)||out.length>=limit)return;const shape=JSON.stringify(row.shape.map(n=>[Math.round(n.beat*32),Math.round(n.length*32),n.role,n.semitones]));if(seen.has(shape))return;seen.add(shape);used.add(row.id);out.push(row);}
  for(const name of new Set(sorted.map(r=>r.family)))add(sorted.find(r=>r.family===name));
  sorted.forEach(add);return out;
 }
 function playable(events,grid){
  if(!grid)return true;
  const lead=events.filter(n=>n.beat<4),ratio=60/grid.bpm*(grid.meter||4)/4;
  return lead.length>=3&&lead.every(n=>n.length*ratio>=.032)&&lead.length/Math.max(.1,(4-lead[0].beat)*ratio)<=14;
 }
 function bank(style,grid,rhythm,automatic=false,context=null,selection='all'){
  if(!style||style==='roots')return [];
  const basslines=[],runs=[],fills=[];
  function addDerived(source,onlyKind){
   for(const entry of derived(source)){
    if(onlyKind&&entry.kind!==onlyKind)continue;
    if(!playable(entry.recordedStudy.events,grid))continue;
    const shape=entry.recordedStudy.events.filter(n=>n.beat<4).map(n=>({beat:n.beat,length:Math.min(n.length,4-n.beat),role:'passing',semitones:n.offset}));
    const value=score(grid,rhythm,shape,60/source.step,automatic);if(automatic&&value<-.05)continue;
    (entry.kind==='runs'?runs:fills).push({id:'source-study:'+entry.kind+':'+entry.id,kind:entry.kind,label:source.title+' · '+source.family+' (adapted)',family:source.family,style:source.style,sourceId:source.id,entry,shape,recorded:true,score:value});
   }
  }
  for(const row of U.items){
   const rowStyle=genre(row)||(style.startsWith('source:')?'recordings':null),rowFamily=family(row);if(!rowStyle||!matches(style,rowStyle,rowFamily)||!D.visible('uploaded',row.id))continue;
   for(const [part,timing] of (window.BassRecordedPhrases?.[row.id]||[]).entries()){
    if(!D.visible('uploaded',row.id+'/'+part))continue;
    const id='clip:'+row.id+(part?'/'+part:''),key=row.id+'/'+part;
    if(!cache.has(key))cache.set(key,U.rehearsalShape(row.id,part));
    const shape=cache.get(key),bpm=60*timing[2]/(timing[1]-timing[0]),value=score(grid,rhythm,shape,bpm,automatic);
    if(shape.length&&(!automatic||value>=-.05))basslines.push({id,kind:'basslines',label:N.clip(row)+(part?' .'+(part+1):'')+' · '+rowFamily+' (adapted)',family:rowFamily,style:rowStyle,sourceId:row.id,sourcePart:part,shape,recorded:true,score:value+.06});
    const plan=U.plan(row.id,'phrase-'+part),step=plan.recording?.step;
    if(step)addDerived({kind:'uploaded',id:row.id,part,style:rowStyle,family:rowFamily,title:N.clip(row)+(part?' .'+(part+1):''),step,offset:(row.sourceStart||0)+plan.sourceStart,notes:plan.bass.map(n=>({midi:n.midi,start:n.beat*step,end:(n.beat+n.length)*step,confidence:n.confidence??.7,velocity:n.velocity}))});
   }
  }
  if(!style.startsWith('source:'))for(const [idea,row]of P.lines.entries()){
   const category=H.category(row),identified=H.identify(row),rowStyle=category==='african'||identified==='fusion'?identified:category;
   if(!D.visible('basslines',row.id)||!D.visible('basslines',row.id+'/0')||rowStyle!==style)continue;
   const shape=C.pattern(row,P,idea);if(!shape.length)continue;
   basslines.push({id:row.id,kind:'basslines',label:N.short(row.name)+' · Practice (adapted)',family:'Practice bassline',style,sourceId:row.id,shape,recorded:false,score:C.patternScore(grid,rhythm,shape)+(row.expressive?.15:0)});
   // These loops already have their own authored runs and fills above.
   // Do not mint further near-duplicate derivatives with the loop's name.
   if(row.expressive||row.writtenPractice)continue;
   const plan=P.make('basslines',{idea,key:0,bpm:100}),step=60/plan.bpm;
   addDerived({kind:'basslines',id:row.id,part:0,style,family:'Practice bassline',title:N.short(row.name),step,offset:0,notes:plan.bass.map(n=>({midi:n.midi,start:n.beat*step,end:(n.beat+n.length)*step,confidence:1,velocity:n.velocity}))});
  }
  for(const kind of ['runs','fills']){
   const list=kind==='runs'?P.runs:F.styles;
   for(const [idea,row]of list.entries()){
    const entry=Q.get(kind,idea);if(!entry||!G.visible(kind,idea))continue;
    const source=entry.recordedStudy,clip=source?.sourceKind==='uploaded'&&U.find(source.sourceId);
    const rowStyle=(clip&&genre(clip))||entry.culturalStyle||H.profile(P.make(kind,{idea,from:1,to:4,key:0})).id,rowFamily=source?.family||'Practice studies';
    if(!matches(style,rowStyle,rowFamily))continue;
    const native=source?.events||P.make(kind,{idea,from:1,to:4,key:0}).bass.map(n=>({...n,offset:n.midi-36}));
    if(!playable(native,grid))continue;
    const shape=native.filter(n=>n.beat<4).map(n=>({beat:n.beat,length:Math.min(n.length,4-n.beat),role:'passing',semitones:n.offset}));
    const value=score(grid,rhythm,shape,source?.nativeBpm,automatic);if(!shape.length||automatic&&value<-.05)continue;
    (kind==='runs'?runs:fills).push({id:'study:'+kind+':'+entry.id,kind,label:N.label(kind,row)+' · '+rowFamily+' (adapted)',family:rowFamily,style:rowStyle,sourceId:source?.sourceId,entry,shape,recorded:true,score:value+(entry.expressive?.16:source?.family==='Practice bassline'?0:.04)});
   }
  }
  // Where a genre has only transition studies, draw the missing type from
  // another visible study in that genre, using the same passage checks.
  for(const missing of ['runs','fills'])if(!(missing==='runs'?runs:fills).length){
   const parents=missing==='runs'?[...fills]:[...runs];
   for(const row of parents){
    const entry=row.entry;if(!entry||entry.recordedStudy)continue;
    const plan=Q.make(entry.kind,{idea:entry.index,from:1,to:4,key:0,bpm:100}),step=60/plan.bpm;
    addDerived({kind:entry.kind,id:entry.id,part:0,style:row.style,family:row.family,title:entry.title,step,offset:0,notes:plan.bass.map(n=>({midi:n.midi,start:n.beat*step,end:(n.beat+n.length)*step,confidence:1,velocity:n.velocity}))},missing);
   }
  }
  // A visible transition can also supply a restrained accompaniment motif.
  // This remains labelled as practice, and disappears with its source study.
  if(!basslines.length)for(const row of [...runs,...fills].sort((a,b)=>b.score-a.score)){
   const shape=row.shape.filter((n,i,all)=>i===0||n.beat-all[i-1].beat>=.45||Math.abs(n.beat-Math.round(n.beat))<.06).slice(0,8).map(n=>({...n,length:Math.min(n.length,.65)}));
   if(shape.length<3)continue;
   basslines.push({...row,id:'motif:'+row.id,kind:'basslines',originEntry:row.entry,entry:undefined,shape,label:'Motif · '+row.label,score:row.score-.03});
   if(basslines.length===4)break;
  }
  if(M&&context)for(const row of [...basslines,...runs,...fills])row.score+=M.matchScore(row,context,selection);
  if(M&&context&&selection!=='all')for(const rows of [runs,fills])for(let i=rows.length-1;i>=0;i--)if(!M.canPlace(rows[i].entry,context,selection))rows.splice(i,1);
  const artistSource=style==='source:bass-lady'||style==='source:bassmatics';
  return [...diverse(basslines,artistSource?Infinity:12),...diverse(runs,artistSource?Infinity:8),...diverse(fills,artistSource?Infinity:8)].map(row=>({...row,label:describe(row).label}));
 }
 function strongestStyle(chords,grid,rhythm,title=''){
  const hinted=H.namedGenre?.({title})||X.styleOf({title}),fallback=C.suggest(chords,grid);
  if(hinted&&C.styles.some(([id])=>id===hinted))return hinted;
  const ranked=availableStyles().filter(([id])=>!['auto','roots'].includes(id)).map(([style])=>({style,score:Math.max(-1,...bank(style,grid,rhythm,true).map(row=>row.score))+(style===fallback?.12:0)}));
  return ranked.sort((a,b)=>b.score-a.score)[0]?.style||fallback;
 }
 function active(chords,time){return chords.findLast(c=>c.start<=time+.012&&c.end>time+.008);}
 function eventsBetween(entry,fromPc,toPc){
  let study=entry.recordedStudy;
  if(!study){
   const plan=Q.make(entry.kind,{idea:entry.index,key:0,from:1,to:4,bpm:100});
   study={interval:plan.target-plan.source,events:plan.bass.filter(n=>n.beat<=4).map(n=>({offset:n.midi-plan.source,beat:n.beat,length:n.length,velocity:n.velocity,confidence:1,review:false}))};
  }
  const result=X.retarget(study,toPc-fromPc);
  const first=Math.min(...result.offsets),last=Math.max(...result.offsets),roots=[];
  for(let midi=23;midi<=59;midi++)if(pc(midi)===pc(fromPc)&&midi+first>=23&&midi+last<=59)roots.push(midi);
  const root=roots.sort((a,b)=>Math.abs(a-35)-Math.abs(b-35))[0];if(root===undefined)return [];
  return study.events.map((n,i)=>({...n,midi:root+result.offsets[i]}));
 }
 function addTransitions(base,clip,entry,placement){
  if(!entry||placement==='off'||!clip.grid)return base;
  const {grid,chords,start,end,quiet=[]}=clip,notes=base.map(n=>({...n})),points=grid.points,meter=grid.meter;
  const boundaries=placement==='bar'?points.filter((_,i)=>i>0&&i%meter===0):chords.filter(c=>c.start>start+.02&&c.start<end-.02).map(c=>c.start);
  boundaries.push(end);
  for(const boundary of [...new Set(boundaries)]){
   const from=active(chords,boundary-.03),to=active(chords,boundary>=end-.02?start+.03:boundary+.03);
   if(!from||!to||from.uncertain&&!from.manual||to.uncertain&&!to.manual||from.rootOnly||to.rootOnly)continue;
   const fromPc=pc((Number.isInteger(from.bassPc)?from.bassPc:from.rootPc)+(clip.transpose||0)),toPc=pc((Number.isInteger(to.bassPc)?to.bassPc:to.rootPc)+(clip.transpose||0));
   if(placement==='ends'&&fromPc===toPc)continue;
   let source;try{source=eventsBetween(entry,fromPc,toPc);}catch{continue;}
   const lead=source.filter(n=>n.beat<4);if(lead.length<3)continue;
   let at=points.findIndex(t=>t>=boundary-.001);if(at<0)continue;
   const previous=points[Math.max(0,at-meter)],launch=Math.max(start,from.start,previous),duration=boundary-launch;
   const secondsPerBeat=60/grid.bpm;
   if(duration<secondsPerBeat*(entry.kind==='runs'?1.5:.65))continue;
   const firstBeat=lead[0].beat,ratio=duration/4,prepared=lead.map(n=>({time:launch+n.beat*ratio,stop:Math.min(boundary-.008,launch+(n.beat+n.length)*ratio),midi:n.midi,role:entry.kind==='runs'?'run':'fill',accent:.6,confidence:n.confidence,review:n.review,sourceId:entry.recordedStudy?.sourceId,adapted:true}));
   if(prepared.some(n=>n.stop-n.time<.032||quiet.some(r=>r.start<n.stop&&r.end>n.time))||prepared.length/Math.max(.1,boundary-prepared[0].time)>14)continue;
   const begin=launch+firstBeat*ratio;
   for(let i=notes.length-1;i>=0;i--)if(notes[i].time>=begin-.01&&notes[i].time<boundary-.01)notes.splice(i,1);
   notes.push(...prepared);
  }
  const ordered=notes.sort((a,b)=>a.time-b.time),out=[];
  for(const note of ordered){const previous=out.at(-1);if(previous)previous.stop=Math.min(previous.stop,note.time-.007);if(note.stop-note.time>=.031)out.push(note);}
  return out;
 }
 function fit(clip,choice,placement='ends',selection='all',pool=null){
  if(M)return M.fit(clip,choice,choice?.entry||placement==='off'?[]:pool||bank(choice?.style||'roots',clip.grid,clip.rhythm,false,clip,selection),placement,selection);
  const rows=choice?.entry?[choice]:bank(choice?.style||'roots',clip.grid,clip.rhythm),candidate=choice?.entry?choice:rows.find(row=>row.kind==='fills'&&row.sourceId===choice?.sourceId)||rows.find(row=>row.kind==='fills'&&row.family===choice?.family)||rows.find(row=>row.kind==='fills');
  const base=C.fit({...clip,shape:choice?.entry?[]:choice?.shape||[],recorded:choice?.entry?false:!!choice?.recorded,fill:candidate?'off':placement});
  return candidate?addTransitions(base,clip,candidate.entry,placement):base;
 }
 return {sourceOptions,availableStyles,bank,strongestStyle,eventsBetween,addTransitions,fit,genre,family,describe};
})();
