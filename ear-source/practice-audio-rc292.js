/* Sampled bass with a warm practice voicing; piano remains an explicit choice. */
window.BassPracticeAudio=(()=>{
 'use strict';
 const buses=new WeakMap(),mutedSamples=new WeakMap(),A=()=>window.BassPianoAudio;
 function bassContext(context){
  if(buses.has(context))return buses.get(context);
  const sub=context.createBiquadFilter(),body=context.createBiquadFilter(),top=context.createBiquadFilter();
  sub.type='highpass';sub.frequency.value=25;sub.Q.value=.5;
  body.type='lowshelf';body.frequency.value=150;body.gain.value=3;
  top.type='lowpass';top.frequency.value=1850;top.Q.value=.55;
  sub.connect(body).connect(top).connect(context.destination);
  const proxy={get currentTime(){return context.currentTime;},destination:sub,createBufferSource:()=>context.createBufferSource(),createGain:()=>context.createGain()};
  buses.set(context,proxy);return proxy;
 }
 async function prepare(sound='piano',context,options){
  if(sound==='bass'&&window.BassFingeredBass){
   try{return await window.BassFingeredBass.prepare(context,options);}catch{}
  }
  return A().prepare(sound,context,options);
 }
 function tone(context,midi,when,length,sound='piano',age=0,velocity=80,level=1,expression={}){
  const v=Math.max(1,Math.min(127,Number(velocity)||80));
  if(sound==='bass'&&window.BassFingeredBass?.has(midi))return window.BassFingeredBass.tone(bassContext(context),midi,when,length,age,v,level*.82*(v/90)**.7,expression);
  return A().tone(sound==='bass'?bassContext(context):context,midi,when,length,sound,age,v,level*(sound==='bass'?.82*(v/90)**.7:1));
 }
 function muted(context,when,level){
  let buffer=mutedSamples.get(context);
  if(!buffer){
   const length=Math.round(context.sampleRate*.055);
   buffer=context.createBuffer(1,length,context.sampleRate);
   const samples=buffer.getChannelData(0);
   let seed=8271,smooth=0;
   for(let i=0;i<length;i++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    smooth+=(seed/2147483648-1-smooth)*.105;
    samples[i]=smooth*Math.min(1,i/35)*Math.exp(-i/length*6.3);
   }
   mutedSamples.set(context,buffer);
  }
  const source=context.createBufferSource(),target=bassContext(context),gain=context.createGain();
  source.buffer=buffer;gain.gain.value=level*.88;
  source.connect(gain).connect(target.destination);source.start(when);
  return source;
 }
 return {prepare,tone,muted};
})();
