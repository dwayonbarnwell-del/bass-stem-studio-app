/* Sampled bass with a warm practice voicing; piano remains an explicit choice. */
window.BassPracticeAudio=(()=>{
 'use strict';
 const buses=new WeakMap(),A=()=>window.BassPianoAudio;
 function bassContext(context){
  if(buses.has(context))return buses.get(context);
  const sub=context.createBiquadFilter(),body=context.createBiquadFilter(),top=context.createBiquadFilter();
  sub.type='highpass';sub.frequency.value=25;sub.Q.value=.5;
  body.type='lowshelf';body.frequency.value=150;body.gain.value=2.5;
  top.type='lowpass';top.frequency.value=2400;top.Q.value=.55;
  sub.connect(body).connect(top).connect(context.destination);
  const proxy={get currentTime(){return context.currentTime;},destination:sub,createBufferSource:()=>context.createBufferSource(),createGain:()=>context.createGain()};
  buses.set(context,proxy);return proxy;
 }
 const prepare=(...args)=>A().prepare(...args);
 function tone(context,midi,when,length,sound='piano',age=0,velocity=80,level=1){
  const v=Math.max(1,Math.min(127,Number(velocity)||80));
  return A().tone(sound==='bass'?bassContext(context):context,midi,when,length,sound,age,v,level*(sound==='bass'?.82*(v/90)**.7:1));
 }
 return {prepare,tone};
})();
