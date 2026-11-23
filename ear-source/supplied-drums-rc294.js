/* The owner's recordings; all stems use the same integer-sample beat clock. */
window.BassSuppliedDrums=(()=>{
 'use strict';
 const loops=window.BassDrumLoops||[],genres=[['worship','Worship'],['praise','Praise'],['soul','Soul & R&B'],['funk','Funk'],['reggae','Reggae'],['highlife','Highlife'],['afrobeat','Afrobeat'],['makossa','Makossa'],['soukous','Soukous & Seben'],['soca','Soca'],['zouk','Zouk'],['rock','Rock']];
 const available=[...loops,...(window.BassGrooveLibrary?.loops||[])];
 const buffers=new Map(),renders=new Map(),loads=new Map();
 function choose(style,genre='auto',id='auto'){
  const exact=available.find(x=>x.id===id);if(exact)return exact;
  const target=genre!=='auto'?genre:({worship:'soul',gospel:'soul',jazz:'soul',blues:'soul',fusion:'funk',mbalax:'praise',mbaqanga:'highlife',sungura:'soukous'}[style]||style);
  const pool=loops.filter(x=>x.genre===(target==='worship'?'soul':target));
  return pool.find(x=>x.automaticDefault&&x.id.startsWith('correct-'))||pool.find(x=>x.automaticDefault)||pool[0]||loops.find(x=>x.genre==='soul');
 }
 // Measured phrase lengths in the supplied WAVs. The player still honours
 // the selected practice BPM. An entry describes four practice beats in seconds.
 const sourceBars={
  'correct-praise-a62d2f9461':[240/126,.026],
  'correct-praise-5b0dbf04c3':[240/130,-.006],
  'correct-praise-c2891326aa':[240/150,-.014],
  'correct-highlife-77e55d558a':[240/138,-.019],
  'correct-praise-5405aa362e':[1.5,-.028]
 };
 // These full-length loops have a consistent late file cut across all eight
 // bars. Move the whole recording, retaining the spacing between its hits.
 const fileOffsets={
  'correct-funk-2d1f3c8df3':-.040,'correct-rock-3820baa306':-.028,
  'correct-rock-91a82f2149':-.031,'correct-makossa-92baa4991e':-.054
 };
 function alignSource(ctx,loop,raw){
  const calibration=sourceBars[loop.id];
  if(!calibration){
   if(!fileOffsets[loop.id])return raw;
   const cut=raw.length+Math.round(fileOffsets[loop.id]*ctx.sampleRate);
   const audio=ctx.createBuffer(raw.numberOfChannels,raw.length,ctx.sampleRate);
   for(let c=0;c<raw.numberOfChannels;c++){
    const data=raw.getChannelData(c),out=audio.getChannelData(c);
    out.set(data.subarray(cut));out.set(data.subarray(0,cut),raw.length-cut);
   }
   return audio;
  }
  const [barSeconds,attack]=calibration,rate=ctx.sampleRate;
  const frames=Math.round(loop.beats/4*barSeconds*rate),bar=Math.round(barSeconds*rate);
  const start=Math.round(attack*rate),blend=Math.round(.004*rate);
  const audio=ctx.createBuffer(raw.numberOfChannels,frames,rate);
  for(let c=0;c<raw.numberOfChannels;c++){
   const input=raw.getChannelData(c),output=audio.getChannelData(c);
   // Two uploads end part way through their last beat. Complete that beat
   // from the same place in the preceding bar, retaining the played variations.
   for(let i=0;i<frames;i++){
    const at=i+start;
    if(at<0)output[i]=input[at+bar];
    else if(at>=input.length)output[i]=input[at-bar];
    else if(at>=input.length-blend&&at>=bar){
     const mix=(at-input.length+blend)/blend;
     output[i]=input[at]*(1-mix)+input[at-bar]*mix;
    }else output[i]=input[at];
   }
   // Crossfade the tail against the audio immediately before this downbeat.
   for(let i=0;i<blend;i++){
    const before=start-blend+i,at=before<0?before+bar:before;
    const mix=(i+1)/blend;
    output[frames-blend+i]=output[frames-blend+i]*(1-mix)+input[at]*mix;
   }
  }
  return audio;
 }
 async function load(context,loop){
  const key=loop.id+':'+context.sampleRate;if(buffers.has(key))return buffers.get(key);
  if(!loads.has(key))loads.set(key,(async()=>{
   let cache,response;try{cache=await caches.open('bass-supplied-drums-rc294');response=await cache.match(loop.url);}catch{}
   if(!response){response=await fetch(loop.url);if(!response.ok)throw Error('Drum loop unavailable');if(cache)try{await cache.put(loop.url,response.clone());}catch{}}
   const decoded=alignSource(context,loop,await context.decodeAudioData(await response.arrayBuffer()));buffers.set(key,decoded);
   while(buffers.size>3)buffers.delete(buffers.keys().next().value);return decoded;
  })().finally(()=>loads.delete(key)));
  return loads.get(key);
 }
 async function performance(context,loop,beatFrames,cancelled){
  const frames=beatFrames*loop.beats,rate=context.sampleRate;
  const keys=window.BassPracticeDrums;
  await keys.prepare(context,loop.kit);
  if(cancelled())return null;
  const offline=new OfflineAudioContext(1,frames+rate*2,rate);
  const hats=loop.events.filter(([,hit])=>hit.includes('hat'));
  for(const [i,[beat,hit,velocity]] of loop.events.entries()){
   const gate=hit==='openhat'?(hats.find(([at])=>at>beat)?.[0]??(hats[0][0]+loop.beats))-beat:undefined;
   keys.tone(offline,{hit,gate,velocity:velocity*100/127,variant:1+i%2},beat*beatFrames/rate,loop.kit,beatFrames/rate);
  }
  const buffer=await offline.startRendering();
  if(cancelled())return null;
  const samples=buffer.getChannelData(0);
  for(let i=frames;i<samples.length;i++)samples[(i-frames)%frames]+=samples[i];
  const out=context.createBuffer(1,frames,rate),data=out.getChannelData(0);
  data.set(samples.subarray(0,frames));
  let power=0,peak=0;
  for(const value of data){power+=value*value;peak=Math.max(peak,Math.abs(value));}
  const gain=Math.min(.14/Math.max(.001,Math.sqrt(power/frames)),.84/Math.max(.001,peak));
  for(let i=0;i<frames;i++)data[i]*=gain;
  return out;
 }
 function remember(key,buffer){
  renders.set(key,buffer);while(renders.size>3)renders.delete(renders.keys().next().value);
  return buffer;
 }
 async function render(context,loop,beatFrames,cancelled=()=>false){
  if(!loop)throw Error('Choose a drum loop');
  const key=loop.id+':'+context.sampleRate+':'+beatFrames,frames=beatFrames*loop.beats;
  if(renders.has(key))return renders.get(key);
  if(loop.events){
   const buffer=await performance(context,loop,beatFrames,cancelled);
   return buffer?remember(key,buffer):null;
  }
  if(loop.base){
   const parent=await render(context,choose(null,null,loop.base),beatFrames,cancelled);
   if(!parent||cancelled())return null;
   const out=context.createBuffer(parent.numberOfChannels,frames,context.sampleRate),offset=loop.firstBeat*beatFrames;
   for(let c=0;c<parent.numberOfChannels;c++){
    const source=parent.getChannelData(c),data=out.getChannelData(c);
    data.set(source.subarray(offset,offset+frames));
    // Crossfade into the start using the source audio just before the cut.
    const fade=Math.min(frames,Math.round(context.sampleRate*.003));
    for(let i=0;i<fade;i++){
     const mix=(i+1)/fade;
     data[frames-fade+i]=data[frames-fade+i]*(1-mix)+source[(offset-fade+i+source.length)%source.length]*mix;
    }
   }
   return remember(key,out);
  }
  const source=await load(context,loop);if(cancelled())return null;
  if(source.length===frames)return source;
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
  return remember(key,output);
 }
 return {loops,available,genres,choose,render};
})();
