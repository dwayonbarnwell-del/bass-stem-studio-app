const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
function fn(name){const start=html.indexOf('  function '+name+'(');assert(start>=0);let end=html.indexOf('\n  function ',start+10);return html.slice(start,end);}
const c={notes:[],detectedChordChanges:[],manualCorrections:[],copyAnalysis:x=>JSON.parse(JSON.stringify(x))};vm.createContext(c);
vm.runInContext(fn('replayManualCorrections')+fn('compactDigitsToSeconds')+fn('parseUserTime'),c);
let failed=0;function test(name,f){try{f();console.log('PASS '+name)}catch(e){failed++;console.log('FAIL '+name+': '+e.message)}}
test('moving a note remains unique when corrections replay',()=>{const original={midi:36,start:0,end:1};const value={...original,midi:38,start:.5,end:1.5,manual:true};c.notes=[original];c.manualCorrections=[{kind:'note',original,value}];c.replayManualCorrections();c.replayManualCorrections();assert.equal(c.notes.length,1);assert.equal(c.notes[0].start,.5)});
test('successive timing and pitch edits replay once',()=>{const first=c.manualCorrections[0].value;const next={...first,start:1,end:2,midi:40};c.manualCorrections.push({kind:'note',original:first,value:next});c.replayManualCorrections();c.replayManualCorrections();assert.equal(c.notes.length,1);assert.equal(c.notes[0].midi,40)});
test('invalid repeat times are rejected',()=>{for(const v of ['',':','1:','1::2','1:-2','-25','abc25','1:Infinity','Infinity:1','1e2'])assert(Number.isNaN(c.parseUserTime(v)),v)});
test('established compact and clock entry remain supported',()=>{for(const [v,seconds] of [['0',0],['26',26],['075',75],['120',80],['1:20',80],['0:01.5',1.5],['1:02:03',3723]])assert.equal(c.parseUserTime(v),seconds,v)});
process.exitCode=failed?1:0;
