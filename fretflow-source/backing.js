/* Independently mute bass and vocals using the shared playback clock. */
window.BassBacking=(()=>{
 'use strict';
 let attemptedSession=null,availableBlobs=null,needsFileSave=false;
 let api,enabled=false,busy=false,ready=false,message='',token=0,saved=null,gate=null,bassGate=null,vocalGate=null,vocalsMuted=false,session=null;
 const players=[new Audio(),new Audio(),new Audio()],urls=[];let startPending=false;
 players.forEach(p=>{p.preload='auto';p.preservesPitch=true;p.addEventListener('error',()=>{if(enabled)fail('Mute playback failed. Original track restored.');});});
 function changed(){api?.update();}
 function stop(){players.forEach(p=>p.pause());}
 function fail(text){enabled=false;vocalsMuted=false;api?.setMuted(false);stop();route();message=text;changed();}
 function reset(){token++;availableBlobs=null;needsFileSave=false;attemptedSession=null;enabled=false;busy=false;ready=false;vocalsMuted=false;saved=null;message='';session=null;stop();for(const p of players){p.removeAttribute('src');p.load();}for(const url of urls)URL.revokeObjectURL(url);urls.length=0;route();}
 function route(){
  if(!api)return;
  if(enabled&&!gate){const g=api.graph();gate=g.ctx.createGain();bassGate=g.ctx.createGain();g.ctx.createMediaElementSource(players[0]).connect(gate).connect(g.main);const b=g.ctx.createMediaElementSource(players[1]);b.connect(bassGate);for(const output of g.bass)bassGate.connect(output);vocalGate=g.ctx.createGain();g.ctx.createMediaElementSource(players[2]).connect(vocalGate).connect(g.main);}
  if(gate){const g=api.graph();gate.gain.setTargetAtTime(enabled?1:0,g.ctx.currentTime,.01);bassGate.gain.setTargetAtTime(enabled?1:0,g.ctx.currentTime,.01);vocalGate.gain.setTargetAtTime(enabled&&!vocalsMuted?1:0,g.ctx.currentTime,.01);}
 }
 async function sync(force=false){
  if(!api||!enabled||!ready)return;const s=api.get(),master=s.master;
  if(s.session!==session){reset();changed();return;}
  const activePlayers=players.slice(0,saved?.version===2?3:2);
  for(const p of activePlayers){p.playbackRate=master.playbackRate;p.preservesPitch=true;if(force||Math.abs(p.currentTime-master.currentTime)>.045)p.currentTime=Math.min(master.currentTime,p.duration||0);}
  if(master.paused||master.ended){stop();return;}
  if(startPending||activePlayers.every(p=>!p.paused))return;
  startPending=true;const mine=token;
  try{await Promise.all(activePlayers.map(p=>p.play()));if(mine!==token||!enabled||api.get().master.paused)stop();}
  catch{if(mine===token)fail('Mute playback failed. Original track restored.');}finally{startPending=false;}
 }
 function pcmPart(buffer,offset,start=0,end=buffer.length){
  const out=new Uint8Array((end-start)*4),v=new DataView(out.buffer),a=buffer.getChannelData(offset),b=buffer.getChannelData(offset+1);
  for(let i=0;i<end-start;i++){for(let c=0;c<2;c++){const x=Math.max(-1,Math.min(1,c?b[i+start]:a[i+start]));v.setInt16(i*4+c*2,Math.round(x<0?x*32768:x*32767),true);}}return out;
 }
 function wav(parts,frames,rate){const h=new DataView(new ArrayBuffer(44));const str=(p,t)=>{for(let i=0;i<t.length;i++)h.setUint8(p+i,t.charCodeAt(i));};str(0,'RIFF');h.setUint32(4,36+frames*4,true);str(8,'WAVEfmt ');h.setUint32(16,16,true);h.setUint16(20,1,true);h.setUint16(22,2,true);h.setUint32(24,rate,true);h.setUint32(28,rate*4,true);h.setUint16(32,4,true);h.setUint16(34,16,true);str(36,'data');h.setUint32(40,frames*4,true);return new Blob([h.buffer,...parts],{type:'audio/wav'});}
 function canRestore(value,duration){
  return [1,2].includes(value?.version)&&Number.isFinite(value.duration)&&Math.abs(value.duration-duration)<=.1&&
    [value.accompanimentBase64,value.bassBase64,...(value.version===2?[value.vocalsBase64]:[])].every(v=>typeof v==='string'&&v.length>=60);
 }
 async function validWav(blob,duration){
  if(!blob||blob.size<44)return false;
  const h=new DataView(await blob.slice(0,44).arrayBuffer());
  if(h.getUint32(0)!==0x52494646||h.getUint32(8)!==0x57415645||h.getUint32(4,true)+8>blob.size)return false;
  if(h.getUint32(36)!==0x64617461)return true;
  const bytes=h.getUint32(40,true),bytesPerSecond=h.getUint32(28,true);
  return bytes+44<=blob.size&&Math.abs(bytes/bytesPerSecond-duration)<=.1;
 }
 async function load(blobs,mine,duration){
  const old=urls.splice(0);try{
   await Promise.all(blobs.map((blob,i)=>new Promise((resolve,reject)=>{
    const p=players[i],url=URL.createObjectURL(blob);urls.push(url);const timer=setTimeout(()=>done(Error('Audio loading timed out')),20000);
    function done(error){clearTimeout(timer);p.removeEventListener('loadedmetadata',ok);p.removeEventListener('error',bad);error?reject(error):resolve();}
    function ok(){done(Math.abs(p.duration-duration)>.1?Error('Instrumental timing does not match the song'):null);}
    function bad(){done(Error('Instrumental audio is unavailable'));}
    p.addEventListener('loadedmetadata',ok);p.addEventListener('error',bad);p.src=url;p.load();
   })));
   if(mine!==token)throw Error('Cancelled');
  }finally{for(const url of old)URL.revokeObjectURL(url);}
 }
 async function prepare(target){
  const s=api.get();if(!s.loaded||s.busy)throw Error('Wait for the current song to finish loading or analysing.');
  if(target)api.pause();
  const mine=++token;busy=true;session=s.session;enabled=false;stop();route();message='Checking saved mute controls…';changed();
  const cancelled=()=>mine!==token||api.get().session!==s.session;
  try{
   const key=await api.cacheKey().catch(()=>'');
   if(cancelled())return;
   const cached=(!availableBlobs&&key)?await api.readCache(key).catch(()=>null):null;
   if(cancelled())return;
   let blobs=availableBlobs;
   if(!blobs&&Math.abs((cached?.duration??Infinity)-s.duration)<=.1&&cached.blobs?.length===3&&(await Promise.all(cached.blobs.map(b=>validWav(b,s.duration).catch(()=>false)))).every(Boolean)){
    blobs=cached.blobs;needsFileSave=true;
   }
   if(!blobs){
    const parts=[[],[],[]],rate=44100;let frames=0;
    for(let from=0;from<s.duration;from+=20){
     const to=Math.min(s.duration,from+20),count=Math.round((to-from)*rate);
     const partId=key&&key+':part:'+from;
     const stored=partId?await api.readCache(partId).catch(()=>null):null;
     if(cancelled())return;
     let pcm=stored?.frames===count&&stored.parts?.length===3&&stored.parts.every(p=>p?.size===count*4)?stored.parts:null;
     if(!pcm){
      const audioStart=Math.max(0,from-.4),audioEnd=Math.min(s.duration,to+.4);
      const audio=await api.extract(audioStart,audioEnd,p=>{message='Preparing mute controls '+Math.min(99,Math.round((from+(to-from)*p/100)/s.duration*100))+'%';changed();},cancelled);
      if(cancelled())return;
      if(audio.numberOfChannels!==6||audio.sampleRate!==rate)throw Error('Instrumental output is incomplete.');
      const first=Math.round((from-audioStart)*rate);
      pcm=parts.map((_,i)=>new Blob([pcmPart(audio,i*2,first,first+count)]));
      if(partId&&api.writePart)await api.writePart(partId,count,pcm).catch(()=>{});
      if(cancelled())return;
     }
     pcm.forEach((part,i)=>parts[i].push(part));frames+=count;
    }
    blobs=parts.map(p=>wav(p,frames,rate));needsFileSave=true;
    message='Keeping a device copy of the mute audio…';changed();
    if(key){
     try{
      await api.writeCache(key,s.duration,blobs);
      if(api.removePart)for(let from=0;from<s.duration;from+=20)await api.removePart(key+':part:'+from).catch(()=>{});
     }catch{}
    }
    if(cancelled())return;
   }
   availableBlobs=blobs;
   if(!saved||saved.version!==2){
    const encoded=[];
    for(const blob of blobs){
     const pieces=[],chunk=3*1024*1024;
     for(let i=0;i<blob.size;i+=chunk){pieces.push(await api.encode(blob.slice(i,i+chunk)));if(cancelled())return;}
     encoded.push(pieces.join(''));
    }
    saved={version:2,duration:s.duration,mime:'audio/wav',accompanimentBase64:encoded[0],bassBase64:encoded[1],vocalsBase64:encoded[2]};
   }
   if(needsFileSave){needsFileSave=false;api.save();}
   message='Loading mute audio…';changed();
   await load(blobs,mine,s.duration);
   if(cancelled())return;
   ready=true;enabled=!!target;vocalsMuted=target==='vocals';if(target)api.setMuted(target==='bass'||s.bassMuted);
   message='Mute controls ready.';route();
   void api.bassStemReady?.(blobs[1],s.session);
  }catch(e){if(mine===token){ready=false;enabled=false;vocalsMuted=false;api.setMuted(false);route();message=availableBlobs?'Mute audio could not load. Tap Vocals to retry.':e.message||'Could not prepare mute controls.';}}
  finally{if(mine===token){busy=false;changed();}}
 }
 async function prepareForSong(){
  const s=api.get();
  if(!s.loaded||s.busy||busy||enabled||saved?.version===2||attemptedSession===s.session)return;
  attemptedSession=s.session;
  await prepare(null);
 }
 async function toggle(target='bass'){try{
  if(busy)return;
  if(!ready||(target==='vocals'&&saved?.version!==2)){await prepare(target);return;}
  if(target==='vocals')vocalsMuted=!vocalsMuted;else api.setMuted(!api.get().bassMuted);
  enabled=!!api.get().bassMuted||vocalsMuted;message='';route();if(enabled)void sync(true);else stop();changed();
 }catch(e){message=e.message||'Could not prepare mute controls.';changed();}}
 function cancel(){if(!busy)return;token++;api.stopWork?.();busy=false;enabled=false;vocalsMuted=false;api.setMuted(false);stop();message='Preparation cancelled.';route();changed();}
 async function restore(value){
  if(!value)return;const mine=token,s=api.get();
  try{
   if(!canRestore(value,s.duration))throw Error('Invalid saved backing track');
   const encoded=[value.accompanimentBase64,value.bassBase64,...(value.version===2?[value.vocalsBase64]:[])];
   const blobs=[];
   for(const base64 of encoded){
    const pieces=[],chunk=1024*1024;
    if(!base64.length)throw Error('Missing saved audio');
    for(let offset=0;offset<base64.length;offset+=chunk){
     const text=atob(base64.slice(offset,offset+chunk)),bytes=new Uint8Array(text.length);
     for(let i=0;i<text.length;i++)bytes[i]=text.charCodeAt(i);
     pieces.push(bytes);
     if(offset&&offset%(8*chunk)===0){await new Promise(resolve=>setTimeout(resolve,0));if(mine!==token)return;}
    }
    const blob=new Blob(pieces,{type:'audio/wav'});
    if(!await validWav(blob,s.duration))throw Error('Invalid saved WAV');
    blobs.push(blob);
   }
   if(mine!==token)return;
   session=s.session;saved=value;if(value.version===2){availableBlobs=blobs;attemptedSession=session;}
   await load(blobs,mine,s.duration);if(mine!==token)return;
   ready=true;message=value.version===2?'Saved mute controls ready.':'Bass mute ready.';changed();
   void api.bassStemReady?.(blobs[1],s.session);
  }catch{if(mine===token){ready=false;message=availableBlobs?'Saved mute audio could not load. Tap Vocals to retry.':'Saved mute audio is incomplete.';changed();}}
 }
 async function bandExcerpt(start,end){
  if(session!==api?.get().session||availableBlobs?.length!==3||!(start>=0&&end>start))return null;
  const mine=token,stems=[availableBlobs[0],availableBlobs[2]];
  const headers=await Promise.all(stems.map(async blob=>new DataView(await blob.slice(0,44).arrayBuffer())));
  if(mine!==token||headers.some(h=>h.byteLength!==44||h.getUint32(36)!==0x64617461||
    h.getUint16(20,true)!==1||h.getUint16(22,true)!==2||h.getUint16(34,true)!==16))return null;
  const rate=headers[0].getUint32(24,true);
  const from=Math.round(start*rate),to=Math.round(end*rate),length=to-from;
  if(!length||headers.some((h,i)=>h.getUint32(24,true)!==rate||44+to*4>stems[i].size))return null;
  const pcm=await Promise.all(stems.map(async blob=>new DataView(await blob.slice(44+from*4,44+to*4).arrayBuffer())));
  if(mine!==token)return null;
  const audio=new AudioBuffer({numberOfChannels:2,length,sampleRate:rate});
  for(let c=0;c<2;c++){
    const samples=audio.getChannelData(c);
    for(let i=0;i<length;i++){
      const pos=(i*2+c)*2;
      samples[i]=(pcm[0].getInt16(pos,true)+pcm[1].getInt16(pos,true))/32768;
    }
  }
  return audio;
 }
 // Cache fixed slices so nearby and repeated loops share the same separation.
 let rehearsalSession,rehearsalVersion=0,rehearsalQueue=Promise.resolve();
 const rehearsalBlocks=new Map();
 function cancelRehearsalBand(){rehearsalVersion++;return rehearsalQueue;}
 async function rehearsalBand(start,end,progress,cancelled){
  const song=api.get(),rate=44100,blockSeconds=8,version=rehearsalVersion;
  const stopped=()=>version!==rehearsalVersion||song.session!==api.get().session;
  const abandoned=()=>cancelled()||stopped();
  const check=()=>{if(abandoned())throw new DOMException('Preparation cancelled.','AbortError');};
  const saved=await bandExcerpt(start,end);
  check();
  if(saved)return saved;
  if(rehearsalSession!==song.session){rehearsalBlocks.clear();rehearsalSession=song.session;}
  const from=Math.round(start*rate),to=Math.round(end*rate),blockSize=rate*blockSeconds;
  const output=new AudioBuffer({numberOfChannels:2,length:to-from,sampleRate:rate});
  const dest=[output.getChannelData(0),output.getChannelData(1)];
  for(let block=Math.floor(from/blockSize)*blockSize;block<to;block+=blockSize){
   check();
   const finish=Math.min(block+blockSize,Math.round(song.duration*rate)),first=Math.max(from,block),last=Math.min(to,finish);
   let pcm=rehearsalBlocks.get(block);
   if(!pcm){
    // Serialise the shared worker. A running slice can serve a subsequent passage.
    const job=rehearsalQueue.then(async()=>{
     check();
     if(rehearsalBlocks.has(block))return rehearsalBlocks.get(block);
     while(api.get().busy){
      await new Promise(resolve=>setTimeout(resolve,120));
      check();
      const ready=await bandExcerpt(start,end);
      if(ready)return {ready};
     }
     const a=Math.max(0,block/rate-.4),b=Math.min(song.duration,finish/rate+.4);
     const audio=await api.extract(a,b,p=>{if(!abandoned())progress(Math.min(99,Math.round((first-from+(last-first)*p/100)/(to-from)*100)));},stopped);
     if(stopped())throw new DOMException('Preparation cancelled.','AbortError');
     const offset=block-Math.round(a*rate),length=finish-block;
     if(audio.sampleRate!==rate||audio.numberOfChannels!==6||offset+length>audio.length)throw Error('Instrumental output is incomplete.');
     const stereo=[new Float32Array(length),new Float32Array(length)];
     for(let c=0;c<2;c++){
      const music=audio.getChannelData(c),voice=audio.getChannelData(c+4);
      for(let i=0;i<length;i++)stereo[c][i]=music[offset+i]+voice[offset+i];
     }
     rehearsalBlocks.set(block,stereo);
     if(rehearsalBlocks.size>8)rehearsalBlocks.delete(rehearsalBlocks.keys().next().value);
     return stereo;
    });
    rehearsalQueue=job.catch(()=>{});
    pcm=await job;
    check();
    if(pcm.ready)return pcm.ready;
   }
   for(let c=0;c<2;c++)dest[c].set(pcm[c].subarray(first-block,last-block),first-from);
  }
  return output;
 }
 function init(hooks){api=hooks;const master=api.get().master;for(const event of ['play','pause','seeking','seeked','ratechange','ended'])master.addEventListener(event,()=>void sync(true));}
 return {init,canRestore,prepareForSong,toggle,cancel,reset,sync,restore,bandExcerpt,rehearsalBand,cancelRehearsalBand,exportData:()=>saved,state:()=>({enabled,busy,ready,vocalsReady:ready&&saved?.version===2,canRetry:attemptedSession!==null&&attemptedSession===api?.get().session&&!busy,vocalsMuted,bassMuted:!!api?.get().bassMuted,message}),pcmPart,wav};
})();
