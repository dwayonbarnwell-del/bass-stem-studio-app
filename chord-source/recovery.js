/* RC236: voluntary, on-device missing-chord suggestions. Never contacts RunPod. */
(()=>{
'use strict';
const FFT_SIZE=8192, SAMPLE_RATE=11025, STEP=.5, SOURCE='on-device-chord-recovery-v1';
const NAMES=['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
const bitReversed=new Uint16Array(FFT_SIZE),windowValues=new Float64Array(FFT_SIZE);
for(let i=0;i<FFT_SIZE;i++){
 let value=i,reversed=0;
 for(let bit=0;bit<13;bit++){reversed=(reversed<<1)|(value&1);value>>=1;}
 bitReversed[i]=reversed;
 windowValues[i]=.5-.5*Math.cos(2*Math.PI*i/(FFT_SIZE-1));
}
function fft(real,imag){
 for(let i=0;i<FFT_SIZE;i++){
  const j=bitReversed[i];
  if(j>i){const value=real[i];real[i]=real[j];real[j]=value;}
 }
 for(let size=2;size<=FFT_SIZE;size*=2){
  const half=size/2,angle=-2*Math.PI/size,cos=Math.cos(angle),sin=Math.sin(angle);
  for(let base=0;base<FFT_SIZE;base+=size){
   let wr=1,wi=0;
   for(let j=0;j<half;j++){
    const a=base+j,b=a+half,tr=wr*real[b]-wi*imag[b],ti=wr*imag[b]+wi*real[b];
    real[b]=real[a]-tr;imag[b]=imag[a]-ti;real[a]+=tr;imag[a]+=ti;
    const next=wr*cos-wi*sin;wi=wr*sin+wi*cos;wr=next;
   }
  }
 }
}
function extractChroma(samples){
 const real=new Float64Array(FFT_SIZE),imag=new Float64Array(FFT_SIZE),chroma=new Float64Array(12);
 for(let i=0;i<FFT_SIZE;i++)real[i]=samples[i]*windowValues[i];
 fft(real,imag);
 const peakRows=[];let strongest=0;
 const minBin=Math.ceil(60*FFT_SIZE/SAMPLE_RATE),maxBin=Math.floor(1250*FFT_SIZE/SAMPLE_RATE);
 for(let bin=minBin;bin<=maxBin;bin++){
  const magnitude=real[bin]*real[bin]+imag[bin]*imag[bin];
  if(magnitude>strongest)strongest=magnitude;
 }
 if(strongest<1e-6)return chroma;
 for(let bin=minBin;bin<=maxBin;bin++){
  const power=real[bin]*real[bin]+imag[bin]*imag[bin];
  if(power<strongest*.006 || power<real[bin-1]**2+imag[bin-1]**2 || power<real[bin+1]**2+imag[bin+1]**2)continue;
  const frequency=bin*SAMPLE_RATE/FFT_SIZE,midiFloat=69+12*Math.log2(frequency/440),midi=Math.round(midiFloat);
  if(Math.abs(midiFloat-midi)>.34||midi<36||midi>90)continue;
  peakRows.push({frequency,midi,weight:Math.sqrt(power/strongest)});
 }
 for(const row of peakRows){
  let overtone=0;
  for(const lower of peakRows){
   if(lower.frequency>=row.frequency/1.7)break;
   const ratio=row.frequency/lower.frequency,n=Math.round(ratio);
   if(n>=2&&n<=9&&Math.abs(12*Math.log2(ratio/n))<.3)overtone=Math.max(overtone,lower.weight/n);
  }
  chroma[(row.midi%12+12)%12]+=Math.max(0,row.weight-overtone*.65);
 }
 return chroma;
}
const templates=[];
for(let rootPc=0;rootPc<12;rootPc++)for(const [quality,steps] of [['maj',[0,4,7]],['min',[0,3,7]]]){
 templates.push({rootPc,quality,pitches:steps.map(step=>(rootPc+step)%12)});
}
function classify(evidence){
 const votes=[];
 for(let i=0;i<evidence.length;i++){
  const values=new Float64Array(12);
  for(let j=Math.max(0,i-4);j<=Math.min(evidence.length-1,i+4);j++){
   for(let pitch=0;pitch<12;pitch++)values[pitch]+=evidence[j][pitch];
  }
  const total=values.reduce((a,b)=>a+b,0);
  if(total<.002){votes.push(null);continue;}
  for(let pitch=0;pitch<12;pitch++)values[pitch]/=total;
  let best=null,second=-Infinity;
  for(const template of templates){
   const inside=template.pitches.reduce((sum,p)=>sum+values[p],0);
   const lowest=Math.min(...template.pitches.map(p=>values[p]));
   const score=inside+.10*values[template.rootPc]+.05*lowest-.30*(1-inside);
   if(!best||score>best.score){second=best?.score??-Infinity;best={rootPc:template.rootPc,quality:template.quality,score,coverage:inside};}
   else if(score>second)second=score;
  }
  votes.push(best&&best.score>.28&&best.coverage>.46&&best.score-second>.012?best:null);
 }
 return votes;
}
function intervalsFromVotes(votes){
 const ranges=[];let active=null;
 function finish(){if(active&&active.end-active.start>=1){ranges.push(active);}active=null;}
 for(let i=0;i<=votes.length;i++){
  const v=votes[i]||null;
  if(!v){finish();continue;}
  if(active&&active.rootPc===v.rootPc&&active.quality===v.quality){
   active.end=(i+1)*STEP;active.score=Math.min(active.score,v.score);
  }else{
   finish();active={start:i*STEP,end:(i+1)*STEP,rootPc:v.rootPc,quality:v.quality,score:v.score};
  }
 }
 return ranges;
}
function addOnlyMissing(candidateRanges,savedChords,duration){
 // Saved chords, especially manually corrected ones, always take precedence.
 const old=(Array.isArray(savedChords)?savedChords:[]).filter(c=>c&&c.source!==SOURCE||c?.manual===true);
 const occupied=old.filter(c=>Number.isFinite(Number(c.start))&&Number.isFinite(Number(c.end))&&c.end>c.start)
   .sort((a,b)=>Number(a.start)-Number(b.start));
 const added=[];
 for(const candidate of candidateRanges){
  let pieces=[{start:candidate.start,end:Math.min(duration,candidate.end)}];
  for(const prior of occupied){
   const next=[];
   for(const part of pieces){
    if(Number(prior.end)<=part.start||Number(prior.start)>=part.end){next.push(part);continue;}
    if(Number(prior.start)>part.start)next.push({start:part.start,end:Number(prior.start)});
    if(Number(prior.end)<part.end)next.push({start:Number(prior.end),end:part.end});
   }
   pieces=next;
   if(!pieces.length)break;
  }
  for(const part of pieces){
   if(part.end-part.start<.75)continue;
   const quality=candidate.quality,rootPc=candidate.rootPc;
   added.push({start:Number(part.start.toFixed(3)),end:Number(part.end.toFixed(3)),rootPc,quality,
     label:NAMES[rootPc]+(quality==='min'?'m':''),confidence:Number(Math.min(.86,Math.max(.71,.66+.6*candidate.score)).toFixed(3)),
     evidenceVersion:'local-chord-v1',uncertain:true,manual:false,bassPc:null,source:SOURCE});
  }
 }
 return {added,old};
}
async function scan(buffer,{progress=()=>{},stillCurrent=()=>true,existing=[]}={}){
 if(!buffer||!Number.isFinite(buffer.duration)||buffer.duration<2||!Number.isFinite(buffer.sampleRate))throw Error('Open a saved song with audio first.');
 const sr=buffer.sampleRate,length=buffer.length,channels=[];
 for(let i=0;i<Math.min(2,buffer.numberOfChannels);i++)channels.push(buffer.getChannelData(i));
 if(!channels.length)throw Error('No playable audio was found.');
 const frame=new Float32Array(FFT_SIZE),evidence=[];
 const count=Math.ceil(buffer.duration/STEP),ratio=sr/SAMPLE_RATE;
 for(let sample=0;sample<count;sample++){
  if(!stillCurrent())throw Error('Song changed. No chords were added.');
  const offset=(sample+.5)*STEP*sr-FFT_SIZE*ratio/2;
  for(let n=0;n<FFT_SIZE;n++){
   const pos=offset+n*ratio,index=Math.floor(pos),fraction=pos-index;
   if(index<0||index+1>=length){frame[n]=0;continue;}
   let value=0;
   for(const channel of channels)value+=channel[index]*(1-fraction)+channel[index+1]*fraction;
   frame[n]=value/channels.length;
  }
  evidence.push(extractChroma(frame));
  if(sample%24===0){progress(Math.round(sample/count*100));await new Promise(resolve=>setTimeout(resolve,0));}
 }
 if(!stillCurrent())throw Error('Song changed. No chords were added.');
 progress(100);
 const pieces=intervalsFromVotes(classify(evidence));
 return addOnlyMissing(pieces,existing,buffer.duration);
}
function init({getContext,apply}={}){
 const panel=document.getElementById('aiPanel');if(!panel||typeof getContext!=='function'||typeof apply!=='function')return;
 if(document.getElementById('findMissingChords'))return;
 const row=document.createElement('div');row.className='local-chord-row';
 const button=document.createElement('button');button.type='button';button.id='findMissingChords';button.className='btn';button.textContent='Find missing chords (free)';
 const notice=document.createElement('div');notice.className='local-chord-result';notice.setAttribute('role','status');
 row.append(button,notice);panel.append(row);
 const style=document.createElement('style');style.textContent='.local-chord-row{border-top:1px solid var(--line, #385265);margin-top:12px;padding-top:12px;display:grid;gap:9px}.local-chord-row>.btn{width:100%;min-height:44px;font-weight:700;border-radius:12px}.local-chord-result{font-size:13px;color:var(--muted,#9fb3c5);line-height:1.45;text-align:center;white-space:normal}';
 document.head.append(style);
 let running=false;
 button.addEventListener('click',async()=>{
  if(running)return;
  const context=getContext();
  if(!context?.buffer){notice.textContent='Open a saved song with audio first.';return;}
  if(context.busy){notice.textContent='Finish the current import or analysis first.';return;}
  running=true;button.disabled=true;button.textContent='Checking chords…';notice.textContent='Scanning this song on your device. No RunPod charge.';
  try{
   const result=await scan(context.buffer,{existing:context.chords,stillCurrent:()=>getContext()?.session===context.session,
    progress:p=>{notice.textContent='Checking chords on your device · '+p+'% · no RunPod charge';}});
   if(!result.added.length){notice.textContent='No confident additional chord spans found. Saved chords and bass unchanged.';return;}
   const added=await apply(context.session,result);
   notice.textContent=added?added+' tentative chord spans added. Review the ? labels, then tap Save to export a new project. Bass notes are unchanged.':'No new chords were added.';
  }catch(err){notice.textContent=String(err?.message||err);}
  finally{running=false;button.disabled=false;button.textContent='Find missing chords (free)';}
 });
}
const api={init,scan,addOnlyMissing};
if(typeof window!=='undefined')window.BassChordRecovery=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})();