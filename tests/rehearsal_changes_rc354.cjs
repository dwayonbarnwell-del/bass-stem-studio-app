const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const files=['cultural-recordings-rc352','drum-loops-data-rc294','groove-library','fl-drums-rc349','supplied-drums-rc294','fills-rc264','practice-rc264b','catalogue-rc269','curated-rc289','groups-rc290','uploaded-data-rc267','lesson-data-rc272','african-data-rc274','recording-phrases','original-studies','world-methods-rc350','reggae-recordings-rc348','uploaded-core-rc267','accompaniment-rc293','catalogue-review-rc347','cultural-studies-rc351','bass-register-rc292','study-display-rc294','rehearsal-core','rehearsal-harmony-rc354','rehearsal-ideas-rc352'];
const env={window:{},localStorage:{getItem:()=>null,setItem:()=>{}}};vm.createContext(env);
for(const file of files){vm.runInContext(fs.readFileSync('ear-source/'+file+'.js','utf8'),env);if(file==='rehearsal-core')env.window.BassRehearsalCore=env.BassRehearsalCore;}
const W=env.window,H=W.BassRehearsalHarmony,I=W.BassRehearsalIdeas,F=W.BassFillCore,pc=n=>(n%12+12)%12;
const grid={points:Array.from({length:33},(_,i)=>i*.5),meter:4,bpm:120,snap:false};
function fixture(sequence=[1,4,5,4],key=0,mode='major'){
 const scale=F.scales[mode],chords=sequence.map((d,i)=>{
  const triad=[0,2,4].map(n=>scale[(d-1+n)%7]+12*Math.floor((d-1+n)/7)-scale[d-1]);
  return {start:i*4,end:(i+1)*4,rootPc:pc(key+scale[d-1]),quality:triad[2]===6?'dim':triad[1]===3?'min':'maj',manual:true};
 });
 return {keyRoot:key,keyMode:mode,start:0,end:sequence.length*4,grid:{...grid,points:Array.from({length:sequence.length*8+1},(_,i)=>i*.5)},chords,quiet:[]};
}
function validate(notes,clip){
 assert(notes.length);for(let i=0;i<notes.length;i++){
  const n=notes[i];assert(Number.isFinite(n.time+n.stop)&&n.stop>n.time&&n.time>=clip.start-.001&&n.stop<=clip.end+.001,'Invalid event');assert(n.midi===null||Number.isInteger(n.midi)&&n.midi>=23&&n.midi<=59,'Invalid bass pitch');
  if(i){assert(notes[i-1].stop<=n.time+.001,'Overlapping guide voices');if(n.midi!==null&&notes[i-1].midi!==null)assert(Math.abs(n.midi-notes[i-1].midi)<=12,'Unnecessary register jump');}
  const chord=H.at(clip,n.time);if(!chord||n.midi===null)continue;
  if(Math.abs(H.beat(clip,n.time)-Math.round(H.beat(clip,n.time)))<.075)assert(H.chordTones(chord).has(pc(n.midi)),'Strong-beat chord clash '+JSON.stringify({n,chord}));
 }
 for(const chord of H.prepare(clip).segments){
  const n=notes.find(n=>Math.abs(n.time-chord.start)<.025);assert(n,'Missing chord landing');assert.equal(pc(n.midi),pc(chord.bassPc??chord.rootPc),'Wrong destination');
 }
}
const common=['worship','gospel','rnb','soul','reggae','jazz','blues','fusion','praise','woro','highlife','ariaria','makossa','seben','soukous','zouk','afrobeat','mbalax','mbaqanga','sungura'];let fitted=0;
for(const style of common){
 const clip=fixture(),copy=JSON.stringify(clip),rows=I.bank(style,clip.grid,null,false,clip);
 for(const kind of ['basslines','runs','fills']){
  const row=rows.find(r=>r.kind===kind);assert(row,style+' '+kind);const notes=I.fit(clip,row,'ends','all',rows);validate(notes,clip);
  if(row.entry)assert(notes.some(n=>n.role===(kind==='runs'?'run':'fill')),style+' lacks a fitting '+kind);
  assert.equal(JSON.stringify(clip),copy,'Saved harmony was changed');fitted++;
 }
}
// Every directed degree change, every key, major and minor. Do not assume a
// major-key interval or substitute a source recording's chord progression.
const representatives=I.bank('makossa',fixture().grid).filter(r=>['basslines','runs','fills'].includes(r.kind));
const picks=['basslines','runs','fills'].map(kind=>representatives.find(r=>r.kind===kind));let changes=0;
for(const mode of ['major','minor'])for(let key=0;key<12;key++)for(let from=1;from<=7;from++)for(let to=1;to<=7;to++)if(from!==to){
 const clip=fixture([from,to],key,mode);assert.equal(H.options(clip)[0].label,from+'→'+to);
 for(const row of picks){validate(I.fit(clip,row,'ends','all',representatives),clip);changes++;}
}
// Native source intervals rank ahead of equally suitable adapted intervals.
const clip=fixture([1,6,4,5]),move=H.options(clip).find(t=>t.label==='1→6');assert(move);
for(const kind of ['runs','fills']){
 const choices=I.bank('makossa',clip.grid,null,false,clip,move.id).filter(r=>r.kind===kind);
 const matching=choices.filter(r=>pc(r.entry.recordedStudy?.interval??5)===9);assert(matching.length,'No native 1→6 source');assert.equal(pc(choices[0].entry.recordedStudy.interval),9,'Wrong movement ranked first');
 const focused=I.fit(clip,choices[0],'ends',move.id);assert(focused.filter(n=>n.role===kind.slice(0,-1)).every(n=>n.changeLabel==='1→6'),'Focused choice changed another transition');
}
// A major third from a source must become the minor or diminished third.
for(const quality of ['min','dim','min7b5','sus4','7','maj7']){
 const test={...fixture([1]),chords:[{start:0,end:4,rootPc:0,quality,manual:true}]};
 const notes=H.conform([{time:1,stop:1.35,midi:40,role:'third'},{time:2,stop:2.35,midi:43,role:'fifth'}],test);validate(notes,test);
}
const slash=fixture([1,5]);slash.chords[1].bassPc=11;validate(I.fit(slash,picks[0],'ends'),slash);
const unknown={...fixture([1,6]),keyRoot:null,key:'',keyMode:''};assert.equal(H.options(unknown)[0].label,'C→Am','Unknown keys must not invent degree numbers');
const minor=fixture([1,4,5],9,'minor');minor.numbering='relative-major';assert.equal(H.progression(minor),'6–2–3');
const quiet=fixture([1,6]);quiet.quiet=[{start:3,end:4}];assert(!I.fit(quiet,picks[2],'ends').some(n=>n.time>=3&&n.time<4));
const uncertain=fixture([1,6]);uncertain.chords[0].uncertain=true;uncertain.chords[0].manual=false;assert(!I.fit(uncertain,picks[2],'ends').some(n=>n.role==='fill'));
const partial={points:[0,.5,1,1.5,2,2.5],meter:4,bpm:120};assert.equal(W.BassRehearsalCore.barChords('C F',partial).at(-1).end,2.5);
const offbeat=fixture([1,6]);offbeat.chords[0].end=3.2;offbeat.chords[1].start=3.2;validate(I.fit(offbeat,picks[2],'ends'),offbeat);
const variable=fixture([1,6]);variable.grid={...variable.grid,points:Array.from({length:17},(_,i)=>i*.5+(i%2?.04:0))};validate(I.fit(variable,picks[1],'ends'),variable);
const chromatic=fixture([1]);const brief=H.conform([{time:1.75,stop:1.86,midi:42,role:'passing'},{time:2,stop:2.3,midi:43,role:'fifth'}],chromatic);assert(brief.some(n=>n.time===1.75&&n.midi%12===6),'Resolved brief chromatic approach was lost');
// A repeated movement must be selectable by occurrence. Only the 1:02–1:05
// phrase changes; another 5→6 at 0:10–0:13 and notes after 1:05 stay intact.
const timed={keyRoot:0,keyMode:'major',start:0,end:75,grid:{points:Array.from({length:151},(_,i)=>i*.5),meter:4,bpm:120},quiet:[],chords:[{start:0,end:10,rootPc:0,quality:'maj',manual:true},{start:10,end:13,rootPc:7,quality:'maj',manual:true},{start:13,end:30,rootPc:9,quality:'min',manual:true},{start:30,end:62,rootPc:5,quality:'maj',manual:true},{start:62,end:65,rootPc:7,quality:'maj',manual:true},{start:65,end:75,rootPc:9,quality:'min',manual:true}]};
timed.bassNotes=Array.from({length:150},(_,i)=>{const time=i*.5,chord=timed.chords.find(c=>c.start<=time&&c.end>time);return {time,stop:time+.32,midi:24+chord.rootPc,role:'transcribed',accent:.6};});
const occurrences=H.phraseOptions(timed).filter(t=>t.label==='5→6'),target=occurrences.find(t=>t.range==='1:02–1:05');assert.equal(occurrences.length,2);assert(target);assert.notEqual(target.phraseId,occurrences[0].phraseId);assert.equal(H.changes(timed,target.phraseId).length,1);
const projection=notes=>JSON.stringify(notes.map(n=>[n.time,n.stop,n.midi]));let exact=0;
for(const style of common){
 const rows=I.bank(style,timed.grid,null,false,timed,target.phraseId);
 for(const kind of ['basslines','runs','fills']){
  const choice=rows.find(r=>r.kind===kind);assert(choice,'No timed '+style+' '+kind);
  const notes=I.fit(timed,choice,'ends',target.phraseId,rows),first=notes.find(n=>n.time===62),last=notes.find(n=>n.time===65);
  assert(first&&last,'Phrase endpoints shifted');assert.equal(pc(first.midi),7);assert.equal(pc(last.midi),9);
  assert.equal(projection(notes.filter(n=>n.time<62||n.time>65)),projection(timed.bassNotes.filter(n=>n.time<62||n.time>65)),'Changed notes outside 1:02–1:05');
  if(choice.entry){const source=notes.filter(n=>n.sourceEntry===choice.entry.id);assert(source.length>=3);assert.equal(source[0].time,62);assert(source.every(n=>n.time>=62&&n.stop<65));}
  exact++;
 }
}
console.log(JSON.stringify({passed:true,populatedGenres:common.length,genreAlternativesFitted:fitted,majorAndMinorChangesAcrossAllKeys:changes,fullProgression1454:true,focused16:true,minorAndDiminishedQuality:true,slashBassLandings:true,savedHarmonyPreserved:true,exact6200To6500Alternatives:exact,otherOccurrenceAndSurroundingNotesUnchanged:true}));
