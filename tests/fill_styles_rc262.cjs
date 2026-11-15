const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const env={window:{}};vm.createContext(env);vm.runInContext(fs.readFileSync('ear-source/fills-rc262.js','utf8'),env);const F=env.window.BassFillCore,pc=n=>(n%12+12)%12;
assert.deepEqual(Array.from(F.styles.slice(6),s=>s[0]),['Jazz fill','Blues fill','Pentatonic fill','Contemporary worship']);
let checked=0;
for(const mode of ['major','minor'])for(let key=0;key<12;key++)for(let from=1;from<=7;from++)for(let to=1;to<=7;to++){
 if(from===to)continue;const scale=mode==='major'?[0,2,4,5,7,9,11]:[0,2,3,5,7,8,10];
 for(let idea=6;idea<10;idea++){
  const p=F.make({key,mode,from,to,idea}),a=Array.from(p.bass);
  assert.equal(pc(a[0].midi),pc(key+scale[from-1]));assert.equal(pc(a.at(-1).midi),pc(key+scale[to-1]));assert.equal(a.at(-1).beat,4);
  if(idea===6){assert(Math.abs(a[2].beat-5/3)<1e-9);assert.equal(a.at(-2).midi,p.target-1);assert.equal(a.at(-3).midi,p.target+1);}
  if(idea===7){const third=(scale[(from+1)%7]-scale[from-1]+12)%12;assert(a.some(n=>n.midi-p.source===(third===3?6:3)),'contains the blue note');assert(a.some(n=>Math.abs(n.beat-4/3)<1e-9),'triplet');}
  if(idea===8){const pent=mode==='minor'?[0,3,5,7,10]:[0,2,4,7,9];assert(a.slice(1,-1).every(n=>pent.includes(pc(n.midi-key))));assert(a.slice(1,-2).every((n,i)=>n.midi>a[i+2].midi),'descending pentatonic run');}
  if(idea===9){assert(a.some(n=>n.midi===p.source+12));assert.equal(a.at(-2).midi,p.target);assert.equal(a.at(-2).beat,3.5);}
  checked++;
 }
}
assert.equal(F.make({idea:999}).idea,9);assert.equal(F.make({idea:-1}).idea,0);
console.log(`PASS ${checked} style-specific arrangements: swing and enclosures, blues notes and triplets, pentatonic runs, worship octave/pickup, and correct landing roots.`);
