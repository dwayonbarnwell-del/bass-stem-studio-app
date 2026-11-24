const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const current=fs.existsSync('ear-source/reggae-recordings-rc348.js');
const files=['fills-rc264','practice-rc264b','catalogue-rc269','curated-rc289','groups-rc290','uploaded-data-rc267','lesson-data-rc272','african-data-rc274',...current?[]:['reggae-data-rc273'],'recording-phrases','original-studies',current?'reggae-recordings-rc348':'reggae-recordings-rc347','uploaded-core-rc267','accompaniment-rc293','catalogue-review-rc347'];
function load(saved=new Map(),fail=false){const e={window:{},localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>{if(fail)throw Error('Storage full');saved.set(k,v);}}};vm.createContext(e);for(const f of files)vm.runInContext(fs.readFileSync('ear-source/'+f+'.js','utf8'),e);return e.window;}
const saved=new Map(),w=load(saved),{BassPracticeCatalogue:D,BassCatalogueReview:R,BassAccompaniment:H,BassPracticeCore:P,BassUploadedCore:U}=w;
assert(H.groups.length<=10);
for(const name of ['Gospel','Soul','R&B','Jazz','Blues'])assert(H.groups.some(([,label])=>label===name));
for(const name of ['Afrobeat','Highlife','Makossa','Gospel & Soul'])assert(!H.availableGroups().some(([,label])=>label===name));
for(const row of P.lines){if(['reggae','afrobeat','highlife','makossa'].includes(H.identify(row)))assert(!D.visible('basslines',row.id));}
const expected=current?JSON.parse(fs.readFileSync('tests/reggae_phrases_rc348.json')).songs:53;
const reggae=U.items.filter(row=>H.category(row,true)==='reggae');assert.equal(reggae.length,expected);assert.equal(new Set(reggae.map(r=>r.displayName)).size,expected);
for(const clip of reggae){assert(clip.originalMix);assert(fs.existsSync(clip.audio));const p=U.practicePlan(clip.id,'phrase-0');assert.equal(p.bpm,p.originalBpm);assert([8,16,32].includes(p.beats));assert(p.bass.every(n=>n.midi>=23&&n.midi<=59));assert(p.recording.originalMix);assert.equal(H.profile(p).id,'reggae');}
// Restore exactly one of twenty deletions and preserve the rest after a reload.
const ids=P.runs.slice(0,20).map(r=>r.id);
for(const id of ids)D.remove('runs',id);D.restore('runs',ids[7]);
for(const [i,id] of ids.entries())assert.equal(D.visible('runs',id),i===7);
let reloaded=load(saved);for(const [i,id] of ids.entries())assert.equal(reloaded.BassPracticeCatalogue.visible('runs',id),i===7);
// Restoring a removed section's one item reveals only that item, persistently.
const highlife=P.lines.find(row=>H.identify(row)==='highlife');D.restore('basslines',highlife.id);assert(H.availableGroups().some(([id])=>id==='highlife'));
for(const row of P.lines.filter(row=>H.identify(row)==='highlife'))assert.equal(D.visible('basslines',row.id),row.id===highlife.id);
reloaded=load(saved);assert(reloaded.BassPracticeCatalogue.visible('basslines',highlife.id));
// One canonical item can carry an old alias deletion.
D.remove('runs','10');D.remove('runs','22');const alias=R.removed().find(r=>r.restoreItems.some(x=>x.kind==='runs'&&x.id==='22'));assert(alias);assert(alias.restoreItems.some(x=>x.id==='10'));D.restoreItems(alias.restoreItems);assert(D.visible('runs','10')&&D.visible('runs','22'));assert(!D.visible('runs',ids[0]));
const broken=load(saved,true);assert.throws(()=>broken.BassPracticeCatalogue.restore('runs',ids[0]));assert(!broken.BassPracticeCatalogue.visible('runs',ids[0]));
// Migrate older deletions without reviving any other item.
const oldSaved=new Map([['bass-practice-deleted-v1',JSON.stringify(ids.map(id=>'runs:'+id))]]),old=load(oldSaved);
old.BassPracticeCatalogue.restore('runs',ids[2]);const migrated=load(oldSaved);
for(const [i,id] of ids.entries())assert.equal(migrated.BassPracticeCatalogue.visible('runs',id),i===2);
// Restoring one phrase of a deleted parent keeps its siblings deleted.
const line=P.lines.find(row=>P.phrases(row.degrees).length>1);D.remove('basslines',line.id);D.remove('basslines',line.id+'/0');
R.restore(R.removed().find(row=>row.kind==='basslines'&&row.id===line.id+'/0'));
assert(D.visible('basslines',line.id)&&D.visible('basslines',line.id+'/0'));assert(!D.visible('basslines',line.id+'/1'));
// A recording deleted before the latest collection update can still be restored by itself.
D.remove('uploaded','clip-23');R.restore(R.removed().find(row=>row.kind==='uploaded'&&row.id==='clip-23'));
assert(U.items.some(row=>row.id==='clip-23'));assert(load(saved).BassUploadedCore.items.some(row=>row.id==='clip-23'));
// Built-in runs/fills stay musically distinct; section removals never change notes.
const seen=new Set();for(const kind of ['runs','fills']){const rows=kind==='runs'?P.runs:w.BassFillCore.styles;for(const [i,row] of rows.entries()){if(!D.visible(kind,row.id))continue;const key=R.signature(P.make(kind,{idea:i,from:1,to:4,bpm:100}));assert(!seen.has(key),row[0]);seen.add(key);}}
console.log(JSON.stringify({passed:true,reggae:reggae.length,sourceDuplicates:JSON.parse(fs.readFileSync('tests/reggae_import_rc347.json')).duplicates.length,patternsReviewed:P.lines.length+P.runs.length+w.BassFillCore.styles.length,retired:R.retired.length,exactPatternDuplicates:R.duplicates.length,individualRestore:true,persistent:true}));
