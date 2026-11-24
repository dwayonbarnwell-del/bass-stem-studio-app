const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),cp=require('node:child_process');
const files=['drum-loops-data-rc294','groove-library','fl-drums-rc349','supplied-drums-rc294','fills-rc264','practice-rc264b','catalogue-rc269','curated-rc289','groups-rc290','uploaded-data-rc267','lesson-data-rc272','african-data-rc274','recording-phrases','original-studies','world-methods-rc350','reggae-recordings-rc348','uploaded-core-rc267','accompaniment-rc293','catalogue-review-rc347','cultural-studies-rc351','bass-register-rc292','study-display-rc294','rehearsal-core'];
function load(saved=new Map(),baseline=false){
 const env={window:{},localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)}};vm.createContext(env);
 for(const file of [...baseline?[]:['cultural-recordings-rc352'],...files,...baseline?[]:['rehearsal-ideas-rc352']]){
  const path='ear-source/'+file+'.js';vm.runInContext(baseline?cp.execFileSync('git',['show','f4b11cc77d1f16d4619e56f12f959d9678a964ff:'+path],{encoding:'utf8',maxBuffer:8000000}):fs.readFileSync(path,'utf8'),env);
  if(file==='rehearsal-core')env.window.BassRehearsalCore=env.BassRehearsalCore;
 }
 return env.window;
}
const saved=new Map(),W=load(saved),old=load(new Map(),true),{BassRehearsalIdeas:I,BassCulturalStudies:X,BassPracticeCore:P,BassFillCore:F,BassPracticeCatalogue:D,BassStudyGroups:G,BassRegister:B,BassRehearsalCore:C}=W;
const pc=n=>(n%12+12)%12,scale=F.scales.major,labels=new Set();let changes=0;
assert.equal(W.BassCulturalUploads.length,45);
assert.equal(new Set(W.BassCulturalUploads.map(r=>r.sourceRecording)).size,20);
assert(W.BassCulturalUploads.some(r=>/Tobi Jeff/i.test(r.originalTitle)&&r.practiceStyle==='ariaria'));
assert(!/Y2Mate\.is/i.test(fs.readFileSync('ear-source/cultural-recordings-rc352.js','utf8')));
for(const e of old.BassCulturalStudies.entries){
 const next=X.entries.find(r=>r.id===e.id);assert(next,'Removed an RC351 source study: '+e.id);
 assert.equal(JSON.stringify(next.recordedStudy),JSON.stringify(e.recordedStudy));
}
for(const [id]of old.BassRehearsalCore.styles)assert(C.styles.some(([next])=>next===id),'Removed a rehearsal genre: '+id);
for(const e of X.entries){
 const r=e.recordedStudy,label=e.kind+'/'+r.style+'/'+e.title;assert(e.title.length<=12);assert(!labels.has(label),'Repeated short title: '+label);labels.add(label);
 assert.equal(r.changes.length,42);assert(r.nativeBpm>=40&&r.nativeBpm<=220);
 if(old.BassCulturalStudies.entries.some(row=>row.id===e.id))continue;
 const source=W.BassUploadedCore.find(r.sourceId);assert(source?.culturalUpload);
 assert.equal(W.BassAccompaniment.resolve(P.make(e.kind,{idea:e.index,from:1,to:4})).loop.id,source.sourceDrumLoopId);
 for(let from=1;from<=7;from++)for(let to=1;to<=7;to++)if(from!==to)for(let key=0;key<12;key++){
  assert(G.supports(e.kind,e.index,from,to));const plan=B.plan(P.make(e.kind,{idea:e.index,from,to,key,bpm:110}));
  assert(plan.requestedChangeSupported&&!plan.bassRevoiced);assert(plan.bass.every(n=>Number.isFinite(n.midi)&&n.midi>=23&&n.midi<=59&&n.length>0));
  assert.equal(pc(plan.bass[0].midi),pc(key+scale[from-1]));assert.equal(pc(plan.bass.find(n=>n.role==='landing').midi),pc(key+scale[to-1]));changes++;
 }
}
for(const row of W.BassCulturalUploads){
 assert(row.title.length<=12);assert(row.notes.every(n=>n.midi>=23&&n.midi<=59&&n.end>n.start&&n.start>=0&&n.end<=row.duration+.0001));
 const plan=W.BassUploadedCore.plan(row.id,'phrase-0');assert(W.BassUploadedCore.loop(row.id)&&plan?.recording&&plan.bass.length);assert.equal(plan.clipId,row.id);
 assert(W.BassCulturalMixes[row.audio]);assert(W.BassSuppliedDrums.loops.some(d=>d.id===row.sourceDrumLoopId));
}
const grid={points:Array.from({length:25},(_,i)=>i*.5),meter:4,bpm:120,snap:false},chords=[{start:0,end:4,rootPc:0,quality:'maj',manual:true},{start:4,end:8,rootPc:5,quality:'maj',manual:true},{start:8,end:12,rootPc:7,quality:'7',manual:true}],clip={grid,chords,start:0,end:12,quiet:[]};
const required=['worship','rnb','gospel','soul','reggae','jazz','blues','fusion','praise','makossa','woro','highlife','ariaria','seben','soukous','zouk','mbalax','mbaqanga','sungura','afrobeat'];let fitted=0;
for(const style of required){
 assert(I.availableStyles().some(([id])=>id===style));const rows=I.bank(style,grid);
 for(const kind of ['basslines','runs','fills']){
  const choices=rows.filter(r=>r.kind===kind);assert(choices.length,'Missing '+style+' '+kind);
  for(const choice of choices.slice(0,2)){
   assert(/Adapted/.test(I.describe(choice).detail));const notes=I.fit(clip,choice,'ends');
   assert(notes.length);assert(notes.every(n=>Number.isFinite(n.time)&&Number.isFinite(n.stop)&&n.stop>n.time&&n.time>=0&&n.stop<=12&&(n.midi===null||n.midi>=23&&n.midi<=59)));
   if(choice.entry){assert(notes.some(n=>n.role===(kind==='runs'?'run':'fill')));assert(!I.fit(clip,choice,'off').some(n=>n.role==='run'||n.role==='fill'));}
   fitted++;
  }
 }
}
assert.equal(JSON.stringify(chords),JSON.stringify(clip.chords));
for(const [id]of I.sourceOptions())assert(I.bank(id,grid).some(r=>r.recorded));
// Actual pitch-class movements, including minor-key and slash-bass changes.
for(const kind of ['runs','fills'])for(const choice of I.bank('woro',grid).filter(r=>r.kind===kind))for(let from=0;from<12;from++)for(let to=0;to<12;to++){
 const events=I.eventsBetween(choice.entry,from,to);assert(events.length>=4);assert.equal(pc(events[0].midi),from);assert.equal(pc(events.at(-1).midi),to);assert(events.every(n=>n.midi>=23&&n.midi<=59));
}
const partial={...grid,points:grid.points.slice(0,23)};
assert(Number.isFinite(C.patternScore(partial,{kick:new Float32Array(1200),bright:new Float32Array(1200),start:0,step:.01},[{beat:3.75,length:.2,role:'root'}])));
assert(C.fit({...clip,end:11,grid:partial,shape:[{beat:3.75,length:.2,role:'root'}],recorded:true,fill:'off'}).every(n=>Number.isFinite(n.time)&&Number.isFinite(n.stop)));
// Source, individual pattern and permanent deletion all carry into Rehearsal.
const source=W.BassCulturalUploads.find(r=>r.practiceStyle==='woro');D.remove('uploaded',source.id);
assert(!I.bank('woro',grid).some(r=>r.sourceId===source.id));D.emptyDeleted();
const reloaded=load(saved);assert(!reloaded.BassRehearsalIdeas.bank('woro',grid).some(r=>r.sourceId===source.id));
const choice=I.bank('rnb',grid).find(r=>r.kind==='runs'&&r.entry.recordedStudy);assert(choice);D.remove('runs',choice.entry.id);assert(!I.bank('rnb',grid).some(r=>r.id===choice.id));
const motif=I.bank('blues',grid).find(r=>r.kind==='basslines');assert(motif);const origin=I.bank('blues',grid).find(r=>r.id===motif.id.replace(/^motif:/,''));D.remove(origin.kind,origin.entry.id);assert(!I.bank('blues',grid).some(r=>r.id===motif.id));
console.log(JSON.stringify({passed:true,newRecordedLoops:45,representedRecordings:20,legacyCulturalStudiesPreserved:old.BassCulturalStudies.entries.length,newChangesAcrossAllKeys:changes,rehearsalGenresWithAllThreeAlternatives:required.length,fittedAlternatives:fitted,sourceAndPatternDeletionsPersist:true}));
