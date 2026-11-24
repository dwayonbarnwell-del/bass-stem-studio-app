const fs=require('fs'),assert=require('node:assert/strict');
global.window=global;global.localStorage={getItem:()=>null,setItem:()=>{}};
for(const name of ['fills-rc264','practice-rc264b','catalogue-rc269','curated-rc289','groups-rc290','uploaded-data-rc267','lesson-data-rc272','african-data-rc274','recording-phrases','original-studies','reggae-recordings-rc348','uploaded-core-rc267','accompaniment-rc293','catalogue-review-rc347','drum-loops-data-rc294','groove-library','fl-drums-rc349','supplied-drums-rc294'])require('../ear-source/'+name+'.js');
const before=JSON.parse(fs.readFileSync('tests/drum_reuse_baseline_rc349.json'));
const report=JSON.parse(fs.readFileSync('audio/drums-rc349/manifest.json'));
assert.equal(report.replacements,184);assert.equal(BassFlDrums.loops.length,184);
assert.equal(new Set(BassFlDrums.loops.map(x=>x.id)).size,184);
assert.equal(new Set(report.changes.map(x=>JSON.stringify(x.signature))).size,184);
const usage=new Map(),newUsage=new Map();let changed=0;
for(const row of before.uses){
 const [kind,idea,part]=row.key.split('/');
 const plan=BassPracticeCore.make(kind,{idea:Number(idea),part:Number(part),from:1,to:4});
 const choice=BassAccompaniment.resolve(plan),replacement=BassFlDrums.assignments[row.key];
 assert.equal(choice.sound,'piano');
 if(replacement){
  assert.equal(choice.loop.id,replacement[0]);assert.equal(choice.assignedPhase,0);
  assert.equal(choice.loop.tempoSource,'MIDI');assert.equal(choice.loop.bpm,report.loops.find(x=>x.id===choice.loop.id).bpm);
  newUsage.set(choice.loop.id,(newUsage.get(choice.loop.id)||0)+1);changed++;
 }else assert.equal(choice.loop.id,row.loop,'Unrelated rhythm changed: '+row.key);
 const source=choice.loop.base||choice.loop.id;usage.set(source,(usage.get(source)||0)+1);
 const manual=BassAccompaniment.resolve(plan,{groove:'gs-reggae-deep-drop'});
 assert.equal(manual.loop.id,'gs-reggae-deep-drop');
}
assert.equal(changed,184);assert([...newUsage.values()].every(count=>count===1));
assert.equal(usage.size,report.afterDistinctSources);
assert.equal([...usage.values()].reduce((total,count)=>total+Math.max(0,count-1),0),report.remainingSharedAssignments);
for(const loop of BassFlDrums.loops){assert(fs.statSync(loop.url).size>1000);assert(fs.statSync(loop.sourceMidi).size>50);assert.equal(loop.frames,loop.beats*Math.round(32000*60/loop.bpm));}
for(const song of BassUploadedCore.items.filter(x=>x.collection==='recorded-reggae')){
 const plan=BassUploadedCore.practicePlan(song.id,'phrase-0');assert(plan.recording.originalMix);assert(!BassFlDrums.assignments[song.id+'/0']);
}
console.log(JSON.stringify({passed:true,originalStudies:before.uses.length,replaced:changed,distinctNewBeats:newUsage.size,distinctSourcesAfter:usage.size,remainingRepeatAssignments:report.remainingSharedAssignments,manualOverrides:true,originalReggaePreserved:true}));
