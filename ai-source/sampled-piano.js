/* RC257: licensed stereo piano, lazy sample loading and velocity layers. */
window.BassGrandPiano=(()=>{
 'use strict';
 const base='./ai-source/salamander/',cacheName='bass-piano-salamander-v1',limit=96*1024*1024,release=.24;
 const decoded=new Map(),loading=new Map();let catalogue,manifestTask,decoder,bytes=0,clock=0;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const velocity=v=>clamp(Number.isFinite(v)?Math.round(v):80,1,127);
 const valid=notes=>(notes||[]).filter(n=>Number.isFinite(n.midi)&&n.midi>=21&&n.midi<=108);
 async function resource(path,validate){
  let cache,saved;try{cache=await caches.open(cacheName);saved=await cache.match(path);}catch{}
  if(saved){
   try{return await validate(saved);}catch{
    try{await cache.delete(path);}catch{}
   }
  }
  const response=await fetch(path);if(!response.ok)throw Error('Piano sound unavailable');
  const value=await validate(response.clone());
  if(cache)try{await cache.put(path,response.clone());}catch{}
  return value;
 }
 async function manifest(){if(catalogue)return catalogue;if(!manifestTask)manifestTask=resource(base+'manifest.json',async response=>{const data=await response.json();if(data.id!=='salamander-grand-v3-rc257'||!Array.isArray(data.samples)||data.samples.length!==90)throw Error('Piano sounds need updating');return data.samples;}).then(data=>catalogue=data).catch(e=>{manifestTask=null;throw e;});return manifestTask;}
 function descriptor(midi,v){const layer=velocity(v),pool=catalogue.filter(s=>layer>=s.velocityMin&&layer<=s.velocityMax);return pool.reduce((a,b)=>Math.abs(b.rootMidi-midi)<Math.abs(a.rootMidi-midi)?b:a);}
 function evict(protectedKeys){for(const [key,item] of [...decoded].sort((a,b)=>a[1].used-b[1].used)){if(bytes<=limit)break;if(protectedKeys.has(key))continue;decoded.delete(key);bytes-=item.bytes;}}
 async function prepare(sound='piano',context,{notes=[{midi:60,velocity:80}]}={}){
  await manifest();context??=(decoder??=new AudioContext());
  const wanted=new Map(valid(notes).map(n=>{const d=descriptor(n.midi,n.velocity);return [d.url,d];}));
  // Decode sequentially to avoid transient memory spikes on phones.
  for(const [key,d] of wanted){
   if(!decoded.has(key)){
    if(!loading.has(key))loading.set(key,(async()=>{const buffer=await resource(base+key,async response=>{const buffer=await context.decodeAudioData(await response.arrayBuffer());if(buffer.numberOfChannels!==2)throw Error('Stereo piano sound unavailable');return buffer;});const item={...d,midi:d.rootMidi,buffer,channels:[buffer.getChannelData(0),buffer.getChannelData(1)],rate:buffer.sampleRate,bytes:buffer.length*8,used:++clock};decoded.set(key,item);bytes+=item.bytes;return item;})().finally(()=>loading.delete(key)));
    await loading.get(key);
   }decoded.get(key).used=++clock;evict(new Set(wanted.keys()));
  }return [...wanted.keys()].map(k=>decoded.get(k));
 }
 function sample(midi,v){if(!catalogue)throw Error('Piano sound loading');const d=descriptor(midi,v),s=decoded.get(d.url);if(!s)throw Error('Piano sound loading');s.used=++clock;return s;}
 const gain=v=>1.25*(velocity(v)/(velocity(v)<=50?40:velocity(v)<=95?80:112))**.35;
 function envelope(age,length){if(age<0||age>=length+release)return 0;return Math.min(1,age/.004)*(age<=length?1:(1-(age-length)/release)**2);}
 function tone(context,midi,when,length,sound='piano',age=0,v=80,level=1){
  const s=sample(midi,v),ratio=2**((midi-s.midi)/12),start=Math.max(context.currentTime,when),offset=Math.max(0,age)*ratio;
  const remaining=Math.max(0,length-age),duration=Math.min(remaining+release,(s.buffer.duration-offset)/ratio);
  if(duration<=0)return {stop(){}};
  const source=context.createBufferSource(),volume=context.createGain(),peak=gain(v)*level;
  source.buffer=s.buffer;source.playbackRate.value=ratio;
  // Small onset ramp avoids clicks; a curved release retains the recorded decay.
  const attack=Math.min(.004,duration/3),hold=Math.min(remaining,Math.max(attack,duration-.015));
  volume.gain.setValueAtTime(0,start);volume.gain.linearRampToValueAtTime(peak,start+attack);volume.gain.setValueAtTime(peak,start+hold);
  const tail=Math.max(.001,duration-hold);for(let i=1;i<=8;i++)volume.gain.linearRampToValueAtTime(peak*(1-i/8)**2,start+hold+tail*i/8);
  source.connect(volume).connect(context.destination);source.start(start,offset);source.stop(start+duration+.005);
  source.onended=()=>{source.disconnect();volume.disconnect();};
  return {stop(){try{const now=context.currentTime;if(volume.gain.cancelAndHoldAtTime)volume.gain.cancelAndHoldAtTime(now);else{volume.gain.cancelScheduledValues(now);volume.gain.setValueAtTime(volume.gain.value,now);}volume.gain.linearRampToValueAtTime(0,now+.008);source.stop(now+.01);}catch{}}};
 }
 function render(notes,from,length,rate){
  const out=[new Float32Array(length),new Float32Array(length)],to=from+length/rate;
  for(const n of valid(notes)){if(!Number.isFinite(n.start+n.end)||n.end<=n.start||n.end+release<=from||n.start>=to)continue;
   const s=sample(n.midi,n.velocity),ratio=2**((n.midi-s.midi)/12),a=Math.max(0,Math.ceil((n.start-from)*rate)),b=Math.min(length,Math.ceil((n.end+release-from)*rate)),level=gain(n.velocity);
   for(let i=a;i<b;i++){const age=from+i/rate-n.start,pos=age*s.rate*ratio,j=Math.floor(pos);if(j<0||j+1>=s.buffer.length)continue;const env=envelope(age,n.end-n.start)*level;for(let ch=0;ch<2;ch++){const x=s.channels[ch];out[ch][i]+=(x[j]+(x[j+1]-x[j])*(pos-j))*env;}}
  }for(const x of out)for(let i=0;i<x.length;i++)x[i]=clamp(x[i],-.95,.95);return out;
 }
 function header(frames,rate){const v=new DataView(new ArrayBuffer(44));for(const [p,s] of [[0,'RIFF'],[8,'WAVE'],[12,'fmt '],[36,'data']])for(let i=0;i<s.length;i++)v.setUint8(p+i,s.charCodeAt(i));v.setUint32(4,36+frames*4,true);v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,2,true);v.setUint32(24,rate,true);v.setUint32(28,rate*4,true);v.setUint16(32,4,true);v.setUint16(34,16,true);v.setUint32(40,frames*4,true);return v.buffer;}
 const int16=x=>Int16Array.from(x,v=>Math.round(clamp(v,-1,1)*(v<0?32768:32767)));
 async function exportAudio({notes,start=0,end,format='wav',encoder,progress=()=>{},cancelled=()=>false}){
  const rate=44100,selected=valid(notes).filter(n=>n.end>start&&n.start<end).map(n=>({...n,end:Math.min(end,n.end)}));
  if(!Number.isFinite(end-start)||end<=start||end-start>7200)throw Error('Choose a melody up to two hours long.');
  if(cancelled())throw Error('Export cancelled');await prepare('piano',null,{notes:selected});if(cancelled())throw Error('Export cancelled');
  const total=Math.ceil((end-start+release)*rate),parts=format==='wav'?[header(total,rate)]:[],mp3=format==='mp3'?new (await encoder()).Mp3Encoder(2,rate,256):null;
  for(let offset=0;offset<total;offset+=rate*2){if(cancelled())throw Error('Export cancelled');const stereo=render(selected,start+offset/rate,Math.min(rate*2,total-offset),rate).map(int16),[left,right]=stereo;
   if(mp3){for(let i=0;i<left.length;i+=1152){const b=mp3.encodeBuffer(left.subarray(i,i+1152),right.subarray(i,i+1152));if(b.length)parts.push(new Uint8Array(b));}}
   else{const b=new ArrayBuffer(left.length*4),view=new DataView(b);for(let i=0;i<left.length;i++){view.setInt16(i*4,left[i],true);view.setInt16(i*4+2,right[i],true);}parts.push(b);}
   progress(Math.round(Math.min(total,offset+left.length)/total*100));await new Promise(r=>setTimeout(r,0));
  }if(mp3){const tail=mp3.flush();if(tail.length)parts.push(new Uint8Array(tail));}return new Blob(parts,{type:mp3?'audio/mpeg':'audio/wav'});
 }
 return {prepare,tone,render,exportAudio,envelope,release};
})();
