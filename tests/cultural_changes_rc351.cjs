const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),cp=require('node:child_process');
const files=['drum-loops-data-rc294','groove-library','fl-drums-rc349','supplied-drums-rc294','fills-rc264','practice-rc264b','catalogue-rc269','curated-rc289','groups-rc290','uploaded-data-rc267','lesson-data-rc272','african-data-rc274','recording-phrases','original-studies','world-methods-rc350','reggae-recordings-rc348','uploaded-core-rc267','accompaniment-rc293','catalogue-review-rc347'];
function load(saved=new Map(),baseline=false){
 const env={window:{},localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)}};vm.createContext(env);
 for(const file of [...files,...baseline?[]:['cultural-studies-rc351'],'bass-register-rc292','study-display-rc294']){
  const path='ear-source/'+file+'.js',source=baseline?cp.execFileSync('git',['show','fe01e3689d4eaf98347bab40a095a1888a69ff9a:'+path],{encoding:'utf8',maxBuffer:8000000}):fs.readFileSync(path,'utf8');vm.runInContext(source,env);
 }
 return env.window;
}
const saved=new Map(),W=load(saved),{BassCulturalStudies:X,BassPracticeCore:P,BassFillCore:F,BassCuratedStudies:C,BassStudyGroups:G,BassRegister:B,BassPracticeCatalogue:D,BassCatalogueReview:R}=W;
const scale=F.scales.major,pc=n=>(n%12+12)%12,labels=new Set(),ids=new Set(),shapes=new Set();let checked=0,native=0;
assert(X.entries.length>0);assert.equal(G.migrate('african'),'makossa');assert(!G.groups.some(([id])=>id==='african'));
for(const kind of ['runs','fills'])for(const style of ['makossa','seben','soukous','zouk'])assert(G.available(kind).some(([id])=>id===style));
for(const e of X.entries){
 const r=e.recordedStudy,rows=e.kind==='runs'?P.runs:F.styles;assert(!ids.has(e.id));ids.add(e.id);
 const label=W.BassStudyDisplay.label(e.kind,rows[e.index]),labelKey=e.kind+'/'+r.style+'/'+label;assert(label.length<=12);assert(!labels.has(labelKey));labels.add(labelKey);
 assert.equal(r.changes.length,42);assert(r.events.length>=(e.kind==='runs'?8:4));assert(r.events.length<=(e.kind==='runs'?14:7));assert.equal(r.events[0].offset,0);assert.equal(r.events.at(-1).offset,r.interval);
 const shape=e.kind+'/'+r.style+'/'+JSON.stringify(r.events.map(n=>[n.offset,Math.round((n.beat-r.events[0].beat)*16),Math.round(n.length*8)]));assert(!shapes.has(shape));shapes.add(shape);
 assert(r.nativeBpm>=40&&r.nativeBpm<=220);assert(X.available(e));assert(r.estimated);assert(!e.original);
 const auto=W.BassAccompaniment.resolve(P.make(e.kind,{idea:e.index,from:1,to:4}));assert.equal(auto.loop.genre,W.BassSuppliedDrums.choose(r.style==='seben'?'soukous':r.style).genre);
 for(let i=1;i<r.events.length;i++)assert(Math.abs((r.events[i].beat-r.events[i-1].beat)*60/r.nativeBpm-(r.events[i].sourceTime-r.events[i-1].sourceTime))<.00003,'Captured timing changed');
 for(let from=1;from<=7;from++)for(let to=1;to<=7;to++)if(from!==to)for(let key=0;key<12;key++){
  assert(G.supports(e.kind,e.index,from,to));const p=B.plan(P.make(e.kind,{idea:e.index,from,to,key,bpm:110}));
  assert.equal(p.from,from);assert.equal(p.to,to);assert(p.requestedChangeSupported);assert(!p.bassRevoiced);assert(p.bass.every(n=>n.midi>=23&&n.midi<=59&&n.length>0&&n.beat>=0&&n.beat+n.length<=8));
  assert.equal(pc(p.bass[0].midi),pc(key+scale[from-1]));assert.equal(pc(p.bass.find(n=>n.role==='landing').midi),pc(key+scale[to-1]));
  const events=p.bass.filter(n=>n.sourceTime!==undefined);assert.equal(events.length,r.events.length);
  for(let i=0;i<events.length;i++){
   assert.equal(events[i].beat,r.events[i].beat);assert.equal(events[i].sourceTime,r.events[i].sourceTime);
   const shift=i>=p.sourceAdaptation.pivot?p.sourceAdaptation.shift:0;
   assert.equal(events[i].midi-p.source-p.bassShift,r.events[i].offset+shift);
  }
  if(X.nativeMatch(e,from,to)){assert.equal(p.sourceAdaptation.shift,0);native++;}
  const profile=W.BassAccompaniment.profile(p);assert.equal(profile.id,r.style==='seben'?'soukous':r.style);
  checked++;
 }
}
for(const family of ['Bass Lady','Bassmatics','World Methods','Practice bassline'])assert(X.entries.some(e=>e.recordedStudy.family===family));
// Reclassification must preserve every previous study's music and deletion ID.
const old=load(new Map(),true);let preserved=0;
for(const kind of ['runs','fills']){
 const before=kind==='runs'?old.BassPracticeCore.runs:old.BassFillCore.styles,after=kind==='runs'?P.runs:F.styles;
 for(let idea=0;idea<before.length;idea++){
  assert.equal(after[idea].id,before[idea].id);assert.equal(G.visible(kind,idea),old.BassStudyGroups.visible(kind,idea));
  const opts={idea,from:1,to:4};assert.equal(W.BassAccompaniment.resolve(P.make(kind,opts)).loop.id,old.BassAccompaniment.resolve(old.BassPracticeCore.make(kind,opts)).loop.id);
  for(let from=1;from<=7;from++)for(let to=1;to<=7;to++)if(from!==to){
   const opts={idea,from,to,key:0,bpm:100};assert.equal(R.signature(P.make(kind,opts)),old.BassCatalogueReview.signature(old.BassPracticeCore.make(kind,opts)));preserved++;
  }
 }
}
const item=X.entries.find(e=>e.recordedStudy.family==='Bass Lady'),sibling=X.entries.find(e=>e.kind===item.kind&&e.id!==item.id);
D.remove(item.kind,item.id);assert(!G.visible(item.kind,item.index));assert(G.visible(sibling.kind,sibling.index));
let reload=load(saved),entry=reload.BassCatalogueReview.removed().find(r=>r.id===item.id);assert(entry);reload.BassCatalogueReview.restore(entry);assert(reload.BassStudyGroups.visible(item.kind,item.index));
reload.BassPracticeCatalogue.remove(item.kind,item.id);reload.BassPracticeCatalogue.emptyDeleted();reload=load(saved);assert(!reload.BassStudyGroups.visible(item.kind,item.index));assert(!reload.BassCatalogueReview.removed().some(r=>r.id===item.id));
const other=reload.BassCulturalStudies.entries.find(e=>e.recordedStudy.family==='Bassmatics'),source=other.recordedStudy;
reload.BassPracticeCatalogue.remove(other.kind,other.id);reload.BassPracticeCatalogue.remove(source.sourceKind,source.sourceId);
entry=reload.BassCatalogueReview.removed().find(r=>r.id===other.id);assert(entry&&entry.available===false);assert.throws(()=>reload.BassCatalogueReview.restore(entry));
reload.BassPracticeCatalogue.restore(source.sourceKind,source.sourceId);entry=reload.BassCatalogueReview.removed().find(r=>r.id===other.id);reload.BassCatalogueReview.restore(entry);assert(reload.BassStudyGroups.visible(other.kind,other.index));
console.log(JSON.stringify({passed:true,sourceStudies:X.entries.length,checkedTransposedChanges:checked,directedChangesPerStudy:42,nativeShapeChecks:native,legacyTransitionsPreserved:preserved,sourceFamilies:X.summary.families,sourceAndPatternDeletionPersistent:true,summary:X.summary}));
