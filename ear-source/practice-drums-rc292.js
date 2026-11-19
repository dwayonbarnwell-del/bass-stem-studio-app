/* Original 4/4 practice grooves with sampled acoustic percussion. */
window.BassPracticeDrums=(()=>{
 'use strict';
 const base='./audio/drums-rc292/',buffers=new Map(),loading=new Map();
 const kits=[['vintage','Warm vintage'],['studio','Tight studio'],['jazz','Open jazz']];
 const grooves=[['pocket','Soul pocket'],['worship','Spacious worship'],['gospel','Gospel drive'],['praise','Praise'],['shuffle','Blues shuffle'],['swing','Jazz swing'],['fusion','Funk / fusion'],['highlife','Highlife'],['reggae','Reggae one-drop'],['makossa','Makossa'],['afrobeat','Afrobeat'],['soukous','Soukous / Seben'],['mbalax','Mbalax inspired'],['mbaqanga','Mbaqanga inspired'],['sungura','Sungura inspired'],['soca','Soca'],['zouk','Zouk']];
 // Original drum-set practice arrangements. Not traditional percussion transcriptions.
 const shapes={
  pocket:{kick:[0,1.75,2.5],snare:[1,3],ghost:[2.75],step:.5},
  worship:{kick:[0,2.5],snare:[2],ghost:[],step:1},
  gospel:{kick:[0,.75,1.75,2.5],snare:[1,3],ghost:[.5,2.75,3.75],step:.25},
  praise:{kick:[0,.75,2,2.5],snare:[1,3],ghost:[1.75,3.75],step:.5},
  fusion:{kick:[0,.75,1.5,2.75],snare:[1,3],ghost:[.25,2.25,3.5],step:.25},
  highlife:{kick:[0,1.5,2.75],snare:[1,3],ghost:[.75,1.75,3.5],step:.5,open:3.5},
  makossa:{kick:[0,.75,2.25,3.5],snare:[1,3],ghost:[1.75,2.75],step:.5,open:1.5},
  afrobeat:{kick:[0,1.5,2.25,3.75],snare:[1,2.75],ghost:[.75,2,3.5],step:.25,open:3},
  soukous:{kick:[0,1.5,2,3.5],snare:[1,3],ghost:[.75,2.75],step:.5,open:2.5},
  mbalax:{kick:[0,.75,2,2.75],snare:[1.25,3],ghost:[.5,1.75,3.25,3.75],step:.5,open:1.5},
  mbaqanga:{kick:[0,2,2.75],snare:[1,3],ghost:[1.5],step:.5,open:3.5},
  sungura:{kick:[0,1,2,3],snare:[1,3],ghost:[.75,2.75],step:.5,open:1.5},
  soca:{kick:[0,1,2,3],snare:[.75,1.5,2.75,3.5],ghost:[],step:.5,open:2.5},
  zouk:{kick:[0,.75,2,2.5],snare:[1.5,3.5],ghost:[1,3],step:.5,open:.5}
 };
 function events(beats,groove='pocket'){
  if(!grooves.some(([id])=>id===groove))groove='pocket';
  const out=[];let serial=0;
  const hit=(bar,at,hit,velocity)=>{const beat=bar*4+at;if(beat<beats)out.push({beat,hit,velocity,variant:(serial++%2)+1});};
  for(let bar=0;bar<Math.ceil(beats/4);bar++){
   const h=(at,s,v)=>hit(bar,at,s,v);
   if(groove==='swing'){
    for(const at of [0,1,1+2/3,2,3,3+2/3])h(at,'ride',Number.isInteger(at)?(at%2?65:72):42);
    for(const at of [0,1,2,3])h(at,'kick',36);
    h(bar%2?1+2/3:1,'softsnare',49);h(bar%2?3:3+2/3,'softsnare',44);
   }else if(groove==='shuffle'){
    for(let b=0;b<4;b++){h(b,'closedhat',70);h(b+2/3,'closedhat',43);}
    h(0,'kick',83);h(2,'kick',76);h(1,'snare',78);h(3,'snare',84);if(bar%2)h(3+2/3,'kick',55);
   }else if(groove==='reggae'){
    for(let b=0;b<4;b++){h(b,'closedhat',34);h(b+.5,'closedhat',64);}h(2,'kick',86);h(2,'softsnare',85);
   }else{
    const p=shapes[groove];
    for(let b=0;b<4;b+=p.step)h(b,b===p.open?'openhat':'closedhat',b%1===0?59:b%.5===0?48:30);
    for(const [i,at] of p.kick.entries())h(at,'kick',i===0?86:68+(bar%2)*4);
    for(const at of p.snare)h(at,'snare',at>=3?84:78);
    for(const at of p.ghost)h(at,'softsnare',bar%2?35:28);
   }
  }
  const ordered=out.sort((a,b)=>a.beat-b.beat);
  // Close an open hi-hat on the following hat strike, as on an acoustic kit.
  for(let i=0;i<ordered.length;i++)if(ordered[i].hit==='openhat')ordered[i].gate=(ordered.slice(i+1).find(x=>x.hit.includes('hat'))?.beat??beats)-ordered[i].beat;
  return ordered;
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
 function tone(context,event,when,kit,beatSeconds=.75){
  const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffers.get(kit+'-'+event.hit+'-'+event.variant);
  if(!source.buffer)throw Error('Drum sound unavailable');
  gain.gain.value=(event.velocity/100)**1.25*(event.hit.includes('hat')?.38:event.hit==='ride'?.36:.7);
  source.connect(gain).connect(context.destination);source.start(when);if(event.gate){const end=when+Math.max(.04,event.gate*beatSeconds);gain.gain.setValueAtTime(gain.gain.value,end-.015);gain.gain.linearRampToValueAtTime(0,end);source.stop(end+.002);}source.onended=()=>{source.disconnect();gain.disconnect();};
 }
 return {kits,grooves,events,prepare,tone};
})();
