const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const s=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const a=s.indexOf('const CHORD_QUALITY_LABELS='),b=s.indexOf('  function reliableChord(',a);
const code=s.slice(a,b);
new vm.Script(code);
const names=['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'].map((n,pc)=>({n,pc}));
const make=(mode,hasKey=true)=>new Function('SCALE_ROOTS','noteDisplayMode','numberingScaleContext','scaleDegreeLabel','transposeSemitones',code+'return chordDisplayLabel;')(
 names,mode,()=>hasKey?{rootPc:2}:null,
 pc=>{const scale=[0,2,4,5,7,9,11],d=(pc-2+12)%12;const idx=scale.indexOf(d);return idx>=0?String(idx+1):'#'+String(scale.findLastIndex(v=>v<d)+1);},0);
const letter=make('notes'),number=make('numbers'),noKey=make('numbers',false);
for(const [pc,quality,value] of [[0,'maj','C'],[9,'min','Am'],[0,'maj7','CM7'],[2,'maj','D'],[11,'min','Bm'],[2,'maj7','DM7']])
 assert.equal(letter({rootPc:pc,quality}),value);
for(const [pc,quality,value] of [[2,'maj','1'],[11,'min','6m'],[7,'maj','4'],[2,'maj7','1M7']])
 assert.equal(number({rootPc:pc,quality}),value);
assert.equal(letter({rootPc:2,quality:'maj',bassPc:11}),'D/B');
assert.equal(number({rootPc:2,quality:'maj',bassPc:11}),'1/6');
assert.equal(noKey({rootPc:2,quality:'maj'}),'D');
assert(s.includes('window.BassBatch.init'));
console.log('PASS: major has no M, minor m, major seventh M7, selected numbers, slash bass and no-key fallback.');
