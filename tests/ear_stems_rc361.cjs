const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// Exercise the shipped worker with transient drums and a sustained instrument.
// Voice has already been separated by the neural worker, so this stage must
// neither invent a vocal channel nor remove samples from the backing sum.
const rate=32000,length=rate*2,music=[new Float32Array(length),new Float32Array(length)];
for(let i=0;i<length;i++){
 const t=i/rate,phase=i%(rate/2),drum=phase<400?.5*Math.sin(i*2.41)*Math.exp(-phase/150):0;
 music[0][i]=.12*Math.sin(2*Math.PI*220*t)+drum;music[1][i]=.09*Math.sin(2*Math.PI*330*t)+drum*.8;
}
let message;
const env={self:{postMessage:data=>{message=data;}},Float32Array,Float64Array,Math,globalThis:null,importScripts(){vm.runInContext(fs.readFileSync('fretflow-source/practice-stems.js','utf8'),context);}};
env.globalThis=env.self;const context=vm.createContext(env);
vm.runInContext(fs.readFileSync('ear-source/band-split-worker-rc361.js','utf8'),context);env.self.onmessage({data:{channels:music,rate}});
assert(!message.error,message.error);assert.equal(message.channels.length,4);
let error=0,drumPower=0,otherPower=0;for(let c=0;c<2;c++)for(let i=0;i<length;i++){
 const drum=message.channels[c][i],other=message.channels[c+2][i];error=Math.max(error,Math.abs(drum+other-music[c][i]));drumPower+=drum*drum;otherPower+=other*other;
}
assert(error<1e-7);assert(drumPower>1&&otherPower>10);
// Actual transport gain nodes, including independent voice mute and volume.
const w={};vm.runInNewContext(fs.readFileSync('ear-source/practice-loop-rc292.js','utf8'),{window:w});
const gains=[],sources=[],ctx={currentTime:0,destination:{},createGain(){const g={gain:{value:1,setValueAtTime(v){this.value=v;},setTargetAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;},cancelScheduledValues(){}},connect(){return this;},disconnect(){}};gains.push(g);return g;},createBufferSource(){const source={connect(){return this;},disconnect(){},start(when){this.when=when;},stop(){}};sources.push(source);return source;}};
const buffer={duration:2},audio={stems:{bass:buffer,drums:buffer,chords:buffer,voice:buffer},seconds:2,beatSeconds:.5,gain:1,levels:{bass:2,drums:3,chords:4,voice:5}};
const transport=w.BassPracticeLoop.start(ctx,audio);assert.deepEqual(gains.slice(1).map(g=>g.gain.value),[2,.63,.28,1.05]);
transport.level('voice',0);assert.equal(gains[4].gain.value,0);assert.equal(gains[3].gain.value,.28);
transport.level('chords',0);transport.level('voice',.12);assert.equal(gains[3].gain.value,0);assert.equal(gains[4].gain.value,.6);
transport.level('drums',0);assert.equal(gains[2].gain.value,0);assert.equal(gains[1].gain.value,2);assert.equal(sources.length,4);assert(sources.every(s=>s.when===sources[0].when));
console.log(JSON.stringify({passed:true,backingReconstructionError:error,drumsAndOthersAudible:true,independentRealVoiceGain:true,zeroMutes:true,normalisationBeforeUserFaders:true,sourcesShareClock:true}));
async function fallbackTest(){
 const pcm=Array.from({length:6},(_,c)=>new Float32Array(200).fill((c+1)*.01));
 const source={length:200,sampleRate:100,duration:2,numberOfChannels:6,getChannelData:c=>pcm[c]};
 const context={sampleRate:100,decodeAudioData:async()=>source,createBuffer(channels,length,sampleRate){const pcm=Array.from({length:channels},()=>new Float32Array(length));return {length,sampleRate,numberOfChannels:channels,duration:length/sampleRate,getChannelData:c=>pcm[c],copyToChannel:(data,c)=>pcm[c].set(data)};}};
 const window={BassEarAudio:{recording:async()=>{throw Error('Model offline');},normalisation:()=>1}};
 const env={window,fetch:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(0)})};
 vm.runInNewContext(fs.readFileSync('ear-source/practice-loop-rc292.js','utf8'),env);
 const rendered=await window.BassPracticeLoop.render(context,{audio:'offline-fixture',bpm:60,beats:2,recording:{originalMix:true},semitones:2},{recorded:true});
 assert.equal(rendered.voiceUnavailable,true,'a failed model must not masquerade as separate vocals');
 assert.equal(rendered.stems.voice,undefined);assert.deepEqual([...rendered.stems.bass.getChannelData(0)],[...pcm[0]]);assert.equal(rendered.seconds,2);assert.equal(rendered.semitones,2);
 console.log('PASS existing separated recordings remain playable when new vocal preparation is unavailable.');
}
async function cachedBandTest(){
 const D=require('../ear-source/audio-dsp-rc361.js'),pcm=Array.from({length:6},(_,c)=>new Float32Array(64).fill((c+1)*.01));
 const source={length:64,sampleRate:32000,duration:64/32000,numberOfChannels:6,getChannelData:c=>pcm[c]},drums=[new Float32Array(64).fill(.003),new Float32Array(64).fill(.004)];
 const window={},env={window,BassEarDSP:D,OfflineAudioContext:class{createBufferSource(){this.node={connect(){},start(){}};return this.node;}async startRendering(){return this.node.buffer;}}};
 vm.runInNewContext(fs.readFileSync('ear-source/ear-audio-rc361.js','utf8'),env);
 const output=await window.BassEarAudio.bandStems(source,()=>false,drums);
 for(let c=0;c<2;c++){assert.deepEqual([...output[c]],[...pcm[c+2]],'cached bass is unchanged');assert.deepEqual([...output[c+6]],[...pcm[c+4]],'cached vocals are unchanged');for(let i=0;i<64;i++)assert(Math.abs(output[c+2][i]+output[c+4][i]-pcm[c][i])<1e-8);}
 console.log('PASS cached drum separation reuses the original bass/vocals and exactly reconstructs the backing.');
}
fallbackTest().then(cachedBandTest).catch(error=>{console.error(error);process.exitCode=1;});
