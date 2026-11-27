/* Source-derived practice adaptations. Estimated notes do not establish the
 * recording's original chord progression. Native matching intervals are
 * preferred. Other changes transpose the captured approach into the selected
 * landing, retaining its note order, relative timing and internal intervals. */
window.BassCulturalStudies=(()=>{
 'use strict';
 const C=window.BassCuratedStudies,P=window.BassPracticeCore,F=window.BassFillCore,D=window.BassPracticeCatalogue;
 const pc=n=>(n%12+12)%12,scale=F.scales.major,entries=[],limits={makossa:32,seben:24,soukous:20,zouk:12,woro:32,highlife:32,ariaria:40},priority=[5,7,2,9,3,10,4,1,11,8,6];
 const names={woro:'Woro',highlife:'Highlife',ariaria:'Ariaria',makossa:'Makossa',seben:'Seben',soukous:'Soukous',zouk:'Zouk',afrobeat:'Afrobeat',soca:'Soca',sungura:'Sungura',mbalax:'Mbalax',mbaqanga:'Mbaqanga'};
 const round=n=>Math.round(n*100000)/100000;
 function hash(text){let h=2166136261;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);return (h>>>0).toString(16).padStart(8,'0');}
 function styleOf(row){
  const text=[row.title,row.originalTitle,row.name,row.sourceFilename,row.collection,row.feel].filter(Boolean).join(' ');
  if(/seben/i.test(text))return 'seben';
  const explicit=row.practiceStyle||String(row.collection||'').replace(/^recorded-/,'');
  if(names[explicit])return explicit;
  return Object.keys(names).find(id=>new RegExp(id,'i').test(text))||null;
 }
 function sourceAvailable(source){return D.visible(source.kind,source.id)&&D.visible(source.kind,source.id+'/'+source.part);}
 function captures(){
  const sources=[];
  for(const row of window.BassUploadedCore.items){
   const style=styleOf(row);if(!style||!row.notes?.length)continue;
   const phrases=window.BassRecordedPhrases?.[row.id];
   for(const [part,phrase] of (phrases||[]).entries()){
    const section=row.sections?.[part],start=section?0:phrase[0],end=section?.duration??phrase[1],beats=section?.beats??phrase[2];
    if(!Number.isFinite(beats)||end<=start)continue;
    const notes=(section?.notes||row.notes).filter(n=>n.start>=start&&n.start<end).map(n=>({...n,start:n.start-start,end:Math.min(end,n.end)-start}));
    const family=row.sourceFamily||(row.group==='bass-lady'?'Bass Lady':row.group==='bassmatics'?'Bassmatics':row.group==='world-method'?'World Methods':'Recorded bass');
    sources.push({kind:'uploaded',id:row.id,part,style,family,cohort:row.culturalUpload?'uploads-352':'legacy',title:row.displayName||row.title,audio:section?.audio||row.audio,offset:(row.sourceStart||0)+start,step:(end-start)/beats,notes,estimated:true});
   }
  }
  // New or individually restored cultural practice basslines use the same
  // extractor, without reviving their removed genre menus or deleted items.
  for(const [idea,row] of P.lines.entries()){
   const style=styleOf(row);if(!style||row.removedFromPlatform||!D.visible('basslines',row.id))continue;
   for(const [part] of P.phrases(row.degrees).entries()){
    if(!D.visible('basslines',row.id+'/'+part))continue;
    const plan=P.make('basslines',{idea,part,key:0,bpm:100}),step=60/plan.bpm;
    sources.push({kind:'basslines',id:row.id,part,style,family:'Practice bassline',title:row.name,audio:null,offset:0,step,estimated:false,notes:plan.bass.map(n=>({midi:n.midi,start:n.beat*step,end:(n.beat+n.length)*step,velocity:n.velocity,confidence:1}))});
   }
  }
  return sources;
 }
 function changes(interval){const out=[];for(let from=1;from<=7;from++)for(let to=1;to<=7;to++)if(from!==to&&pc(scale[to-1]-scale[from-1])===pc(interval))out.push([from,to]);return out;}
 const allChanges=Array.from({length:7},(_,i)=>i+1).flatMap(from=>Array.from({length:7},(_,i)=>i+1).filter(to=>to!==from).map(to=>[from,to]));
 function candidates(source,kind,{maxSeconds=5,allowTempoAdaptation=false}={}){
  const notes=source.notes,out=[],lo=kind==='fills'?4:8,hi=kind==='fills'?7:14;
  for(let first=0;first<notes.length;first++)for(let count=lo;count<=hi;count++){
   const last=first+count-1;if(last>=notes.length)break;
   const take=notes.slice(first,last+1),a=take[0],b=take.at(-1),seconds=b.start-a.start,interval=b.midi-a.midi;
   if(seconds<.65||seconds>maxSeconds||!pc(interval))continue;
   if(take.some(n=>!Number.isFinite(n.confidence)||n.midi<23||n.midi>59||n.end-n.start<.045))continue;
   const confidence=take.reduce((sum,n)=>sum+n.confidence,0)/count,pitches=take.map(n=>n.midi);
   if(confidence<.67||a.confidence<.65||b.confidence<.65||a.end-a.start<.09||b.end-b.start<.09)continue;
   if(new Set(pitches.map(pc)).size<3||Math.max(...pitches)-Math.min(...pitches)>24||pitches.some((p,i)=>i&&Math.abs(p-pitches[i-1])>14))continue;
   const span=Math.min(4,Math.max(1,Math.round(seconds/source.step*2)/2)),ratio=span/seconds,bpm=60*ratio;
   if(!allowTempoAdaptation&&(bpm<40||bpm>220))continue;
   const events=take.map((n,i)=>({offset:n.midi-a.midi,beat:round(4-span+(n.start-a.start)*ratio),length:round(i===take.length-1?2.8:Math.max(.04,Math.min(n.end-n.start,(take[i+1].start-n.start)*.95)*ratio)),velocity:n.velocity||82,confidence:n.confidence,review:n.confidence<.76,sourceTime:round(source.offset+n.start)}));
   const shape=JSON.stringify(events.map(n=>[n.offset,Math.round((n.beat-events[0].beat)*16),Math.round(n.length*8)]));
   const id='culture-351-'+kind+'-'+hash([source.kind,source.id,source.part,round(a.start),round(b.start)].join(':'));
   const rhythm=new Set(events.slice(1).map((n,i)=>Math.round((n.beat-events[i].beat)*8))).size;
   const score=confidence*3+(source.kind==='uploaded'?1:0)+Math.min(.2,(a.end-a.start+b.end-b.start)*.2)+Math.min(.18,rhythm*.045)+Math.min(.15,new Set(pitches.map(pc)).size*.025);
   out.push({id,kind,source,events,interval,changes:changes(interval),nativeBpm:round(bpm),start:round(source.offset+a.start),end:round(source.offset+b.start),score,confidence,shape});
  }
  return out;
 }
 const all=captures(),byGroup=new Map(),sourceNumbers=new Map(),familyCounts=new Map();
 for(const source of all){const familyKey=source.style+'/'+source.family,key=familyKey+'/'+source.kind+'/'+source.id+'/'+source.part;if(!sourceNumbers.has(key)){const n=(familyCounts.get(familyKey)||0)+1;familyCounts.set(familyKey,n);sourceNumbers.set(key,n);}}
 for(const source of all)for(const kind of ['runs','fills']){
  const key=(source.cohort||'legacy')+'|'+kind+'/'+source.style;if(!byGroup.has(key))byGroup.set(key,[]);byGroup.get(key).push(...candidates(source,kind));
 }
 const duplicateIds=new Map(),registeredShapes=new Map(),summary={runs:{},fills:{},families:{},sourceCaptures:all.length};
 const batches=[...byGroup].filter(([key])=>key.startsWith('legacy|')).concat([...byGroup].filter(([key])=>!key.startsWith('legacy|')));
 for(const [batchKey,raw] of batches){
  const key=batchKey.split('|')[1],[kind,style]=key.split('/'),unique=new Map();
  for(const row of raw.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id))){
   if(!unique.has(row.shape)){unique.set(row.shape,row);duplicateIds.set(row.id,[]);}
   else duplicateIds.get(unique.get(row.shape).id).push(row.id);
  }
  const pool=[...unique.values()],selected=[],used=new Set(),sourceCounts=new Map(),cap=limits[style]||16;
  function take(row){
   if(!row||used.has(row.id)||selected.length>=cap||(sourceCounts.get(row.source.id)||0)>=4)return false;
   used.add(row.id);selected.push(row);sourceCounts.set(row.source.id,(sourceCounts.get(row.source.id)||0)+1);return true;
  }
  // Cover the requested changes first, and retain every contributing teacher.
  for(const delta of [5,7,2])for(const family of new Set(pool.map(r=>r.source.family)))take(pool.find(r=>pc(r.interval)===delta&&r.source.family===family&&!used.has(r.id)));
  for(const family of new Set(pool.map(r=>r.source.family)))take(pool.find(r=>r.source.family===family&&!used.has(r.id)));
  for(let pass=0;pass<cap&&selected.length<cap;pass++){
   let added=false;
   for(const delta of priority){
    const choice=pool.filter(r=>pc(r.interval)===delta&&!used.has(r.id)&&(sourceCounts.get(r.source.id)||0)<4).sort((a,b)=>(b.score-(sourceCounts.get(b.source.id)||0)*.16)-(a.score-(sourceCounts.get(a.source.id)||0)*.16)||a.id.localeCompare(b.id))[0];
    added=take(choice)||added;
   }
   if(!added)break;
  }
  const numbers=new Map();let registered=0;
  for(const row of selected){
   try{for(let interval=1;interval<12;interval++)retarget({events:row.events,interval:row.interval},interval);}catch{continue;}
   const shapeKey=kind+'/'+style+'/'+row.shape,previous=registeredShapes.get(shapeKey);
   if(previous){const list=kind==='runs'?P.runs:F.styles;list[previous.index].aliasIds.push(row.id,...(duplicateIds.get(row.id)||[]));continue;}
   const number=(numbers.get(row.source.id)||0)+1;numbers.set(row.source.id,number);
   registerCapture(row,number);registered++;

  }
  summary[kind][style]=(summary[kind][style]||0)+registered;
 }
 function registerCapture(row,number){
   const {kind,source:{style}}=row;
   const sourceNumber=String(sourceNumbers.get(style+'/'+row.source.family+'/'+row.source.kind+'/'+row.source.id+'/'+row.source.part)).padStart(2,'0');
   const uploadedName=({Bassmatics:'Mat','Bass Lady':'Ldy','World Methods':'Wld'}[row.source.family]||{highlife:'Hlife',ariaria:'Aria',woro:'Woro',makossa:'Mk'}[style]||'Take')+' '+sourceNumber;
   const base=row.source.cohort==='uploads-352'?uploadedName:row.source.family==='World Methods'?'World '+sourceNumber:row.source.kind==='basslines'?'Line '+sourceNumber:['Bass Lady','Bassmatics'].includes(row.source.family)?row.source.title.replace(/^Bass Lady\s*/i,'Lady ').replace(/^Bassmatics?\s*/i,'Matics '):uploadedName;
   const title=(base.slice(0,9)+'.'+number).slice(0,12);
   const recordedStudy={sourceKind:row.source.kind,sourceId:row.source.id,sourcePart:row.source.part,family:row.source.family,sourceTitle:row.source.title,style,start:row.start,end:row.end,nativeBpm:row.nativeBpm,interval:row.interval,changes:allChanges,nativeChanges:row.changes,events:row.events,confidence:row.confidence,estimated:true};
   const entry=C.register({id:row.id,kind,title,tip:'',genre:style,mode:'major',rhythm:'recorded',notes:[],tier:0,rank:-1000-row.score*100,culturalStyle:style,recordedStudy,source:{label:'Adapted from '+row.source.family+' · '+row.source.title,url:row.source.audio}});
   entry.original=false;const list=kind==='runs'?P.runs:F.styles;list[entry.index].aliasIds=duplicateIds.get(row.id)||[];entries.push(entry);registeredShapes.set(kind+'/'+style+'/'+row.shape,entry);
   D.describe([{kind,id:entry.id,title:names[style]+' · '+row.source.family+' · '+row.source.title+' · '+(kind==='runs'?'run':'fill')}]);
   summary.families[row.source.family]=(summary.families[row.source.family]||0)+1;
 }
 // After the existing catalogue has its stable indices, cover artist takes
 // that lost out to another source in the original genre-wide selection.
 function completeArtistStudies(){
  const used=new Set(entries.map(e=>e.recordedStudy.sourceId+'/'+e.kind));
  for(const [,pool] of batches){
   for(const row of pool){
    const {source,kind}=row,key=source.id+'/'+kind;
    if(!['Bass Lady','Bassmatics'].includes(source.family)||used.has(key))continue;
    if(registeredShapes.has(kind+'/'+source.style+'/'+row.shape))continue;
    try{for(let delta=0;delta<12;delta++)retarget({events:row.events,interval:row.interval},delta);}catch{continue;}
    registerCapture(row,1);used.add(key);
   }
  }

  // Additional passages from the longer archived performances, outside the
  // original short loop. Keep the public recording ID for deletion and naming.
  batches.length=0;byGroup.clear();
  const archivePassages=[
   ["lady-02","runs","clip-24",38,11],
   ["lady-04","fills","clip-26",20,5],
   ["lady-05","runs","clip-27",37,12],
   ["lady-05","fills","clip-27",44,5],
   ["lady-10","fills","clip-32",6,5],
   ["clip-33","runs","clip-33",25,8],
   ["clip-33","fills","clip-33",121,4],
   ["matics-02","fills","clip-43",31,4],
   ["matics-03","runs","clip-42",8,10],
   ["matics-03","fills","clip-42",8,4],
   ["matics-05","fills","clip-40",53,4],
   ["matics-07","runs","clip-38",45,14],
   ["matics-09","fills","clip-36",44,6],
   ["matics-10","fills","clip-35",56,5],
  ];
  for(const [id,kind,archiveId,first,count] of archivePassages){
   if(used.has(id+'/'+kind))continue;
   const archive=window.BassUploadedStudies.find(r=>r.id===archiveId);
   const timing=window.BassRecordedPhrases[id]?.[0];
   if(!archive||!timing)continue;
   const row=window.BassUploadedCore.find(id),family=row.group==='bass-lady'?'Bass Lady':'Bassmatics';
   const source={kind:'uploaded',id,part:0,style:styleOf(archive),family,title:archive.title,audio:row.audio,offset:0,step:(timing[1]-timing[0])/timing[2],notes:archive.notes.slice(first,first+count)};
   const passage=candidates(source,kind,{maxSeconds:8,allowTempoAdaptation:true}).find(r=>r.events.length===count);
   if(passage&&!registeredShapes.has(kind+'/'+source.style+'/'+passage.shape))registerCapture(passage,1);
  }
  registeredShapes.clear();duplicateIds.clear();
 }
 function supports(entry,from,to){return !entry?.recordedStudy||entry.recordedStudy.changes.some(pair=>pair[0]===Number(from)&&pair[1]===Number(to));}
 function nativeMatch(entry,from,to){return !!entry?.recordedStudy?.nativeChanges.some(pair=>pair[0]===Number(from)&&pair[1]===Number(to));}
 function available(entry){const r=entry?.recordedStudy;return !r||sourceAvailable({kind:r.sourceKind,id:r.sourceId,part:r.sourcePart});}
 function retarget(study,interval){
  const offsets=study.events.map(n=>n.offset);
  if(pc(study.interval)===pc(interval))return {offsets,pivot:offsets.length,shift:0};
  const choices=[];
  for(let pivot=Math.max(1,Math.floor(offsets.length/2));pivot<offsets.length;pivot++)for(let octave=-2;octave<=2;octave++){
   const shift=pc(interval)-pc(study.interval)+octave*12,notes=offsets.map((n,i)=>n+(i>=pivot?shift:0));
   const span=Math.max(0,...notes)-Math.min(0,...notes),jump=Math.max(...notes.slice(1).map((n,i)=>Math.abs(n-notes[i])));
   if(span>24||jump>14)continue;
   const cost=Math.abs(shift)*.05+Math.abs(pivot-(offsets.length-3))*.15+jump*.04+(pivot===offsets.length-1?3:0);
   choices.push({offsets:notes,pivot,shift,cost});
  }
  choices.sort((a,b)=>a.cost-b.cost||a.pivot-b.pivot||Math.abs(a.shift)-Math.abs(b.shift));
  if(!choices.length)throw Error('Source phrase cannot fit this bass transition');
  return choices[0];
 }
 function make(kind,entry,opts={}){
  const r=entry.recordedStudy,key=pc(Math.round(Number(opts.key)||0));
  const from=Math.max(1,Math.min(7,Math.round(Number(opts.from)||1)));let to=Math.max(1,Math.min(7,Math.round(Number(opts.to)||4)));if(from===to)to=from%7+1;
  const requestedChangeSupported=supports(entry,from,to),adaptation=retarget(r,scale[to-1]-scale[from-1]);
  const degree=n=>36+key+scale[(n%7+7)%7]+12*Math.floor(n/7),source=degree(from-1),target=source+adaptation.offsets.at(-1);
  const bass=r.events.map((n,i)=>({midi:source+adaptation.offsets[i],beat:n.beat,length:n.length,velocity:n.velocity,confidence:n.confidence,review:n.review,sourceTime:n.sourceTime,role:i===r.events.length-1?'landing':'bass'}));
  if(bass[0].beat>0)bass.unshift({midi:source,beat:0,length:Math.min(1.3,bass[0].beat-.04),velocity:86,role:'bass'});
  const chord=(d,beat)=>[0,2,4].map(i=>({midi:degree(d-1+i)+12,beat,length:3.7,velocity:46,role:'chord'}));
  const chordName=d=>{const root=degree(d-1),third=degree(d+1)-root,fifth=degree(d+3)-root;return F.names[pc(root)]+(fifth===6?'dim':third===3?'m':'');};
  return {kind,key,mode:'major',from,to,idea:entry.index,bpm:Math.max(40,Math.min(220,Number(opts.bpm)||r.nativeBpm)),beats:8,bass,chords:[...chord(from,0),...chord(to,4)],source,target,title:entry.title,tip:'',curated:entry,recordedStudy:r,culturalStyle:r.style,practiceStyle:r.style==='seben'?'soukous':r.style,requestedChangeSupported,sourceAdaptation:{pivot:adaptation.pivot,shift:adaptation.shift},heading:from+' → '+to+' · '+chordName(from)+' → '+chordName(to),fromChord:chordName(from),toChord:chordName(to)};
 }
 return {entries,summary,completeArtistStudies,styleOf,supports,nativeMatch,available,make,retarget,candidates};
})();
