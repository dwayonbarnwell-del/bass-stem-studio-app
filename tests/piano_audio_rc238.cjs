const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const env={window:{},Blob,DataView,Uint8Array,Int16Array,Float32Array,WeakMap,Math,Array,setTimeout};vm.createContext(env);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../ai-source/piano-audio.js'),'utf8'),env);const a=env.window.BassPianoAudio;
function estimate(x,sr){let crossings=0;for(let i=1;i<x.length;i++)if(x[i-1]<0&&x[i]>=0)crossings++;return crossings*sr/x.length;}
(async()=>{
 const n=[{start:.2,end:.8,midi:69}],pcm=a.pcm(n,0,22050,22050,'piano');assert.ok(pcm.subarray(0,4000).every(x=>x===0));assert.ok(pcm.subarray(18000).every(x=>x===0));assert.ok(Math.abs(estimate(pcm.subarray(6000,15000),22050)-440)<5);assert.ok(pcm.every(x=>Math.abs(x)<=.95));
 const wav=await a.exportAudio({notes:n,start:0,end:1});const v=new DataView(await wav.arrayBuffer());assert.equal(v.getUint32(24,true),22050);assert.equal(v.getUint32(40,true),44100);assert.equal(wav.size,44144);
 const midi=new Uint8Array(await a.midi(n).arrayBuffer());assert.equal(String.fromCharCode(...midi.slice(0,4)),'MThd');assert.ok(midi.includes(69));
 const tracker=a.tracker();for(let i=0;i<10;i++)tracker.push({midi:60,confidence:.95},i*.04);tracker.push(null,.4);for(let i=12;i<22;i++)tracker.push({midi:62,confidence:.94},i*.04);const notes=tracker.finish();assert.equal(notes.length,2);assert.equal(notes[0].midi,60);assert.equal(notes[1].midi,62);assert.ok(notes[1].start>notes[0].end);
 const noise=a.tracker();for(let i=0;i<20;i++)noise.push({midi:60+i%3,confidence:.6},i*.04);assert.equal(noise.finish().length,0);
 await assert.rejects(a.exportAudio({notes:n,start:0,end:1,cancelled:()=>true}),/cancelled/);
 console.log('PASS: rendered pitch, silence, level bounds, WAV header, MIDI, live-note rests and confidence, cancellation');
})();
