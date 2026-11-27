/* Independent stems, a fixed pitch clock and peak limiting for Ear Training. */
window.BassEarAudio=(()=>{
 'use strict';
 const DSP=globalThis.BassEarDSP,graphs=new WeakMap(),defaults=Object.freeze({bass:1,drums:.21,chords:.07,voice:.21});
 let model='',worker,idleTimer,PitchEngine,queue=Promise.resolve();const loads=new Map();
 function configure(options){model=options.model;}
 async function prepare(ctx){
  let state=graphs.get(ctx);if(state?.ready)return state.ready;
  if(!state){const input=ctx.createGain();state={input,worklet:false,ready:null};graphs.set(ctx,state);state.limiter=window.BassAutoLevel.attach(ctx,input,ctx.destination,{normalise:'ear'});}
  const limiter=state.limiter;
  state.ready=(async()=>{
   await limiter.ready;
   PitchEngine=(await import('./pitch-engine-rc361.mjs')).PitchEngine;
   if(ctx.audioWorklet&&typeof AudioWorkletNode!=='undefined')try{await ctx.audioWorklet.addModule('./ear-source/pitch-worklet-rc361.js?v=rc368');state.worklet=true;}catch{}
   return state;
  })().catch(error=>{state.ready=null;throw error;});return state.ready;
 }
 function mixer(ctx,{semitones=0,fixedKey=false}={}){
  const state=graphs.get(ctx);if(!state)throw Error('Audio is not ready');
  const master=ctx.createGain(),pitched=ctx.createGain(),drums=ctx.createDelay(.5),guide=ctx.createDelay(.5);
  const direct=fixedKey && semitones===0;
  const engine=!direct && !state.worklet ? new PitchEngine(ctx.sampleRate,semitones) : null;
  const latency=.18;
  let pitch;
  const extra=state.worklet?0:1024/ctx.sampleRate;
  drums.delayTime.value=guide.delayTime.value=latency+extra;
  if(direct){pitch=ctx.createDelay(.5);pitch.delayTime.value=latency+extra;}
  else if(state.worklet){pitch=new AudioWorkletNode(ctx,'bass-ear-pitch-rc361',{outputChannelCount:[2],channelCount:2,channelCountMode:'explicit',parameterData:{semitones}});}
  else{pitch=ctx.createScriptProcessor(1024,2,2);pitch.onaudioprocess=e=>engine.process([e.inputBuffer.getChannelData(0),e.inputBuffer.getChannelData(1)],[e.outputBuffer.getChannelData(0),e.outputBuffer.getChannelData(1)],semitones);}
  pitched.connect(pitch).connect(master);drums.connect(master);guide.connect(master);master.connect(state.input);
  const proxy={get currentTime(){return ctx.currentTime;},get sampleRate(){return ctx.sampleRate;},destination:guide};
  for(const name of ['createBufferSource','createGain','createBiquadFilter','createBuffer'])proxy[name]=(...args)=>ctx[name](...args);
  return {master,pitched,drums,guide,context:proxy,get latency(){return latency+.01+extra+(state.limiter.mode==='compatible'?1024/ctx.sampleRate:0);},setSemitones(value){semitones=value;pitch.parameters?.get('semitones').setTargetAtTime(value,ctx.currentTime,.012);},disconnect(){if(pitch.port){pitch.port.postMessage('stop');pitch.port.close();}if(engine)pitch.onaudioprocess=null;for(const n of [pitched,pitch,drums,guide,master])n.disconnect();}};
 }
 function buffer(ctx,channels,rate=ctx.sampleRate){const out=ctx.createBuffer(channels.length,channels[0].length,rate);channels.forEach((data,c)=>out.copyToChannel(data,c));return out;}
 function stereo(ctx,source,first=0){return buffer(ctx,[source.getChannelData(first),source.getChannelData(Math.min(first+1,source.numberOfChannels-1))],source.sampleRate);}
 async function cache(key,value){
  if(!key||typeof indexedDB==='undefined')return null;
  const limit=96*1024*1024,bytes=value?(value.channels||value.drums||[]).reduce((sum,c)=>sum+c.byteLength,0):0;
  if(bytes>limit)return null;
  const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('bass-ear-stems-v1',2);request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains('audio'))db.createObjectStore('audio');else request.transaction.objectStore('audio').clear();if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta');};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  try{return await new Promise((resolve,reject)=>{
   const tx=db.transaction(value?['audio','meta']:['audio'],value?'readwrite':'readonly'),audio=tx.objectStore('audio');
   tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Cache unavailable'));
   if(!value){const request=audio.get(key);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);return;}
   const meta=tx.objectStore('meta'),request=meta.getAll();
   request.onsuccess=()=>{const rows=request.result.filter(row=>row.key!==key).sort((a,b)=>a.at-b.at);let total=rows.reduce((sum,row)=>sum+row.bytes,0)+bytes;for(const row of rows){if(total<=limit)break;audio.delete(row.key);meta.delete(row.key);total-=row.bytes;}audio.put(value,key);meta.put({key,bytes,at:Date.now()},key);};
   tx.oncomplete=()=>resolve(value);
  });}finally{db.close();}
 }

 async function separate(ctx,source,{key='',progress=()=>{},cancelled=()=>false}={}){
  const identity=key+':'+source.sampleRate+':'+source.length;
  if(key&&loads.has(identity))return loads.get(identity);
  const run=(async()=>{
   const stored=key?await cache(identity).catch(()=>null):null;if(cancelled())return null;
   if(stored?.channels?.length===8)return buffer(ctx,stored.channels,stored.rate);
   if(!model)throw Error('Voice separation is unavailable');
   const offline=new OfflineAudioContext(2,Math.round(source.duration*44100),44100),node=offline.createBufferSource();node.buffer=source;node.connect(offline.destination);node.start();
   const resampled=await offline.startRendering();if(cancelled())return null;
   const samples=[resampled.getChannelData(0).slice(),resampled.getChannelData(1).slice()];
   const job=queue.then(()=>new Promise((resolve,reject)=>{
    if(cancelled()){resolve(null);return;}
    clearTimeout(idleTimer);worker??=new Worker('./fretflow-source/practice-stems.js?v=rc361');const current=worker;
    const interval=setInterval(()=>{if(cancelled()){current.terminate();if(worker===current)worker=null;finish(null);}},150);
    function finish(value,error){clearInterval(interval);current.onmessage=current.onerror=null;if(worker===current)idleTimer=setTimeout(()=>{if(worker===current){current.terminate();worker=null;}},60000);error?reject(error):resolve(value);}
    current.onmessage=({data})=>{if(data.error)finish(null,Error(data.error));else if(data.channels)finish(data.channels);else if(data.progress!==undefined)progress(data.progress);};
    current.onerror=()=>{current.terminate();if(worker===current)worker=null;finish(null,Error('Voice separation is unavailable'));};
    current.postMessage({model,samples,stem:'mixer'},samples.map(c=>c.buffer));
   }));queue=job.catch(()=>{});
   const channels=await job;if(!channels||cancelled())return null;
   const audio=buffer(ctx,channels,44100);if(key)void cache(identity,{channels,rate:44100}).catch(()=>{});return audio;
  })();
  if(key){loads.set(identity,run);while(loads.size>2)loads.delete(loads.keys().next().value);run.catch(()=>loads.delete(identity));run.then(value=>{if(!value)loads.delete(identity);},()=>{});}
  return run;
 }
 async function recording(ctx,source,options){
  if(source.numberOfChannels===8)return source;
  if(source.numberOfChannels!==6)return separate(ctx,source,options);
  const full=ctx.createBuffer(2,source.length,source.sampleRate);
  for(let c=0;c<2;c++){const out=full.getChannelData(c);for(let i=0;i<source.length;i++)out[i]=source.getChannelData(c)[i]+source.getChannelData(c+2)[i]+source.getChannelData(c+4)[i];}
  const isolated=await separate(ctx,full,options);if(!isolated)return null;
  const offline=new OfflineAudioContext(2,isolated.length,isolated.sampleRate),node=offline.createBufferSource();node.buffer=stereo(ctx,source);node.connect(offline.destination);node.start();const original=await offline.startRendering();
  const summed=new OfflineAudioContext(2,isolated.length,isolated.sampleRate),sumNode=summed.createBufferSource();sumNode.buffer=full;sumNode.connect(summed.destination);sumNode.start();const mix=await summed.startRendering();
  // Preserve the original isolated bass and the exact sum of the source stems.
  for(let c=0;c<2;c++){const bass=isolated.getChannelData(c),other=isolated.getChannelData(c+4),drums=isolated.getChannelData(c+2),voice=isolated.getChannelData(c+6),old=original.getChannelData(c),total=mix.getChannelData(c);for(let i=0;i<isolated.length;i++){bass[i]=old[i];other[i]=total[i]-old[i]-drums[i]-voice[i];}}
  return isolated;
 }
 async function bandStems(source,cancelled=()=>false,cachedDrums=null){
  const rate=32000,frames=Math.round(source.duration*rate),offline=new OfflineAudioContext(6,frames,rate),node=offline.createBufferSource();
  node.buffer=source;node.connect(offline.destination);node.start();const reduced=await offline.startRendering();if(cancelled())return null;
  const channels=[reduced.getChannelData(0).slice(),reduced.getChannelData(1).slice()];
  const parts=cachedDrums?cachedDrums.concat(channels.map((data,c)=>Float32Array.from(data,(x,i)=>x-cachedDrums[c][i]))):await new Promise((resolve,reject)=>{
   const worker=new Worker('./ear-source/band-split-worker-rc361.js');
   const watch=setInterval(()=>{if(cancelled()){clearInterval(watch);worker.terminate();resolve(null);}},150);
   worker.onmessage=({data})=>{clearInterval(watch);worker.terminate();data.error?reject(Error(data.error)):resolve(data.channels);};
   worker.onerror=()=>{clearInterval(watch);worker.terminate();reject(Error('Band controls unavailable'));};
   worker.postMessage({channels,rate},channels.map(c=>c.buffer));
  });if(!parts||cancelled())return null;
  return [reduced.getChannelData(2),reduced.getChannelData(3),parts[0],parts[1],parts[2],parts[3],reduced.getChannelData(4),reduced.getChannelData(5)];
 }
 return {configure,prepare,mixer,buffer,stereo,separate,recording,bandStems,drumCache:(key,value)=>cache('drums:'+key,value),normalisation:DSP.normalisation,keyLabel:DSP.keyLabel,shift:DSP.shift,transposePlan:DSP.transposePlan,defaults};
})();
