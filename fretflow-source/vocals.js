/* Optional on-device instrumental stems, synchronised to the existing master. */
window.BassVocalMute=(()=>{
 'use strict';
 let api,enabled=false,busy=false,ready=false,message='',token=0,saved=null,gate=null,bassGate=null,session=null;
 const players=[new Audio(),new Audio()],urls=[];let startPending=false;
 players.forEach(p=>{p.preload='auto';p.preservesPitch=true;p.addEventListener('error',()=>{if(enabled)fail('Vocal mute could not play. Original track restored.');});});
 function changed(){api?.update();}
 function stop(){players.forEach(p=>p.pause());}
 function fail(text){enabled=false;stop();message=text;changed();}
 function reset(){token++;enabled=false;busy=false;ready=false;saved=null;message='';session=null;stop();for(const p of players){p.removeAttribute('src');p.load();}for(const url of urls)URL.revokeObjectURL(url);urls.length=0;route();}
 function route(){
  if(!api)return;
  if(enabled&&!gate){const g=api.graph();gate=g.ctx.createGain();bassGate=g.ctx.createGain();g.ctx.createMediaElementSource(players[0]).connect(gate).connect(g.main);const b=g.ctx.createMediaElementSource(players[1]);b.connect(bassGate);for(const output of g.bass)bassGate.connect(output);}
  if(gate){const g=api.graph();gate.gain.setTargetAtTime(enabled?1:0,g.ctx.currentTime,.01);bassGate.gain.setTargetAtTime(enabled?1:0,g.ctx.currentTime,.01);}
 }
 async function sync(force=false){
  if(!api||!enabled||!ready)return;const s=api.get(),master=s.master;
  if(s.session!==session){reset();changed();return;}
  for(const p of players){p.playbackRate=master.playbackRate;p.preservesPitch=true;if(force||Math.abs(p.currentTime-master.currentTime)>.045)p.currentTime=Math.min(master.currentTime,p.duration||0);}
  if(master.paused||master.ended){stop();return;}
  if(startPending||players.every(p=>!p.paused))return;
  startPending=true;const mine=token;
  try{await Promise.all(players.map(p=>p.play()));if(mine!==token||!enabled||api.get().master.paused)stop();}
  catch{if(mine===token)fail('Vocal mute could not play. Original track restored.');}finally{startPending=false;}
 }
 function pcmPart(buffer,offset,start=0,end=buffer.length){
  const out=new Uint8Array((end-start)*4),v=new DataView(out.buffer),a=buffer.getChannelData(offset),b=buffer.getChannelData(offset+1);
  for(let i=0;i<end-start;i++){for(let c=0;c<2;c++){const x=Math.max(-1,Math.min(1,c?b[i+start]:a[i+start]));v.setInt16(i*4+c*2,Math.round(x<0?x*32768:x*32767),true);}}return out;
 }
 function wav(parts,frames,rate){const h=new DataView(new ArrayBuffer(44));const str=(p,t)=>{for(let i=0;i<t.length;i++)h.setUint8(p+i,t.charCodeAt(i));};str(0,'RIFF');h.setUint32(4,36+frames*4,true);str(8,'WAVEfmt ');h.setUint32(16,16,true);h.setUint16(20,1,true);h.setUint16(22,2,true);h.setUint32(24,rate,true);h.setUint32(28,rate*4,true);h.setUint16(32,4,true);h.setUint16(34,16,true);str(36,'data');h.setUint32(40,frames*4,true);return new Blob([h.buffer,...parts],{type:'audio/wav'});}
 async function load(blobs,mine,duration){
  const old=urls.splice(0);try{
   await Promise.all(players.map((p,i)=>new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(blobs[i]);urls.push(url);const timer=setTimeout(()=>done(Error('Audio loading timed out')),20000);
    function done(error){clearTimeout(timer);p.removeEventListener('loadedmetadata',ok);p.removeEventListener('error',bad);error?reject(error):resolve();}
    function ok(){done(Math.abs(p.duration-duration)>.1?Error('Instrumental timing does not match the song'):null);}
    function bad(){done(Error('Instrumental audio is unavailable'));}
    p.addEventListener('loadedmetadata',ok);p.addEventListener('error',bad);p.src=url;p.load();
   })));
   if(mine!==token)throw Error('Cancelled');
  }finally{for(const url of old)URL.revokeObjectURL(url);}
 }
 async function prepare(){
  const s=api.get();if(!s.loaded||s.busy)throw Error('Wait for the current song to finish loading or analysing.');
  api.pause();const mine=++token;busy=true;session=s.session;enabled=false;message='Preparing vocal mute…';changed();
  const cancelled=()=>mine!==token||api.get().session!==s.session;
  try{
   const parts=[[],[]],rate=44100;let frames=0;
   for(let from=0;from<s.duration;from+=20){
    const to=Math.min(s.duration,from+20),audioStart=Math.max(0,from-.4),audioEnd=Math.min(s.duration,to+.4),audio=await api.extract(audioStart,audioEnd,p=>{message='Preparing vocal mute '+Math.min(99,Math.round((from+(to-from)*p/100)/s.duration*100))+'%';changed();},cancelled);
    if(cancelled())throw Error('Cancelled');
    if(audio.numberOfChannels!==4||audio.sampleRate!==rate)throw Error('Instrumental output is incomplete.');
    const first=Math.round((from-audioStart)*rate),last=first+Math.round((to-from)*rate);
    parts[0].push(pcmPart(audio,0,first,last));parts[1].push(pcmPart(audio,2,first,last));frames+=last-first;
   }
   const blobs=parts.map(p=>wav(p,frames,rate));await load(blobs,mine,s.duration);if(cancelled())throw Error('Cancelled');
   const encoded=await Promise.all(blobs.map(api.encode));if(cancelled())throw Error('Cancelled');
   saved={version:1,duration:s.duration,mime:'audio/wav',accompanimentBase64:encoded[0],bassBase64:encoded[1]};
   ready=true;enabled=true;message='Vocals muted. Save the song to keep this. Some voice may remain.';route();
  }catch(e){if(mine===token){ready=false;enabled=false;saved=null;message=e.message==='Cancelled'?'Preparation cancelled.':e.message||'Could not prepare vocal mute.';}}
  finally{if(mine===token){busy=false;changed();}}
 }
 async function toggle(){try{
  if(busy)return;if(!ready){await prepare();return;}
  enabled=!enabled;message=enabled?'Vocals muted. Some voice may remain.':'Original vocals restored.';route();if(enabled)void sync(true);else stop();changed();
 }catch(e){message=e.message||'Could not prepare vocal mute.';changed();}}
 function cancel(){if(!busy)return;token++;busy=false;enabled=false;stop();message='Preparation cancelled.';route();changed();}
 async function restore(value){
  if(!value)return;const mine=token,s=api.get();
  try{
   if(value.version!==1||!Number.isFinite(value.duration)||Math.abs(value.duration-s.duration)>.1||typeof value.accompanimentBase64!=='string'||typeof value.bassBase64!=='string')throw Error('Invalid saved instrumental');
   const blobs=[value.accompanimentBase64,value.bassBase64].map(v=>{const text=atob(v),out=new Uint8Array(text.length);for(let i=0;i<text.length;i++)out[i]=text.charCodeAt(i);return new Blob([out],{type:'audio/wav'});});
   await load(blobs,mine,s.duration);if(mine!==token)return;session=s.session;saved=value;ready=true;message='Vocal mute ready.';changed();
  }catch{if(mine===token){ready=false;message='Saved vocal mute is unavailable. You can prepare it again.';changed();}}
 }
 function init(hooks){api=hooks;const master=api.get().master;for(const event of ['play','pause','seeking','seeked','ratechange','ended'])master.addEventListener(event,()=>void sync(true));}
 return {init,toggle,cancel,reset,sync,restore,exportData:()=>saved,state:()=>({enabled,busy,ready,message}),pcmPart,wav};
})();
