/* Independently mute bass and vocals using the shared playback clock. */
window.BassBacking=(()=>{
 'use strict';
 let attemptedSession=null;
 let api,enabled=false,busy=false,ready=false,message='',token=0,saved=null,gate=null,bassGate=null,vocalGate=null,vocalsMuted=false,session=null;
 const players=[new Audio(),new Audio(),new Audio()],urls=[];let startPending=false;
 players.forEach(p=>{p.preload='auto';p.preservesPitch=true;p.addEventListener('error',()=>{if(enabled)fail('Mute playback failed. Original track restored.');});});
 function changed(){api?.update();}
 function stop(){players.forEach(p=>p.pause());}
 function fail(text){enabled=false;vocalsMuted=false;api?.setMuted(false);stop();route();message=text;changed();}
 function reset(){token++;enabled=false;busy=false;ready=false;vocalsMuted=false;saved=null;message='';session=null;stop();for(const p of players){p.removeAttribute('src');p.load();}for(const url of urls)URL.revokeObjectURL(url);urls.length=0;route();}
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
   const cached=key?await api.readCache(key).catch(()=>null):null;
   if(cancelled())return;
   let blobs=cached?.duration===s.duration&&cached.blobs?.length===3?cached.blobs:null;
   if(blobs){
    try{await load(blobs,mine,s.duration);}catch{blobs=null;}
    if(cancelled())return;
   }
   let stored=!!blobs;
   if(!blobs){
    const parts=[[],[],[]],rate=44100;let frames=0;
    for(let from=0;from<s.duration;from+=20){
     const to=Math.min(s.duration,from+20),audioStart=Math.max(0,from-.4),audioEnd=Math.min(s.duration,to+.4),audio=await api.extract(audioStart,audioEnd,p=>{message='Preparing mute controls '+Math.min(99,Math.round((from+(to-from)*p/100)/s.duration*100))+'%';changed();},cancelled);
     if(cancelled())throw Error('Cancelled');
     if(audio.numberOfChannels!==6||audio.sampleRate!==rate)throw Error('Instrumental output is incomplete.');
     const first=Math.round((from-audioStart)*rate),last=first+Math.round((to-from)*rate);
     for(let i=0;i<3;i++)parts[i].push(pcmPart(audio,i*2,first,last));frames+=last-first;
    }
    blobs=parts.map(p=>wav(p,frames,rate));
    message='Saving mute controls…';changed();
    if(key)try{await api.writeCache(key,s.duration,blobs);stored=true;}catch{}
    if(cancelled())return;
    await load(blobs,mine,s.duration);
    if(cancelled())return;
   }
   const encoded=[];for(const blob of blobs){encoded.push(await api.encode(blob));if(cancelled())return;}if(cancelled())throw Error('Cancelled');
   saved={version:2,duration:s.duration,mime:'audio/wav',accompanimentBase64:encoded[0],bassBase64:encoded[1],vocalsBase64:encoded[2]};
   ready=true;enabled=!!target;vocalsMuted=target==='vocals';if(target)api.setMuted(target==='bass'||s.bassMuted);message=stored?'Mute controls saved on this device.':'Device copy unavailable. Check that the song finishes saving.';route();api.save();
  }catch(e){if(mine===token){ready=false;enabled=false;vocalsMuted=false;saved=null;api.setMuted(false);route();message=e.message==='Cancelled'?'Preparation cancelled.':e.message||'Could not prepare bass mute.';}}
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
 function cancel(){if(!busy)return;token++;busy=false;enabled=false;vocalsMuted=false;api.setMuted(false);stop();message='Preparation cancelled.';route();changed();}
 async function restore(value){
  if(!value)return;const mine=token,s=api.get();
  try{
   if(![1,2].includes(value.version)||!Number.isFinite(value.duration)||Math.abs(value.duration-s.duration)>.1||typeof value.accompanimentBase64!=='string'||typeof value.bassBase64!=='string'||(value.version===2&&typeof value.vocalsBase64!=='string'))throw Error('Invalid saved backing track');
   const blobs=[value.accompanimentBase64,value.bassBase64,...(value.version===2?[value.vocalsBase64]:[])].map(v=>{const text=atob(v),out=new Uint8Array(text.length);for(let i=0;i<text.length;i++)out[i]=text.charCodeAt(i);return new Blob([out],{type:'audio/wav'});});
   await load(blobs,mine,s.duration);if(mine!==token)return;session=s.session;saved=value;ready=true;message=value.version===2?'Mute controls ready.':'Bass mute ready.';changed();
  }catch{if(mine===token){ready=false;message='Saved bass mute is unavailable. You can prepare it again.';changed();}}
 }
 function init(hooks){api=hooks;const master=api.get().master;for(const event of ['play','pause','seeking','seeked','ratechange','ended'])master.addEventListener(event,()=>void sync(true));}
 return {init,prepareForSong,toggle,cancel,reset,sync,restore,exportData:()=>saved,state:()=>({enabled,busy,ready,vocalsReady:ready&&saved?.version===2,canRetry:attemptedSession!==null&&attemptedSession===api?.get().session&&!busy,vocalsMuted,bassMuted:!!api?.get().bassMuted,message}),pcmPart,wav};
})();
