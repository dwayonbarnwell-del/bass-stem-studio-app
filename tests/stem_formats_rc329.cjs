// Exercise the same encoder worker code used during a project migration.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const dir=path.resolve(__dirname,'../fretflow-source');
const context=vm.createContext({URL,Blob,Int16Array,Int32Array,Uint8Array,DataView,console});
context.self=context;context.location={href:'file://'+dir+'/stem-encoder.js'};
context.importScripts=file=>{
 const source=path.resolve(dir,file);
 if(file.includes('libflac')){
  process.env.FLAC_SCRIPT_LOCATION=path.dirname(source);
  // Load the local WASM through Node's filesystem.
  global.fetch=undefined;context.Flac=require(source);
 }else vm.runInContext(fs.readFileSync(source,'utf8'),context);
};
vm.runInContext(fs.readFileSync(path.join(dir,'stem-encoder.js'),'utf8'),context);
(async()=>{
 const frames=44101,pcm=new Int16Array(frames*2),h=Buffer.alloc(44);
 for(let i=0;i<frames;i++){pcm[2*i]=Math.round(20000*Math.sin(i*.013));pcm[2*i+1]=Math.round(16000*Math.sin(i*.019));}
 h.write('RIFF');h.writeUInt32LE(36+pcm.byteLength,4);h.write('WAVEfmt ',8);h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(2,22);h.writeUInt32LE(44100,24);h.writeUInt32LE(176400,28);h.writeUInt16LE(4,32);h.writeUInt16LE(16,34);h.write('data',36);h.writeUInt32LE(pcm.byteLength,40);
 const wav=new Blob([h,pcm]),flac=await context.encodeStem(wav,'audio/flac');
 assert(flac.blob.size<wav.size);
 const decoded=await context.decodeFlac(flac.blob,frames);
 assert.deepEqual(Buffer.from(await decoded.blob.arrayBuffer()),Buffer.from(pcm.buffer));
 await assert.rejects(context.decodeFlac(flac.blob,frames+1));
 const mp3=await context.encodeStem(wav,'audio/mpeg');
 assert.equal(mp3.frames,frames);assert(mp3.blob.size>1000&&mp3.blob.size<wav.size);
 console.log('PASS lossless stereo samples, exact sample count, incorrect length rejection and MP3 encoding');
})().catch(error=>{console.error(error);process.exitCode=1;});
