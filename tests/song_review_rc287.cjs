const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const box={window:{}};vm.runInNewContext(fs.readFileSync('song-view/core.js','utf8'),box);const C=box.window.BassSongViewCore;
const chord=(start,end,extra={})=>({start,end,rootPc:0,quality:'maj',confidence:.9,...extra});
function rows(chords){return C.build({duration:8,notes:[],chords}).rows;}
const source=[chord(0,1),chord(1,2,{confidence:.8}),chord(2,3)],before=JSON.stringify(source),model=C.build({duration:8,chords:source});
assert.equal(model.rows[0].chords.length,1);assert.equal(model.rows[0].chords[0].end,3);assert.equal(model.rows[0].chords[0].confidence,.8);
assert.equal(model.chords.length,3,'saved event history is retained');assert.equal(JSON.stringify(source),before,'source data is immutable');
for(const extra of [{rootPc:2},{quality:'min'},{bassPc:7},{uncertain:true},{manual:true}])assert.equal(rows([chord(0,1),chord(1,2,extra)])[0].chords.length,2,'distinct chord or certainty must remain visible');
assert.equal(rows([chord(0,1),chord(1.1,2)])[0].chords.length,2,'a real gap must stay empty');
const crossing=rows([chord(0,3),chord(3,5)]);assert.equal(crossing[0].chords[0].end,4);assert.equal(crossing[1].chords[0].start,4);assert.equal(crossing[1].chords[0].continued,true);
assert.equal(C.active(C.index(model.rows[0].chords),2.5).length,1);assert.equal(C.active(C.index(model.rows[0].chords),3).length,0);
console.log('PASS chord grouping, gaps, changes, certainty, held-note boundaries and unchanged source events');
