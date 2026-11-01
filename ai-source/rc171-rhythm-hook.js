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

  window.BassRhythm.init({pause,get:()=>({buffer,session:songSession,start:loopStart??currentTime(),end:loopEnd??Math.min(buffer?.duration||0,currentTime()+8)}),
    encode:async(b,a=0,z=null)=>encodeAudioBufferForAnalysis(b,192,a,z),
    extract:async(from,to,progress,cancelled)=>{
      if(aiBusy||songImportBusy)throw Error('Wait for analysis to finish.');
      const session=songSession,original=buffer;if(!original)throw Error('Import a song first.');
      aiBusy=true;try{
        const length=Math.ceil((to-from)*AI_SR),off=new OfflineAudioContext(2,length,AI_SR),src=off.createBufferSource();src.buffer=original;src.connect(off.destination);src.start(0,from,to-from);const input=await off.startRendering();
        await ensureAiSession(false);assertSongSession(session);if(cancelled())throw Error('Cancelled.');
        const pad=AI_CHUNK-Math.floor(AI_CHUNK/2),step=Math.floor(AI_CHUNK/2),fade=Math.floor(AI_CHUNK/10),n=input.length+2*pad;
        const channels=[0,1].map(c=>{const a=new Float32Array(n),x=input.getChannelData(c);for(let i=0;i<n;i++)a[i]=x[reflectIndex(i-pad,x.length)];return a;});
        const output=[new Float32Array(n),new Float32Array(n)],weight=new Float32Array(n),starts=[];
        for(let s=0;s<n;s+=step)starts.push(s);
        for(let ci=0;ci<starts.length;ci++){
          assertSongSession(session);if(cancelled())throw Error('Cancelled.');progress(Math.round(ci/starts.length*100));
          const s=starts[ci],spec=makeDrumInput(channels[0],channels[1],s),tensor=new ort.Tensor('float32',spec,[1,4,AI_BINS,AI_FRAMES]);let result;
          try{result=await aiSession.run({[aiSession.inputNames[0]]:tensor});
            const data=result[aiSession.outputNames[0]].data;
            for(let c=0;c<2;c++){
              const audio=new Float32Array(AI_CHUNK),envelope=new Float32Array(AI_CHUNK),re=new Float32Array(AI_NFFT),im=new Float32Array(AI_NFFT);
              for(let t=0;t<AI_FRAMES;t++){
                for(let k=0;k<AI_BINS;k++){const j=((c*AI_BINS+k)*AI_FRAMES+t)*2;re[k]=data[j]*Math.sqrt(AI_NFFT);im[k]=data[j+1]*Math.sqrt(AI_NFFT);}
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
        assertSongSession(session);if(cancelled())throw Error('Cancelled.');
        const rendered=new AudioBuffer({numberOfChannels:2,length:input.length,sampleRate:AI_SR});let peak=0;
        for(let c=0;c<2;c++){const target=rendered.getChannelData(c);for(let i=0;i<target.length;i++){target[i]=output[c][i+pad]/Math.max(1e-6,weight[i+pad]);peak=Math.max(peak,Math.abs(target[i]));}}
        if(peak>.95)for(let c=0;c<2;c++){const x=rendered.getChannelData(c);for(let i=0;i<x.length;i++)x[i]*=.95/peak;}
        return rendered;
      }finally{aiBusy=false;updateAnalysisToolsState();}
    },command:text=>{
      const t=text.toLowerCase().replace(/[.!?]/g,'').trim();
      if(/^(stop|pause)( music| playback)?$/.test(t)){pause();return 'Paused.';}
      if(/^(play|resume)( music| playback)?$/.test(t)){if(!buffer)return 'Import a song first.';play();return 'Playing.';}
      if(/^(repeat|loop)( the)? chorus$/.test(t)){
        const entries=Object.entries(sections).filter(([name])=>/chorus/i.test(name));
        if(!entries.length)return 'No labelled chorus found.';
        const found=entries.find(([,s])=>s.end>currentTime())||entries[0],s=found[1];
        selectedTimeframes.clear();selectedSections.clear();multiSectionMode=false;timeframeLoopMode=false;sectionQueue=[];timeframeQueue=[];
        loopStart=s.start;loopEnd=s.end;loopEnabled=true;updateLoopUI();seekTo(s.start);play();return 'Repeating '+found[0]+'.';
      }
      return 'Try: play, pause, repeat the chorus.';
    }
  });
