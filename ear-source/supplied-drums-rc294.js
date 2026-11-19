/* The owner's recordings; all stems use the same integer-sample beat clock. */
window.BassSuppliedDrums=(()=>{
 'use strict';
 const loops=window.BassDrumLoops||[],genres=[['worship','Worship'],['praise','Praise'],['soul','Soul & R&B'],['funk','Funk'],['reggae','Reggae'],['highlife','Highlife'],['afrobeat','Afrobeat'],['makossa','Makossa'],['soukous','Soukous & Seben'],['soca','Soca'],['zouk','Zouk'],['rock','Rock']];
 const buffers=new Map(),renders=new Map(),loads=new Map();
 function choose(style,genre='auto',id='auto'){
  const exact=loops.find(x=>x.id===id);if(exact)return exact;
  const target=genre!=='auto'?genre:({worship:'soul',gospel:'soul',jazz:'soul',blues:'soul',fusion:'funk',mbalax:'praise',mbaqanga:'highlife',sungura:'soukous'}[style]||style);
  const pool=loops.filter(x=>x.genre===(target==='worship'?'soul':target));
  return pool.find(x=>x.automaticDefault&&x.id.startsWith('correct-'))||pool.find(x=>x.automaticDefault)||pool[0]||loops.find(x=>x.genre==='soul');
 }
 async function load(context,loop){
  const key=loop.id+':'+context.sampleRate;if(buffers.has(key))return buffers.get(key);
  if(!loads.has(key))loads.set(key,(async()=>{
   let cache,response;try{cache=await caches.open('bass-supplied-drums-rc294');response=await cache.match(loop.url);}catch{}
   if(!response){response=await fetch(loop.url);if(!response.ok)throw Error('Drum loop unavailable');if(cache)try{await cache.put(loop.url,response.clone());}catch{}}
   const decoded=await context.decodeAudioData(await response.arrayBuffer());buffers.set(key,decoded);
   while(buffers.size>3)buffers.delete(buffers.keys().next().value);return decoded;
  })().finally(()=>loads.delete(key)));
  return loads.get(key);
 }
 async function render(context,loop,beatFrames,cancelled=()=>false){
  if(!loop)throw Error('Choose a drum loop');
  const key=loop.id+':'+context.sampleRate+':'+beatFrames,frames=beatFrames*loop.beats;
  if(renders.has(key))return renders.get(key);
  const source=await load(context,loop);if(cancelled())return null;
  const channels=Array.from({length:source.numberOfChannels},(_,c)=>source.getChannelData(c).slice());
  const data=await new Promise((resolve,reject)=>{
   const worker=new Worker('./ear-source/drum-stretch-worker-rc294.js',{type:'module'});
   const timeout=setTimeout(()=>{worker.terminate();reject(Error('Drum tempo took too long'));},45000);
   worker.onmessage=({data})=>{clearTimeout(timeout);worker.terminate();data.error?reject(Error(data.error)):resolve(data.channels);};
   worker.onerror=()=>{clearTimeout(timeout);worker.terminate();reject(Error('Drum tempo unavailable'));};
   worker.postMessage({channels,sampleRate:context.sampleRate,frames,beats:loop.beats},channels.map(c=>c.buffer));
  });
  if(cancelled())return null;
  const output=context.createBuffer(data.length,frames,context.sampleRate);data.forEach((d,c)=>output.copyToChannel(d,c));
  renders.set(key,output);while(renders.size>2)renders.delete(renders.keys().next().value);return output;
 }
 return {loops,genres,choose,render};
})();
