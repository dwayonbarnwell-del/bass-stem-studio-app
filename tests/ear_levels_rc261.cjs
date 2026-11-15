const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const env={window:{},Math};vm.createContext(env);vm.runInContext(fs.readFileSync('ear-source/core-rc261.js','utf8'),env);const C=env.window.BassEarTrainingCore;
let seed=261,count=0;const rng=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296),pc=n=>(n%12+12)%12;
const qualities={'Major':[0,4,7],'Minor':[0,3,7],'Diminished':[0,3,6],'Augmented':[0,4,8],'Sus2':[0,2,7],'Sus4':[0,5,7],'Dominant 7th':[0,4,7,10],'Major 7th':[0,4,7,11],'Minor 7th':[0,3,7,10],'Half-diminished 7th':[0,3,6,10],'Major 6th':[0,4,7,9],'Minor 6th':[0,3,7,9],'Diminished 7th':[0,3,6,9],'Dominant 9th':[0,4,7,10,2],'Major 9th':[0,4,7,11,2],'Minor 9th':[0,3,7,10,2],'Dominant 7th sus4':[0,5,7,10]};
const labels={1:'Minor 2nd',2:'Major 2nd',3:'Minor 3rd',4:'Major 3rd',5:'Perfect 4th',6:'Tritone',7:'Perfect 5th',8:'Minor 6th',9:'Major 6th',10:'Minor 7th',11:'Major 7th',12:'Octave',13:'Minor 9th',14:'Major 9th',15:'Minor 10th',16:'Major 10th',17:'Perfect 11th',18:'Augmented 11th',19:'Perfect 12th',20:'Minor 13th',21:'Major 13th',22:'Minor 14th',23:'Major 14th',24:'Double octave'};
for(const mode of C.modes)for(const level of [4,5])for(const sound of ['bass','piano']){
 const seen=new Set();let recent=[];
 for(let i=0;i<350;i++){
  const q=C.make(mode,level,{rng,sound,recent});assert.equal(q.level,level);assert(!recent.includes(q.key));recent=[...recent,q.key].slice(-3);assert(C.grade(q,q.answer).correct);assert(!C.grade(q,null).correct);seen.add(typeof q.answer==='string'?q.answer:q.key);
  for(const n of q.events){assert(n.midi>=21&&n.midi<=108);assert(n.end>n.start&&n.start>=0);}
  if(q.options.length){assert.equal(q.options.length,6);assert.equal(new Set(q.options).size,6);assert(q.options.includes(q.answer));}
  if(mode==='notes'){assert.equal(q.answer.length,level+1);assert.equal(q.keyboard.length,12);assert.equal(q.keyboard[0]%12,0);assert.equal(q.keyboard.at(-1)%12,11);assert(q.answer.every(n=>q.keyboard.includes(n)));assert.deepEqual(Array.from(q.events,n=>n.midi),Array.from(q.answer));}
  if(mode==='intervals'){const gap=Math.abs(q.events[1].midi-q.events[0].midi);assert.equal(q.answer,labels[gap]);assert(level===4?gap<=12:gap>=13);}
  if(mode==='chords'){const actual=Array.from(q.events,n=>pc(n.midi)).sort((a,b)=>a-b);assert(q.events.some(n=>JSON.stringify(qualities[q.answer].map(x=>pc(n.midi+x)).sort((a,b)=>a-b))===JSON.stringify(actual)));}
  if(mode==='progressions'){
   assert.equal(q.degrees.length,level===4?4:6);assert.equal(q.events.length,q.degrees.length*4);assert.equal(q.answer,q.degrees.join('–'));
   const scale=[0,2,4,5,7,9,11],starts=[...new Set(Array.from(q.events,n=>n.start))];
   q.degrees.forEach((d,j)=>{const group=q.events.filter(n=>n.start===starts[j]),expected=[0,0,2,4].map(k=>scale[(d-1+k)%7]).sort((a,b)=>a-b);assert.deepEqual(Array.from(group,n=>pc(n.midi-q.tonic)).sort((a,b)=>a-b),expected);assert.equal(group[0].midi,q.tonic+scale[d-1]-12);assert(group.every(n=>n.end<starts[j+1]||j===starts.length-1));});
  }
  if(mode==='rhythm'){assert.equal(q.barBeats,level===5?8:4);assert(q.beats.at(-1)<q.barBeats);assert.equal(q.answer.length,q.beats.length);assert(C.grade(q,q.answer.map(n=>n+20)).correct);assert(!C.grade(q,q.answer.map(n=>n*1.5)).correct);assert.equal(C.grade(q,q.answer.map((n,j)=>n+(j?.11:0))).correct,false);}
  count++;
 }
 if(mode==='chords')assert.equal(seen.size,level===4?10:17);if(mode==='intervals')assert.equal(seen.size,12);
}
const old={version:1,modes:{notes:{total:30,correct:22,rounds:6,level:3,recent:[true,false]}}},restored=C.restore(old);assert.equal(restored.modes.notes.total,30);assert.equal(restored.modes.notes.level,3);assert.equal(C.record(restored,'notes',true,5).modes.notes.level,5);assert.equal(C.restore({version:1,modes:{notes:{level:99}}}).modes.notes.level,5);
const trainer=fs.readFileSync('ear-source/trainer-rc266.js','utf8');new vm.Script(trainer);assert(trainer.includes('round.level<C.maxLevel'));assert(trainer.includes('Math.min(C.maxLevel,round.level+1)'));
console.log(`PASS ${count} advanced examples: five skills, both sounds, compound intervals, 17 chord types, six-chord sequences, two-bar rhythms, fixed C–B keys and saved progress.`);
