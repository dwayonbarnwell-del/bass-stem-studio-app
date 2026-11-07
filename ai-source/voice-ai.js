window.BassVoiceAI=(()=>{
 const names=['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
 const profiles={major:[6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88],minor:[6.33,2.68,3.52,5.38,2.6,3.53,2.54,4.75,3.98,2.69,3.34,3.17]};
 function keyEstimate(hist,seconds){
  const peak=Math.max(...hist);if(seconds<3||hist.filter(v=>v>peak*.12).length<6)return 'Gathering notes';
  const centre=a=>{const mean=a.reduce((x,y)=>x+y,0)/a.length;return a.map(x=>x-mean)};
  const v=centre(hist),norm=Math.sqrt(v.reduce((a,b)=>a+b*b,0));if(!norm)return 'Unclear';
  const ranks=[];for(let root=0;root<12;root++)for(const [mode,p] of Object.entries(profiles)){
   const r=centre(Array.from({length:12},(_,i)=>p[(i-root+12)%12]));
   const score=v.reduce((a,b,i)=>a+b*r[i],0)/(norm*Math.sqrt(r.reduce((a,b)=>a+b*b,0)));
   ranks.push({name:names[root]+' '+mode,score});
  }
  ranks.sort((a,b)=>b.score-a.score);if(ranks[0].score<.65)return 'Unclear';
  return ranks[0].score-ranks[1].score<.08?ranks[0].name+' / '+ranks[1].name+' ?':ranks[0].name+' ?';
 }
 function readFrames(d,classify,mono=false){
  const counts=new Map(),votes=new Map(),hist=new Array(12).fill(0);let voiced=0;
  for(let f=0;f<d.frames;f++){
   const row=d.values.subarray(f*d.pitches,(f+1)*d.pitches),peak=Math.max(...row),chroma=new Float64Array(12);
   if(peak<(mono?.4:.3))continue;voiced++;
   const strongest=row.indexOf(peak);
   for(let p=0;p<row.length;p++)if((!mono||p===strongest)&&row[p]>=Math.max(.3,peak*.4)){
    const midi=p+21;counts.set(midi,(counts.get(midi)||0)+1);chroma[midi%12]+=row[p];hist[midi%12]+=row[p];
   }
   const result=mono?{kind:'notes'}:classify(chroma);if(result.kind==='chord')votes.set(result.label,(votes.get(result.label)||0)+1);
  }
  const notes=[...counts].filter(([,n])=>n>=d.frames*.3).map(([midi])=>midi).sort((a,b)=>a-b);
  const best=[...votes].sort((a,b)=>b[1]-a[1])[0];
  return {notes:notes.map(m=>names[m%12]+(Math.floor(m/12)-1)),midis:notes,chord:best&&best[1]>=d.frames*.5?best[0]:'—',hist,seconds:voiced*256/22050};
 }
 const worklet=`class VoiceCapture extends AudioWorkletProcessor{constructor(){super();this.ring=new Float32Array(43844);this.pos=0;this.count=0;this.since=0;}process(inputs,outputs){const a=inputs[0]?.[0];if(a){for(const x of a){this.ring[this.pos]=x;this.pos=(this.pos+1)%43844;}this.count+=a.length;this.since+=a.length;if(this.count>=43844&&this.since>=8820){this.since=0;const samples=new Float32Array(43844);samples.set(this.ring.subarray(this.pos));samples.set(this.ring.subarray(0,this.pos),43844-this.pos);this.port.postMessage({samples,end:(currentFrame+a.length)/sampleRate},[samples.buffer]);}}return true;}}registerProcessor('bass-voice-capture',VoiceCapture);`;
 async function start(context,source,onResult,onState){
  if(context.sampleRate!==22050)throw Error('This browser cannot start AI audio capture.');
  const assets=window.BASS_VOICE_ASSETS;
  const decode=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
  const workerUrl=URL.createObjectURL(new Blob([decode(assets.worker)],{type:'text/javascript'}));
  const workletUrl=URL.createObjectURL(new Blob([worklet],{type:'text/javascript'}));
  const worker=new Worker(workerUrl);let node=null,ready=false,busy=false,ended=false,latest=null,watchdog;
  const stop=()=>{if(ended)return;ended=true;clearTimeout(watchdog);worker.terminate();try{source.disconnect(node);node?.disconnect();}catch(_){}URL.revokeObjectURL(workerUrl);URL.revokeObjectURL(workletUrl);};
  const send=()=>{if(ended||!ready||busy||!latest)return;const data=latest;latest=null;let peak=0;for(const x of data.samples)peak=Math.max(peak,Math.abs(x));if(peak>.95){const gain=.95/peak;for(let i=0;i<data.samples.length;i++)data.samples[i]*=gain;}busy=true;worker.postMessage({type:'audio',...data},[data.samples.buffer]);clearTimeout(watchdog);watchdog=setTimeout(()=>{onState('AI took too long. Stop and retry.');stop();},20000);};
  worker.onmessage=({data:d})=>{
   if(ended)return;
   if(d.type==='ready'){ready=true;clearTimeout(watchdog);onState('AI ready. Listening for notes.');send();}
   else if(d.type==='notes'){busy=false;clearTimeout(watchdog);onResult(d);send();}
   else if(d.type==='error'){onState('AI could not run. Stop and retry; recording is still available.');stop();}
  };
  worker.onerror=()=>{onState('AI could not load. Stop and retry; recording is still available.');stop();};
  try{
   if(context.audioWorklet){
    await context.audioWorklet.addModule(workletUrl);
    if(context.state==='closed'){stop();throw Error('Microphone stopped.');}
    node=new AudioWorkletNode(context,'bass-voice-capture');node.port.onmessage=({data})=>{latest=data;send();};
   }else{
    node=context.createScriptProcessor(4096,1,1);
    const ring=new Float32Array(43844);let pos=0,count=0,since=0;
    node.onaudioprocess=e=>{
     const a=e.inputBuffer.getChannelData(0);for(const x of a){ring[pos]=x;pos=(pos+1)%43844;}count+=a.length;since+=a.length;
     if(count>=43844&&since>=8820){since=0;const samples=new Float32Array(43844);samples.set(ring.subarray(pos));samples.set(ring.subarray(0,pos),43844-pos);latest={samples,end:e.playbackTime};send();}
    };
   }
   source.connect(node);node.connect(context.destination); // Capture outputs silence: no feedback.
   onState('Starting AI…');watchdog=setTimeout(()=>{onState('AI could not start. Stop and retry.');stop();},30000);
   worker.postMessage({type:'init',assets});return {stop};
  }catch(e){stop();throw e;}
 }
 return Object.freeze({start,readFrames,keyEstimate});
})();
