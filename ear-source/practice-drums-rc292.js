/* Original 4/4 practice grooves with sampled acoustic percussion. */
window.BassPracticeDrums=(()=>{
 'use strict';
 const base='./audio/drums-rc292/',buffers=new Map(),loading=new Map();
 const kits=[['vintage','Warm vintage'],['studio','Tight studio'],['jazz','Open jazz']];
 const grooves=[['pocket','Steady pocket'],['worship','Spacious worship'],['gospel','Gospel drive'],['praise','Praise'],['shuffle','Blues shuffle'],['swing','Jazz swing'],['highlife','Highlife'],['reggae','Reggae one-drop']];
 function events(beats,groove='pocket'){
  if(!grooves.some(([id])=>id===groove))groove='pocket';
  const out=[];let serial=0;
  const hit=(bar,at,hit,velocity)=>{const beat=bar*4+at;if(beat<beats)out.push({beat,hit,velocity,variant:(serial++%2)+1});};
  for(let bar=0;bar<Math.ceil(beats/4);bar++){
   const h=(at,s,v)=>hit(bar,at,s,v);
   if(groove==='shuffle'||groove==='swing'){
    for(let b=0;b<4;b++){h(b,groove==='swing'?'ride':'closedhat',b%2?65:77);h(b+2/3,groove==='swing'?'ride':'closedhat',45);}
    h(0,'kick',groove==='swing'?55:86);h(2,'kick',65);h(1,'snare',groove==='swing'?52:83);h(3,'snare',groove==='swing'?58:88);
   }else if(groove==='reggae'){
    for(let b=0;b<4;b++){h(b,'closedhat',42);h(b+.5,'closedhat',67);}h(2,'kick',88);h(2,'snare',79);
   }else{
    const step=groove==='gospel'?.25:.5;
    for(let b=0;b<4;b+=step)h(b,'closedhat',b%1===0?70:b%.5===0?48:32);
    h(0,'kick',88);if(groove!=='worship')h(2,'kick',78);else h(2.5,'kick',64);
    h(1,'snare',82);h(3,'snare',88);
    if(groove==='gospel'){h(1.75,'kick',65);h(2.75,'softsnare',35);if(bar%2)h(3.5,'kick',72);}
    if(groove==='praise'){h(.75,'kick',67);h(2.5,'kick',74);h(3.75,'softsnare',32);}
    if(groove==='highlife'){h(.75,'kick',66);h(2.75,'kick',67);h(1.75,'softsnare',37);h(3.5,'openhat',46);}
   }
  }
  return out.sort((a,b)=>a.beat-b.beat);
 }
 async function prepare(context,kit){
  if(!kits.some(([id])=>id===kit))throw Error('Choose a drum sound');
  for(const hit of ['kick','snare','softsnare','closedhat','openhat','ride'])for(const variant of [1,2]){
   const key=kit+'-'+hit+'-'+variant;
   if(buffers.has(key))continue;
   if(!loading.has(key))loading.set(key,(async()=>{let response,cache;try{cache=await caches.open('bass-drums-rc292');response=await cache.match(base+key+'.wav');}catch{}
    if(!response){response=await fetch(base+key+'.wav');if(!response.ok)throw Error('Drum sound unavailable');if(cache)try{await cache.put(base+key+'.wav',response.clone());}catch{}}
    const buffer=await context.decodeAudioData(await response.arrayBuffer());buffers.set(key,buffer);
   })().finally(()=>loading.delete(key)));
   await loading.get(key);
  }
 }
 function tone(context,event,when,kit){
  const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffers.get(kit+'-'+event.hit+'-'+event.variant);
  if(!source.buffer)throw Error('Drum sound unavailable');
  gain.gain.value=(event.velocity/100)**1.25*(event.hit.includes('hat')?.38:event.hit==='ride'?.36:.7);
  source.connect(gain).connect(context.destination);source.start(when);source.onended=()=>{source.disconnect();gain.disconnect();};
 }
 return {kits,grooves,events,prepare,tone};
})();
