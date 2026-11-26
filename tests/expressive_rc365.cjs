const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const files=['cultural-recordings-rc352','drum-loops-data-rc294','groove-library','fl-drums-rc349','supplied-drums-rc294','fills-rc264','practice-rc264b','catalogue-rc269','curated-rc289','groups-rc290','uploaded-data-rc267','lesson-data-rc272','african-data-rc274','recording-phrases','original-studies','world-methods-rc350','reggae-recordings-rc348','uploaded-core-rc267','accompaniment-rc293','catalogue-review-rc347','cultural-studies-rc351','bass-register-rc292','study-display-rc294','rehearsal-core','expressive-studies-rc365','rehearsal-harmony-rc354','rehearsal-ideas-rc352'];
function load(saved=new Map(),expressive=true){const c={window:{},localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)}};vm.createContext(c);for(const file of files){if(!expressive&&file==='expressive-studies-rc365')continue;vm.runInContext(fs.readFileSync('ear-source/'+file+'.js','utf8'),c,{filename:file});if(file==='rehearsal-core')c.window.BassRehearsalCore=c.BassRehearsalCore;}return c.window;}
const saved=new Map(),W=load(saved),old=load(new Map(),false),{BassPracticeCore:P,BassFillCore:F,BassExpressiveStudies:E,BassCuratedStudies:Q,BassRehearsalHarmony:H,BassRehearsalIdeas:I}=W,pc=n=>(n%12+12)%12,plain=v=>JSON.parse(JSON.stringify(v));
assert.equal(E.entries.length,40);assert.equal(new Set(E.entries.map(e=>e.id)).size,40);assert.equal(P.lines.filter(line=>line.id.startsWith("expressive365-basslines-")).length,10);
assert.equal(JSON.stringify(W.BassUploadedCore.items),JSON.stringify(old.BassUploadedCore.items),'recordings changed');
for(const entry of old.BassCulturalStudies.entries){const e=W.BassCulturalStudies.entries.find(e=>e.id===entry.id);assert(e);assert.equal(JSON.stringify(e.recordedStudy),JSON.stringify(entry.recordedStudy));assert.equal(JSON.stringify(P.make(e.kind,{idea:e.index,from:2,to:6,key:3})),JSON.stringify(old.BassPracticeCore.make(entry.kind,{idea:entry.index,from:2,to:6,key:3})),'recorded interpretation changed');}
let studies=0,phrases=0,legacyPlans=0;
function validate(plan){const ns=plan.bass;for(let i=0;i<ns.length;i++){const n=ns[i];assert(Number.isFinite(n.beat+n.length+n.midi));assert(n.midi>=23&&n.midi<=59);assert(n.length>0&&n.beat>=0&&n.beat+n.length<=plan.beats+.001);assert(n.velocity>=1&&n.velocity<=127);if(i)assert(ns[i-1].beat+ns[i-1].length<=n.beat+.00001,'overlap '+plan.title);}assert(new Set(ns.map(n=>n.velocity)).size>=4);}
for(const entry of E.entries){
 assert(entry.title.length<=12);assert(W.BassStudyGroups.matching(entry.kind,entry.practiceStyle==='gospel'?'gospel':entry.practiceStyle).includes(entry.index));
 const observed=new Set();
 for(let key=0;key<12;key++)for(let from=1;from<=7;from++)for(let to=1;to<=7;to++)if(from!==to){const plan=P.make(entry.kind,{idea:entry.index,key,from,to,bpm:83});validate(plan);assert.equal(pc(plan.bass[0].midi),pc(key+F.scales.major[from-1]));assert.equal(pc(plan.bass.find(n=>n.role==='landing').midi),pc(key+F.scales.major[to-1]));assert.equal(plan.bass.find(n=>n.role==='landing').beat,4);assert(plan.bass[0].length<Q.rhythms[entry.rhythm][0]);observed.add(plan.bass.map(n=>n.midi-plan.source).join(','));studies++;}
 assert(observed.size>=10,'changes use interchangeable pitches '+entry.title);
}
for(const line of P.lines.filter(r=>r.expressive)){const idea=P.lines.indexOf(line);for(let key=0;key<12;key++){const plan=P.make('basslines',{idea,key,bpm:92});validate(plan);assert.equal(W.BassAccompaniment.category(line),line.practiceStyle);assert(W.BassAccompaniment.availableGroups().some(([id])=>id===line.practiceStyle));assert.equal(W.BassAccompaniment.profile(plan).id,line.practiceStyle);assert(plan.bass.some(n=>n.beat%4>=3.5));}}
for(const kind of ['runs','fills'])for(let idea=0;idea<(kind==='runs'?P.runs:F.styles).length;idea++)if(E.styleOf(kind,idea)&&!Q.get(kind,idea)?.expressive)for(const [from,to]of [[1,4],[1,5],[2,6],[7,3],[4,7]])for(const key of [0,6,11]){
 const plan=P.make(kind,{idea,key,from,to,bpm:82});validate(plan);const e=Q.get(kind,idea);if(e)plan.bass.slice(1,-1).forEach((n,i)=>assert(Math.abs(n.beat-Q.rhythms[e.rhythm][i])*60/82<=.01201,'authored rhythm replaced '+e.title));legacyPlans++;
}
function fixture(from,to,key,mode,quality){const scale=F.scales[mode],a=E.make;const degree=d=>{const rootPc=pc(key+scale[d-1]),third=(scale[(d+1)%7]+12*Math.floor((d+1)/7))-scale[d-1],fifth=(scale[(d+3)%7]+12*Math.floor((d+3)/7))-scale[d-1];return {rootPc,quality:fifth===6?'dim':third===3?'min':'maj',manual:true};};return {keyRoot:key,keyMode:mode,start:0,end:8,grid:{bpm:80,meter:4,points:Array.from({length:12},(_,i)=>i*.75).filter(t=>t<=8).concat([8])},quiet:[],chords:[{...degree(from),...quality,start:0,end:4},{...degree(to),start:4,end:8}]};}
for(const mode of ['major','minor'])for(let key=0;key<12;key++)for(let from=1;from<=7;from++)for(let to=1;to<=7;to++)if(from!==to){
 const clip=fixture(from,to,key,mode),copy=JSON.stringify(clip);
 for(const entry of E.entries){
  const {kind,practiceStyle:style}=entry,choice={entry,kind,style},notes=I.fit(clip,choice,'ends');assert(notes.some(n=>n.role===(kind==='runs'?'run':'fill')),'missing '+style+' '+from+'>'+to);
  for(const chord of H.prepare(clip).segments){const landing=notes.find(n=>n.time===chord.start);assert(landing);assert.equal(pc(landing.midi),pc(chord.bassPc??chord.rootPc));}
  for(const n of notes){assert(n.stop>n.time&&n.midi>=23&&n.midi<=59);if(Math.abs(H.beat(clip,n.time)-Math.round(H.beat(clip,n.time)))<.075)assert(H.chordTones(H.at(clip,n.time)).has(pc(n.midi)),'strong dissonance');}
  phrases++;
 }
 assert.equal(JSON.stringify(clip),copy,'original harmony mutated');
}
const altered=fixture(2,6,0,'major',{rootPc:2,quality:'min7',bassPc:5}),change=H.changes(altered)[0],entry=E.entries.find(e=>e.practiceStyle==='rnb'&&e.kind==='runs');const built=E.rehearsalStudy(entry,change,altered);assert.equal(pc(built.events[0].midi),5);assert(built.events.filter(n=>n.beat%1===0&&n.beat<4).every(n=>H.chordTones(change.from).has(pc(n.midi))));
const quiet=fixture(1,4,0,'major');quiet.quiet=[{start:2,end:4}];assert(!I.fit(quiet,{entry},'ends').some(n=>n.time>=2&&n.time<4));
const fifth=E.entries.find(e=>e.technique==='fifth'&&e.practiceStyle==='worship'),fifthClip=fixture(1,4,0,'major'),fifthNotes=I.fit(fifthClip,{entry:fifth,kind:'fills',style:'worship'},'ends');assert.equal(pc(fifthNotes.filter(n=>n.time<4&&n.role==='fill').at(-1).midi),0,'fifth of F must be C, not an arbitrary semitone');
const jazz=E.entries.find(e=>e.practiceStyle==='jazz'&&e.kind==='fills'&&e.technique==='guide'),dominant=P.make('fills',{idea:jazz.index,from:5,to:1,key:0});assert(dominant.bass.some(n=>n.beat===2&&pc(n.midi)===5),'G7 seventh must be F, not F#');
const upper=E.entries.find(e=>e.title==='Upper reply'),aeolian=P.make('runs',{idea:upper.index,from:6,to:4,key:0});assert.equal(pc(aeolian.bass.find(n=>n.beat===3.25).midi),5,'A minor in C must retain F natural in the diatonic answer');
const fullSong=fixture(1,4,0,'major'),original=JSON.stringify(fullSong),fingerprints=new Set();
for(const line of P.lines.filter(r=>r.expressive)){
 const bank=I.bank(line.practiceStyle,fullSong.grid,null,false,fullSong),row=bank.find(r=>r.sourceId===line.id&&r.kind==='basslines');assert(row,'new loop hidden '+line.id);const notes=I.fit(fullSong,row,'off', 'all',[]);assert(notes.length);assert(notes.every(n=>n.velocity>=1));assert.equal(pc(notes[0].midi),0);assert.equal(pc(notes.find(n=>n.time===4).midi),5);fingerprints.add(notes.map(n=>[n.time.toFixed(3),n.midi,n.velocity].join(':')).join('|'));
}assert.equal(fingerprints.size,10,'new accompaniment grooves collapse into the same first bar');assert.equal(JSON.stringify(fullSong),original);
const short=fixture(1,4,0,'major');short.chords[0].end=.15;short.chords[1].start=.15;const fast=I.fit(short,{entry:fifth,kind:'fills'},'ends');assert(!fast.some(n=>n.time<.15&&n.role==='fill'),'skip a change that cannot fit a playable phrase');
const slidePlan={bass:[{midi:48,slideFrom:46},{midi:43}],chords:[]},shifted=W.BassRegister.plan(slidePlan);assert.equal(shifted.bass[0].midi-shifted.bass[0].slideFrom,2,'register fitting must transpose slide origin too');
for(const quality of ['maj7','min7','dom7','min7b5','dim7','sus4','7b9'])for(const e of E.entries){const clip=fixture(2,6,0,'major',{rootPc:2,quality,bassPc:5}),notes=I.fit(clip,{entry:e,kind:e.kind,style:e.practiceStyle},'ends');for(const n of notes.filter(n=>n.time<4&&Math.abs(H.beat(clip,n.time)-Math.round(H.beat(clip,n.time)))<.075))assert(H.chordTones(H.at(clip,n.time)).has(pc(n.midi)),quality+' strong beat '+e.title);}
const worship=I.bank('worship',fullSong.grid,null,false,fullSong);for(const kind of ['basslines','runs','fills']){const rows=worship.filter(r=>r.kind===kind);assert.equal(new Set(rows.map(r=>r.label)).size,rows.length,'duplicate rehearsal labels within '+kind);if(kind!=='basslines')assert.equal(rows.filter(r=>r.entry?.expressive).length,4,'new authored studies buried by synthetic derivatives');}
for(const e of E.entries){const clip={start:62,end:69,keyRoot:0,keyMode:'major',grid:{bpm:120,meter:4,points:Array.from({length:139},(_,i)=>i*.5)},chords:[{start:62,end:65,rootPc:7,quality:'dom7',manual:true},{start:65,end:69,rootPc:9,quality:'min7',manual:true}],quiet:[]},change=H.changes(clip).find(c=>c.at===65),notes=I.fit(clip,{entry:e,kind:e.kind},'ends',change.phraseId);assert.equal(notes.find(n=>n.time===62).midi%12,7);assert.equal(notes.find(n=>n.time===65).midi%12,9);assert(notes.filter(n=>n.role==='run'||n.role==='fill').every(n=>n.time>=62&&n.stop<=65));}
for(const meter of [3,6]){const clip=fixture(1,4,0,'major');clip.grid.meter=meter;clip.grid.points=Array.from({length:17},(_,i)=>i*.5+(i%2)*.018);for(const e of E.entries){const notes=I.fit(clip,{entry:e,kind:e.kind},'ends');assert.equal(notes.find(n=>n.time===4).midi%12,5);assert(notes.every(n=>n.stop>n.time&&n.stop<=clip.end));}}
// Declared authored triplets survive; the old shared timing cells do not overwrite them.
const trip=E.entries.find(e=>e.technique==='triplet'),plan=P.make(trip.kind,{idea:trip.index});assert(plan.bass.some(n=>Math.abs(n.beat*3-Math.round(n.beat*3))<1e-6&&Math.abs(n.beat*4-Math.round(n.beat*4))>.1));
const deleted=E.entries[0];W.BassPracticeCatalogue.remove(deleted.kind,deleted.id);assert(!W.BassStudyGroups.visible(deleted.kind,deleted.index));const reload=load(saved);assert(!reload.BassStudyGroups.visible(deleted.kind,reload.BassExpressiveStudies.entries.find(e=>e.id===deleted.id).index));
console.log(JSON.stringify({passed:true,newOriginalStudies:40,newBasslineLoops:10,studyChangesAcrossKeys:studies,majorMinorRehearsalFits:phrases,legacyPlans,distinctRehearsalGrooves:fingerprints.size,recordingsPreserved:true,authoredRhythms:true,sourceQualityAndSlashBass:true,deletionsPersist:true}));

// Golden performances from RC365, identified by the labels in the owner's recording.
const approvedWorship = [
 [
  "line-0",
  0,
  "Practice 01",
  "8c7b31246afdf6f0aaa7906a1d49b556c8c5baa3d266566bf4ca9fa5252e8586"
 ],
 [
  "line-1",
  0,
  "Practice 02",
  "ba0d77d9e96311c6fc78189694c1a4f32d8119849d78def6ec92c38fdae96437"
 ],
 [
  "line-8",
  0,
  "Practice 09",
  "88f2065f7bc08eceeccf475633d0865615f0798c30de828206fde514f36d7fdb"
 ],
 [
  "line-14",
  0,
  "Practice 15",
  "c928f8aa02455cd4e328225cff5385ca64ba06be7a6071671a97cbef8a5b78b6"
 ],
 [
  "progression-6-5-4-5-3",
  0,
  "lift.1",
  "9443d3f6af444f4bcc6e869f4a6cb387e1f010b7abf848ae5c7cfc113a787c1a"
 ],
 [
  "progression-6-5-4-5-3",
  1,
  "lift.2",
  "f62e7e1a97bdbbfdf6c2ad88edb75bc29772b7b39c255333c0fe8683f388cc1c"
 ],
 [
  "progression-6-4-1-3",
  0,
  "lift 25",
  "a87537c873411f245b10db8fdc5113da662d3ac6bc7b880a53f1e9ff02f84094"
 ],
 [
  "progression-2-3-6-5",
  0,
  "lift 31",
  "4ae9316476d344f7f21e9954c3e1b7e11b0e6d64ecaaf6361b1bc04370881d42"
 ],
 [
  "progression-2-6-3-6",
  0,
  "lift 37",
  "27d0ad483109575666d11bc3898f5cf270e82c66815470d1b14709fa31433eca"
 ]
];
for(const [id,part,name,signature] of approvedWorship){
 const idea=P.lines.findIndex(row=>row.id===id);
 const plan=P.make('basslines',{idea,part,key:0,bpm:90});
 const band=W.BassAccompaniment.resolve(plan);
 const parts=P.phrases(P.lines[idea].degrees),display=W.BassStudyDisplay;
 const label=display.label('basslines',P.lines[idea]);
 assert.equal(parts.length>1?display.suffix(label,'.'+(part+1)):label,name);
 const values=[plan.bass,plan.chords,band.loop.id,band.loop.bpm,band.style,band.sound];
 assert.equal(require('node:crypto').createHash('sha256').update(JSON.stringify(values)).digest('hex'),signature,name);
}
function catalogueSignature(w){
 const hash=require('node:crypto').createHash('sha256');
 let count=0;
 for(const kind of ['basslines','fills','runs']){
  const rows=kind==='basslines'?w.BassPracticeCore.lines:kind==='fills'?w.BassFillCore.styles:w.BassPracticeCore.runs;
  for(const [idea,row] of rows.entries()){
   if(row.curated?.recordedStudy||/366-/.test(row.id))continue;
   const parts=kind==='basslines'?w.BassPracticeCore.phrases(row.degrees).map((_,i)=>i):[null];
   for(const part of parts){
    const plan=w.BassPracticeCore.make(kind,{idea,part,from:1,to:4,key:0});
    const band=w.BassAccompaniment.resolve(plan);
    hash.update(JSON.stringify([kind,row.id,part,plan.bass,plan.chords,band.loop.id,band.loop.bpm,band.style,band.sound,w.BassAccompaniment.arrange(plan,band.style)]));
    count++;
   }
  }
 }
 return [count,hash.digest('hex')];
}
assert.deepEqual(catalogueSignature(W),[355,'fdf5153f5f7abde2e058a9d4fea441f2cb946362f20f5af19547fa859b7ecddd']);

// The later studies have fixed beats that should survive menu reordering.
const laterBeats=new Map([
 ['afrobeat366-cross','correct-afrobeat-5f92f3a49d'],['praise366-rise','correct-praise-7f442f1ff9'],
 ['sungura366-step','supplied-soukous-15362bf2d2'],['funk366-pocket','correct-funk-2d1f3c8df3'],
 ['blues366-shuffle','gmd-blues-2'],['transition366-afrobeat-runs','supplied-afrobeat-ba183319b5'],
 ['transition366-african-praise-runs','correct-praise-7364b66ca7'],['transition366-reggae-runs','gmd-reggae-2'],
 ['transition366-reggae-fills','correct-reggae-67c8e09761'],['transition366-praise-fills','correct-praise-a62d2f9461'],
 ['transition366-praise-runs','correct-praise-5b0dbf04c3']
]);
for(const [kind,rows] of [['basslines',P.lines],['runs',P.runs],['fills',F.styles]]){
 for(const [idea,row] of rows.entries()){
  if(!laterBeats.has(row.id))continue;
  const plan=P.make(kind,{idea,key:0,from:1,to:4});
  assert.equal(W.BassAccompaniment.resolve(plan).loop.id,laterBeats.get(row.id));
  laterBeats.delete(row.id);
 }
}
assert.equal(laterBeats.size,0);

// Compare the numbered practice series with the approved catalogue above.
{
const W=load(),P=W.BassPracticeCore,F=W.BassFillCore;
const legacy=P.make;
const archived=new Map();
for(const [kind,rows] of [['basslines',P.lines],['runs',P.runs],['fills',F.styles]])for(const [idea,row] of rows.entries()){
 const parts=kind==='basslines'?P.phrases(row.degrees).length:1;
 for(let part=0;part<parts;part++){
 if(!/^(Practice|Prac)\s/.test(W.BassStudyDisplay.label(kind,row)))continue;
 archived.set([kind,idea,part].join('/'),JSON.stringify(legacy(kind,{idea,part,from:1,to:4,key:0})));
 }}
vm.runInNewContext(fs.readFileSync('ear-source/practice-series-rc373.js','utf8'),{window:W});
const S=W.BassPracticeSeries, stats={},labels=new Map();
for(const [kind,rows] of [['basslines',P.lines],['runs',P.runs],['fills',F.styles]])for(const [idea,row] of rows.entries()){
 const parts=kind==='basslines'?P.phrases(row.degrees).length:1;
 for(let part=0;part<parts;part++){
 const s=S.get(kind,idea,part);if(!s)continue;
 const k=kind+'/'+s.genre;const ns=labels.get(k)||new Set();labels.set(k,ns);assert(!ns.has(s.number));ns.add(s.number);
 const type=s.recorded?'source':s.keep?'kept':'new';stats[type]=(stats[type]||0)+1;
 for(const [key,from,to] of [[0,1,4],[5,1,5],[11,2,6]]){
 if(s.recorded&&!W.BassStudyGroups.supports(kind,idea,from,to))continue;
 const p=P.make(kind,{idea,part,key,from,to});
 if(s.keep&&key===0&&archived.has([kind,idea,part].join('/')))assert.equal(JSON.stringify(p),archived.get([kind,idea,part].join('/')));
 if(!s.recorded&&!s.keep){assert(p.bass.length>=5);for(const [i,n] of p.bass.entries())assert(Number.isFinite(n.midi+n.beat+n.velocity+n.length)&&n.midi>=23&&n.midi<=59&&n.length>0&&n.beat+n.length<=p.beats+.001&&(!i||p.bass[i-1].beat+p.bass[i-1].length<=n.beat+.001),row.id);}
 }}
}assert.equal(labels.size,63);assert(stats.new>350);
console.log(JSON.stringify({numberedPractice:stats,genreMenus:labels.size}));
}
