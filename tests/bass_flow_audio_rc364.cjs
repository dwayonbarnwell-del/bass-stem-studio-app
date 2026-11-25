const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),cp=require('node:child_process');
const rate=44100,samples=Float32Array.from({length:rate*2},(_,i)=>.7*Math.sin(2*Math.PI*440*i/rate));
const env={window:{BassPianoSamples:{bass:{69:'data:audio/mp3;base64,AA=='}}},atob,Blob,DataView,Uint8Array,Int16Array,Float32Array,WeakMap,Math,Array,setTimeout};vm.createContext(env);
vm.runInContext(fs.readFileSync('ai-source/piano-audio.js','utf8'),env);vm.runInContext(fs.readFileSync('vendor/lamejs/lame.min.js','utf8'),env);
const audio=env.window.BassPianoAudio,context={decodeAudioData:async()=>({numberOfChannels:1,length:samples.length,sampleRate:rate,getChannelData:()=>samples}),createBuffer:()=>({copyToChannel(){}})};
const frequency=x=>{let crossings=0;for(let i=1;i<x.length;i++)if(x[i-1]<0&&x[i]>=0)crossings++;return crossings*rate/x.length;};
(async()=>{
 await audio.prepare('bass',context);const notes=[{midi:18,start:.2,end:.8,velocity:80}];
 const pcm=audio.pcm(notes,0,rate,rate,'bass');assert(pcm.some(v=>Math.abs(v)>.2));assert(pcm.every(Number.isFinite));assert(pcm.every(v=>Math.abs(v)<=.95));assert(Math.abs(frequency(pcm.subarray(.25*rate,.75*rate))-23.12465)<3);
 const wav=await audio.exportAudio({notes,start:0,end:1,sound:'bass',format:'wav'});assert.equal(wav.size,88244);
 const mp3=await audio.exportAudio({notes,start:0,end:1,sound:'bass',format:'mp3',encoder:async()=>env.lamejs});assert(mp3.size>10000);
 const decoded=cp.spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-i','pipe:0','-f','f32le','-ac','1','-ar',String(rate),'pipe:1'],{input:Buffer.from(await mp3.arrayBuffer()),maxBuffer:1024*1024});assert.equal(decoded.status,0,decoded.stderr.toString());const bytes=decoded.stdout,copy=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),roundtrip=new Float32Array(copy);assert(roundtrip.some(v=>Math.abs(v)>.1));assert(Math.abs(frequency(roundtrip.subarray(.25*rate,.75*rate))-23.12465)<3);
 const midi=new Uint8Array(await audio.midi(notes,0,1,'bass').arrayBuffer());assert(midi.some((v,i)=>v===0x90&&midi[i+1]===18));
 console.log('PASS downward-transposed bass below A0 stays audible and pitched correctly in PCM, WAV, real MP3 encode/decode and MIDI.');
})().catch(e=>{console.error(e);process.exitCode=1;});
