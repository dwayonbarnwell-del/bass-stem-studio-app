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
 async function render(context,plan,{drums=true,loop=null,style='worship',sound='piano',chords=true,recorded=false,cancelled=()=>false}={}){
  const A=window.BassPracticeAudio,D=window.BassSuppliedDrums,rate=context.sampleRate,beatFrames=Math.round(60/plan.bpm*rate),frames=Math.round(plan.beats*beatFrames),seconds=frames/rate;
  if(!Number.isFinite(seconds)||seconds<=0||seconds>240)throw Error('Practice loop is too long');
  const beat=beatFrames/rate,stems={},K=window.BassPracticeKeys,keys=window.BassAccompaniment?window.BassAccompaniment.arrange(plan,style):plan.chords;
  if(recorded){stems.bass=await recordedBass(context,plan,frames,cancelled);if(!stems.bass)return null;}
  else await A.prepare('bass',context,{notes:plan.bass});
  if(chords&&keys.length){if(K)await K.prepare(context,sound,keys);else await A.prepare('piano',context,{notes:keys});}
  if(cancelled())return null;
  for(const part of [...(recorded?[]:['bass']),...(chords&&keys.length?['chords']:[])]){
   const offline=new OfflineAudioContext(part==='bass'?1:2,frames+Math.ceil(tail*rate),rate);
   for(const n of part==='bass'?plan.bass:keys){if(part==='chords'&&K)K.tone(offline,n,n.beat*beat,n.length*beat,sound,.22);else A.tone(offline,n.midi,n.beat*beat,n.length*beat,part==='bass'?'bass':'piano',0,n.velocity,part==='bass'?.72:.18);}
   const buffer=await offline.startRendering();if(cancelled())return null;
   // Carry each decaying cymbal/note across the seam rather than cutting it off.
   for(let ch=0;ch<buffer.numberOfChannels;ch++){const data=buffer.getChannelData(ch);for(let i=frames;i<data.length;i++)data[(i-frames)%frames]+=data[i];}
   const loop=context.createBuffer(buffer.numberOfChannels,frames,rate);
   for(let ch=0;ch<buffer.numberOfChannels;ch++)loop.copyToChannel(buffer.getChannelData(ch).subarray(0,frames),ch);
   stems[part]=loop;
  }
  if(drums&&loop){const buffer=await D.render(context,loop,beatFrames,cancelled);if(!buffer||cancelled())return null;stems.drums=buffer;}
  // Different phrase lengths share an integer-sample beat, never a UI timer.
  // Sum peak bounds so every relative phase is safe, including odd progressions.
  let bound=0;for(const buffer of Object.values(stems)){let peak=0;for(let c=0;c<buffer.numberOfChannels;c++)for(const value of buffer.getChannelData(c))peak=Math.max(peak,Math.abs(value));bound+=peak;}
  return {stems,frames,seconds,beatSeconds:beat,beatFrames,rate,gain:Math.min(1,.88/(bound||1))};
 }
 function start(context,rendered,{repeat=true,drums=.45,chords=1,onEnded=()=>{},when=context.currentTime+.08,offsetBeats=0,fadeIn=0}={}){
  const sources=[],gains={},master=context.createGain();let stopped=false,ending=false;
  when=Math.max(context.currentTime,when);const offset=offsetBeats*rendered.beatSeconds;
  master.gain.setValueAtTime(fadeIn?0:rendered.gain,when);if(fadeIn)master.gain.linearRampToValueAtTime(rendered.gain,when+fadeIn);master.connect(context.destination);
  for(const [part,buffer] of Object.entries(rendered.stems)){
   const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;source.loop=part==='bass'?repeat:true;source.loopStart=0;source.loopEnd=buffer.duration;
   gain.gain.value=part==='drums'?drums:part==='chords'?chords:1;source.connect(gain).connect(master);sources.push({source,part});gains[part]=gain;
   source.onended=()=>{source.disconnect();gain.disconnect();if(part==='bass'&&!stopped){stopped=true;for(const other of sources)if(other.source!==source)try{other.source.stop();}catch{}master.disconnect();if(!ending)onEnded();}};
   source.start(when,((offset%buffer.duration)+buffer.duration)%buffer.duration);
  }
  function stopAt(at=context.currentTime,fade=.006){if(stopped)return;ending=true;at=Math.max(context.currentTime,at);master.gain.cancelScheduledValues(at);master.gain.setValueAtTime(rendered.gain,at);master.gain.linearRampToValueAtTime(0,at+fade);for(const {source} of sources)try{source.stop(at+fade+.001);}catch{}}
  return {when,seconds:rendered.seconds,beatSeconds:rendered.beatSeconds,offsetBeats,setRepeat(value){for(const {source,part} of sources)if(part==='bass')source.loop=!!value;},level(part,value){const g=gains[part];if(g)g.gain.setTargetAtTime(Math.max(0,Math.min(1,value)),context.currentTime,.015);},position(){return context.currentTime-when+offset;},stopAt,stop(){stopAt(context.currentTime);}};
 }
 return {render,start};
})();
