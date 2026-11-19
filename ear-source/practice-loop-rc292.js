/* Render once, then loop on the audio clock. UI timers never schedule sound. */
window.BassPracticeLoop=(()=>{
 'use strict';
 const tail=3;
 async function render(context,plan,{drums=true,kit='vintage',groove='pocket',style='worship',sound='piano',chords=true,cancelled=()=>false}={}){
  const A=window.BassPracticeAudio,D=window.BassPracticeDrums,rate=context.sampleRate,frames=Math.round(plan.beats*60/plan.bpm*rate),seconds=frames/rate;
  if(!Number.isFinite(seconds)||seconds<=0||seconds>240)throw Error('Practice loop is too long');
  const beat=60/plan.bpm,stems={},K=window.BassPracticeKeys,keys=window.BassAccompaniment?window.BassAccompaniment.arrange(plan,style):plan.chords;
  await A.prepare('bass',context,{notes:plan.bass});if(chords&&keys.length){if(K)await K.prepare(context,sound,keys);else await A.prepare('piano',context,{notes:keys});}if(drums)await D.prepare(context,kit);
  if(cancelled())return null;
  for(const part of ['bass',...(chords&&keys.length?['chords']:[]),...(drums?['drums']:[])]){
   const offline=new OfflineAudioContext(part==='bass'?1:2,frames+Math.ceil(tail*rate),rate);
   if(part==='drums')for(const hit of D.events(plan.beats,groove))D.tone(offline,hit,hit.beat*beat,kit,beat);
   else for(const n of part==='bass'?plan.bass:keys){if(part==='chords'&&K)K.tone(offline,n,n.beat*beat,n.length*beat,sound,.22);else A.tone(offline,n.midi,n.beat*beat,n.length*beat,part==='bass'?'bass':'piano',0,n.velocity,part==='bass'?.72:.18);}
   const buffer=await offline.startRendering();if(cancelled())return null;
   // Carry each decaying cymbal/note across the seam rather than cutting it off.
   for(let ch=0;ch<buffer.numberOfChannels;ch++){const data=buffer.getChannelData(ch);for(let i=frames;i<data.length;i++)data[(i-frames)%frames]+=data[i];}
   const loop=context.createBuffer(buffer.numberOfChannels,frames,rate);
   for(let ch=0;ch<buffer.numberOfChannels;ch++)loop.copyToChannel(buffer.getChannelData(ch).subarray(0,frames),ch);
   stems[part]=loop;
  }
  // A shared gain avoids clipping without changing the bass/drum balance.
  let peak=0;for(let i=0;i<frames;i++)for(let ch=0;ch<2;ch++){let value=0;for(const b of Object.values(stems))value+=b.getChannelData(Math.min(ch,b.numberOfChannels-1))[i];peak=Math.max(peak,Math.abs(value));}
  return {stems,frames,seconds,rate,gain:Math.min(1,.88/(peak||1))};
 }
 function start(context,rendered,{repeat=false,drums=.45,chords=1,onEnded=()=>{}}={}){
  const when=context.currentTime+.08,sources=[],gains={},master=context.createGain();let stopped=false;
  master.gain.value=rendered.gain;master.connect(context.destination);
  for(const [part,buffer] of Object.entries(rendered.stems)){
   const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;source.loop=repeat;source.loopStart=0;source.loopEnd=rendered.seconds;
   gain.gain.value=part==='drums'?drums:part==='chords'?chords:1;source.connect(gain).connect(master);sources.push(source);gains[part]=gain;
   source.onended=()=>{source.disconnect();gain.disconnect();if(part==='bass'&&!stopped){stopped=true;master.disconnect();onEnded();}};
   source.start(when);
  }
  return {when,seconds:rendered.seconds,setRepeat(value){for(const s of sources)s.loop=!!value;},level(part,value){const g=gains[part];if(g)g.gain.setTargetAtTime(Math.max(0,Math.min(1,value)),context.currentTime,.015);},position(){return context.currentTime-when;},stop(){if(stopped)return;stopped=true;master.gain.setTargetAtTime(0,context.currentTime,.003);for(const s of sources)try{s.stop(context.currentTime+.02);}catch{};setTimeout(()=>master.disconnect(),40);}};
 }
 return {render,start};
})();
