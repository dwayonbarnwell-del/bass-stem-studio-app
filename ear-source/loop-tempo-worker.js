/* Continuous stereo waveform overlap keeps the original mix on one clock. */
self.onmessage=({data:{channels,frames,sampleRate}})=>{
 try{
  const input=channels[0].length,ratio=input/frames;
  const grain=Math.round(sampleRate*.046),hop=Math.round(grain/4),search=Math.round(sampleRate*.008);
  const output=channels.map(()=>new Float32Array(frames)),weights=new Float32Array(frames);
  const window=Float32Array.from({length:grain},(_,i)=>.5-.5*Math.cos(2*Math.PI*i/(grain-1)));
  const wrap=i=>((i%input)+input)%input;
  for(let at=-grain+hop;at<frames;at+=hop){
   const nominal=Math.round(at*ratio);let chosen=nominal,best=-Infinity;
   if(at>0){
    for(let shift=-search;shift<=search;shift+=8){
     let cross=0,power=0;
     for(let i=0;i<Math.min(grain-hop,frames-at);i+=8){
      const w=weights[at+i];if(w<.01)continue;
      const a=output[0][at+i]/w,b=channels[0][wrap(nominal+shift+i)];cross+=a*b;power+=b*b;
     }
     const score=cross/Math.sqrt(power+1e-12);
     if(score>best){best=score;chosen=nominal+shift;}
    }
   }
   for(let i=0;i<grain;i++){
    const target=at+i;if(target<0||target>=frames)continue;
    const w=window[i];weights[target]+=w;
    for(let c=0;c<channels.length;c++)output[c][target]+=channels[c][wrap(chosen+i)]*w;
   }
  }
  for(const channel of output)for(let i=0;i<frames;i++)channel[i]/=Math.max(1e-8,weights[i]);
  // Taper only the loop boundary, preserving attacks inside the phrase.
  const fade=Math.round(sampleRate*.002);
  for(const channel of output)for(let i=0;i<fade;i++){const gain=i/fade;channel[i]*=gain;channel[frames-1-i]*=gain;}
  self.postMessage({channels:output},output.map(x=>x.buffer));
 }catch(error){self.postMessage({error:error.message});}
};
