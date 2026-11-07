/* RC209: fast, local basic chords. No uploads or paid requests. */
window.BassResponsiveLive = (()=>{
 'use strict';
 const names=['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
 const blank=()=>({chord:'—',confidence:0});
 const triads=[];
 for(let root=0;root<12;root++)for(const [suffix,steps] of [['',[0,4,7]],['m',[0,3,7]]])
  triads.push({chord:names[root]+suffix,pcs:steps.map(n=>(n+root)%12)});
 function rank(chroma,{inside=.68,minimum=.14,margin=.035}={}){
  const total=chroma.reduce((a,b)=>a+b,0),peak=Math.max(...chroma);
  if(!Number.isFinite(total)||total<.05||!peak)return blank();
  const ranked=[];
  for(const t of triads){
   const values=t.pcs.map(pc=>chroma[pc]),low=Math.min(...values),share=values.reduce((a,b)=>a+b,0)/total;
   if(low<peak*minimum||share<inside)continue;
   ranked.push({chord:t.chord,share,score:share+.10*low/peak});
  }
  ranked.sort((a,b)=>b.score-a.score);
  if(!ranked.length)return blank();
  const best=ranked[0],gap=best.score-(ranked[1]?.score||0);
  if(gap<margin)return blank();
  return {chord:best.chord,confidence:Math.min(1,best.share*.8+Math.min(.2,gap)),share:best.share};
 }
 function levels(samples){
  let sum=0,peak=0,near=0,flat=0,previous=NaN;
  for(const value of samples){
   if(!Number.isFinite(value))continue;
   const a=Math.abs(value);sum+=value*value;peak=Math.max(peak,a);
   if(a>=.995){near++;if(Math.abs(value-previous)<.000015)flat++;}
   previous=value;
  }
  const count=Math.max(1,samples.length),rms=Math.sqrt(sum/count);
  // One large sample is not sustained distortion; stereo mixing can exceed 1.
  return {rms,peak,quiet:rms<.0025,warning:near/count>.015,severe:flat/count>.025&&near/count>.08};
 }
 function spectrum(db,sampleRate,fftSize){
  const step=sampleRate/fftSize,peaks=[];let maximum=-Infinity;
  for(let i=Math.max(2,Math.ceil(65/step));i<Math.min(db.length-1,Math.floor(2400/step));i++)maximum=Math.max(maximum,db[i]);
  if(!Number.isFinite(maximum)||maximum<-88)return blank();
  for(let i=Math.max(2,Math.ceil(65/step));i<Math.min(db.length-1,Math.floor(2400/step));i++){
   const v=db[i];if(!Number.isFinite(v)||v<maximum-34||v<-90||v<=db[i-1]||v<db[i+1])continue;
   const denom=db[i-1]-2*v+db[i+1],offset=Number.isFinite(denom)&&denom!==0?Math.max(-.5,Math.min(.5,.5*(db[i-1]-db[i+1])/denom)):0;
   const frequency=(i+offset)*step,midi=69+12*Math.log2(frequency/440),m=Math.round(midi);
   if(Math.abs(midi-m)>.40||m<36||m>94)continue;
   peaks.push({frequency,midi:m,weight:Math.pow(10,(v-maximum)/20)});
  }
  if(peaks.length<3)return blank();
  const power=peaks.reduce((s,p)=>s+p.weight*p.weight,0);
  // Reject the harmonic series of one voice or one instrument note.
  for(const base of peaks.slice(0,12)){
   if(base.weight<.15)continue;
   let explained=0;
   for(const p of peaks){const ratio=p.frequency/base.frequency,n=Math.round(ratio);
    if(n>=1&&n<=12&&Math.abs(12*Math.log2(ratio/n))<.30)explained+=p.weight*p.weight;
   }
   if(explained/power>.97)return blank();
  }
  const chroma=new Float64Array(12);
  for(const p of peaks){
   let overtone=0;
   for(const lower of peaks){
    if(lower.frequency>=p.frequency*.76)break;
    const ratio=p.frequency/lower.frequency,n=Math.round(ratio);
    if(n>=2&&n<=8&&Math.abs(12*Math.log2(ratio/n))<.30){
     overtone=Math.max(overtone,lower.weight/n);
    }
   }
   const weight=Math.max(0,p.weight-1.6*overtone);
   if(weight<.08)continue;
   const pc=((p.midi%12)+12)%12;
   chroma[pc]=Math.max(chroma[pc],Math.sqrt(weight));
  }
  return rank(chroma,{inside:.66,minimum:.16,margin:.04});
 }
 function model(d,{lead=true}={}){
  if(!d?.values||!d.frames||!d.pitches)return {...blank(),lead:null};
  // The worker already supplies the recent, reliable frames; do not average a whole phrase.
  const from=Math.max(0,d.frames-43),votes=new Map();let usable=0;
  for(let f=from;f<d.frames;f++){
   const row=d.values.subarray(f*d.pitches,(f+1)*d.pitches);let peak=0;
   for(const p of row)peak=Math.max(peak,p);
   if(peak<.20)continue;
   const chroma=new Float64Array(12);
   for(let p=0;p<row.length;p++){
    const midi=p+21,v=row[p];if(midi<40||midi>90||v<Math.max(.12,peak*.25))continue;
    chroma[midi%12]=Math.max(chroma[midi%12],Math.sqrt(v));
   }
   if(Array.from(chroma).filter(x=>x>0).length<3)continue;
   usable++;const c=rank(chroma,{inside:.62,minimum:.16,margin:.03});
   if(c.chord!=='—'){const v=votes.get(c.chord)||{n:0,weight:0};v.n++;v.weight+=c.confidence;votes.set(c.chord,v);}
  }
  const sorted=[...votes].sort((a,b)=>b[1].weight-a[1].weight);let chord=blank();
  if(sorted.length){
   const [label,best]=sorted[0],other=sorted[1]?.[1].weight||0;
   // Require simultaneous notes in several frames, never combine solo notes into a chord.
   if(best.n>=4&&best.n>=usable*.35&&best.weight>other*1.18)
    chord={chord:label,confidence:Math.min(1,best.weight/best.n*(.72+.28*best.n/Math.max(1,usable)))};
  }
  const singing=lead?window.BassWorshipLive.analyse(d):null;
  return {...chord,lead:singing?.lead||null};
 }
 function createFollower(){
  let current='—',seen=-Infinity,pending='',since=0,count=0,lastCandidate=-Infinity,lastTime=-Infinity;
  const clear=()=>{current='—';seen=-Infinity;pending='';since=0;count=0;lastCandidate=-Infinity;lastTime=-Infinity;};
  function state(now){
   if(now-seen>2.8)current='—';
   return {chord:current,held:current!=='—'&&now-seen>1.0,age:now-seen};
  }
  return {clear,state,update(e,now){
   if(!Number.isFinite(now))return state(lastTime);
   if(now<lastTime-.05)return state(lastTime);
   lastTime=now;
   if(e&&e.chord!=='—'&&e.confidence>=.58){
    if(e.chord===current){seen=now;pending='';count=0;}
    else{
     if(pending!==e.chord||now-lastCandidate>.65){pending=e.chord;since=now;count=0;}
     count++;lastCandidate=now;
     const wait=current==='—'?.16:.24;
     if((e.source==='model'&&e.confidence>=.88)||(count>=2&&now-since>=wait)){
      current=e.chord;seen=now;pending='';count=0;
     }
    }
   }else if(now-lastCandidate>.40){pending='';count=0;}
   return state(now);
  }};
 }
 return Object.freeze({rank,levels,spectrum,model,createFollower});
})();
