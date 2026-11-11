// Real encoder/decoder regression. Web Audio resampling is supplied by FFmpeg
// in this Node harness. Set LAME_JS_PATH to the app's LameJS build.
const fs=require('node:fs'),vm=require('node:vm');
const {spawnSync}=require('node:child_process');
const assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const functions=html.slice(html.indexOf('  function pcmFloatToInt16('),html.indexOf('  async function prepareAudioForRunPod('));
const lamePath=process.env.LAME_JS_PATH;
if(!lamePath)throw Error('Set LAME_JS_PATH to the same LameJS build used by the app.');
function ffmpeg(args,input){const r=spawnSync('ffmpeg',['-v','error',...args],{input,maxBuffer:20*1024*1024});assert.equal(r.status,0,String(r.stderr));return r.stdout;}
class BufferAudio{
 constructor(channels,length,sampleRate){this.numberOfChannels=channels;this.length=length;this.sampleRate=sampleRate;this.duration=length/sampleRate;this.data=Array.from({length:channels},()=>new Float32Array(length));}
 getChannelData(ch){return this.data[ch];}
}
class OfflineAudioContext{
 constructor(channels,length,rate){this.channels=channels;this.length=length;this.rate=rate;this.destination={};}
 createBufferSource(){this.source={connect:()=>{},start:(_when,from,duration)=>{this.from=from;this.duration=duration;}};return this.source;}
 async startRendering(){
  const output=new BufferAudio(this.channels,this.length,this.rate),input=this.source.buffer;
  for(let ch=0;ch<this.channels;ch++){
   const src=input.getChannelData(ch).subarray(Math.floor(this.from*input.sampleRate),Math.floor((this.from+this.duration)*input.sampleRate));
   const raw=ffmpeg(['-f','f32le','-ar',String(input.sampleRate),'-ac','1','-i','pipe:0','-ar',String(this.rate),'-f','f32le','pipe:1'],Buffer.from(src.buffer,src.byteOffset,src.byteLength));
   output.data[ch].set(new Float32Array(raw.buffer.slice(raw.byteOffset,raw.byteOffset+Math.min(raw.byteLength,this.length*4))));
  }
  return output;
 }
}
(async()=>{
 const ctx={Blob,performance,setTimeout,OfflineAudioContext,songSession:1,assertSongSession:()=>{},aiStatus:()=>{},clamp:(v,a,z)=>Math.max(a,Math.min(z,v))};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(lamePath,'utf8'),ctx);ctx.ensureLargeSongEncoder=async()=>ctx.lamejs;vm.runInContext(functions,ctx);
 let count=0;
 for(const sr of [44100,48000])for(const kbps of [32,40,48,56,64,80,192]){
  const input=new BufferAudio(2,sr*4,sr);
  for(let ch=0;ch<2;ch++)for(let i=sr;i<sr*3;i++)input.data[ch][i]=.4*Math.sin(2*Math.PI*(ch?220:110)*i/sr);
  const encoded=await ctx.encodeAudioBufferForAnalysis(input,kbps,1,3);
  const raw=ffmpeg(['-i','pipe:0','-ac','2','-ar',String(sr),'-f','f32le','pipe:1'],Buffer.from(await encoded.arrayBuffer()));
  const samples=new Float32Array(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));
  const duration=samples.length/(2*sr);
  assert.ok(duration>=1.9&&duration<2.3,`duration ${duration} at ${sr}/${kbps}`);
  for(let ch=0;ch<2;ch++){
   let sum=0;for(let i=ch;i<samples.length;i+=2)sum+=samples[i]**2;
   const rms=Math.sqrt(sum/(samples.length/2));
   assert.ok(rms>.2&&rms<.35,`silent or corrupt channel ${ch}: RMS ${rms} at ${sr}/${kbps}`);
  }
  count++;
 }
 console.log(`PASS ${count} real MP3 encode/decode cases: audible stereo and correct excerpt duration. Web Audio resampling stubbed with FFmpeg.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
