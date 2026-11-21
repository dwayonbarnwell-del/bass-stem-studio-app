/* Shared transforms for local analysis. Rehearsal separation runs in a dedicated worker. */
(()=>{
  'use strict';
  function fftInPlace(re,im){
    const n=re.length;
    for(let i=1,j=0;i<n;i++){
      let bit=n>>1;
      for(;j&bit;bit>>=1)j^=bit;
      j^=bit;
      if(i<j){let q=re[i];re[i]=re[j];re[j]=q;q=im[i];im[i]=im[j];im[j]=q}
    }
    for(let len=2;len<=n;len<<=1){
      const ang=-2*Math.PI/len,wr0=Math.cos(ang),wi0=Math.sin(ang);
      for(let i=0;i<n;i+=len){
        let wr=1,wi=0;
        for(let j=0;j<len/2;j++){
          const u=i+j,v=u+len/2,vr=re[v]*wr-im[v]*wi,vi=re[v]*wi+im[v]*wr;
          re[v]=re[u]-vr;im[v]=im[u]-vi;re[u]+=vr;im[u]+=vi;
          const nw=wr*wr0-wi*wi0;wi=wr*wi0+wi*wr0;wr=nw;
        }
      }
    }
  }

  function ifftInPlace(re,im){
    for(let i=0;i<im.length;i++)im[i]=-im[i];
    fftInPlace(re,im);
    const inv=1/re.length;
    for(let i=0;i<re.length;i++){re[i]*=inv;im[i]=-im[i]*inv}
  }

  function reflectIndex(i,n){
    if(n<=1)return 0;
    if(i>=0&&i<n)return i;
    const period=2*n-2,position=((i%period)+period)%period;
    return position<n?position:period-position;
  }
  if(typeof document!=='undefined'){
    globalThis.BassStemTransforms={fftInPlace,ifftInPlace,reflectIndex};
    return;
  }
  let aiSession;
  const AI_NFFT=4096,AI_HOP=1024,AI_BINS=2049,AI_CHUNK=121275,AI_PADDED=121856,AI_FRAMES=120;
  function makeDrumInput(left,right,startSample){
    const out=new Float32Array(4*AI_BINS*AI_FRAMES);
    const re=new Float32Array(AI_NFFT),im=new Float32Array(AI_NFFT);
    const scale=1/Math.sqrt(AI_NFFT);
    for(let c=0;c<2;c++){
      const sig=c===0?left:right;
      for(let t=0;t<AI_FRAMES;t++){
        const center=t*AI_HOP;
        for(let j=0;j<AI_NFFT;j++){
          const local=center+j-(AI_NFFT>>1);
          let v=0;
          {
            let srcLocal=local;
            if(srcLocal<0) srcLocal=reflectIndex(srcLocal,AI_PADDED);
            else if(srcLocal>=AI_PADDED) srcLocal=reflectIndex(srcLocal,AI_PADDED);
            if(srcLocal<AI_CHUNK){
              const gi=startSample+srcLocal;
              if(gi>=0&&gi<sig.length)v=sig[gi];
            }
          }
          re[j]=v;im[j]=0;
        }
        fftInPlace(re,im);
        const rc=c*2,ic=rc+1;
        for(let k=0;k<AI_BINS;k++){
          out[(rc*AI_BINS+k)*AI_FRAMES+t]=re[k]*scale;
          out[(ic*AI_BINS+k)*AI_FRAMES+t]=im[k]*scale;
        }
      }
    }
    return out;
  }
  async function loadModel(url){
    if(aiSession)return;
    const runtime='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/';
    if(!self.ort)importScripts(runtime+'ort.all.min.js');
    ort.env.wasm.wasmPaths=runtime;ort.env.wasm.numThreads=1;
    const create=providers=>ort.InferenceSession.create(url,{executionProviders:providers,graphOptimizationLevel:'all'});
    if(navigator.gpu){try{aiSession=await create(['webgpu','wasm']);}catch{}}
    if(!aiSession)aiSession=await create(['wasm']);
  }
  async function separate(samples,stem){
    const length=samples[0].length;
    const pad=AI_CHUNK-Math.floor(AI_CHUNK/2),step=Math.floor(AI_CHUNK/2),fade=Math.floor(AI_CHUNK/10),n=length+2*pad;
    const channels=[0,1].map(c=>{const a=new Float32Array(n),x=samples[c];for(let i=0;i<n;i++)a[i]=x[reflectIndex(i-pad,x.length)];return a;});
    const mixes=stem==='rehearsal'?[[0,2],[1],[3]]:stem==='practice'?[[0,2,3],[1]]:[[stem]],channelsOut=mixes.length*2;
    const output=Array.from({length:channelsOut},()=>new Float32Array(n)),weight=new Float32Array(n),starts=[];
    for(let s=0;s<n;s+=step)starts.push(s);
    for(let ci=0;ci<starts.length;ci++){
      self.postMessage({progress:Math.round(ci/starts.length*100)});
      const s=starts[ci],spec=makeDrumInput(channels[0],channels[1],s),tensor=new ort.Tensor('float32',spec,[1,4,AI_BINS,AI_FRAMES]);let result;
      try{result=await aiSession.run({[aiSession.inputNames[0]]:tensor});
        const data=result[aiSession.outputNames[0]].data;
        for(let c=0;c<channelsOut;c++){
          const audio=new Float32Array(AI_CHUNK),envelope=new Float32Array(AI_CHUNK),re=new Float32Array(AI_NFFT),im=new Float32Array(AI_NFFT);
          for(let t=0;t<AI_FRAMES;t++){
            for(let k=0;k<AI_BINS;k++){re[k]=0;im[k]=0;for(const part of mixes[Math.floor(c/2)]){const j=(((part*2+c%2)*AI_BINS+k)*AI_FRAMES+t)*2;re[k]+=data[j]*Math.sqrt(AI_NFFT);im[k]+=data[j+1]*Math.sqrt(AI_NFFT);}}
            for(let k=AI_BINS;k<AI_NFFT;k++){re[k]=re[AI_NFFT-k];im[k]=-im[AI_NFFT-k];}ifftInPlace(re,im);
            for(let j=0;j<AI_NFFT;j++){const p=t*AI_HOP+j-AI_NFFT/2;if(p>=0&&p<AI_CHUNK){audio[p]+=re[j];envelope[p]++;}}
          }
          for(let j=0;j<AI_CHUNK&&s+j<n;j++){
            let w=1;if(ci>0&&j<fade)w=j/fade;if(ci<starts.length-1&&j>=AI_CHUNK-fade)w=Math.min(w,(AI_CHUNK-1-j)/fade);
            const value=audio[j]/Math.max(1,envelope[j]);if(!Number.isFinite(value))throw Error('Invalid model output.');output[c][s+j]+=value*w;if(c===0)weight[s+j]+=w;
          }
        }
      }finally{tensor.dispose?.();if(result)Object.values(result).forEach(t=>t.dispose?.());}
      await new Promise(r=>setTimeout(r,0));
    }
    const rendered=output.map(channel=>channel.subarray(pad,pad+length));
    let peak=0;
    for(const data of rendered){
      for(let i=0;i<length;i++){data[i]/=Math.max(1e-6,weight[i+pad]);peak=Math.max(peak,Math.abs(data[i]));}
    }
    if(stem!=='practice'&&stem!=='rehearsal'&&peak>.95){
      for(const data of rendered)for(let i=0;i<length;i++)data[i]*=.95/peak;
    }
    self.postMessage({channels:rendered},rendered.map(data=>data.buffer));
  }
  self.onmessage=async({data})=>{
    try{await loadModel(data.model);await separate(data.samples,data.stem);}
    catch(error){self.postMessage({error:error?.message||'Could not prepare the audio.'});}
  };
})();
