const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('ear-source/ear-audio-rc361.js','utf8');
async function audioPreparationRetry(){
 let imports=0,connections=0,disconnections=0;
 const node=()=>({connect(){connections++;return this;},disconnect(){disconnections++;}}),ctx={destination:{},createGain:node};
 const window={BassAutoLevel:{attach:()=>({ready:Promise.resolve()})}},env={window,WeakMap,Map,Promise,globalThis:{BassEarDSP:{}},__loadPitch:async()=>{if(++imports===1)throw Error('Temporary module failure');return {PitchEngine:class{}};}};
 vm.runInNewContext(source.replace("import('./pitch-engine-rc361.mjs')",'__loadPitch()'),env);
 await assert.rejects(window.BassEarAudio.prepare(ctx),/Temporary module failure/);
 await window.BassEarAudio.prepare(ctx);
 assert.equal(imports,2,'a temporary import failure must not remain cached forever');
 const ready=await window.BassEarAudio.prepare(ctx);assert(ready);assert.equal(imports,2,'successful preparation is reused');
 console.log('PASS failed audio-module loading can be retried, then successful preparation is reused.');
}
audioPreparationRetry().catch(e=>{console.error(e);process.exitCode=1;});

async function separationRecovery(){
 const workers=[];let intervals=new Map(),next=0;
 class Worker{constructor(){workers.push(this);}postMessage(){this.posted=true;}terminate(){this.terminated=true;}}
 const makeBuffer=(n,length,rate)=>{const pcm=Array.from({length:n},()=>new Float32Array(length));return {length,sampleRate:rate,duration:length/rate,numberOfChannels:n,getChannelData:c=>pcm[c],copyToChannel:(x,c)=>pcm[c].set(x)};};
 const ctx={createBuffer:makeBuffer},sourceAudio=makeBuffer(2,4410,44100);
 const env={window:{},globalThis:{BassEarDSP:{}},Worker,OfflineAudioContext:class{constructor(n,length,rate){this.output=makeBuffer(n,length,rate);}createBufferSource(){return {connect(){},start(){}};}async startRendering(){return this.output;}},setInterval(fn){intervals.set(++next,fn);return next;},clearInterval:id=>intervals.delete(id),setTimeout:()=>0,clearTimeout(){},Float32Array,Map,WeakMap,Promise};
 vm.runInNewContext(source,env);const E=env.window.BassEarAudio;E.configure({model:'fixture-model'});
 const flush=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};
 const complete=worker=>worker.onmessage({data:{channels:Array.from({length:8},()=>new Float32Array(4410))}});
 let cancelled=false;
 const cancelledJob=E.separate(ctx,sourceAudio,{key:'one',cancelled:()=>cancelled});await flush();
 assert.equal(workers.length,1);cancelled=true;for(const fn of [...intervals.values()])fn();assert.equal(await cancelledJob,null);assert(workers[0].terminated);assert.equal(intervals.size,0);
 const retry=E.separate(ctx,sourceAudio,{key:'one'});await flush();assert.equal(workers.length,2);complete(workers[1]);assert.equal((await retry).numberOfChannels,8);assert.equal(intervals.size,0);
 const concurrent=Array.from({length:12},()=>E.separate(ctx,sourceAudio,{key:'two'}));await flush();assert.equal(workers.length,2,'reuse the healthy worker');complete(workers[1]);
 const values=await Promise.all(concurrent);assert(values.every(v=>v===values[0]),'one inference per concurrent source');
 const failed=E.separate(ctx,sourceAudio,{key:'three'});await flush();workers[1].onerror();await assert.rejects(failed,/unavailable/);assert(workers[1].terminated);assert.equal(intervals.size,0);
 const recovered=E.separate(ctx,sourceAudio,{key:'three'});await flush();assert.equal(workers.length,3);complete(workers[2]);assert.equal((await recovered).numberOfChannels,8);
 console.log('PASS cancelled inference releases workers; retries, concurrent requests and worker-crash recovery succeed.');
}
separationRecovery().catch(e=>{console.error(e);process.exitCode=1;});
