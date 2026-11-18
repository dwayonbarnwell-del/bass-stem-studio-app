const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
function load(grouped=true,saved=new Map()){const e={window:{},localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)}};vm.createContext(e);for(const f of ['fills-rc264.js','practice-rc264b.js','catalogue-rc269.js','curated-rc289.js',...(grouped?['groups-rc290.js']:[])])vm.runInContext(fs.readFileSync('ear-source/'+f,'utf8'),e);return e.window;}
const saved=new Map(),w=load(true,saved),old=load(false),{BassFillCore:F,BassPracticeCore:P,BassCuratedStudies:C,BassStudyGroups:G,BassPracticeCatalogue:D}=w;
const list=(w,k)=>k==='runs'?w.BassPracticeCore.runs:w.BassFillCore.styles,fp=notes=>notes.map(n=>n.midi-notes[0].midi).join(',');
assert.equal(G.groups.length,5);assert.equal(F.styles.length,100);assert.equal(P.runs.length,100);assert.equal(G.added.length,37);
assert.equal(G.added.filter(e=>e.kind==='runs').length,6);assert.equal(G.added.filter(e=>e.kind==='fills').length,31);
const fingerprints=new Set(),identities=new Set(),legacy=new Set();let cases=0,preserved=0;
for(const kind of ['runs','fills']){
 const counts=G.groups.map(([id])=>G.matching(kind,id).length);assert(counts.every(n=>n>0));assert.equal(counts.reduce((a,b)=>a+b),100);
 for(const [i,row] of list(w,kind).entries()){
  assert(!identities.has(kind+':'+row.id));identities.add(kind+':'+row.id);
  const plan=P.make(kind,{idea:i}),p=fp(plan.bass.slice(1,-1));assert(!fingerprints.has(p),'Duplicate pitch sequence: '+row[0]);fingerprints.add(p);assert(plan.bass.length>=5);
  if(row.curated){assert.equal(C.get(kind,i).id,row.id);assert.equal(row.curated.index,i);}
 }
 for(const [group] of G.groups){const indices=G.matching(kind,group);for(let i=1;i<indices.length;i++)assert(C.compare(kind,indices[i-1],indices[i])<=0);}
 for(const [oldIndex,row] of list(old,kind).entries()){
  const id=row.id||String(oldIndex),newIndex=list(w,kind).findIndex(r=>r.id===id||(r.aliasIds||[]).includes(id));assert(newIndex>=0,'Lost content '+row[0]);
  for(const mode of Object.keys(F.scales))for(let from=1;from<=7;from++)for(let to=1;to<=7;to++)if(from!==to){
   const opts={mode,from,to,key:0},a=old.BassPracticeCore.make(kind,{...opts,idea:oldIndex}),b=P.make(kind,{...opts,idea:newIndex});
   legacy.add(fp(a.bass.slice(1,-1)));assert.equal(JSON.stringify(a.bass),JSON.stringify(b.bass),'Changed notes '+row[0]);assert.equal(JSON.stringify(a.chords),JSON.stringify(b.chords),'Changed harmony '+row[0]);preserved++;
  }
 }
}
for(const e of G.added){const a=P.make(e.kind,{idea:e.index});assert(!legacy.has(fp(a.bass.slice(1,-1))),'Existing variation copied: '+e.title);assert(e.source.url.startsWith('https://'));}
for(const kind of ['fills','runs'])for(let idea=0;idea<100;idea++)for(let key=0;key<12;key++)for(let from=1;from<=7;from++)for(let to=1;to<=7;to++)if(from!==to){
 const p=P.make(kind,{idea,key,from,to}),pc=n=>(n%12+12)%12;
 assert.equal(p.beats,8);assert.equal(p.bass.at(-1).beat,4);assert.equal(pc(p.source),pc(key+F.scales[p.mode][from-1]));assert.equal(pc(p.target),pc(key+F.scales[p.mode][to-1]));
 for(const [i,n] of p.bass.entries()){assert(Number.isInteger(n.midi)&&n.midi>=23&&n.midi<=88);assert(Number.isFinite(n.beat)&&n.beat>=0&&n.length>0&&n.beat+n.length<=8);if(i)assert(p.bass[i-1].beat+p.bass[i-1].length<=n.beat+.00001);}
 cases++;
}
// Old deletion keys stay attached to the original pattern after index consolidation.
for(const [kind,id] of [['runs','23'],['runs','22'],['fills','0'],['runs',C.entries.find(e=>e.kind==='runs').id]])D.remove(kind,id);
const reloaded=load(true,saved),R=reloaded.BassStudyGroups;
assert(!R.visible('runs',reloaded.BassPracticeCore.runs.findIndex(r=>r.id==='23')));assert(!R.visible('runs',10),'Deleted alias reappeared');assert(!R.visible('fills',0));
D.restore();assert.equal(G.matching('runs','african').length,6);
assert.equal(G.migrate('pentatonic'),'blues');assert.equal(G.migrate('fusion'),'funk');assert.equal(G.migrate('bad'),'gospel');
const ui=fs.readFileSync('ear-source/study-ui-rc267.js','utf8');for(const id of ['fillQuality','fillStyle','fillPack','fillFilterPanel'])assert(!ui.includes('id="'+id+'"'));
for(const file of ['groups-rc290.js?v=rc290','curated-rc289.js?v=rc290','study-ui-rc267.js?v=rc290','trainer-rc267.css?v=rc290'])for(const p of ['index.html','sw.js'])assert(fs.readFileSync(p,'utf8').includes(file));
console.log(`PASS: 100 runs + 100 fills, five groups each, 200 distinct pitch sequences, ${preserved} preserved arrangements, ${cases} playable arrangements, stable IDs and saved deletions.`);
