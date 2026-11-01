window.BassCoach=(()=>{
 let stopCurrent=()=>{};
 const worklet=`class CoachCapture extends AudioWorkletProcessor{constructor(){super();this.ring=new Float32Array(4096);this.pos=0;this.count=0;this.hop=0;this.energy=0;this.size=0;this.floor=.001;this.previous=0;this.last=-9;}process(inputs){const x=inputs[0]?.[0];if(x){for(let i=0;i<x.length;i++){const v=x[i];this.ring[this.pos]=v;this.pos=(this.pos+1)%4096;this.count++;this.hop++;this.energy+=v*v;this.size++;if(this.size===256){const rms=Math.sqrt(this.energy/256),t=(currentFrame+i)/sampleRate;if(rms>.012&&rms>this.floor*2.4&&rms>this.previous*1.35&&t-this.last>.16){this.port.postMessage({type:'attack',time:t});this.last=t;}this.floor=this.floor*.94+rms*.06;this.previous=rms;this.size=0;this.energy=0;}}if(this.count>=4096&&this.hop>=2048){this.hop=0;const samples=new Float32Array(4096);samples.set(this.ring.subarray(this.pos));samples.set(this.ring.subarray(0,this.pos),4096-this.pos);this.port.postMessage({type:'pitch',samples},[samples.buffer]);}}return true;}}registerProcessor('bass-practice-coach',CoachCapture);`;
 async function start(context,source){
  stopCurrent();const $=id=>document.getElementById(id);let node,url,ended=false,beatTimer,origin=null,nextBeat=0,errors=[],attacks=new Set(),calibrating=false,calibrated=false,calibration=[],offset=Number($('coachOffset').value)/1000||0,bpm=Number($('coachBpm').value)||80;const clicks=new Set();
  const beatStop=()=>{clearInterval(beatTimer);beatTimer=null;origin=null;calibrating=false;calibration=[];for(const o of clicks)try{o.stop();}catch{}clicks.clear();$('coachBeat').textContent='Start beat';};
  const stop=()=>{if(ended)return;ended=true;beatStop();try{source.disconnect(node);node?.disconnect();}catch{}if(url)URL.revokeObjectURL(url);$('coachPitch').textContent='Tuner stopped';$('coachBeat').disabled=true;$('coachCalibrate').disabled=true;};stopCurrent=stop;
  function receive(d){if(ended)return;if(d.type==='pitch'){if(!$('coachPanel').open)return;const p=BassPracticeDSP.pitch(d.samples,context.sampleRate);$('coachPitch').textContent=!p?'Play one clear note':p.note+' · '+(Math.abs(p.cents)<=5?'In tune':Math.round(Math.abs(p.cents))+' cents '+(p.cents>0?'sharp':'flat'));}
   else if(d.type==='attack'&&origin!==null){const hardware=Math.max(0,Number(context.outputLatency)||Number(context.baseLatency)||0),t=BassPracticeDSP.timing(d.time,origin,bpm,hardware+offset);if(!t||attacks.has(t.beat))return;attacks.add(t.beat);if(attacks.size>1000)attacks.delete(attacks.values().next().value);
    if(calibrating){calibration.push(t.ms/1000);$('coachTiming').textContent='Calibration: '+calibration.length+'/8';if(calibration.length===8){calibration.sort((a,b)=>a-b);offset=Math.max(-.3,Math.min(.3,offset+(calibration[3]+calibration[4])/2));$('coachOffset').value=String(Math.round(offset*1000));calibrating=false;calibrated=true;errors=[];$('coachTiming').textContent='Delay adjusted. Keep playing.';}return;}
    if(!calibrated){$('coachTiming').textContent='Calibrate first for timing feedback.';return;}errors.push(t.ms);errors=errors.slice(-16);const mean=errors.reduce((s,n)=>s+Math.abs(n),0)/errors.length,last=t.ms;$('coachTiming').textContent=(Math.abs(last)<25?'On beat':Math.round(Math.abs(last))+' ms '+(last<0?'early':'late'))+' · average gap '+Math.round(mean)+' ms';
   }
  }
  try{
   if(context.audioWorklet){url=URL.createObjectURL(new Blob([worklet],{type:'text/javascript'}));await context.audioWorklet.addModule(url);if(ended||context.state==='closed')return;
    node=new AudioWorkletNode(context,'bass-practice-coach');node.port.onmessage=e=>receive(e.data);
   }else{
    node=context.createScriptProcessor(2048,1,1);const ring=new Float32Array(4096);let pos=0,count=0,energy=0,size=0,floor=.001,previous=0,last=-9;
    node.onaudioprocess=e=>{const x=e.inputBuffer.getChannelData(0);for(let i=0;i<x.length;i++){const v=x[i];ring[pos]=v;pos=(pos+1)%4096;count++;energy+=v*v;size++;if(size===256){const rms=Math.sqrt(energy/256),t=e.playbackTime+i/context.sampleRate;if(rms>.012&&rms>floor*2.4&&rms>previous*1.35&&t-last>.16){receive({type:'attack',time:t});last=t;}floor=floor*.94+rms*.06;previous=rms;energy=0;size=0;}}if(count>=4096){const samples=new Float32Array(4096);samples.set(ring.subarray(pos));samples.set(ring.subarray(0,pos),4096-pos);receive({type:'pitch',samples});}};
   }
   source.connect(node);node.connect(context.destination);
   $('coachPitch').textContent='Play one clear note';$('coachTiming').textContent='Use headphones. Calibrate before playing.';$('coachBeat').disabled=false;$('coachCalibrate').disabled=false;
   $('coachBeat').onclick=()=>{if(origin!==null){beatStop();$('coachTiming').textContent='Beat stopped.';return;}bpm=Math.max(40,Math.min(240,Number($('coachBpm').value)||80));$('coachBpm').value=String(bpm);const period=60/bpm,start=context.currentTime+.2;origin=start+4*period;nextBeat=0;errors=[];attacks.clear();$('coachBeat').textContent='Stop beat';$('coachTiming').textContent='Count in: 4 beats.';
    const schedule=()=>{while(start+nextBeat*period<context.currentTime+.25){const t=start+nextBeat*period;nextBeat++;if(t<context.currentTime)continue;const o=context.createOscillator(),g=context.createGain();o.frequency.value=nextBeat<=4?1000:700;g.gain.setValueAtTime(.12,t);g.gain.exponentialRampToValueAtTime(.0001,t+.035);o.connect(g).connect(context.destination);o.start(t);o.stop(t+.04);clicks.add(o);o.onended=()=>{clicks.delete(o);o.disconnect();g.disconnect();};}};schedule();beatTimer=setInterval(schedule,50);
   };
   $('coachCalibrate').onclick=()=>{if(origin===null)$('coachBeat').click();calibrating=true;calibration=[];$('coachTiming').textContent='Play 8 steady attacks on the beat.';};
   $('coachPanel').ontoggle=()=>{if(!$('coachPanel').open)beatStop();};
   $('coachOffset').onchange=()=>{offset=Math.max(-.3,Math.min(.3,Number($('coachOffset').value)/1000||0));calibrated=true;errors=[];};
  }catch(e){stop();$('coachPitch').textContent='Tuner unavailable in this browser.';}
  return {stop};
 }
 return {start,stop:()=>stopCurrent()};
})();
