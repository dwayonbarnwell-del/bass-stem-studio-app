/* RC168: AI-assisted local live audio. No microphone audio is uploaded by this module. */
window.BassLiveDSP = (()=>{
  const names=['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
  const templates=[['',[0,4,7]],['m',[0,3,7]],['7',[0,4,7,10]],['maj7',[0,4,7,11]],['m7',[0,3,7,10]],['sus2',[0,2,7]],['sus4',[0,5,7]],['dim',[0,3,6]],['aug',[0,4,8]]];
  function spectrumChroma(db,sampleRate,fftSize){
    const peaks=[],chroma=new Float64Array(12),step=sampleRate/fftSize;
    let max=-Infinity;for(let i=1;i<db.length;i++)if(i*step>=65&&i*step<=2200)max=Math.max(max,db[i]);
    if(!Number.isFinite(max)||max < -85)return chroma;
    for(let i=Math.max(2,Math.floor(65/step));i<Math.min(db.length-1,Math.ceil(2200/step));i++){
      const v=db[i];if(v<max-32||v<-85||v<=db[i-1]||v<db[i+1])continue;
      const denom=db[i-1]-2*v+db[i+1];
      const offset=Number.isFinite(denom)&&denom!==0?Math.max(-.5,Math.min(.5,.5*(db[i-1]-db[i+1])/denom)):0;
      const freq=(i+offset)*step,midi=69+12*Math.log2(freq/440),rounded=Math.round(midi);
      if(Math.abs(midi-rounded)>.42)continue;
      peaks.push({freq,midi:rounded,raw:Math.pow(10,(v-max)/20),weight:Math.exp(-.5*Math.pow((midi-rounded)/.25,2))});
    }
    // Discount upper partials to reduce false thirds/fifths from a single note.
    for(const p of peaks){let harmonic=0;for(const lower of peaks){if(lower.freq>=p.freq*.75)break;const ratio=p.freq/lower.freq,h=Math.round(ratio);if(h>=2&&h<=6&&Math.abs(12*Math.log2(ratio/h))<.35)harmonic=Math.max(harmonic,lower.raw/h);}
      const amplitude=Math.max(0,p.raw-1.25*harmonic)*p.weight;
      chroma[((p.midi%12)+12)%12]+=amplitude;
    }
    return chroma;
  }
  function classify(chroma){
    const total=chroma.reduce((a,b)=>a+b,0),peak=Math.max(...chroma);
    if(total<=1e-8||peak<=1e-8)return {label:'—',kind:'quiet'};
    const strong=Array.from(chroma).filter(v=>v>=peak*.18).length;
    if(strong<3)return {label:'—',kind:'notes'};
    const candidates=[];
    for(let root=0;root<12;root++)for(const [suffix,intervals] of templates){
      const values=intervals.map(i=>chroma[(root+i)%12]);
      if(Math.min(...values)<peak*.16)continue;
      const inside=values.reduce((a,b)=>a+b,0)/total;
      const score=inside-.3*(1-inside)-.012*(intervals.length-3);
      candidates.push({label:names[root]+suffix,score,inside});
    }
    candidates.sort((a,b)=>b.score-a.score);
    if(!candidates.length||candidates[0].inside<.78)return {label:'—',kind:'unclear'};
    const best=candidates[0],margin=best.score-(candidates[1]?.score??0);
    if(margin<.025)return {label:'—',kind:'unclear'};
    return {label:best.label,kind:'chord',strength:best.inside};
  }
  return Object.freeze({spectrumChroma,classify});
})();
window.BassLiveAudio = (()=>{
  let restoreSaved;
  function init({loadRecording,pausePlayer,isBusy,exportMP3}){
    const $=id=>document.getElementById(id),dialog=$('liveAudioDialog'),player=$('liveReplay');
    let stream=null,context=null,source=null,analyser=null,recorder=null,timer=null,generation=0,pending=false,finishing=false,importing=false;
    let autoCandidate='',autoCount=0,autoHarmony=false,clipping=false;
    let ai=null,latestRms=0,aiOrigin=0,history=[],lastAIEnd=-1,aiNotes='',aiKey='Gathering notes',quietSince=0;
    const worshipFollow=window.BassWorshipLive.createFollower();
    const chordFollow=window.BassResponsiveLive.createFollower();
    let leadSeen=-Infinity,lastLead=null,inputWarning=false;
    let fft,timeData,smooth=new Float64Array(12),lastTick=0,candidate='',candidateSince=0,shown='—';
    let chunks=[],audioBlob=null,audioURL='',downloaded=true,recordStart=0,listenStart=0,recordEnd=0,recordName='',events=[],lastEvent=null,stopPromise=null,resolveStop=null;
    let recovering=true,exporting=false,humNotes=[],humLastTime=-1,feedbackTotal=0,feedbackMatch=0;
    const state=$('liveStatus'),chord=$('liveChord'),detail=$('liveDetail'),elapsed=$('liveElapsed'),meter=$('liveLevel');
    const clock=t=>{t=Math.max(0,Math.floor(t));return Math.floor(t/60)+':'+String(t%60).padStart(2,'0')};
    function recording(){return !!recorder&&recorder.state==='recording';}
    function sync(){
      const active=!!stream,busy=pending||finishing||importing||recovering||exporting;
      $('liveListen').disabled=active||busy;
      $('liveRecord').disabled=recording()||busy||typeof MediaRecorder==='undefined';
      $('liveStop').disabled=!(active||pending)||finishing;
      $('liveSave').disabled=!audioBlob||recording()||busy;
      $('liveMP3').disabled=!audioBlob||active||busy;
      $('liveMidi').disabled=!humNotes.length||active||busy;
      $('liveForget').disabled=active||busy;
      $('liveUse').disabled=!audioBlob||active||busy;
      $('liveSaveChords').disabled=!events.length||active||busy;
      player.hidden=!audioBlob||recording()||finishing;
      $('openLiveAudio').innerHTML=recording()?'<span>Recording</span> <span>audio</span>':active?'<span>Listening</span> <span>live</span>':'<span>Live</span> <span>audio</span>';
    }
    function appendEvent(label,seconds){
      if(!recording())return;
      seconds=Math.max(0,seconds);
      if(lastEvent){seconds=Math.max(seconds,lastEvent.end);lastEvent.end=seconds;if(lastEvent.chord===label&&lastEvent.notes===aiNotes&&lastEvent.key===aiKey)return;}
      lastEvent={start:seconds,end:seconds,chord:label,notes:aiNotes,key:aiKey,provisional:true};events.push(lastEvent);
      const rows=events.slice(-6).map(e=>clock(e.start)+'  '+(e.chord==='—'?(e.notes||'Unclear / silence'):e.chord+' ?'));
      $('liveHistory').textContent=rows.join('\n');
    }
    function show(label,kind,now){
      shown=label;chord.textContent=label==='—'?'—':label+' ?';
      const messages={quiet:'Waiting for music',notes:'More notes needed for a chord',unclear:'Chord unclear',chord:'Provisional chord'};
      detail.textContent=messages[kind]||'Listening';
      appendEvent(label,(now-recordStart)/1000);
    }
    function renderListening(now){
      const mode=$('liveVoiceMode').value,seconds=context?.currentTime||0;
      if(seconds-leadSeen>1.6)lastLead=null;
      aiNotes=lastLead?.note||'';
      $('liveNotes').hidden=mode!=='auto';
      $('liveNotes').textContent='Lead note: '+(aiNotes||'—');
      if(mode==='solo'){
        shown='—';chord.textContent=aiNotes||'—';
        detail.textContent=aiNotes?'Voice note (estimate)':'Listening for a voice';
        appendEvent('—',(now-recordStart)/1000);
      }else{
        const current=chordFollow.state(seconds);
        show(current.chord,current.chord==='—'?'notes':'chord',now);
        detail.textContent=current.chord==='—'?'Listening for a chord':current.held?'Last chord · listening…':'Basic chord (estimate)';
      }
      if(inputWarning)detail.textContent+=' · Sound is very loud';
    }
    function tick(){
      if(!analyser||!context)return;
      const now=performance.now(),seconds=context.currentTime;
      if(now-lastTick>1500){chordFollow.clear();worshipFollow.clear();lastLead=null;leadSeen=-Infinity;}
      lastTick=now;
      analyser.getFloatTimeDomainData(timeData);
      const quality=window.BassResponsiveLive.levels(timeData);
      latestRms=quality.rms;clipping=quality.severe;inputWarning=quality.warning;
      meter.value=Math.min(1,Math.sqrt(Math.max(0,latestRms)));
      if(quality.quiet){
        if(!quietSince)quietSince=now;
        if(now-quietSince>=1100){chordFollow.clear();worshipFollow.clear();lastLead=null;}
      }else{
        quietSince=0;
        if($('liveVoiceMode').value!=='solo'&&!clipping){
          analyser.getFloatFrequencyData(fft);
          const evidence=window.BassResponsiveLive.spectrum(fft,context.sampleRate,analyser.fftSize);
          chordFollow.update({...evidence,source:'spectrum'},seconds);
        }
      }
      renderListening(now);
      elapsed.textContent=clock((now-(recording()?recordStart:listenStart))/1000);
      if(recording()&&now-recordStart>=3600000)void stop('One-hour recording complete. Save it before starting another.');
    }
    function releaseMic(){window.BassCoach?.stop();
      clearInterval(timer);timer=null;ai?.stop();ai=null;worshipFollow.clear();chordFollow.clear();lastLead=null;leadSeen=-Infinity;$('liveAIState').textContent='Stopped';
      if(stream){for(const track of stream.getTracks()){track.onended=null;track.stop();}stream=null;}
      try{source?.disconnect();analyser?.disconnect();}catch(_){}
      source=null;analyser=null;
      const old=context;context=null;if(old&&old.state!=='closed')void old.close().catch(()=>{});
      meter.value=0;
    }
    async function listen(){
      if(stream)return true;if(pending||finishing||importing||recovering||exporting)return false;
      if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){state.textContent='Open the hosted app over HTTPS to use your microphone.';return false;}
      const token=++generation;pending=true;state.textContent='Allow microphone access to start.';sync();
      let acquired=null,ctx=null;
      try{
        pausePlayer();player.pause();
        const AudioCtx=window.AudioContext||window.webkitAudioContext;
        ctx=new AudioCtx({sampleRate:22050});await ctx.resume();
        acquired=await navigator.mediaDevices.getUserMedia({audio:{channelCount:{ideal:1},echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
        if(token!==generation){acquired.getTracks().forEach(t=>t.stop());await ctx.close();return false;}
        context=ctx;stream=acquired;source=context.createMediaStreamSource(stream);analyser=context.createAnalyser();
        analyser.fftSize=8192;analyser.smoothingTimeConstant=0;source.connect(analyser);
        fft=new Float32Array(analyser.frequencyBinCount);timeData=new Float32Array(analyser.fftSize);
        smooth.fill(0);candidate='';shown='—';chord.textContent='—';detail.textContent='Waiting for music';listenStart=performance.now();lastTick=listenStart;
        stream.getTracks().forEach(t=>{t.onended=()=>void stop('Microphone disconnected. Any recording is ready to save.');});
        state.textContent='Listening on this device.';timer=setInterval(tick,100);
        autoCandidate='';autoCount=0;autoHarmony=false;history=[];lastAIEnd=-1;aiNotes='';aiKey='Gathering notes';quietSince=0;worshipFollow.clear();chordFollow.clear();lastLead=null;leadSeen=-Infinity;aiOrigin=performance.now()-context.currentTime*1000;
        $('liveNotes').textContent='Lead note: —';$('liveKey').textContent='Key: gathering notes';
        const liveContext=context; // Keep live listening focused; no extra timing/pitch coach.
        void (async()=>{try{
          const handle=await window.BassVoiceAI.start(context,source,d=>{
            if(token!==generation||!context||context!==liveContext)return;
            const age=context.currentTime-d.end;
            // Late model results must not erase the faster chord display.
            if(age>2){$('liveAIState').textContent='Listening';return;}
            const mode=$('liveVoiceMode').value;
            const evidence=window.BassResponsiveLive.model(d,{lead:mode!=='harmony'});
            const focus=worshipFollow.update(evidence,d.end);
            if(latestRms>=.0025&&!clipping){
              if(focus.lead){lastLead=focus.lead;leadSeen=context.currentTime;}
              if(mode!=='solo'&&age<.95&&evidence.chord!=='—')
                chordFollow.update({...evidence,source:'model'},context.currentTime);
            }
            $('liveAIState').textContent='Listening';
            renderListening(performance.now());
          },message=>{if(token===generation)$('liveAIState').textContent=message;});
          if(token!==generation)handle.stop();else ai=handle;
        }catch(_){if(token===generation)$('liveAIState').textContent='AI unavailable. Recording still works.';}})();
        return token===generation;
      }catch(error){
        acquired?.getTracks().forEach(t=>t.stop());if(ctx&&ctx.state!=='closed')await ctx.close().catch(()=>{});
        if(token===generation){releaseMic();state.textContent=error.name==='NotAllowedError'?'Microphone access was not allowed. Enable it in your browser and try again.':error.name==='NotFoundError'?'No microphone found. Connect one and try again.':'Could not open the microphone. Check that another app is not using it.';}
        return false;
      }finally{if(token===generation){pending=false;sync();}}
    }
    async function record(){
      if(recording()||pending||finishing||importing||recovering||exporting)return;
      if(typeof MediaRecorder==='undefined'){state.textContent='Recording is not supported in this browser. Try Chrome, Edge or Safari.';return;}
      if(audioBlob&&!downloaded&&!await BassDialog.confirm('This take has not been saved. Cancel to save it first.',{title:'Replace recording',accept:'Replace',danger:true}))return;
      if(!await listen())return;
      try{
        const types=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus','audio/webm'];
        const type=types.find(t=>MediaRecorder.isTypeSupported(t));
        const next=new MediaRecorder(stream,type?{mimeType:type}:undefined);
        const nextChunks=[];let chunkIndex=0;
        const recoveryError=()=>{$('liveRecovery').textContent='Recovery unavailable. Save this take.';};
        const takeName='Bass_Studio_Live_'+new Date().toISOString().replace(/[:.]/g,'-');
        const recordToken=generation;pending=true;sync();
        const previousTake=await BassRecovery.restore();if(previousTake)await BassTrash.add('recording',previousTake.name,previousTake);
        if(recordToken!==generation||!stream){pending=false;sync();return;}
        await window.BassRecovery.begin({name:takeName,mime:next.mimeType,complete:false}).catch(recoveryError);
        if(recordToken!==generation||!stream){pending=false;sync();return;}pending=false;
        next.ondataavailable=e=>{if(e.data.size){nextChunks.push(e.data);void window.BassRecovery.chunk(chunkIndex++,e.data,takeName).catch(recoveryError);}};
        next.onerror=()=>{void stop('Recording was interrupted. Save any audio recovered below.');};
        next.onstop=()=>{
          if(!recordEnd)recordEnd=performance.now();
          releaseMic();chord.textContent='—';detail.textContent='Stopped';
          if(lastEvent)lastEvent.end=Math.max(lastEvent.start,(recordEnd-recordStart)/1000);
          const mime=next.mimeType||nextChunks[0]?.type||'application/octet-stream';
          audioBlob=nextChunks.length?new Blob(nextChunks,{type:mime}):null;
          void window.BassRecovery.finish({name:recordName,mime,complete:true,events,humNotes,duration:(recordEnd-recordStart)/1000}).catch(recoveryError);
          chunks=[];recorder=null;finishing=false;
          if(audioURL)URL.revokeObjectURL(audioURL);audioURL='';
          if(audioBlob){audioURL=URL.createObjectURL(audioBlob);player.src=audioURL;player.load();downloaded=false;}
          else{state.textContent='No audio was captured. Please try recording again.';player.removeAttribute('src');}
          sync();resolveStop?.();resolveStop=null;stopPromise=null;
        };
        next.start(1000);
        recorder=next;chunks=nextChunks;events=[];lastEvent=null;recordStart=performance.now();recordEnd=0;
        recordName=takeName;humNotes=[];humLastTime=-1;feedbackTotal=0;feedbackMatch=0;
        $('liveHistory').textContent='';elapsed.textContent='0:00';state.textContent='Recording…';
        appendEvent(shown,0);sync();
      }catch(error){pending=false;state.textContent='Could not start recording. Live listening is still available.';sync();}
    }
    async function stop(message='Stopped.'){
      if(finishing)return stopPromise;
      ++generation;pending=false;
      const active=recorder;
      if(active){
        recordEnd=performance.now();finishing=true;
        stopPromise=new Promise(resolve=>{resolveStop=resolve;});
        if(active.state!=='inactive')active.stop();
      }
      releaseMic();chord.textContent='—';detail.textContent='Stopped';state.textContent=message;sync();
      if(active)return stopPromise;
    }
    function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
    function extension(){const type=audioBlob?.type||'';return /mp4/.test(type)?'m4a':/ogg/.test(type)?'ogg':/webm/.test(type)?'webm':'audio';}
    $('openLiveAudio').onclick=()=>{dialog.showModal();dialog.scrollTop=0;sync();};
    $('liveListen').onclick=()=>void listen();$('liveRecord').onclick=()=>void record();$('liveStop').onclick=()=>void stop();
    $('liveClose').onclick=async()=>{await stop('Stopped.');player.pause();dialog.close();};
    dialog.addEventListener('cancel',e=>{e.preventDefault();$('liveClose').click();});
    $('liveSave').onclick=()=>{if(audioBlob){download(audioBlob,recordName+'.'+extension());downloaded=true;state.textContent='Audio download started.';}};
    $('liveMP3').onclick=async()=>{
      if(!audioBlob||exporting)return;exporting=true;sync();state.textContent='Making MP3…';
      try{const blob=await exportMP3(audioBlob);download(blob,recordName+'.mp3');downloaded=true;state.textContent='MP3 download started.';}
      catch(e){state.textContent='MP3 unavailable. Save audio still works.';}finally{exporting=false;sync();}
    };
    $('liveMidi').onclick=()=>download(window.BassMidi(humNotes),recordName+'_Bass.mid');
    $('livePracticeKey').onchange=()=>{feedbackTotal=feedbackMatch=0;$('liveFeedback').textContent='';};
    $('liveForget').onclick=async()=>{
      if(stream||pending||finishing||importing||recovering||exporting)return;
      if(!await BassDialog.confirm('You can restore it from Recently deleted.',{title:'Delete recording',accept:'Delete take',danger:true}))return;recovering=true;sync();
      try{const saved=await BassRecovery.restore();if(saved)await BassTrash.add('recording',saved.name,saved);else if(audioBlob)await BassTrash.add('recording',recordName,{name:recordName,blob:audioBlob,mime:audioBlob.type,events,humNotes,complete:true,duration:Number(player.duration)||0});await window.BassRecovery.clear();audioBlob=null;humNotes=[];events=[];player.pause();player.removeAttribute('src');if(audioURL)URL.revokeObjectURL(audioURL);audioURL='';downloaded=true;state.textContent='Saved take deleted.';sync();}catch(e){state.textContent='Could not delete the saved take.';}finally{recovering=false;sync();}
    };
    $('liveSaveChords').onclick=()=>{
      const rows=['Start seconds,End seconds,Chord,Notes,Key,Status',...events.map(e=>[e.start.toFixed(3),e.end.toFixed(3),e.chord==='—'?'Unclear':e.chord,e.notes||'',e.key||'','Provisional'].join(','))];
      download(new Blob([rows.join('\r\n')],{type:'text/csv;charset=utf-8'}),recordName+'_Chords.csv');
    };
    $('liveUse').onclick=async()=>{
      if(!audioBlob||stream||importing)return;
      if(isBusy()){state.textContent='Wait for the current import or analysis to finish first.';return;}
      if(!await BassDialog.confirm('Save your current song first. Analysing this recording may upload it to your analysis service.',{title:'Load recording',accept:'Load audio'}))return;
      importing=true;sync();state.textContent='Loading recording…';
      try{player.pause();const ok=await loadRecording(new File([audioBlob],recordName+'.'+extension(),{type:audioBlob.type}));
        state.textContent=ok?'Recording loaded. Use Analyse Bass for the full analysis.':'Could not load this recording. You can still save the audio.';
        if(ok)dialog.close();
      }catch(_){state.textContent='Could not load this recording. You can still save the audio.';}
      finally{importing=false;sync();}
    };
    const selectMode=()=>{
      if(!['auto','solo','harmony'].includes($('liveVoiceMode').value))$('liveVoiceMode').value='auto';
      worshipFollow.clear();chordFollow.clear();lastLead=null;leadSeen=-Infinity;aiNotes='';aiKey='';
      $('livePractice').hidden=true;$('liveNotes').hidden=$('liveVoiceMode').value!=='auto';
      $('liveNotes').textContent='Lead note: —';chord.textContent='—';
      detail.textContent=$('liveVoiceMode').value==='solo'?'Listening for a voice':'Listening for a chord';
      try{localStorage.setItem('bassLiveModeRC209',$('liveVoiceMode').value);}catch{}
    };
    try{const saved=localStorage.getItem('bassLiveModeRC209');if(['auto','solo','harmony'].includes(saved))$('liveVoiceMode').value=saved;}catch{}
    $('liveVoiceMode').onchange=selectMode;selectMode();
    window.addEventListener('beforeunload',e=>{if(recording()||finishing||(audioBlob&&!downloaded)){e.preventDefault();e.returnValue='';}});
    window.addEventListener('pagehide',()=>void stop('Microphone off.'));
    restoreSaved=async saved=>{
      if(stream||pending||finishing||importing||recovering||exporting)throw Error('Stop live audio first.');
      if(!(saved.blob instanceof Blob)||!saved.blob.size)throw Error('No audio in this recovery copy.');
      recovering=true;sync();try{const current=await BassRecovery.restore();if(current)await BassTrash.add('recording',current.name,current);
        const {blob,...meta}=saved;await BassRecovery.replace(meta,blob);
        player.pause();if(audioURL)URL.revokeObjectURL(audioURL);audioBlob=blob;recordName=saved.name;events=saved.events||[];humNotes=saved.humNotes||[];audioURL=URL.createObjectURL(blob);player.src=audioURL;player.load();downloaded=false;elapsed.textContent=clock(saved.duration||0);state.textContent='Recording restored. Open Live audio to play or save.';
      }finally{recovering=false;sync();}
    };
    void window.BassRecovery.restore().then(saved=>{
      if(!saved)return;audioBlob=saved.blob;recordName=saved.name;events=saved.events||[];humNotes=saved.humNotes||[];
      audioURL=URL.createObjectURL(audioBlob);player.src=audioURL;player.load();downloaded=false;
      elapsed.textContent=clock(saved.duration||0);state.textContent=saved.complete?'Recording restored.':'Interrupted take recovered. Check playback.';
      $('openLiveAudio').innerHTML='<span>Recovered</span> <span>audio</span>';
    }).catch(()=>{$('liveRecovery').textContent='Recovery unavailable. Save your recording.';}).finally(()=>{recovering=false;sync();});
    sync();
  }
  return Object.freeze({init,restoreSaved:s=>restoreSaved(s)});
})();
