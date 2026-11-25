import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {PitchEngine} from '../ear-source/pitch-engine-rc361.mjs';
const require=createRequire(import.meta.url),D=require('../ear-source/audio-dsp-rc361.js');
const rate=32000,seconds=5,count=rate*seconds;
function render(frequency,semitones,pulses=false){
 const engine=new PitchEngine(rate,semitones),input=new Float32Array(count),output=new Float32Array(count),right=new Float32Array(count);
 for(let i=0;i<count;i++)input[i]=.3*Math.sin(2*Math.PI*frequency*i/rate)*(pulses?i%rate<rate*.025:1);
 for(let i=0;i<count;i+=128){const end=Math.min(count,i+128);engine.process([input.subarray(i,end),input.subarray(i,end)],[output.subarray(i,end),right.subarray(i,end)],semitones);}
 assert.equal(engine.underruns,0);assert.deepEqual(right,output,'stereo stays phase coherent');return {input,output,engine};
}
// Estimate the fundamental using the actual processed waveform, including
// sub-bass. Frequency errors are measured in cents rather than MIDI labels.
function power(samples,frequency){const step=2*Math.PI*frequency/rate,coef=2*Math.cos(step);let a=0,b=0;for(let i=rate;i<samples.length;i++){const v=samples[i]+coef*a-b;b=a;a=v;}return a*a+b*b-coef*a*b;}
const measured=[];
for(const frequency of [30.867706,55,110,440])for(const semi of [-6,-2,0,2,5]){
 const {input,output,engine}=render(frequency,semi),target=frequency*2**(semi/12);let best=0,actual=0;
 const step=target*.0002;
 for(let f=target*.98;f<target*1.02;f+=step){const energy=power(output,f);if(energy>best){best=energy;actual=f;}}
 const cents=1200*Math.log2(actual/target);assert(Math.abs(cents)<25,JSON.stringify({frequency,semi,cents,actual,target}));
 if(!semi)for(let i=engine.delay;i<count;i++)assert.equal(output[i],input[i-engine.delay],'original key bypass is sample-exact');
 measured.push(Math.abs(cents));
}
for(const semi of [-6,-2,0,2,5]){
 const {output}=render(110,semi,true),starts=[];let previous=-rate;
 for(let i=0;i<count;i++)if(Math.abs(output[i])>.05&&i-previous>rate*.5){starts.push(i/rate);previous=i;}
 assert.equal(starts.length,seconds,'no phrases disappear or gain an extra repeat');
 starts.forEach((time,i)=>assert(Math.abs(time-i-.18)<.055,'source attacks retain their timeframe'));
 assert(Math.abs(starts.at(-1)-starts[1]-3)<.035,'no accumulating tempo drift');
}
const sample=(amplitude=0)=>({sampleRate:rate,length:rate,numberOfChannels:2,getChannelData:()=>Float32Array.from({length:rate},(_,i)=>amplitude*Math.sin(i/rate*2*Math.PI*110))});
assert.equal(D.normalisation(sample()),1,'silence stays silent');
const quiet=sample(.03),gain=D.normalisation(quiet);assert(gain>5&&gain<=8,'quiet recordings become clearly audible');
assert(Math.abs(gain*.03/Math.SQRT2-.16)<.001,'normalisation precedes user faders');
for(const mode of ['major','minor'])for(let key=0;key<12;key++)assert(D.keyLabel(key,mode).length<=12);
assert.equal(D.keyLabel(8),'Key: Ab Maj');
const original={tonic:0,bass:[{midi:36,beat:0,length:1}],chords:[{midi:60,beat:0,length:2}]},saved=JSON.stringify(original);
for(let key=0;key<12;key++){const semi=D.shift(0,key),plan=D.transposePlan(original,semi);assert.equal(plan.bass[0].midi,36+semi);assert.equal(plan.chords[0].midi,60+semi);assert.equal(plan.tonic,key);assert.equal(plan.bass[0].beat,0);assert.equal(plan.bass[0].length,1);}
assert.equal(JSON.stringify(original),saved,'key edits cannot overwrite the original transcription');
// The existing limiter still normalises the main player, while the new Ear
// bus only limits peaks and cannot raise a user-muted or deliberately low part.
const html=fs.readFileSync('index.html','utf8'),levelCode=html.slice(html.indexOf('window.BassAutoLevel='),html.indexOf('</script>',html.indexOf('window.BassAutoLevel=')));
const env={window:{},WeakMap,Float32Array,Float64Array,Math};vm.runInNewContext(levelCode,env);
const engine=new env.window.BassAutoLevel.LevelEngine(rate,false),left=new Float32Array(rate),out=new Float32Array(rate);left.fill(3);engine.process([left,left],[out,new Float32Array(rate)]);
assert(Math.max(...out)<.892&&Math.max(...out)>.88,'loud combined stems cannot clip');assert.equal(engine.gain,1,'the limiter does not undo the faders');
const silence=new Float32Array(rate);engine.process([silence,silence],[out,new Float32Array(rate)]);assert(out.subarray(rate/2).every(x=>x===0));
console.log(JSON.stringify({passed:true,pitchedWaveforms:measured.length,maxPitchErrorCents:Math.round(Math.max(...measured)*10)/10,stereoLocked:true,originalKeySampleExact:true,unchangedTimeframes:true,quietAudioGain:gain,limiterCeilingDb:-1,mutedSilence:true,keyLabelsWithin12:true,sourceNotesUnchanged:true}));
