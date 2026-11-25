const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const env={window:{BassRehearsalCore:require('../ear-source/rehearsal-core.js')}};
vm.createContext(env);
for(const file of ['fills-rc264.js','rehearsal-harmony-rc354.js'])vm.runInContext(fs.readFileSync('ear-source/'+file,'utf8'),env);
const H=env.window.BassRehearsalHarmony;
const clip={start:0,end:10,keyRoot:0,keyMode:'major',chords:[
 {start:0,end:2,rootPc:0,quality:'maj',manual:true},
 {start:2,end:4,rootPc:0,quality:'maj7',manual:true},
 {start:4,end:6,rootPc:5,quality:'maj',manual:true},
 {start:6,end:8,rootPc:5,bassPc:0,quality:'maj',manual:true},
 {start:8,end:9,rootPc:7,quality:'maj',uncertain:true},
 {start:9,end:10,rootPc:0,quality:'maj',rootOnly:true}
]};
const kind=(time,midi,role='transcribed')=>H.noteKind(clip,{time,midi,role}).kind;
assert.equal(kind(0,41,'landing'),'passing','a non-root note at a chord boundary is not falsely called a landing');
assert.equal(kind(0,43,'landing'),'chord','a fifth at a boundary is a chord note, not the main bass');
assert.equal(kind(1,36),'main','the root remains recognisable throughout the chord');
assert.equal(kind(2,40,'landing'),'chord');
assert.equal(kind(3,38,'fill'),'fill');
assert.equal(kind(3,40,'run'),'run','generated run membership is retained even for chord tones');
assert.equal(kind(3,42),'passing');
assert.equal(kind(4,41),'main');
assert.equal(kind(6,36),'main','the slash bass is the main bass pitch for an inversion');
assert.equal(kind(6,41),'chord');
assert.equal(kind(8,43),'unknown','uncertain harmony does not assert a note role');
assert.equal(kind(9,36),'unknown','root-only recovery does not assert full chord information');
assert.equal(kind(1,null),'muted');
assert.equal(H.noteKind(clip,{time:1,midi:36,role:'run'}).phrase,'run','the run badge can coexist with a main note');
const segments=H.prepare(clip).segments;
assert.equal(H.chordLabel(segments[0]),'1 C');
assert.equal(H.chordLabel(segments[1]),'1 C','same-root colour changes display the current chord, without a false 1→1 movement');
assert.equal(H.chordLabel(segments[2]),'4 F');
assert.equal(H.chordLabel(segments[4]),'5 G?');
assert(H.prepare(clip).transitions.some(t=>t.label==='1→1'),'presentation does not remove harmonic events used by the fitter');
console.log('PASS main/chord/fill/run/passing roles, false boundary landings, inversion bass and honest chord labels.');
