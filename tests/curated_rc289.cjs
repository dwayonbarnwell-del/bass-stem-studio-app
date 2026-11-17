const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
function load(saved=new Map(),curated=true){const env={window:{},localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)}};vm.createContext(env);for(const f of ['fills-rc264.js','practice-rc264b.js','catalogue-rc269.js',...(curated?['curated-rc289.js']:[])])vm.runInContext(fs.readFileSync('ear-source/'+f,'utf8'),env);return env.window;}
const saved=new Map(),w=load(saved),{BassCuratedStudies:C,BassFillCore:F,BassPracticeCore:P,BassPracticeCatalogue:D}=w,old=load(new Map(),false);
const fingerprint=notes=>notes.map(n=>n.midi-notes[0].midi).join(',');
const legacy=new Set();
for(const kind of ['fills','runs'])for(let idea=0;idea<(kind==='fills'?old.BassFillCore.styles:old.BassPracticeCore.runs).length;idea++)for(const mode of Object.keys(F.scales))for(let from=1;from<=7;from++)for(let to=1;to<=7;to++)if(from!==to)legacy.add(fingerprint(old.BassPracticeCore.make(kind,{idea,mode,from,to}).bass.slice(1,-1)));
assert.equal(C.entries.length,110);assert.equal(new Set(C.entries.map(e=>e.id)).size,110);assert.equal(new Set(C.entries.map(e=>e.title)).size,110);
for(const kind of ['fills','runs'])for(const [genre] of C.genres)assert.equal(C.entries.filter(e=>e.kind===kind&&e.genre===genre).length,11);
assert.equal(F.styles.length,old.BassFillCore.styles.length+55);assert.equal(P.runs.length,old.BassPracticeCore.runs.length+55);
// Old indices, deletions, plans and user-created progressions must survive the addition.
for(const kind of ['fills','runs'])for(let idea=0;idea<(kind==='fills'?old.BassFillCore.styles:old.BassPracticeCore.runs).length;idea++)assert.equal(JSON.stringify(P.make(kind,{idea})),JSON.stringify(old.BassPracticeCore.make(kind,{idea})));
const newPrints=new Map();let arrangements=0;
for(const e of C.entries){
 assert(e.notes.length>=3);assert.equal(e.notes.length,C.rhythms[e.rhythm].length);assert(e.source.url.startsWith('https://'));assert(e.tip.length>20);
 const canonical=P.make(e.kind,{idea:e.index,from:1,to:4,key:0}),fp=fingerprint(canonical.bass.slice(1,-1));
 assert(!legacy.has(fp),'Duplicate of existing library: '+e.title);assert(!newPrints.has(fp),'Duplicate new phrase: '+e.title+' / '+newPrints.get(fp));newPrints.set(fp,e.title);
 assert(new Set(canonical.bass.slice(1,-1).map(n=>n.midi)).size>=3,e.title);
 for(let key=0;key<12;key++)for(let from=1;from<=7;from++)for(let to=1;to<=7;to++)if(from!==to){
  const a=P.make(e.kind,{idea:e.index,key,from,to,bpm:120}),pc=n=>(n%12+12)%12;
  assert.equal(a.bass.length,e.notes.length+2);assert.equal(a.beats,8);assert.equal(a.bpm,120);
  assert.equal(pc(a.source),pc(key+F.scales[e.mode][from-1]));assert.equal(pc(a.target),pc(key+F.scales[e.mode][to-1]));assert.equal(a.bass.at(-1).beat,4);assert.equal(a.bass.at(-1).midi,a.target);
  for(const [i,n] of a.bass.entries()){assert(Number.isInteger(n.midi)&&n.midi>=23&&n.midi<=88,e.title);assert(Number.isFinite(n.beat)&&n.beat>=0&&n.length>0&&n.beat+n.length<=8);if(i)assert(a.bass[i-1].beat+a.bass[i-1].length<=n.beat+.00001,'Overlap: '+e.title);}
  for(const n of a.chords)assert(Number.isInteger(n.midi)&&n.midi>=23&&n.midi<=108&&n.length>0&&n.beat+n.length<=8);
  arrangements++;
 }
}
// Independent expected pitches, not inferred from the renderer.
const titled=title=>{const e=C.entries.find(e=>e.title===title);return P.make(e.kind,{idea:e.index,key:0,from:1,to:4});};
assert.equal(titled('Diminished doorway').bass.slice(3,7).map(n=>n.midi).join(','),'40,43,46,49');
assert.equal(titled('Three-note amber answer').bass.slice(1,-1).map(n=>n.midi).join(','),'45,38,43');
assert.equal(titled('Blue-note velvet curl').bass.slice(1,-1).map(n=>n.midi).join(','),'39,40,43,42,41,40');
assert.equal(titled('Minor eleven question').mode,'dorian');assert.equal(titled('Minor eleven question').fromChord,'Cm7');
for(const kind of ['fills','runs']){
 const list=kind==='fills'?F.styles:P.runs,indices=list.map((_,i)=>i).sort((a,b)=>C.compare(kind,a,b));assert.equal(C.metadata(kind,indices[0]).tier,0);
 for(let i=1;i<indices.length;i++)assert(C.metadata(kind,indices[i-1]).tier<=C.metadata(kind,indices[i]).tier);
 D.remove(kind,'0');D.remove(kind,C.entries.find(e=>e.kind===kind).id);
}
const reloaded=load(saved);for(const kind of ['fills','runs']){assert(!reloaded.BassPracticeCatalogue.visible(kind,'0'));assert(!reloaded.BassPracticeCatalogue.visible(kind,C.entries.find(e=>e.kind===kind).id));}
D.restore();assert.equal(D.deletedCount,0);
const html=fs.readFileSync('index.html','utf8'),sw=fs.readFileSync('sw.js','utf8');for(const file of ['curated-rc289.js?v=rc289','fills-rc264.js?v=rc289','practice-rc264b.js?v=rc289','study-ui-rc267.js?v=rc289']){assert(html.includes(file));assert(sw.includes(file));}
console.log(`PASS: 110 unique phrases, 55 runs / 55 fills, 22 per style, ${arrangements} playable arrangements, existing content unchanged, rankings and saved deletions.`);
