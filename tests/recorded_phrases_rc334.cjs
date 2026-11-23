// Exercise the same clips, names, note ranges and automatic mix as the practice player.
const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const window={},env=vm.createContext({window});
for(const f of ['fills-rc264','uploaded-data-rc267','lesson-data-rc272','african-data-rc274','reggae-data-rc273',
 'recording-grids','recording-phrases','uploaded-core-rc267','accompaniment-rc293','drum-loops-data-rc294',
 'supplied-drums-rc294','study-display-rc294'])vm.runInContext(fs.readFileSync('ear-source/'+f+'.js','utf8'),env);
const {BassUploadedCore:U,BassRecordedPhrases:data,BassStudyDisplay:N,BassAccompaniment:H}=window;
const names=new Set(),bars={};
assert.equal(U.items.length,64);
assert(!U.items.some(c=>c.id==='clip-62')&&!data['clip-62']);
for(const c of U.items){
 const rows=data[c.id];assert(rows?.length);
 let offset=0;const pack=fs.readFileSync('ear-assets/phrases-rc334/'+c.id+'.bin');
 for(const [i,row] of rows.entries()){
  const p=U.practicePlan(c.id,'phrase-'+i),r=p.recording;
  assert(r&&p.bass.length&&p.chords.length);
  assert(r.start>=0&&r.end<=c.parts[0].end+.001);
  assert.equal(r.offset,offset);assert.equal(pack.toString('ascii',offset,offset+4),'fLaC');
  offset+=r.bytes;assert(offset<=pack.length);
  assert([4,8,16].includes(p.beats));bars[p.beats/4]=(bars[p.beats/4]||0)+1;
  assert(p.bass.every(n=>n.beat>=0&&n.beat+n.length<=p.beats+.0001));
  assert.equal(U.practicePlan(c.id,'phrase-'+i,111).bpm,111);
  const label=N.phrase(c,i,rows.length),key=H.category(c,true)+':'+label;
  assert(label.length<=12&&!names.has(key));names.add(key);
  if(c.id==='clip-46')assert(p.bpm===82.9&&r.hasDrums);
 }
 assert.equal(offset,pack.length);
}
console.log('Recorded practice phrases verified',bars);
for(const file of ['practice-rc264b','catalogue-rc269','curated-rc289'])vm.runInContext(fs.readFileSync('ear-source/'+file+'.js','utf8'),env);
const P=window.BassPracticeCore;
let total=0,split=0;
for(const [idea,line] of P.lines.entries()){
 const selections=P.phrases(line.degrees);
 if(selections.length>1)split++;
 const cycle=selections.flat();
 assert(line.degrees.every((d,i)=>d===cycle[i%cycle.length]));
 for(const [part,degrees] of selections.entries()){
  const plan=P.make('basslines',{idea,part});
  assert.deepEqual(plan.degrees,degrees);
  assert.equal(plan.beats,degrees.length*4);assert(plan.beats<=16);
  assert(plan.bass.every(n=>n.beat+n.length<=plan.beats+.0001));
  assert.equal(N.segments(plan).length,degrees.length);total++;
 }
}
for(const [kind,list] of [['fills',window.BassFillCore.styles],['runs',P.runs]]){
 for(let idea=0;idea<list.length;idea++)assert(P.make(kind,{idea,from:1,to:4}).beats<=16);
}
console.log(total+' bassline clips, including '+split+' longer progressions split across clips.');
