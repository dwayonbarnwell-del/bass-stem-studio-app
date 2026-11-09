/* RC238: local melody sound, file exports and microphone capture. */
window.BassPianoAudio=(()=>{
 'use strict';
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const names=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
 const label=m=>names[((m%12)+12)%12]+(Math.floor(m/12)-1);
 const banks=new Map(),loads=new Map();
 let decoder;
 const valid=notes=>notes.filter(n=>Number.isFinite(n.start+n.end+n.midi)&&n.end>n.start&&n.midi>=21&&n.midi<=108);
 const envelope=(age,length)=>Math.min(1,Math.max(0,age)/.006)*Math.min(1,Math.max(0,length-age)/.035);
 async function prepare(sound='piano',context){
  if(banks.has(sound))return banks.get(sound);
  if(loads.has(sound))return loads.get(sound);
  const task=(async()=>{
   const source=window.BassPianoSamples?.[sound];if(!source)throw Error('Sound unavailable');
   context??=(decoder??=new AudioContext());const bank=[];
   // Bounded decoding keeps memory and CPU predictable on phones.
   for(const [key,url] of Object.entries(source)){
    const bytes=Uint8Array.from(atob(url.split(',')[1]),c=>c.charCodeAt(0));
    const buffer=await context.decodeAudioData(bytes.buffer),channels=buffer.numberOfChannels,pcm=new Float32Array(buffer.length);
    for(let ch=0;ch<channels;ch++){const x=buffer.getChannelData(ch);for(let i=0;i<x.length;i++)pcm[i]+=x[i]/channels;}
    let peak=0;for(const v of pcm)peak=Math.max(peak,Math.abs(v));
    const gain=peak>0?.72/peak:1;for(let i=0;i<pcm.length;i++)pcm[i]*=gain;
    const mono=context.createBuffer(1,pcm.length,buffer.sampleRate);mono.copyToChannel(pcm,0);
    bank.push({midi:Number(key),pcm,rate:buffer.sampleRate,buffer:mono});
   }
   bank.sort((a,b)=>a.midi-b.midi);banks.set(sound,bank);return bank;
  })();loads.set(sound,task);try{return await task;}catch(e){loads.delete(sound);throw e;}
 }
 function sample(midi,sound){const bank=banks.get(sound);if(!bank?.length)throw Error('Sound loading');return bank.reduce((a,b)=>Math.abs(b.midi-midi)<Math.abs(a.midi-midi)?b:a);}
 function pcm(notes,from,length,rate,sound='piano'){
  const out=new Float32Array(length),to=from+length/rate;
  for(const n of valid(notes)){if(n.end<=from||n.start>=to)continue;const s=sample(n.midi,sound),ratio=2**((n.midi-s.midi)/12),a=Math.max(0,Math.ceil((n.start-from)*rate)),b=Math.min(length,Math.ceil((n.end-from)*rate));
   for(let i=a;i<b;i++){const age=from+i/rate-n.start,pos=age*s.rate*ratio,j=Math.floor(pos);if(j<0||j+1>=s.pcm.length)continue;const v=s.pcm[j]+(s.pcm[j+1]-s.pcm[j])*(pos-j);out[i]+=v*envelope(age,n.end-n.start);}
  }for(let i=0;i<length;i++)out[i]=clamp(out[i],-.95,.95);return out;
 }
 function header(samples,rate){const v=new DataView(new ArrayBuffer(44));const str=(p,s)=>{for(let i=0;i<s.length;i++)v.setUint8(p+i,s.charCodeAt(i));};str(0,'RIFF');v.setUint32(4,36+samples*2,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,samples*2,true);return v.buffer;}
 function int16(x){const out=new Int16Array(x.length);for(let i=0;i<x.length;i++){const v=clamp(x[i],-1,1);out[i]=Math.round(v*(v<0?32768:32767));}return out;}
 function littleEndian(x){const b=new ArrayBuffer(x.length*2),v=new DataView(b);for(let i=0;i<x.length;i++)v.setInt16(i*2,x[i],true);return b;}
 async function exportAudio({notes,start=0,end,sound='piano',format='wav',encoder,progress=()=>{},cancelled=()=>false}){
  await prepare(sound);if(cancelled())throw Error('Export cancelled');
  const rate=44100,total=Math.ceil((end-start)*rate);if(!Number.isFinite(total)||total<=0||total>rate*7200)throw Error('Choose a melody up to two hours long.');
  const parts=format==='wav'?[header(total,rate)]:[],mp3=format==='mp3'?new (await encoder()).Mp3Encoder(1,rate,192):null;
  for(let offset=0;offset<total;offset+=rate*2){if(cancelled())throw Error('Export cancelled');const x=int16(pcm(notes,start+offset/rate,Math.min(rate*2,total-offset),rate,sound));
   if(mp3){for(let i=0;i<x.length;i+=1152){const b=mp3.encodeBuffer(x.subarray(i,i+1152));if(b.length)parts.push(new Uint8Array(b));}}else parts.push(littleEndian(x));
   progress(Math.round(Math.min(total,offset+x.length)/total*100));await new Promise(r=>setTimeout(r,0));
  }if(mp3){const tail=mp3.flush();if(tail.length)parts.push(new Uint8Array(tail));}return new Blob(parts,{type:mp3?'audio/mpeg':'audio/wav'});
 }
 function tone(context,midi,when,length,sound='piano',age=0){
  const s=sample(midi,sound),remaining=Math.max(.015,length-age),start=Math.max(context.currentTime,when),o=context.createBufferSource(),g=context.createGain(),ratio=2**((midi-s.midi)/12);
  o.buffer=s.buffer;o.playbackRate.value=ratio;
  const offset=age*ratio;if(offset>=s.buffer.duration)return {stop(){}};
  const release=Math.min(.035,remaining/3);g.gain.setValueAtTime(0,start);g.gain.linearRampToValueAtTime(1,start+Math.min(.006,remaining/3));g.gain.setValueAtTime(1,start+remaining-release);g.gain.linearRampToValueAtTime(0,start+remaining);
  o.connect(g).connect(context.destination);o.start(start,offset);o.stop(start+remaining+.01);o.onended=()=>{o.disconnect();g.disconnect();};return {stop(){try{g.gain.cancelScheduledValues(context.currentTime);g.gain.setValueAtTime(g.gain.value,context.currentTime);g.gain.linearRampToValueAtTime(0,context.currentTime+.008);o.stop(context.currentTime+.01);}catch{}}};
 }
 function vlq(value){let n=Math.max(0,Math.round(value)),out=[n&127];while((n>>=7)>0)out.unshift((n&127)|128);return out;}
 function midi(notes,start=0,end=Infinity,sound='piano'){
  const events=[];for(const n of valid(notes)){if(n.end<=start||n.start>=end)continue;const a=Math.max(start,n.start),b=Math.min(end,n.end);events.push({t:Math.round((a-start)*960),bytes:[0x90,Math.round(n.midi),92],off:1},{t:Math.max(Math.round((a-start)*960)+1,Math.round((b-start)*960)),bytes:[0x80,Math.round(n.midi),0],off:0});}
  events.sort((a,b)=>a.t-b.t||a.off-b.off);const track=[0,0xff,0x51,3,7,0xa1,0x20,0,0xc0,sound==='bass'?33:0];let prev=0;for(const e of events){track.push(...vlq(e.t-prev),...e.bytes);prev=e.t;}track.push(0,0xff,0x2f,0);
  const n=track.length;return new Blob([new Uint8Array([77,84,104,100,0,0,0,6,0,0,0,1,1,224,77,84,114,107,(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255,...track])],{type:'audio/midi'});
 }
 function tracker(){let current=null,candidate=null,lastTime=0;const notes=[];
  function finish(t){if(current){current.end=Math.max(current.start,t);if(current.end-current.start>=.12)notes.push(current);current=null;}}
  function push(p,t,hop=.04){lastTime=t+hop;const m=p&&p.confidence>=.86&&p.midi>=36&&p.midi<=96?p.midi:null;
   if(m===null){finish(t);candidate=null;return;}
   if(current&&m===current.midi){current.end=t+hop;candidate=null;return;}
   if(!candidate||candidate.midi!==m)candidate={midi:m,start:t,count:1};else candidate.count++;
   if(candidate.count>=2){finish(candidate.start);current={midi:m,start:candidate.start,end:t+hop,confidence:p.confidence,source:'live-microphone-v1',manual:false};candidate=null;}
  }
  return {push,finish:()=>{finish(lastTime);return notes.map(n=>({...n}));},snapshot:()=>[...notes,...(current?[{...current}]:[])]};
 }
 const worklet=`class PianoCapture extends AudioWorkletProcessor{constructor(){super();this.block=new Float32Array(2048);this.pos=0;}process(inputs){const x=inputs[0]?.[0];if(x)for(const v of x){this.block[this.pos++]=v;if(this.pos===2048){this.port.postMessage(this.block,[this.block.buffer]);this.block=new Float32Array(2048);this.pos=0;}}return true;}}registerProcessor('piano-capture-v1',PianoCapture);`;
 async function capture({update=()=>{},cancelled=()=>false,maxSeconds=120}){
  if(!navigator.mediaDevices?.getUserMedia)throw Error('Microphone recording needs a secure browser connection.');
  let stream,context,node,source,url,closed=false,total=0;const chunks=[],ring=new Float32Array(4096),track=tracker();
  const close=async()=>{if(closed)return;closed=true;stream?.getTracks().forEach(t=>t.stop());try{source?.disconnect();node?.disconnect();}catch{}if(url)URL.revokeObjectURL(url);if(context&&context.state!=='closed')await context.close();};
  const receive=x=>{if(closed||cancelled()){void close();return;}const max=Math.floor(context.sampleRate*maxSeconds),remaining=max-total;if(remaining<=0)return;const block=x.length>remaining?x.slice(0,remaining):x;chunks.push(block.slice());total+=block.length;ring.copyWithin(0,block.length);ring.set(block,ring.length-block.length);
   const t=Math.max(0,(total-ring.length/2)/context.sampleRate),p=total>=ring.length?window.BassPracticeDSP.pitch(ring,context.sampleRate,65):null;track.push(p,t,block.length/context.sampleRate);
   update({time:total/context.sampleRate,pitch:p,notes:track.snapshot(),limit:total>=max});
  };
  try{stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:false,noiseSuppression:false,autoGainControl:false}});if(cancelled()){await close();throw Error('Recording cancelled');}
   context=new AudioContext();await context.resume();source=context.createMediaStreamSource(stream);
   if(context.audioWorklet){url=URL.createObjectURL(new Blob([worklet],{type:'text/javascript'}));await context.audioWorklet.addModule(url);if(cancelled()){await close();throw Error('Recording cancelled');}node=new AudioWorkletNode(context,'piano-capture-v1');node.port.onmessage=e=>receive(e.data);}
   else{node=context.createScriptProcessor(2048,1,1);node.onaudioprocess=e=>receive(e.inputBuffer.getChannelData(0));}
   const mute=context.createGain();mute.gain.value=0;source.connect(node).connect(mute).connect(context.destination);
   return {async stop(){const sr=context.sampleRate;await close();const notes=track.finish().map(n=>({...n,end:Math.min(total/sr,n.end)})).filter(n=>n.end>n.start);return {notes,duration:total/sr,blob:new Blob([header(total,sr),...chunks.map(x=>littleEndian(int16(x)))],{type:'audio/wav'})};},close};
  }catch(e){await close();throw e;}
 }
 return {prepare,label,pcm,header,exportAudio,tone,midi,tracker,capture,envelope};
})();
