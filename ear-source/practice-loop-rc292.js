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
 async function render(context,plan,{drums=true,loop=null,style='worship',sound='piano',chords=true,recorded=false,originalDrums=true,originalKeys=true,cancelled=()=>false}={}){
  const A=window.BassPracticeAudio,D=window.BassSuppliedDrums,rate=context.sampleRate,beatFrames=Math.round(60/plan.bpm*rate),frames=Math.round(plan.beats*beatFrames),seconds=frames/rate;
  if(!Number.isFinite(seconds)||seconds<=0||seconds>240)throw Error('Practice loop is too long');
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
   const offline=new OfflineAudioContext(part==='bass'?1:2,frames+Math.ceil(tail*rate),rate);
   for(const n of part==='bass'?plan.bass:keys){if(part==='chords'&&K)K.tone(offline,n,n.beat*beat,n.length*beat,sound,.22);else A.tone(offline,n.midi,n.beat*beat,n.length*beat,part==='bass'?'bass':'piano',0,n.velocity,part==='bass'?.72:.18);}
   const buffer=await offline.startRendering();if(cancelled())return null;
   // Carry each decaying cymbal/note across the seam rather than cutting it off.
   for(let ch=0;ch<buffer.numberOfChannels;ch++){const data=buffer.getChannelData(ch);for(let i=frames;i<data.length;i++)data[(i-frames)%frames]+=data[i];}
   const loop=context.createBuffer(buffer.numberOfChannels,frames,rate);
   for(let ch=0;ch<buffer.numberOfChannels;ch++)loop.copyToChannel(buffer.getChannelData(ch).subarray(0,frames),ch);
   stems[part]=loop;
  }
  if(drumBuffer)stems.drums=drumBuffer;
  // Different phrase lengths share an integer-sample beat, never a UI timer.
  // Sum peak bounds so every relative phase is safe, including odd progressions.
  let bound=0;for(const buffer of Object.values(stems)){let peak=0;for(let c=0;c<buffer.numberOfChannels;c++)for(const value of buffer.getChannelData(c))peak=Math.max(peak,Math.abs(value));bound+=peak;}
  return {drumPhase:phrase?(useDrums?0:originalDrums?plan.recording.drumPhase:0):null,stems,frames,seconds,beatSeconds:beat,beatFrames,rate,gain:Math.min(1,.88/(bound||1))};
 }
 function start(context,rendered,{repeat=true,drums=.45,chords=1,onEnded=()=>{},when=context.currentTime+.08,offsetBeats=0,drumPhase=0,fadeIn=0}={}){
  const sources=[],gains={},master=context.createGain();let stopped=false,ending=false;
  when=Math.max(context.currentTime,when);const offset=offsetBeats*rendered.beatSeconds;
  master.gain.setValueAtTime(fadeIn?0:rendered.gain,when);if(fadeIn)master.gain.linearRampToValueAtTime(rendered.gain,when+fadeIn);master.connect(context.destination);
  for(const [part,buffer] of Object.entries(rendered.stems)){
   const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;source.loop=part==='bass'?repeat:true;source.loopStart=0;source.loopEnd=buffer.duration;
   gain.gain.value=part==='drums'?drums:part==='chords'?chords:1;source.connect(gain).connect(master);sources.push({source,part});gains[part]=gain;
   source.onended=()=>{source.disconnect();gain.disconnect();if(part==='bass'&&!stopped){stopped=true;for(const other of sources)if(other.source!==source)try{other.source.stop();}catch{}master.disconnect();if(!ending)onEnded();}};
   const partOffset=offset+(part==='drums'?drumPhase*rendered.beatSeconds:0);
   source.start(when,((partOffset%buffer.duration)+buffer.duration)%buffer.duration);
  }
  function stopAt(at=context.currentTime,fade=.006){if(stopped)return;ending=true;at=Math.max(context.currentTime,at);master.gain.cancelScheduledValues(at);master.gain.setValueAtTime(rendered.gain,at);master.gain.linearRampToValueAtTime(0,at+fade);for(const {source} of sources)try{source.stop(at+fade+.001);}catch{}}
  return {when,seconds:rendered.seconds,beatSeconds:rendered.beatSeconds,offsetBeats,setRepeat(value){for(const {source,part} of sources)if(part==='bass')source.loop=!!value;},level(part,value){const g=gains[part];if(g)g.gain.setTargetAtTime(Math.max(0,Math.min(1,value)),context.currentTime,.015);},position(){return context.currentTime-when+offset;},stopAt,stop(){stopAt(context.currentTime);}};
 }
 return {render,start};
})();
