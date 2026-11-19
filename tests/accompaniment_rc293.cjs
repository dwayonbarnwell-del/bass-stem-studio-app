const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const saved=new Map(),e={window:{},localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)}};vm.createContext(e);
for(const file of ['fills-rc264','practice-rc264b','catalogue-rc269','curated-rc289','groups-rc290','uploaded-data-rc267','lesson-data-rc272','reggae-data-rc273','african-data-rc274','uploaded-core-rc267','practice-drums-rc292','accompaniment-rc293'])vm.runInContext(fs.readFileSync('ear-source/'+file+'.js','utf8'),e);
const {BassAccompaniment:H,BassPracticeDrums:B,BassPracticeCore:P,BassFillCore:F,BassUploadedCore:U,BassPracticeCatalogue:D}=e.window;
assert.equal(H.groups.length,10);const coverage={};for(const [id]of H.groups)coverage[id]=0;
const originalIds=P.lines.map(x=>x.id),recordedIds=U.items.map(x=>x.id);
for(const row of P.lines){assert(H.groups.some(([id])=>id===H.category(row)));coverage[H.category(row)]++;}
for(const row of U.items){assert(H.groups.some(([id])=>id===H.category(row,true)));coverage[H.category(row,true)]++;}
assert.equal(new Set([...originalIds,...recordedIds]).size,originalIds.length+recordedIds.length);
assert.equal(P.runs.length,100);assert.equal(F.styles.length,100);
assert.equal(H.identify({name:'Praise · Makossa motion'}),'makossa');assert.equal(H.identify({name:'Highlife praise'}),'highlife');assert.equal(H.category({collection:'recorded-review',title:'Unconfirmed'},true),'personal');
const custom=D.addProgression('6 2 3 6',P.lines.find(x=>x.feel==='makossa'));
assert.equal(H.category(P.lines[custom]),'personal');assert.equal(H.identify(P.lines[custom]),'makossa');D.remove('basslines',P.lines[custom].id);assert(!D.visible('basslines',P.lines[custom].id));D.restore();assert(D.visible('basslines',P.lines[custom].id));
let checked=0;const chosen=new Set();
for(const kind of ['fills','runs','basslines'])for(let idea=0;idea<(kind==='basslines'?P.lines.length:100);idea++)for(let key=0;key<12;key++){
 const p=P.make(kind,{idea,key,from:6,to:4}),before=JSON.stringify(p),a=H.resolve(p);chosen.add(a.id);assert(B.kits.some(x=>x[0]===a.kit));assert(B.grooves.some(x=>x[0]===a.groove));const notes=H.arrange(p,a.style);assert(notes.length);
 for(const n of notes){assert(n.midi>=48&&n.midi<=79);assert(n.beat>=0&&n.beat<p.beats);const chordBeat=Math.max(...p.chords.filter(x=>x.beat<=n.beat).map(x=>x.beat));const next=Math.min(...p.chords.filter(x=>x.beat>chordBeat).map(x=>x.beat),p.beats);assert(n.length>0&&n.beat+n.length<=next+1e-8);assert(p.chords.some(x=>x.beat===chordBeat&&(x.midi-n.midi)%12===0),'Preserve chord pitch classes');}
 assert.equal(JSON.stringify(p),before,'Bass and original harmony are unchanged');
 const override=H.resolve(p,{kit:'jazz',groove:'reggae',style:'worship',sound:'piano'});assert.equal(override.kit,'jazz');assert.equal(override.groove,'reggae');assert.equal(override.style,'worship');assert.equal(override.sound,'piano');checked++;
}
const ds=new Set(),ks=new Set(),p=P.make('basslines',{idea:0});
for(const [id,profile]of Object.entries(H.profiles)){
 const drums=B.events(8,profile.groove);assert(drums.length);assert(drums.every(n=>n.beat>=0&&n.beat<8&&n.velocity>0&&n.velocity<=100));ds.add(JSON.stringify(drums.map(n=>[n.beat,n.hit])));
 ks.add(JSON.stringify(H.arrange(p,id).map(n=>[n.beat,n.length,n.midi])));
}
assert.equal(ds.size,Object.keys(H.profiles).length,'Each genre has a distinct drum rhythm');assert.equal(ks.size,Object.keys(H.profiles).length,'Each genre has a distinct keyboard rhythm');
assert(B.events(4,'reggae').filter(n=>n.hit==='kick').every(n=>n.beat===2));assert(B.events(4,'swing').some(n=>Math.abs(n.beat-5/3)<1e-9));
const shell=fs.readFileSync('sw.js','utf8'),index=fs.readFileSync('index.html','utf8');for(const asset of ['practice-keys-rc293.js','accompaniment-rc293.js']){assert(shell.includes(asset));assert(index.includes(asset));}
console.log(JSON.stringify({pass:true,arrangements:checked,groups:10,patterns:originalIds.length,recordings:recordedIds.length,drumRhythms:ds.size,keyboardRhythms:ks.size,autoStylesUsed:[...chosen],allContentRetained:true}));
