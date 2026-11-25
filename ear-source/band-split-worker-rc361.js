/* Split the already vocal-free backing; its two outputs sum to the input. */
importScripts('../fretflow-source/practice-stems.js?v=rc361');
self.onmessage=({data:{channels,rate}})=>{
 try{
  const {fftInPlace:fft,ifftInPlace:ifft}=self.BassStemTransforms,size=2048,hop=512,bins=size/2+1,length=channels[0].length,starts=[];
  for(let a=-size+hop;a<length;a+=hop)starts.push(a);
  const win=Float32Array.from({length:size},(_,i)=>Math.sin(Math.PI*i/size)),mags=new Float32Array(starts.length*bins),re=new Float32Array(size),im=new Float32Array(size);
  for(let t=0;t<starts.length;t++){
   const start=starts[t];for(let i=0;i<size;i++){const a=start+i;re[i]=a>=0&&a<length?(channels[0][a]+channels[1][a])*.5*win[i]:0;im[i]=0;}fft(re,im);
   for(let k=0;k<bins;k++)mags[t*bins+k]=Math.hypot(re[k],im[k]);
  }
  const drum=channels.map(()=>new Float32Array(length)),weight=new Float32Array(length),mask=new Float32Array(bins),pool=new Float32Array(15);
  for(let t=0;t<starts.length;t++){
   for(let k=0;k<bins;k++){
    for(let j=-7;j<=7;j++)pool[j+7]=mags[Math.max(0,Math.min(starts.length-1,t+j))*bins+k];pool.sort();const h=pool[7];
    for(let j=-7;j<=7;j++)pool[j+7]=mags[t*bins+Math.max(0,Math.min(bins-1,k+j))];pool.sort();const p=pool[7];
    mask[k]=p*p/(p*p+h*h+1e-15);
   }
   const start=starts[t];
   for(let c=0;c<2;c++){
    for(let i=0;i<size;i++){const a=start+i;re[i]=a>=0&&a<length?channels[c][a]*win[i]:0;im[i]=0;}fft(re,im);
    for(let k=0;k<size;k++){const gain=mask[Math.min(k,size-k)];re[k]*=gain;im[k]*=gain;}ifft(re,im);
    for(let i=0;i<size;i++){const a=start+i;if(a<0||a>=length)continue;drum[c][a]+=re[i]*win[i];if(c===0)weight[a]+=win[i]*win[i];}
   }
  }
  const other=channels.map(()=>new Float32Array(length));for(let c=0;c<2;c++)for(let i=0;i<length;i++){drum[c][i]/=Math.max(weight[i],1e-9);other[c][i]=channels[c][i]-drum[c][i];}
  const output=[...drum,...other];self.postMessage({channels:output},output.map(c=>c.buffer));
 }catch(error){self.postMessage({error:error.message});}
};
