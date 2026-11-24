const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const env={window:{},localStorage:{getItem(){return null},setItem(){}}};vm.createContext(env);
for(const file of ['drum-loops-data-rc294','fl-drums-rc349','supplied-drums-rc294','fills-rc264','practice-rc264b','catalogue-rc269','curated-rc289','groups-rc290','uploaded-data-rc267','lesson-data-rc272','african-data-rc274','recording-phrases','original-studies','reggae-recordings-rc348','world-methods-rc350','uploaded-core-rc267','accompaniment-rc293','catalogue-review-rc347'])vm.runInContext(fs.readFileSync('ear-source/'+file+'.js','utf8'),env);
const W=env.window,rows=W.BassWorldMethods,mixes=W.BassWorldMethodMixes,review=JSON.parse(fs.readFileSync('ear-assets/world-methods-rc350/review.json'));
assert(rows.length>0);assert.equal(rows.length,review.loops);assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);
assert.equal(review.sources,11);assert(review.proposals>rows.length);assert(!JSON.stringify(review).includes('/workspace/'));
const signatures=new Set();
for(const row of rows){
 assert(/^method-[a-f0-9]{16}$/.test(row.id));assert(row.title.length<=12);assert(row.originalMix&&row.automaticNotes);
 assert(row.duration>=5&&row.duration<=21);assert(row.notes.length>=5);assert(row.difference&&!/Different notes/.test(row.difference));
 assert(fs.statSync(row.audio).size>1000);const asset=mixes[row.audio];assert(asset&&asset.channels===6&&asset.estimated);assert(fs.statSync(asset.url).size>1000);
 const phrase=W.BassRecordedPhrases[row.id][0];assert([8,16,32].includes(phrase[2]));assert(Math.abs(phrase[1]-row.duration)<.0001);
 for(const note of row.notes){assert(note.midi>=23&&note.midi<=59);assert(note.start>=0&&note.end>note.start&&note.end<=row.duration+.0001);assert(Number.isFinite(note.confidence));}
 const signature=JSON.stringify(row.notes.map(n=>[n.midi,n.start,n.end]));assert(!signatures.has(signature),'Repeated captured phrase');signatures.add(signature);
 const plan=W.BassUploadedCore.practicePlan(row.id,'phrase-0');assert(plan.recording.originalMix);assert.equal(plan.chords.length,0);assert.equal(plan.degrees.length,0);assert(plan.keyUncertain);
 assert(Math.abs(plan.bpm-row.originalBpm)<.0001);assert.equal(plan.practiceStyle,row.practiceStyle);
 const audit=review.checks.find(r=>r.finalId===row.id);assert(audit);assert(audit.cut.closure>=.85||audit.cut.cadence);assert(audit.cut.cv<=.075);
}
assert(W.BassAccompaniment.availableGroups().some(([id])=>id==='world-method'));
console.log(JSON.stringify({passed:true,loops:rows.length,lessonsWithLoops:new Set(rows.map(r=>r.sourceFilename)).size,duplicatesOmitted:review.duplicatesOmitted,completeReturningPhrases:true,automaticNotesLabelled:true,noInventedChords:true,stableSourceIds:true}));
