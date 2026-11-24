/* GeneralUser GS fingered bass, two played velocities from B0 to B3.
   Original sample timing is retained; neighbouring pitches move at most one semitone.
   Source and licence: licenses/generaluser-gs/. */
window.BassFingeredBass=(()=>{
 'use strict';
 const banks=new Map(),loads=new Map(),anchors=Array.from({length:13},(_,i)=>23+i*3);
 let decoder;
 const anchor=midi=>anchors.reduce((a,b)=>Math.abs(b-midi)<Math.abs(a-midi)?b:a);
 async function load(context,midi){
  if(banks.has(midi))return;
  if(!loads.has(midi))loads.set(midi,(async()=>{
   const layers=[];
   for(const velocity of [64,104]){
    const url='./audio/bass-rc346/'+midi+'-'+velocity+'.flac';
    let cache,response;
    try{cache=await caches.open('bass-fingered-gs-rc346');response=await cache.match(url);}catch{}
    if(!response){
     response=await fetch(url);if(!response.ok)throw Error('Bass sound unavailable');
     if(cache)try{await cache.put(url,response.clone());}catch{}
    }
    layers.push(await context.decodeAudioData(await response.arrayBuffer()));
   }
   banks.set(midi,layers);
  })().finally(()=>loads.delete(midi)));
  await loads.get(midi);
 }
 async function prepare(context,options={}){
  context??=(decoder??=new AudioContext());
  const notes=options?.notes?.map(n=>Number(n.midi)).filter(Number.isFinite);
  const wanted=notes?.length?[...new Set(notes.map(anchor))]:anchors;
  for(let i=0;i<wanted.length;i+=4)await Promise.all(wanted.slice(i,i+4).map(midi=>load(context,midi)));
 }
 function has(midi){return Number.isFinite(midi)&&banks.has(anchor(midi));}
 function tone(context,midi,when,length,age=0,velocity=80,level=1){
  const key=anchor(midi),layers=banks.get(key);
  if(!layers)throw Error('Bass sound loading');
  const start=Math.max(context.currentTime,when),remaining=Math.max(.015,length-age),ratio=2**((midi-key)/12);
  const blend=Math.max(0,Math.min(1,(velocity-64)/40)),voices=[];
  for(const [i,weight] of [1-blend,blend].entries()){
   if(weight<=0||age*ratio>=layers[i].duration)continue;
   const source=context.createBufferSource(),gain=context.createGain(),release=Math.min(.035,remaining/3);
   source.buffer=layers[i];source.playbackRate.value=ratio;
   gain.gain.setValueAtTime(0,start);
   gain.gain.linearRampToValueAtTime(level*weight,start+Math.min(.004,remaining/3));
   gain.gain.setValueAtTime(level*weight,start+remaining-release);
   gain.gain.linearRampToValueAtTime(0,start+remaining);
   source.connect(gain).connect(context.destination);
   source.start(start,Math.max(0,age)*ratio);source.stop(start+remaining+.01);
   source.onended=()=>{source.disconnect();gain.disconnect();};
   voices.push({source,gain});
  }
  return {stop(){for(const {source,gain} of voices)try{
   gain.gain.cancelScheduledValues(context.currentTime);
   gain.gain.setValueAtTime(gain.gain.value,context.currentTime);
   gain.gain.linearRampToValueAtTime(0,context.currentTime+.008);
   source.stop(context.currentTime+.01);
  }catch{}}};
 }
 return {prepare,has,tone};
})();
