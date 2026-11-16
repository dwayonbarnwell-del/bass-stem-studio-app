const assert=require('node:assert/strict'),C=require('../fretflow-source/core.js');
let cases=0;
for(const count of [4,5,6])for(let midi=0;midi<=127;midi++){
 const tuning=C.tuning(count),positions=C.candidates(midi,count);
 assert.equal(positions.length>0,midi>=tuning[0]&&midi<=tuning.at(-1)+24);
 for(const p of positions){assert.equal(tuning[p.string]+p.fret,midi);assert(p.fret>=0&&p.fret<=24);cases++;}
}
assert.equal(C.pitch(23),'B0');assert.equal(C.pitch(28),'E1');assert.equal(C.pitch(43),'G2');assert.equal(C.pitch(48),'C3');
const notes=[{midi:23,start:0,end:1,confidence:.9},{midi:36,start:1,end:1.5,confidence:.9},{midi:38,start:2,end:3,confidence:.4},{midi:72,start:3,end:4}];
const original=JSON.stringify(notes);
for(const count of [4,5,6])for(const shift of [-12,-5,0,2,12]){
 const rows=C.plan(notes,count,shift);assert.equal(rows.length,4);
 for(const n of rows){assert.equal(n.midi,n.source.midi+shift);if(n.position)assert.equal(C.tuning(count)[n.position.string]+n.position.fret,n.midi);else assert.equal(C.candidates(n.midi,count).length,0);cases++;}
 assert.equal(C.active(rows,1)[0].midi,36+shift);assert.equal(C.active(rows,1.5).length,0);assert.equal(C.active(rows,4).length,0);
 assert.equal(C.active(rows,2.5)[0].midi,38+shift);assert.equal(C.active(rows,.5)[0].midi,23+shift);
}
assert.equal(JSON.stringify(notes),original);assert.equal(C.plan(notes,4)[0].position,null);assert(C.plan(notes,5)[0].position);
const overlapping=C.plan([{midi:36,start:0,end:10},{midi:40,start:1,end:2},{midi:43,start:3,end:4}],5);
assert.equal(C.active(overlapping,3.5).length,2);assert.equal(C.active(overlapping,5).length,1);
assert.deepEqual(C.plan([null,{midi:36,start:0,end:0},{midi:NaN,start:0,end:1}],4),[]);
for(let f=1;f<=24;f++){assert(C.fretCentre(f)>C.fretWire(f-1)&&C.fretCentre(f)<C.fretWire(f));cases++;}
console.log(`PASS ${cases} exact pitch/range/fret checks; onset/end boundaries, silence, overlaps, transposition and immutable source notes.`);
