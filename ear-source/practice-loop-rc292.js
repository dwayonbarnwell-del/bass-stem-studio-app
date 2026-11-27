/* Render once, then loop on the audio clock. UI timers never schedule sound. */
window.BassPracticeLoop=(()=>{
 'use strict';
 const tail=3;
 let recordingKey,recordingLoad;
 async function recordedBass(context,plan,frames,cancelled){
  const {firstByte,lastByte,offset,step,beats}=plan.recording;
  const key=[plan.audio,firstByte,lastByte,context.sampleRate].join(':');
  if(key!==recordingKey){
   recordingKey=key;
   recordingLoad=(async()=>{
    const response=await fetch(plan.audio,{headers:{Range:'bytes='+firstByte+'-'+lastByte}});
    const expected='bytes '+firstByte+'-'+lastByte+'/';
    if(response.status!==206||!response.headers.get('Content-Range')?.startsWith(expected)){
     await response.body?.cancel();
     throw Error('Recording excerpt unavailable');
    }
    return context.decodeAudioData(await response.arrayBuffer());
   })().catch(error=>{if(recordingKey===key)recordingKey=null;throw error;});
  }
  const audio=await recordingLoad;
  if(cancelled())return null;
  const rate=context.sampleRate,start=Math.round(offset*rate),end=start+Math.round(step*beats*rate);
  if(end>audio.length)throw Error('Recording excerpt is incomplete');
  let channels=Array.from({length:audio.numberOfChannels},(_,c)=>audio.getChannelData(c).subarray(start,end));
  if(end-start!==frames){
   const {stretchLoop}=await import('./drum-stretch-rc294.mjs');
   if(cancelled())return null;
   channels=stretchLoop(channels,rate,frames,beats).slice(0,audio.numberOfChannels);
  }
  const output=context.createBuffer(channels.length,frames,rate),fade=Math.round(rate*.004);
  for(let c=0;c<channels.length;c++){
   output.copyToChannel(channels[c],c);
   const samples=output.getChannelData(c);
   for(let i=0;i<fade;i++){const gain=i/fade;samples[i]*=gain;samples[frames-i-1]*=gain;}
  }
  return output;
 }
 let phraseKey,phraseLoad;
 async function phraseAudio(context,recording,frames,cancelled){
  const {pack,offset,bytes}=recording,key=[pack,offset,context.sampleRate].join(':');
  if(phraseKey!==key){
   phraseKey=key;
   phraseLoad=(async()=>{
    const response=await fetch(pack,{headers:{Range:'bytes='+offset+'-'+(offset+bytes-1)}});
    if(!response.ok)throw Error('Recorded phrase unavailable');
    const data=await response.arrayBuffer();
    const slice=response.status===206?data:data.slice(offset,offset+bytes);
    if(slice.byteLength!==bytes)throw Error('Incomplete recorded phrase');
    const audio=await context.decodeAudioData(slice);
    if(audio.numberOfChannels!==3)throw Error('Incomplete recording mix');
    return audio;
   })().catch(error=>{if(phraseKey===key)phraseKey=null;throw error;});
  }
  const audio=await phraseLoad;if(cancelled())return null;
  let channels=Array.from({length:3},(_,i)=>audio.getChannelData(i));
  if(audio.length!==frames){
   channels=await new Promise((resolve,reject)=>{
    const worker=new Worker('./ear-source/drum-stretch-worker-rc294.js?v=rc334',{type:'module'});
    worker.onmessage=({data})=>{worker.terminate();data.error?reject(Error(data.error)):resolve(data.channels);};
    worker.onerror=()=>{worker.terminate();reject(Error('Phrase tempo unavailable'));};
    const copy=channels.map(x=>x.slice());
    worker.postMessage({channels:copy,sampleRate:context.sampleRate,frames,beats:recording.beats},copy.map(x=>x.buffer));
   });
  }
  if(cancelled())return null;
  return channels.map(data=>{const out=context.createBuffer(1,frames,context.sampleRate);out.copyToChannel(data,0);return out;});
 }
 const originalBuffers=new Map(),separatedBuffers=new Map();
 let selected=null,warmTimer;
 function recordingURL(path){
  return (window.BassPracticeMixAssets?.[path]||window.BassWorldMethodMixes?.[path]||window.BassCulturalMixes?.[path])?.url||path;
 }
 async function bytes(path,signal){
  const immutable=/[0-9a-f]{12,}(?:-mix)?\.(?:flac|ogg)$/i.test(path);
  const response=await fetch(path,{signal,cache:immutable?'force-cache':'default'});
  if(!response.ok)throw Error('Recording unavailable');
  return response.arrayBuffer();
 }
 function selectRecording(path){
  if(selected?.path===path)return;
  clearTimeout(warmTimer);selected?.controller.abort();selected=null;
  if(!path)return;
  const url=recordingURL(path),entry={path,url,controller:new AbortController(),request:null};
  selected=entry;
  if([...originalBuffers.keys()].some(key=>key.startsWith(url+':')))return;
  warmTimer=setTimeout(()=>{
   if(selected!==entry||entry.request)return;
   entry.request=bytes(url,entry.controller.signal);
   entry.request.catch(()=>{if(selected===entry)entry.request=null;});
  },100);
 }
 async function recordingVoice(context,audio,cancelled){
  if(audio.numberOfChannels===8)return audio;
  const packed=audio.numberOfChannels===6,first=packed?4:0;
  const left=audio.getChannelData(first).slice(),right=audio.getChannelData(Math.min(first+1,audio.numberOfChannels-1)).slice();
  const vocal=await new Promise((resolve,reject)=>{
   const worker=new Worker('./ear-source/recording-voice-worker.js?v=rc383');
   const finish=()=>{clearInterval(watch);worker.terminate();};
   const watch=setInterval(()=>{if(cancelled()){finish();resolve(null);}},100);
   worker.onmessage=({data})=>{finish();data.error?reject(Error(data.error)):resolve(data.vocal);};
   worker.onerror=()=>{finish();reject(Error('Voice adjustment unavailable'));};
   worker.postMessage({left,right,rate:audio.sampleRate},[left.buffer,right.buffer]);
  });
  if(!vocal||cancelled())return null;
  const out=context.createBuffer(8,audio.length,audio.sampleRate);
  if(packed)for(let c=0;c<4;c++)out.copyToChannel(audio.getChannelData(c),c);
  for(let c=0;c<2;c++){
   const input=audio.getChannelData(Math.min(first+c,audio.numberOfChannels-1)),backing=out.getChannelData(first+c);
   for(let i=0;i<input.length;i++)backing[i]=input[i]-vocal[i];
   out.copyToChannel(vocal,6+c);
  }
  return out;
 }
 async function originalMix(context,plan,frames,cancelled,progress,isolateVoice,naturalBalance){
  const url=recordingURL(plan.audio),key=url+':'+context.sampleRate;
  if(!originalBuffers.has(key)){
   const entry=selected?.path===plan.audio?selected:null,signal=entry?.controller.signal;
   clearTimeout(warmTimer);
   const task=(async()=>{
    for(const path of new Set([url,plan.audio])){
     try{
      const pending=path===url&&entry?.request;
      if(pending)entry.request=null;
      const data=await (pending||bytes(path,signal));
      if(signal?.aborted)throw new DOMException('Selection changed','AbortError');
      const decoded=await context.decodeAudioData(data);
      if(path===url&&url!==plan.audio&&decoded.numberOfChannels<6)throw Error('Recorded stems were downmixed');
      return decoded;
     }catch(error){if(signal?.aborted||path===plan.audio)throw error;}
    }
   })();
   originalBuffers.set(key,task);
   task.catch(()=>{if(originalBuffers.get(key)===task)originalBuffers.delete(key);});
  }
  let audio=await originalBuffers.get(key);
  while(originalBuffers.size>3)originalBuffers.delete(originalBuffers.keys().next().value);
  if(cancelled())return null;
  if(isolateVoice&&window.BassEarAudio){
   const original=audio;
   const voiceKey=key+(naturalBalance?':natural':':model');
   try{
   if(!separatedBuffers.has(voiceKey)){
    const task=naturalBalance?recordingVoice(context,audio,cancelled):window.BassEarAudio.recording(context,audio,{key:url,progress,cancelled});separatedBuffers.set(voiceKey,task);
    task.then(value=>{if(!value)separatedBuffers.delete(voiceKey);},()=>separatedBuffers.delete(voiceKey));
   }
   audio=await separatedBuffers.get(voiceKey);if(cancelled())return null;if(!audio){separatedBuffers.delete(voiceKey);audio=original;}
   while(separatedBuffers.size>2)separatedBuffers.delete(separatedBuffers.keys().next().value);
   }catch(error){if(cancelled())return null;separatedBuffers.delete(voiceKey);audio=original;}
  }
  if(audio.sampleRate!==context.sampleRate){const off=new OfflineAudioContext(audio.numberOfChannels,Math.round(audio.duration*context.sampleRate),context.sampleRate),node=off.createBufferSource();node.buffer=audio;node.connect(off.destination);node.start();audio=await off.startRendering();if(cancelled())return null;}
  if(Math.abs(audio.length-frames)<context.sampleRate*.001)return audio;
  const channels=Array.from({length:audio.numberOfChannels},(_,i)=>audio.getChannelData(i).slice());
  const data=await new Promise((resolve,reject)=>{
   const worker=new Worker('./ear-source/loop-tempo-worker.js');
   const timeout=setTimeout(()=>{worker.terminate();reject(Error('Phrase tempo took too long'));},45000);
   worker.onmessage=({data})=>{clearTimeout(timeout);worker.terminate();data.error?reject(Error(data.error)):resolve(data.channels);};
   worker.onerror=()=>{clearTimeout(timeout);worker.terminate();reject(Error('Phrase tempo unavailable'));};
   worker.postMessage({channels,frames,sampleRate:context.sampleRate},channels.map(x=>x.buffer));
  });
  if(cancelled())return null;
  const output=context.createBuffer(data.length,frames,context.sampleRate);
  data.forEach((d,i)=>output.copyToChannel(d,i));return output;
 }
 async function render(context,plan,{drums=true,loop=null,style='worship',sound='piano',chords=true,recorded=false,originalDrums=true,originalKeys=true,naturalBalance=false,isolateVoice=false,assignedPhase,cancelled=()=>false,sourceCancelled=cancelled,progress=()=>{}}={}){
  const A=window.BassPracticeAudio,D=window.BassSuppliedDrums,rate=context.sampleRate,beatFrames=Math.round(60/plan.bpm*rate),frames=Math.round(plan.beats*beatFrames),seconds=frames/rate;
  if(!Number.isFinite(seconds)||seconds<=0||seconds>240)throw Error('Practice loop is too long');
  if(recorded&&plan.recording?.originalMix){
   const buffer=await originalMix(context,plan,frames,sourceCancelled,progress,isolateVoice,naturalBalance);
   if(!buffer)return null;
   const stems={};
   if([6,8].includes(buffer.numberOfChannels)){
    for(const [index,part] of (buffer.numberOfChannels===8?['bass','drums','chords','voice']:['bass','drums','chords']).entries()){
     const stem=context.createBuffer(2,buffer.length,context.sampleRate);
     for(let channel=0;channel<2;channel++)stem.copyToChannel(buffer.getChannelData(index*2+channel),channel);
     stems[part]=stem;
    }
    const asset=window.BassWorldMethodMixes?.[plan.audio];
    if((asset?.addDrums||!originalDrums)&&drums&&loop){const replacement=await D.render(context,loop,beatFrames,cancelled);if(cancelled())return null;if(replacement)stems.drums=replacement;}
   }else stems.bass=buffer;
   return {stems,frames:buffer.length,seconds:buffer.duration,beatSeconds:buffer.duration/plan.beats,beatFrames:buffer.length/plan.beats,rate,gain:naturalBalance?recordingGain(context,stems):1,levels:naturalBalance?{}:levels(stems),semitones:plan.semitones||0,drumPhase:0,estimatedMix:true,voiceUnavailable:isolateVoice&&!stems.voice,voicePending:!isolateVoice&&!stems.voice};
  }
  const beat=beatFrames/rate,stems={},K=window.BassPracticeKeys,keys=window.BassAccompaniment?window.BassAccompaniment.arrange(plan,style):plan.chords;
  const phrase=recorded&&plan.recording?.pack;
  const useDrums=phrase&&originalDrums&&plan.recording.hasDrums,useKeys=phrase&&originalKeys;
  // Load the rhythm, recorded bass and keys together on the first play.
  const [drumBuffer,bassBuffer]=await Promise.all([
   drums&&loop&&!useDrums?D.render(context,loop,beatFrames,cancelled):null,
   phrase?phraseAudio(context,plan.recording,frames,cancelled):recorded?recordedBass(context,plan,frames,cancelled):A.prepare('bass',context,{notes:plan.bass}),
   chords&&!useKeys&&keys.length?(K?K.prepare(context,sound,keys):A.prepare('piano',context,{notes:keys})):null
  ]);
  if(drums&&loop&&!useDrums&&!drumBuffer||recorded&&!bassBuffer)return null;
  if(recorded)stems.bass=phrase?bassBuffer[0]:bassBuffer;
  if(useDrums&&drums)stems.drums=bassBuffer[1];
  if(useKeys&&chords)stems.chords=bassBuffer[2];
  if(cancelled())return null;
  for(const part of [...(recorded?[]:['bass']),...(chords&&!useKeys&&keys.length?['chords']:[])]){
   if(cancelled())return null;
   const offline=new OfflineAudioContext(part==='bass'?1:2,frames+Math.ceil(tail*rate),rate);
   if(part==='bass'&&plan.pickup)A.muted(offline,(plan.beats-plan.pickup)*beat,.15);
   for(const n of part==='bass'?plan.bass:keys){if(part==='chords'&&K)K.tone(offline,n,n.beat*beat,n.length*beat,sound,.22);else A.tone(offline,n.midi,n.beat*beat,n.length*beat,part==='bass'?'bass':'piano',0,n.velocity,part==='bass'?.72:.18,n);}
   const buffer=await offline.startRendering();if(cancelled())return null;
   // Carry each decaying cymbal/note across the seam rather than cutting it off.
   for(let ch=0;ch<buffer.numberOfChannels;ch++){const data=buffer.getChannelData(ch);for(let i=frames;i<data.length;i++)data[(i-frames)%frames]+=data[i];}
   const loop=context.createBuffer(buffer.numberOfChannels,frames,rate);
   for(let ch=0;ch<buffer.numberOfChannels;ch++)loop.copyToChannel(buffer.getChannelData(ch).subarray(0,frames),ch);
   stems[part]=loop;
  }
  if(drumBuffer)stems.drums=drumBuffer;
  return {pickup:plan.pickup,drumPhase:phrase?(useDrums?0:originalDrums?(assignedPhase??plan.recording.drumPhase):0):null,stems,frames,seconds,beatSeconds:beat,beatFrames,rate,gain:1,levels:levels(stems),semitones:recorded?plan.semitones||0:0,unpitched:recorded&&!useKeys?['chords']:[]};
 }
 // Measure the default practice mix once so quiet phrases start at a useful level.
 // Keep this gain independent of subsequent slider and mute changes.
 function recordingGain(context,stems){
  const reference=context.createBuffer(2,stems.bass.length,context.sampleRate);
  for(const [part,level] of Object.entries({bass:1,drums:.21,chords:.07,voice:.21})){
   const stem=stems[part];if(!stem)continue;
   for(let c=0;c<2;c++){
    const input=stem.getChannelData(Math.min(c,stem.numberOfChannels-1)),mix=reference.getChannelData(c);
    for(let i=0;i<mix.length;i++)mix[i]+=level*input[i%input.length];
   }
  }
  return window.BassEarAudio.normalisation(reference,.15849);
 }
 function levels(stems){return Object.fromEntries(Object.entries(stems).map(([part,buffer])=>[part,window.BassEarAudio?.normalisation(buffer,part==='drums'?.18:.16)??1]));}
 function start(context,rendered,{repeat=true,bass=1,drums=.21,chords=.07,voice=.21,other=.07,onEnded=()=>{},when=context.currentTime+.08,offsetBeats=0,drumPhase=0,fadeIn=0}={}){
  const sources=[],gains={},route=window.BassEarAudio?.mixer(context,{semitones:rendered.semitones||0,fixedKey:true}),master=route?.master||context.createGain();let stopped=false,ending=false;
  if(rendered.pickup&&!fadeIn&&!offsetBeats){
   const lead=rendered.pickup*rendered.beatSeconds;
   when=Math.max(when,context.currentTime+lead+.012);
   sources.push({source:window.BassPracticeAudio.muted(route?.context||context,when-lead,.15),part:'pickup'});
  }
  when=Math.max(context.currentTime,when);const offset=offsetBeats*rendered.beatSeconds;
  master.gain.setValueAtTime(fadeIn?0:rendered.gain,when);if(fadeIn)master.gain.linearRampToValueAtTime(rendered.gain,when+fadeIn);if(!route)master.connect(context.destination);
  const lead=rendered.stems.bass?'bass':Object.keys(rendered.stems)[0];
  for(const [part,buffer] of Object.entries(rendered.stems)){
   const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;source.loop=part==='bass'?repeat:true;source.loopStart=0;source.loopEnd=buffer.duration;
   gain.gain.value=(part==='bass'?bass:part==='drums'?drums:part==='chords'?chords:part==='voice'?voice:other)*(rendered.levels?.[part]||1);source.connect(gain).connect(route?(part==='drums'?route.drums:rendered.unpitched?.includes(part)?route.guide:route.pitched):master);sources.push({source,part});gains[part]=gain;
   source.onended=()=>{source.disconnect();gain.disconnect();if(part===lead&&!stopped){stopped=true;for(const other of sources)if(other.source!==source)try{other.source.stop();}catch{}route?.disconnect();master.disconnect();if(!ending)onEnded();}};
   const partOffset=offset+(part==='drums'?drumPhase*rendered.beatSeconds:0);
   source.start(when,((partOffset%buffer.duration)+buffer.duration)%buffer.duration);
  }
  function stopAt(at=context.currentTime,fade=.006){if(stopped)return;ending=true;at=Math.max(context.currentTime,at)+(route?.latency||0);master.gain.cancelScheduledValues(at);master.gain.setValueAtTime(rendered.gain,at);master.gain.linearRampToValueAtTime(0,at+fade);for(const {source} of sources)try{source.stop(at+fade+.001);}catch{}}
  return {when,latency:route?.latency||0,seconds:rendered.seconds,beatSeconds:rendered.beatSeconds,offsetBeats,setRepeat(value){for(const {source,part} of sources)if(part==='bass')source.loop=!!value;},level(part,value){const g=gains[part];if(g)g.gain.setTargetAtTime(Math.max(0,Math.min(1,value))*(rendered.levels?.[part]||1),context.currentTime,.015);},cancelPending(){
   ending=true;
   master.disconnect();
   for(const {source} of sources)try{source.stop(context.currentTime);}catch{}
  },position(){return context.currentTime-when+offset;},stopAt,stop(){stopAt(context.currentTime);}};
 }
 return {selectRecording,render,start,defaults:Object.freeze({bass:1,drums:.21,chords:.07,voice:.21,other:.07})};
})();
