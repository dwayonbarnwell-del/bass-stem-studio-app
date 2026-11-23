// Decode each real FLAC and run the same calibration and stretch code as the
// browser. The companion signal test checks the audible phrase repetitions.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import vm from 'node:vm';
import {stretchLoop} from '../ear-source/drum-stretch-rc294.mjs';

const rate=10000;
class StretchWorker {
 postMessage({channels,sampleRate,frames,beats}){
  this.onmessage({data:{channels:stretchLoop(channels,sampleRate,frames,beats)}});
 }
 terminate(){}
}
function buffer(channels,length){
 const samples=Array.from({length:channels},()=>new Float32Array(length));
 return {numberOfChannels:channels,length,duration:length/rate,
  getChannelData:c=>samples[c],copyToChannel:(data,c)=>samples[c].set(data)};
}
const context={sampleRate:rate,createBuffer:buffer,async decodeAudioData(bytes){
 const samples=new Float32Array(bytes),out=buffer(1,samples.length);
 out.copyToChannel(samples,0);return out;
}};
const env=vm.createContext({window:{},Worker:StretchWorker,setTimeout,clearTimeout,fetch:async file=>({
 ok:true,async arrayBuffer(){
  const data=execFileSync('ffmpeg',['-v','error','-i',file,'-ar',String(rate),'-ac','1','-f','f32le','-'],{maxBuffer:8e6});
  return data.buffer.slice(data.byteOffset,data.byteOffset+data.length);
 }
})});
for(const name of ['drum-loops-data-rc294','supplied-drums-rc294']){
 vm.runInContext(fs.readFileSync('ear-source/'+name+'.js','utf8'),env);
}
const drums=env.window.BassSuppliedDrums;
const directory=process.argv[2];
if(!directory)throw Error('Run python tests/drum_alignment_rc333.py');
for(const loop of drums.loops)for(const bpm of [77,113,150]){
 const beat=Math.round(rate*60/bpm),audio=await drums.render(context,loop,beat);
 assert.equal(audio.length,beat*loop.beats);
 const samples=audio.getChannelData(0);assert(samples.every(Number.isFinite));
 fs.writeFileSync(directory+'/'+loop.id+'-'+bpm+'.raw',Buffer.from(samples.buffer));
}
