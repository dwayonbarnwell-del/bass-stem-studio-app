const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const env={window:{},Math,console};vm.createContext(env);vm.runInContext(fs.readFileSync('ear-source/core.js','utf8'),env);const C=env.window.BassEarTrainingCore;
let seed=258;const rng=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const qualities={'Major':[0,4,7],'Minor':[0,3,7],'Diminished':[0,3,6],'Augmented':[0,4,8],'Sus2':[0,2,7],'Sus4':[0,5,7],'Dominant 7th':[0,4,7,10],'Major 7th':[0,4,7,11],'Minor 7th':[0,3,7,10],'Half-diminished 7th':[0,3,6,10]};
// Independent major-key triads, including octave placement of the low root.
const chords={1:[0,0,4,7],2:[2,2,5,9],3:[4,4,7,11],4:[5,5,9,0],5:[7,7,11,2],6:[9,9,0,4],7:[11,11,2,5]};
const pc=m=>(m%12+12)%12;let checked=0;
for(const mode of C.modes)for(let level=1;level<=3;level++)for(const sound of ['piano','bass']){
 let recent=[],previous='',priorAnswer='',sameAnswerDifferentNotes=0;const keys=new Set(),tonics=new Set();
 for(let i=0;i<600;i++){
  const q=C.make(mode,level,{rng,sound,previous,recent});assert(!recent.includes(q.key),'identical recent example');assert.equal(q.sound,sound);keys.add(q.key);recent=[...recent,q.key].slice(-3);previous=q.key;
  if(mode==='chords'){
   const expected=qualities[q.answer],pitches=Array.from(q.events,n=>pc(n.midi)).sort((a,b)=>a-b);
   assert(q.events.some(root=>JSON.stringify(expected.map(n=>pc(root.midi+n)).sort((a,b)=>a-b))===JSON.stringify(pitches)),'wrong chord quality');
   if(q.answer===priorAnswer)sameAnswerDifferentNotes++;priorAnswer=q.answer;
  }
  if(mode==='progressions'){
   tonics.add(pc(q.tonic));assert.equal(q.events.length,16);const degree=Array.from(q.degrees);assert.equal(q.answer,degree.join('–'));assert.equal(q.reference.length,3);
   for(let j=0;j<4;j++){const notes=q.events.filter(n=>Math.abs(n.start-j*1.35)<1e-8);assert.equal(notes.length,4);assert.deepEqual(Array.from(notes,n=>pc(n.midi-q.tonic)),chords[degree[j]]);assert.equal(notes[0].midi,q.tonic-12+chords[degree[j]][0]);}
  }
  if(mode==='notes'){assert.deepEqual(Array.from(q.events,n=>n.midi),Array.from(q.answer));assert(q.answer.every(n=>q.keyboard.includes(n)));tonics.add(q.keyboard[0]);}
  if(mode==='intervals'){const semitones=Math.abs(q.events[1].midi-q.events[0].midi),labels={1:'Minor 2nd',2:'Major 2nd',3:'Minor 3rd',4:'Major 3rd',5:'Perfect 4th',6:'Tritone',7:'Perfect 5th',8:'Minor 6th',9:'Major 6th',10:'Minor 7th',11:'Major 7th',12:'Octave'};assert.equal(q.answer,labels[semitones]);}
  if(mode==='rhythm'){assert(C.grade(q,q.answer.map(n=>n+10)).correct);assert(!C.grade(q,q.answer.map(n=>n*1.5)).correct);}
  assert(C.grade(q,q.answer).correct);checked++;
 }
 assert(keys.size>3,'insufficient variety');if(mode==='chords')assert(sameAnswerDifferentNotes>5,'answers must not alternate predictably');
 if(mode==='notes')assert.equal(tonics.size,5);if(mode==='progressions')assert.equal(tonics.size,level===1?3:12);
}
console.log('PASS',checked,'independently checked examples: chord pitch classes, low roots, intervals, rhythm, both instruments, all levels, varied keys and no last-three duplicates.');
