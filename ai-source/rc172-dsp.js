window.BassPracticeDSP=(()=>{
 const pc=n=>((n%12)+12)%12,names=['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
 function pitch(input,sampleRate){
  const stride=Math.max(1,Math.floor(sampleRate/11025)),sr=sampleRate/stride,n=Math.floor(input.length/stride),x=new Float32Array(n);let mean=0,power=0,peak=0;
  for(let i=0;i<n;i++){x[i]=input[i*stride];mean+=x[i];peak=Math.max(peak,Math.abs(x[i]));}mean/=n;
  for(let i=0;i<n;i++){x[i]-=mean;power+=x[i]*x[i];}if(Math.sqrt(power/n)<.004||peak>.99)return null;
  const min=Math.floor(sr/1100),max=Math.min(Math.ceil(sr/35),Math.floor(n/2)),size=n-max,d=new Float64Array(max+1);let sum=0;d[0]=1;
  for(let lag=1;lag<=max;lag++){let value=0;for(let i=0;i<size;i++){const v=x[i]-x[i+lag];value+=v*v;}sum+=value;d[lag]=sum?value*lag/sum:1;}
  let tau=0;for(let lag=min;lag<max;lag++)if(d[lag]<.12){while(lag+1<=max&&d[lag+1]<d[lag])lag++;tau=lag;break;}
  if(!tau||d[tau]>.15)return null;
  const a=d[tau-1],b=d[tau],c=d[Math.min(max,tau+1)],den=a-2*b+c,delta=den?(a-c)/(2*den):0;
  const hz=sr/(tau+Math.max(-.5,Math.min(.5,delta))),m=69+12*Math.log2(hz/440),midi=Math.round(m);
  return {hz,midi,cents:100*(m-midi),confidence:1-b,note:names[pc(midi)]+(Math.floor(midi/12)-1)};
 }
 function snapRange(start,end,beats,duration,maxLength=30){
  if(!Number.isFinite(start+end+duration)||start<0||end<=start||duration<=0)throw Error('Choose a valid start and end first.');
  const grid=[...new Set(beats.filter(n=>Number.isFinite(n)&&n>=0&&n<=duration))].sort((a,b)=>a-b);
  if(grid.length<2)throw Error('Analyse the song to find its beats first.');
  const nearest=t=>grid.reduce((best,n)=>Math.abs(n-t)<Math.abs(best-t)?n:best,grid[0]);
  const a=nearest(start),valid=grid.filter(n=>n>a&&n-a<=maxLength&&n-a>=.5);
  if(!valid.length)throw Error('No suitable beat range here.');
  const b=valid.reduce((best,n)=>Math.abs(n-end)<Math.abs(best-end)?n:best,valid[0]);return {start:a,end:b};
 }
 function timing(time,origin,bpm,offset=0){const period=60/bpm,t=time-offset-origin;if(t<0)return null;const beat=Math.round(t/period);return {beat,ms:(t-beat*period)*1000};}
 async function melody(buffer,start=0,cancelled=()=>false){
  const off=new OfflineAudioContext(1,Math.ceil(buffer.duration*22050),22050),src=off.createBufferSource();src.buffer=buffer;src.connect(off.destination);src.start();const b=await off.startRendering(),x=b.getChannelData(0),out=[];let last=null;
  for(let i=0;i+4096<=x.length;i+=882){if(cancelled())throw Error('Cancelled.');const p=pitch(x.subarray(i,i+4096),22050),t=start+(i+2048)/22050;
   if(p&&p.midi>=45&&p.midi<=90){if(last&&last.midi===p.midi&&t-last.end<.09)last.end=t+.04;else{last={start:t,end:t+.04,midi:p.midi};out.push(last);}}else last=null;
   if(i%(882*20)===0)await new Promise(r=>setTimeout(r,0));
  }return out.filter(n=>n.end-n.start>=.12);
 }
 return {pitch,snapRange,timing,melody};
})();
