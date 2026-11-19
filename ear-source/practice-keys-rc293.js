/* Licensed, locally hosted keyboard samples. See audio/keys-rc293/manifest.json. */
window.BassPracticeKeys=(()=>{
 'use strict';
 const base='./audio/keys-rc293/',buffers=new Map(),loads=new Map();let catalogue,task;
 async function resource(path){
  let cache;try{cache=await caches.open('bass-keys-rc293');const response=await cache.match(path);if(response)return response;}catch{}
  const response=await fetch(path);if(!response.ok)throw Error('Keyboard sound unavailable');if(cache)try{await cache.put(path,response.clone());}catch{}return response;
 }
 async function manifest(){if(catalogue)return catalogue;if(!task)task=(async()=>{const data=await(await resource(base+'manifest.json')).json();if(!Array.isArray(data.samples)||!data.samples.length)throw Error('Keyboard sounds need updating');return catalogue=data.samples;})().catch(e=>{task=null;throw e;});return task;}
 function descriptor(sound,n){
  const pool=catalogue.filter(s=>s.instrument===sound&&(n.velocity||60)>=s.velocityMin&&(n.velocity||60)<=s.velocityMax);
  if(!pool.length)throw Error('Keyboard sound unavailable');
  return pool.reduce((a,b)=>Math.abs(b.rootMidi-n.midi)<Math.abs(a.rootMidi-n.midi)?b:a);
 }
 async function prepare(context,sound,notes){
  if(sound==='piano')return window.BassPracticeAudio.prepare('piano',context,{notes});
  await manifest();const wanted=new Map(notes.map(n=>{const d=descriptor(sound,n);return[d.url,d];}));
  for(const [url] of wanted){if(buffers.has(url))continue;if(!loads.has(url))loads.set(url,(async()=>{const buffer=await context.decodeAudioData(await(await resource(url.startsWith('./')?url:base+url)).arrayBuffer());buffers.set(url,buffer);})().finally(()=>loads.delete(url)));await loads.get(url);}
 }
 function tone(context,n,when,length,sound,level=.22){
  if(sound==='piano')return window.BassPracticeAudio.tone(context,n.midi,when,length,'piano',0,n.velocity,level);
  const d=descriptor(sound,n),buffer=buffers.get(d.url);if(!buffer)throw Error('Keyboard sound loading');
  const source=context.createBufferSource(),gain=context.createGain(),filter=context.createBiquadFilter(),start=Math.max(when,context.currentTime),gate=Math.max(.025,length),release=sound==='organ'?.055:.18;
  source.buffer=buffer;source.playbackRate.value=2**((n.midi-d.rootMidi)/12);
  if(Number.isFinite(d.loopStart)&&Number.isFinite(d.loopEnd)&&d.loopEnd>d.loopStart){source.loop=true;source.loopStart=d.loopStart;source.loopEnd=d.loopEnd;}
  // Organ is deliberately quieter so the low bass stays easy to hear.
  const volume=level*(sound==='organ'?.64:1)*Math.pow((n.velocity||60)/80,.7);
  gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(volume,start+.006);gain.gain.setValueAtTime(volume,start+gate);gain.gain.linearRampToValueAtTime(0,start+gate+release);
  filter.type='highpass';filter.frequency.value=145;filter.Q.value=.5;
  source.connect(filter).connect(gain).connect(context.destination);source.start(start);source.stop(start+gate+release+.005);
  source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
  return {stop(){try{gain.gain.cancelScheduledValues(context.currentTime);gain.gain.setTargetAtTime(0,context.currentTime,.005);source.stop(context.currentTime+.025);}catch{}}};
 }
 return {prepare,tone};
})();
