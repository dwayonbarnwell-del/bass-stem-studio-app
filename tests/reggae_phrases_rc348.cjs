const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const sourceFiles=['fills-rc264','practice-rc264b','catalogue-rc269','curated-rc289','groups-rc290','uploaded-data-rc267','lesson-data-rc272','african-data-rc274','recording-phrases','original-studies'];
const probe=process.argv.includes('--probe');
function load(saved=new Map()){
 const env={window:{},localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)}};vm.createContext(env);
 for(const name of sourceFiles)vm.runInContext(fs.readFileSync('ear-source/'+name+'.js','utf8'),env);
 if(probe){
  const rows=JSON.parse(fs.readFileSync('/tmp/rc348-probe.json')).rows;env.window.BassReggaeRecordings=rows;
  for(const row of rows)env.window.BassRecordedPhrases[row.id]=row.sections.map(s=>[0,s.duration,s.beats,0,1,1]);
 }else vm.runInContext(fs.readFileSync('ear-source/reggae-recordings-rc348.js','utf8'),env);
 for(const name of ['uploaded-core-rc267','accompaniment-rc293','catalogue-review-rc347'])vm.runInContext(fs.readFileSync('ear-source/'+name+'.js','utf8'),env);
 return env.window;
}
const saved=new Map(),w=load(saved),{BassPracticeCatalogue:D,BassCatalogueReview:R,BassPracticeCore:P,BassUploadedCore:U,BassAccompaniment:H}=w;
const songs=U.items.filter(row=>row.collection==='recorded-reggae');const report=probe?null:JSON.parse(fs.readFileSync('tests/reggae_phrases_rc348.json'));assert.equal(songs.length,probe?1:report.songs);
assert(!songs.some(row=>/Action feat/i.test(row.title)));
for(const path of JSON.parse(fs.readFileSync('tests/retired_assets_rc348.json'))){
 assert.equal(fs.statSync(path).size,0,'Retired content must remain empty: '+path);
}
if(!probe){
 assert.equal(songs.filter(row=>D.visible('uploaded',row.id)).length,report.activeSongs);
 for(const duplicate of report.duplicates){
  assert(!D.visible('uploaded',duplicate.id));
  const entry=R.removed().find(row=>row.kind==='uploaded'&&row.id===duplicate.id);assert(entry);
  D.remove('runs',P.runs[1].id);R.restore(entry);assert(D.visible('uploaded',duplicate.id));assert(!D.visible('runs',P.runs[1].id));
  D.remove('uploaded',duplicate.id);
 }
}
let sections=0,maxNotes=0;
for(const song of songs){
 assert.equal(song.sections.length,2);assert.equal(song.sections[0].label,'Verse');assert.equal(song.sections[1].label,'Chorus');
 for(const [i,section] of song.sections.entries()){
  const plan=U.practicePlan(song.id,'phrase-'+i);assert.equal(plan.audio,section.audio);assert(fs.existsSync(plan.audio));assert.equal(plan.beats,section.beats);assert.equal(plan.recording.originalMix,true);assert.equal(plan.bass.length,section.notes.length);assert.equal(plan.section,section.label);
  assert(section.duration>=6&&section.duration<=21);assert(section.boundaryScore>=.79);assert([8,16,32].includes(section.beats));assert(section.notes.length>=1);
  assert(plan.bass.every(n=>n.midi>=23&&n.midi<=59&&n.beat>=0&&n.length>0&&n.beat+n.length<=plan.beats+.002));
  assert.equal(plan.chords.length,0);assert.equal(plan.degrees.length,0);assert.equal(H.profile(plan).id,'reggae');assert.equal(plan.bpm,plan.originalBpm);
  sections++;maxNotes=Math.max(maxNotes,section.notes.length);
 }
 assert.notEqual(song.sections[0].audio,song.sections[1].audio);
}
const old=P.lines.filter(line=>line.removedFromPlatform);assert.equal(old.length,9);
for(const row of old){assert(D.permanentlyRemoved('basslines',row.id));assert(!D.visible('basslines',row.id));assert.throws(()=>D.restore('basslines',row.id));D.remove('basslines',row.id);}
for(const id of ['reggae-58297e32b171','clip-46','clip-57','clip-58','clip-59','clip-60','clip-61']){D.remove('uploaded',id);assert(!D.visible('uploaded',id));assert.throws(()=>D.restore('uploaded',id));}
assert(!R.removed().some(row=>row.kind==='uploaded'&&/reggae-58297e32b171|clip-5[789]|clip-6[01]/.test(row.id)));
assert(!R.removed().some(row=>row.kind==='basslines'&&old.some(line=>line.id===row.id)));
const reloaded=load(saved);for(const row of old)assert(!reloaded.BassPracticeCatalogue.visible('basslines',row.id));
// Restoring one section must not restore the other section or another deletion.
const song=songs[0];D.remove('uploaded',song.id+'/0');D.remove('uploaded',song.id+'/1');D.remove('runs',P.runs[0].id);
R.restore(R.removed().find(row=>row.kind==='uploaded'&&row.id===song.id+'/1'));
assert(!D.visible('uploaded',song.id+'/0'));assert(D.visible('uploaded',song.id+'/1'));assert(!D.visible('runs',P.runs[0].id));
assert(load(saved).BassPracticeCatalogue.visible('uploaded',song.id+'/1'));
console.log(JSON.stringify({passed:true,songs:songs.length,sections,maxNotes,oldPatternsPermanentlyRemoved:old.length,actionRemoved:true,individualRestore:true}));
