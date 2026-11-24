const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),cp=require('node:child_process');
const files=['cultural-recordings-rc352','drum-loops-data-rc294','groove-library','fl-drums-rc349','supplied-drums-rc294','fills-rc264','practice-rc264b','catalogue-rc269','curated-rc289','groups-rc290','uploaded-data-rc267','lesson-data-rc272','african-data-rc274','recording-phrases','original-studies','world-methods-rc350','reggae-recordings-rc348','uploaded-core-rc267','accompaniment-rc293','catalogue-review-rc347','cultural-studies-rc351','bass-register-rc292','study-display-rc294','rehearsal-core','rehearsal-ideas-rc352'];
function load(baseline=false){
 const env={window:{},localStorage:{getItem:()=>null,setItem:()=>{}}};vm.createContext(env);
 for(const file of files){const path='ear-source/'+file+'.js';vm.runInContext(baseline?cp.execFileSync('git',['show','33ac28894b811dca74b12f11434bec1a8fed074c:'+path],{encoding:'utf8',maxBuffer:8000000}):fs.readFileSync(path,'utf8'),env);if(file==='rehearsal-core')env.window.BassRehearsalCore=env.BassRehearsalCore;}
 return env.window;
}
const W=load(),old=load(true),I=W.BassRehearsalIdeas,grid={points:Array.from({length:25},(_,i)=>i*.5),meter:4,bpm:120,snap:false};
const clip={grid,chords:[{start:0,end:4,rootPc:0,quality:'maj',manual:true},{start:4,end:8,rootPc:5,quality:'maj',manual:true},{start:8,end:12,rootPc:7,quality:'7',manual:true}],start:0,end:12,quiet:[]};let checked=0;
for(const [style]of [...I.availableStyles(),...I.sourceOptions()]){
 const rows=I.bank(style,grid),before=old.BassRehearsalIdeas.bank(style,grid);
 assert.equal(JSON.stringify(rows.map(r=>[r.id,r.kind,r.style,r.sourceId,r.shape])),JSON.stringify(before.map(r=>[r.id,r.kind,r.style,r.sourceId,r.shape])));
 for(const kind of ['basslines','runs','fills']){
  const labels=new Set();
  for(const row of rows.filter(r=>r.kind===kind)){
   const info=I.describe(row);assert.equal(row.label,info.label);assert(row.label.length<=34,'Long label: '+row.label);assert(!/Pattern|Chord-tone|adapted/i.test(row.label));assert(!labels.has(row.label),'Ambiguous label: '+style+' '+kind+' '+row.label);labels.add(row.label);
   assert(info.detail.endsWith('Adapted'));assert(info.genre&&info.source);
   if(['Bass Lady','Bassmatics','World Methods'].includes(row.family)){assert(row.label.startsWith(row.family+' '));assert.equal(info.source,row.family);assert.equal(W.BassRehearsalIdeas.family(W.BassUploadedCore.find(info.sourceId)),row.family);}
   if(/^Practice/.test(row.family))assert(row.label.startsWith('Practice '));
   const prior=before.find(r=>r.id===row.id);assert.equal(JSON.stringify(I.fit(clip,row,'ends')),JSON.stringify(old.BassRehearsalIdeas.fit(clip,prior,'ends')));checked++;
  }
 }
}
const initial=I.bank('makossa',grid),source=initial.find(r=>r.family==='Bass Lady');W.BassPracticeCatalogue.remove('uploaded',source.sourceId);
for(const row of I.bank('makossa',grid)){const prior=initial.find(r=>r.id===row.id);if(prior)assert.equal(row.label,prior.label);}
console.log(JSON.stringify({passed:true,conciseUnambiguousLabels:checked,allPriorChoicesAndMusicPreserved:true,actualTeacherAndGenreMetadata:true,deletionsDoNotRenumber:true}));
