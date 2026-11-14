const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const env={window:{}};vm.createContext(env);
for(const file of ['fills-rc264.js','practice-rc264.js'])vm.runInContext(fs.readFileSync('ear-source/'+file,'utf8'),env);
const {BassFillCore:F,BassPracticeCore:P,BassTransitionCore:T}=env.window,pc=n=>(n%12+12)%12;
assert.equal(Object.keys(P.modes).length,7);assert.deepEqual(Array.from(F.scales.phrygian),[0,1,3,5,7,8,10]);assert.deepEqual(Array.from(F.scales.locrian),[0,1,3,5,6,8,10]);
let cases=0;
for(const mode of Object.keys(P.modes))for(let key=0;key<12;key++)for(const kind of ['fills','runs','basslines']){
 const count=kind==='fills'?F.styles.length:kind==='runs'?P.runs.length:P.lines.length;
 for(let idea=0;idea<count;idea++)for(const [from,to] of kind==='basslines'?[[1,4]]:Array.from({length:7},(_,i)=>Array.from({length:7},(_,j)=>[i+1,j+1])).flat().filter(([a,b])=>a!==b)){
  const plan=P.make(kind,{mode,key,from,to,idea,bpm:70});
  assert(plan.bass.length&&plan.beats>0);assert(plan.chords.length);
  for(const [i,n] of plan.bass.entries()){
   assert(Number.isInteger(n.midi)&&n.midi>=23&&n.midi<=84,JSON.stringify({kind,mode,key,from,to,idea,n}));
   assert(n.beat>=0&&n.length>0&&n.beat+n.length<=plan.beats+.001);
   if(i<plan.bass.length-1)assert(n.beat+n.length<=plan.bass[i+1].beat+.0001,'monophonic bass');
  }
  if(kind!=='basslines'){
   assert.equal(pc(plan.bass[0].midi),pc(key+F.scales[mode][from-1]));assert.equal(pc(plan.bass.at(-1).midi),pc(key+F.scales[mode][to-1]));assert.equal(plan.bass.at(-1).beat,4);
   for(const [degree,beat] of [[from,0],[to,4]])assert.deepEqual(Array.from(plan.chords.filter(n=>n.beat===beat),n=>pc(n.midi)).sort((a,b)=>a-b),[0,2,4].map(i=>pc(key+F.scales[mode][(degree-1+i)%7])).sort((a,b)=>a-b));
  }else{assert.equal(plan.beats,16);assert.equal(plan.chords.length,12);}
  cases++;
 }
}
const project={projectName:'Test worship',source:{duration:12},settings:{sections:{Chorus:{start:0,end:12}}},analysis:{baseScale:{rootPc:0,mode:'major'},tempoBpm:60,chords:[{rootPc:0,start:0,end:4,quality:'major',confidence:.9},{rootPc:5,start:4,end:8,quality:'major',confidence:.9},{rootPc:7,start:8,end:12,quality:'major',confidence:.9}],notes:[{midi:36,start:0,end:2,confidence:.9},{midi:38,start:2,end:3,confidence:.9},{midi:40,start:3,end:4,confidence:.9},{midi:41,start:4,end:6,confidence:.9},{midi:45,start:6,end:7,confidence:.9},{midi:42,start:7,end:8,confidence:.3},{midi:43,start:8,end:11,confidence:.9}]}};
const meta={id:'one',title:'Test worship',stamp:'1',filename:'test.bassstudio'};
const original=JSON.stringify(project),r=T.extract(project,meta);assert.equal(JSON.stringify(project),original,'scan must not mutate songs');assert.equal(r.items.length,2);
assert.equal(r.items[0].from,'1');assert.equal(r.items[0].to,'4');assert.equal(r.items[0].section,'Chorus');assert.equal(r.items[1].check,true);
const p=T.plan(r.items[0],50);assert.equal(p.bpm,30);assert.equal(p.bass[2].midi,40);assert(Math.abs(p.bass[2].beat-3)<.001);assert.equal(p.chords.length,0);
const missing=structuredClone(project);missing.analysis.notes=[];assert.equal(T.extract(missing,meta).reason,'No bass notes');
const malformed=structuredClone(project);malformed.analysis.chords[0].rootPc=null;assert.equal(T.extract(malformed,meta).items.length,1,'missing root is not C');
const gap=structuredClone(project);gap.analysis.chords[0].end=2;assert.equal(T.extract(gap,meta).items.length,1,'do not invent a change over a gap');
const unknown=structuredClone(project);unknown.analysis.baseScale={};assert.equal(T.extract(unknown,meta).items[0].from,'?','do not invent a key');
const minor=structuredClone(project);minor.analysis.baseScale={rootPc:0,mode:'minor'};minor.analysis.chords[1].rootPc=8;assert.equal(T.extract(minor,meta).items[0].to,'♭6');
const mod=structuredClone(project);mod.analysis.keySections=[{start:0,end:4,scale:'C major'},{start:4,end:12,scale:'D major'}];assert.equal(T.extract(mod,meta).items[0].modulates,true);assert.equal(T.extract(mod,meta).items[0].from,'?');
const simple=structuredClone(project);simple.analysis.notes=[{midi:36,start:0,end:4},{midi:41,start:4,end:8},{midi:43,start:8,end:12}];assert.equal(T.extract(simple,meta).items.length,0,'held roots are not fills');
const repeated=structuredClone(project);repeated.analysis.chords.splice(1,0,{...repeated.analysis.chords[0],start:2});repeated.analysis.chords[0].end=2;assert.equal(T.extract(repeated,meta).items.length,2,'merge repeated chord detections');
const html=fs.readFileSync('index.html','utf8');assert(html.includes('if(importSucceeded&&!practiceOnly)queueAutomaticMelody()'));assert(html.includes('practiceOnly:true'));assert(html.includes(fs.readFileSync('library-source/library.js','utf8').trim()));
for(const file of ['fills-rc264.js','practice-rc264.js','library-fills-rc264.js','study-ui-rc264.js','trainer-rc264.js'])new vm.Script(fs.readFileSync('ear-source/'+file,'utf8'));
console.log(`PASS ${cases} modal fill/run/bassline arrangements; extraction, gaps, missing data, modulation, confidence, timing and read-only practice import.`);
