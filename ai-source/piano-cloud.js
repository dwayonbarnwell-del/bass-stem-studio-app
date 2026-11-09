  async function analysePianoPassage(part,saved,cancelled,status){
    const session=songSession,file=activeAudioFile;
    if(!file||!buffer)throw Error('Import a song first');
    if(aiBusy||songImportBusy)throw Error('Wait for the current analysis to finish');
    const signature=cloudFileSignature(file),cacheKey='piano-melody-v1:'+signature+':'+part.start;
    const cached=await recoveryStore('results',s=>s.get(cacheKey)).catch(()=>null);
    if(cached?.signature===signature&&cached.melodyJob)Object.assign(part.job,cached.melodyJob);
    const job=part.job;
    const check=()=>{assertSongSession(session);if(cancelled())throw Error('Cancelled');};
    const checkpoint=async()=>{await recoveryStore('results',s=>s.put({id:cacheKey,signature,melodyJob:{...job},savedAt:Date.now()}));if(session===songSession)await saved();};
    if(job.result?.ok)return job.result.notes.map(n=>({...n,start:n.start+part.from,end:n.end+part.from}));
    check();
    if(job.failed||(job.submitting&&!job.id)){
      const known=!!job.failed;
      if(!await BassDialog.confirm(known?'This melody passage failed. Retry only this passage?': 'The melody upload had no confirmed reply. Check RunPod before retrying because another job may already be running or charged.',{title:'Review melody upload',accept:'Retry passage'}))throw Error('Retry cancelled');
      check();delete job.failed;delete job.submitting;delete job.id;await checkpoint();
    }
    const key=await getRunPodKey();check();if(!key)throw Error('Analysis key not entered');
    aiBusy=true;updateProjectButtons();
    try{
      if(!job.id){
        await cacheAudioForRecovery(file);check();status('Preparing melody');
        const upload=await prepareAnalysisPartUpload(file,{audioStart:part.from,audioEnd:part.to,coreStart:part.start,coreEnd:part.end,label:'Melody'},Math.ceil(buffer.duration/180),session);
        const b64=await fileToBase64(upload.file);check();
        job.submitting=true;await checkpoint();
        const response=await runPodFetch(`https://api.runpod.ai/v2/${encodeURIComponent(RUNPOD_ENDPOINT)}/run`,key,{method:'POST',body:JSON.stringify({input:{action:'melody',audio_base64:b64,filename:upload.file.name}})},1,session);
        if(!response?.id)throw Error('No melody job number returned');
        job.id=response.id;delete job.submitting;await checkpoint();check();
      }
      while(true){
        check();status('Finding melody');
        let response;
        try{response=await runPodFetch(`https://api.runpod.ai/v2/${encodeURIComponent(RUNPOD_ENDPOINT)}/status/${encodeURIComponent(job.id)}`,key,{method:'GET'},8,session);}
        catch(e){if(e?.httpStatus===404){job.failed='EXPIRED';await checkpoint();}throw e;}
        const state=String(response?.status||'').toUpperCase();
        if(state==='COMPLETED'){
          if(!response.output?.ok||!Array.isArray(response.output.notes))throw Error('Melody result is incomplete');
          job.result=response.output;await checkpoint();check();
          return job.result.notes.map(n=>({...n,start:n.start+part.from,end:n.end+part.from}));
        }
        if(['FAILED','CANCELLED','TIMED_OUT'].includes(state)){job.failed=state;await checkpoint();throw Error('Melody passage '+state.toLowerCase()+'. Choose Find melody to review and retry');}
        await new Promise(r=>setTimeout(r,3000));
      }
    }finally{if(session===songSession){aiBusy=false;updateProjectButtons();}}
  }
