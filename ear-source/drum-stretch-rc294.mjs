/* Transient-anchored WSOLA for percussion. Each attack keeps its exact beat;
 * only the sound between attacks is stretched. Both channels share one path. */
export function stretchLoop(channels,sampleRate,frames,beats){
 const input=channels[0].length,ratio=input/frames,out=[new Float32Array(frames),new Float32Array(frames)];
 if(Math.abs(ratio-1)<.0001){for(let c=0;c<2;c++){const d=channels[Math.min(c,channels.length-1)];for(let i=0;i<frames;i++){const p=i*ratio,j=Math.floor(p),f=p-j;out[c][i]=d[j%input]*(1-f)+d[(j+1)%input]*f;}}return out;}
 const hop=Math.max(1,Math.round(sampleRate*.002)),env=[];
 for(let i=0;i<input;i+=hop){let sum=0;for(let j=i;j<Math.min(i+hop,input);j++)sum+=channels[0][j]**2;env.push(Math.sqrt(sum/hop));}
 const flux=env.map((v,i)=>Math.max(0,v-(env[i-1]||0))),threshold=Math.max(...flux)*.12,attacks=[0];
 for(let i=1;i<flux.length-1;i++)if(flux[i]>threshold&&flux[i]>=flux[i-1]&&flux[i]>flux[i+1]){
  const at=Math.max(0,(i-1)*hop);if(at-attacks.at(-1)>=sampleRate*.045&&input-at>=sampleRate*.02)attacks.push(at);
 }
 attacks.push(input);
 const grain=Math.round(sampleRate*.024),step=Math.round(grain/3),search=Math.round(sampleRate*.004),guard=Math.round(sampleRate*.018);
 const window=Float32Array.from({length:grain},(_,i)=>.5-.5*Math.cos(2*Math.PI*i/(grain-1)));
 for(let a=0;a<attacks.length-1;a++){
  const start=attacks[a],end=attacks[a+1],length=end-start,dest=Math.round(start/ratio),finish=Math.round(end/ratio),count=finish-dest;
  if(count<=0)continue;
  const keep=Math.min(guard,length,count),weights=new Float32Array(count),mix=[new Float32Array(count),new Float32Array(count)];
  // Copy the attack at its original pitch, without an overlap search or latency.
  for(let c=0;c<2;c++)for(let i=0;i<keep;i++)out[c][dest+i]=channels[Math.min(c,channels.length-1)][start+i];
  if(count>keep){
   const scale=(length-keep)/Math.max(1,count-keep);
   for(let target=Math.max(0,keep-step);target<count;target+=step){
    const wanted=Math.max(0,Math.min(length-grain,keep+(target-keep)*scale));let chosen=Math.round(wanted),best=-Infinity;
    // Waveform matching in the overlap prevents phasing; stereo remains locked.
    if(target>keep&&length>grain){
     for(let candidate=Math.max(keep,chosen-search);candidate<=Math.min(length-grain,chosen+search);candidate+=4){let cross=0,power=0;
      for(let j=0;j<Math.min(step*2,count-target);j+=4)if(weights[target+j]>.01){const x=mix[0][target+j]/weights[target+j],y=channels[0][start+candidate+j];cross+=x*y;power+=y*y;}
      const score=cross/Math.sqrt(power+1e-12);if(score>best){best=score;chosen=candidate;}
     }
    }
    for(let j=0;j<grain&&target+j<count;j++){const w=window[j],at=Math.min(end-1,start+Math.max(0,chosen+j));weights[target+j]+=w;for(let c=0;c<2;c++)mix[c][target+j]+=channels[Math.min(c,channels.length-1)][at]*w;}
   }
   const blend=Math.min(keep,Math.round(sampleRate*.004));
   for(let c=0;c<2;c++)for(let i=Math.max(0,keep-blend);i<count;i++){
    const value=weights[i]>1e-5?mix[c][i]/weights[i]:0,t=i<keep?(i-(keep-blend))/Math.max(1,blend):1;
    out[c][dest+i]=out[c][dest+i]*(1-t)+value*t;
   }
  }
  // A tiny seam taper avoids clicks without shifting the next attack.
  const fade=Math.min(Math.round(sampleRate*.001),count);
  for(let c=0;c<2;c++)for(let j=0;j<fade;j++)out[c][finish-fade+j]*=1-j/fade;
 }
 return out;
}
