const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const h=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8'),c={window:{},Float64Array,Float32Array,Math,Map,Object};vm.createContext(c);
vm.runInContext(h.match(/<script id="rc167-live-script">([\s\S]*?)<\/script>/)[1],c);vm.runInContext(h.match(/<script id="rc168-voice-ai">([\s\S]*?)<\/script>/)[1],c);
const ai=c.window.BassVoiceAI,dsp=c.window.BassLiveDSP;
function frames(notes){const values=new Float32Array(notes.length*88);notes.forEach((ns,i)=>ns.forEach(m=>values[i*88+m-21]=.8));return {values,frames:notes.length,pitches:88};}
assert.equal(ai.readFrames(frames(Array(50).fill([60,64,67])),dsp.classify).chord,'C');
assert.equal(ai.readFrames(frames(Array(50).fill([57,60,64])),dsp.classify).chord,'Am');
assert.equal(ai.readFrames(frames(Array.from({length:50},(_,i)=>[[60],[64],[67]][i%3])),dsp.classify).chord,'—','sequential melody is not a simultaneous chord');
assert.equal(ai.readFrames(frames(Array(50).fill([60,64,67])),dsp.classify,true).chord,'—','solo mode never claims a chord');
assert.equal(ai.readFrames(frames(Array(50).fill([])),dsp.classify).notes.length,0);
assert.equal(ai.keyEstimate([1,0,0,0,1,0,0,1,0,0,0,0],30),'Gathering notes','one chord does not establish a key');
assert.equal(ai.keyEstimate([6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88],10),'C major ?');
console.log('PASS: simultaneous C/Am, sequential melody rejection, solo mode, silence, insufficient key evidence and C-major profile.');
