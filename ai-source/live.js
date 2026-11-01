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
  function init({loadRecording,pausePlayer,isBusy}){
    const $=id=>document.getElementById(id),dialog=$('liveAudioDialog'),player=$('liveReplay');
    let stream=null,context=null,source=null,analyser=null,recorder=null,timer=null,generation=0,pending=false,finishing=false,importing=false;
    let autoCandidate='',autoCount=0,autoHarmony=false,clipping=false;
    let ai=null,latestRms=0,aiOrigin=0,history=[],lastAIEnd=-1,aiNotes='',aiKey='Gathering notes';
    let fft,timeData,smooth=new Float64Array(12),lastTick=0,candidate='',candidateSince=0,shown='—';
    let chunks=[],audioBlob=null,audioURL='',downloaded=true,recordStart=0,listenStart=0,recordEnd=0,recordName='',events=[],lastEvent=null,stopPromise=null,resolveStop=null;
    const state=$('liveStatus'),chord=$('liveChord'),detail=$('liveDetail'),elapsed=$('liveElapsed'),meter=$('liveLevel');
    const clock=t=>{t=Math.max(0,Math.floor(t));return Math.floor(t/60)+':'+String(t%60).padStart(2,'0')};
    function recording(){return !!recorder&&recorder.state==='recording';}
    function sync(){
      const active=!!stream,busy=pending||finishing||importing;
      $('liveListen').disabled=active||busy;
      $('liveRecord').disabled=recording()||busy||typeof MediaRecorder==='undefined';
      $('liveStop').disabled=!(active||pending)||finishing;
      $('liveSave').disabled=!audioBlob||recording()||busy;
      $('liveUse').disabled=!audioBlob||active||busy;
      $('liveSaveChords').disabled=!events.length||active||busy;
      player.hidden=!audioBlob||recording()||finishing;
      $('openLiveAudio').textContent=recording()?'Recording…':active?'Listening…':'Live audio';
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
    function tick(){
      if(!analyser)return;
      const now=performance.now();
      if(now-lastTick>1000){smooth.fill(0);candidate='';candidateSince=now;show('—','unclear',now);}
      lastTick=now;
      analyser.getFloatTimeDomainData(timeData);
      let sum=0,peak=0;for(const v of timeData){sum+=v*v;peak=Math.max(peak,Math.abs(v));}
      const rms=Math.sqrt(sum/timeData.length);meter.value=Math.min(1,rms*5);
      latestRms=rms;clipping=peak>.98;
      if(rms<.003){autoCandidate='';autoCount=0;autoHarmony=false;aiNotes='';$('liveNotes').textContent='Notes: —';show('—','quiet',now);}
      else if(peak>.98){show('—','unclear',now);detail.textContent='Input too loud. Lower the volume.';}
      elapsed.textContent=clock((now-(recording()?recordStart:listenStart))/1000);
      // Bound memory use; the finished recording remains available to save.
      if(recording()&&now-recordStart>=3600000){void stop('One-hour recording complete. Save it before starting another.');}
    }
    function releaseMic(){
      clearInterval(timer);timer=null;ai?.stop();ai=null;$('liveAIState').textContent='AI stopped';
      if(stream){for(const track of stream.getTracks()){track.onended=null;track.stop();}stream=null;}
      try{source?.disconnect();analyser?.disconnect();}catch(_){}
      source=null;analyser=null;
      const old=context;context=null;if(old&&old.state!=='closed')void old.close().catch(()=>{});
      meter.value=0;
    }
    async function listen(){
      if(stream)return true;if(pending||finishing||importing)return false;
      if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){state.textContent='Open the hosted app over HTTPS to use your microphone.';return false;}
      const token=++generation;pending=true;state.textContent='Allow microphone access to start.';sync();
      let acquired=null,ctx=null;
      try{
        pausePlayer();player.pause();
        const AudioCtx=window.AudioContext||window.webkitAudioContext;
        ctx=new AudioCtx({sampleRate:22050});await ctx.resume();
        acquired=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
        if(token!==generation){acquired.getTracks().forEach(t=>t.stop());await ctx.close();return false;}
        context=ctx;stream=acquired;source=context.createMediaStreamSource(stream);analyser=context.createAnalyser();
        analyser.fftSize=8192;analyser.smoothingTimeConstant=0;source.connect(analyser);
        fft=new Float32Array(analyser.frequencyBinCount);timeData=new Float32Array(analyser.fftSize);
        smooth.fill(0);candidate='';shown='—';chord.textContent='—';detail.textContent='Waiting for music';listenStart=performance.now();lastTick=listenStart;
        stream.getTracks().forEach(t=>{t.onended=()=>void stop('Microphone disconnected. Any recording is ready to save.');});
        state.textContent='Listening on this device.';timer=setInterval(tick,100);
        autoCandidate='';autoCount=0;autoHarmony=false;history=[];lastAIEnd=-1;aiNotes='';aiKey='Gathering notes';aiOrigin=performance.now()-context.currentTime*1000;
        $('liveNotes').textContent='Notes: —';$('liveKey').textContent='Key: gathering notes';
        const liveContext=context;
        try{
          const handle=await window.BassVoiceAI.start(context,source,d=>{
            if(token!==generation||!context||context!==liveContext)return;
            const age=context.currentTime-d.end;
            if(age>4){$('liveAIState').textContent='AI is behind. Try a faster device.';show('—','unclear',performance.now());return;}
            const mode=$('liveVoiceMode').value;
            const poly=window.BassVoiceAI.readFrames(d,window.BassLiveDSP.classify,false);
            if(mode==='auto'){
              const next=poly.chord!=='—'?'harmony':'single';
              autoCount=next===autoCandidate?autoCount+1:1;autoCandidate=next;
              if(autoCount>=2)autoHarmony=next==='harmony';
            }
            const evidence=(mode==='harmony'||mode==='auto'&&autoHarmony)?poly:window.BassVoiceAI.readFrames(d,window.BassLiveDSP.classify,true);
            const speech=$('liveVoiceMode').value==='speech';
            $('liveAIState').textContent=(mode==='auto'?(autoHarmony?'Auto: harmony':'Auto: single line'):'AI ready')+' · '+Math.max(0,age).toFixed(1)+'s';
            if(latestRms<.003||clipping)return;
            aiNotes=evidence.notes.join(' ');$('liveNotes').textContent='Notes: '+(aiNotes||'—');
            if(d.end>lastAIEnd){
              const fraction=lastAIEnd<=d.start?1:Math.max(0,(d.end-lastAIEnd)/(d.end-d.start));
              history.push({time:d.end,hist:evidence.hist.map(x=>x*fraction),seconds:evidence.seconds*fraction});lastAIEnd=d.end;
              history=history.filter(x=>x.time>d.end-30);
            }
            const hist=new Array(12).fill(0);let seconds=0;for(const h of history){seconds+=h.seconds;h.hist.forEach((v,i)=>hist[i]+=v);}
            aiKey=speech?'Not estimated for speech':window.BassVoiceAI.keyEstimate(hist,seconds);
            $('liveKey').textContent='Key: '+aiKey;
            show(speech?'—':evidence.chord,evidence.chord!=='—'&&!speech?'chord':evidence.notes.length?'notes':'unclear',aiOrigin+d.end*1000);
            if(speech)detail.textContent='Vocal pitch only';
            else if(evidence.notes.length&&evidence.chord==='—')detail.textContent='No clear chord';
          },message=>{if(token===generation)$('liveAIState').textContent=message;});
          if(token!==generation)handle.stop();else ai=handle;
        }catch(_){if(token===generation)$('liveAIState').textContent='AI unavailable. Recording still works.';}
        return token===generation;
      }catch(error){
        acquired?.getTracks().forEach(t=>t.stop());if(ctx&&ctx.state!=='closed')await ctx.close().catch(()=>{});
        if(token===generation){releaseMic();state.textContent=error.name==='NotAllowedError'?'Microphone access was not allowed. Enable it in your browser and try again.':error.name==='NotFoundError'?'No microphone found. Connect one and try again.':'Could not open the microphone. Check that another app is not using it.';}
        return false;
      }finally{if(token===generation){pending=false;sync();}}
    }
    async function record(){
      if(recording()||pending||finishing||importing)return;
      if(typeof MediaRecorder==='undefined'){state.textContent='Recording is not supported in this browser. Try Chrome, Edge or Safari.';return;}
      if(audioBlob&&!downloaded&&!window.confirm('Replace the unsaved recording? Choose Cancel to save it first.'))return;
      if(!await listen())return;
      try{
        const types=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus','audio/webm'];
        const type=types.find(t=>MediaRecorder.isTypeSupported(t));
        const next=new MediaRecorder(stream,type?{mimeType:type}:undefined);
        const nextChunks=[];
        next.ondataavailable=e=>{if(e.data.size)nextChunks.push(e.data);};
        next.onerror=()=>{void stop('Recording was interrupted. Save any audio recovered below.');};
        next.onstop=()=>{
          if(!recordEnd)recordEnd=performance.now();
          releaseMic();chord.textContent='—';detail.textContent='Microphone off';
          if(lastEvent)lastEvent.end=Math.max(lastEvent.start,(recordEnd-recordStart)/1000);
          const mime=next.mimeType||nextChunks[0]?.type||'application/octet-stream';
          audioBlob=nextChunks.length?new Blob(nextChunks,{type:mime}):null;
          chunks=[];recorder=null;finishing=false;
          if(audioURL)URL.revokeObjectURL(audioURL);audioURL='';
          if(audioBlob){audioURL=URL.createObjectURL(audioBlob);player.src=audioURL;player.load();downloaded=false;}
          else{state.textContent='No audio was captured. Please try recording again.';player.removeAttribute('src');}
          sync();resolveStop?.();resolveStop=null;stopPromise=null;
        };
        next.start(1000);
        recorder=next;chunks=nextChunks;events=[];lastEvent=null;recordStart=performance.now();recordEnd=0;
        recordName='Bass_Studio_Live_'+new Date().toISOString().replace(/[:.]/g,'-');
        $('liveHistory').textContent='';elapsed.textContent='0:00';state.textContent='Recording…';
        appendEvent(shown,0);sync();
      }catch(error){state.textContent='Could not start recording. Live listening is still available.';sync();}
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
      releaseMic();chord.textContent='—';detail.textContent='Microphone off';state.textContent=message;sync();
      if(active)return stopPromise;
    }
    function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
    function extension(){const type=audioBlob?.type||'';return /mp4/.test(type)?'m4a':/ogg/.test(type)?'ogg':/webm/.test(type)?'webm':'audio';}
    $('openLiveAudio').onclick=()=>{dialog.showModal();dialog.scrollTop=0;sync();};
    $('liveListen').onclick=()=>void listen();$('liveRecord').onclick=()=>void record();$('liveStop').onclick=()=>void stop();
    $('liveClose').onclick=async()=>{await stop('Microphone off. Save before closing the app.');player.pause();dialog.close();};
    dialog.addEventListener('cancel',e=>{e.preventDefault();$('liveClose').click();});
    $('liveSave').onclick=()=>{if(audioBlob){download(audioBlob,recordName+'.'+extension());downloaded=true;state.textContent='Audio download started.';}};
    $('liveSaveChords').onclick=()=>{
      const rows=['Start seconds,End seconds,Chord,Notes,Key,Status',...events.map(e=>[e.start.toFixed(3),e.end.toFixed(3),e.chord==='—'?'Unclear':e.chord,e.notes||'',e.key||'','Provisional'].join(','))];
      download(new Blob([rows.join('\r\n')],{type:'text/csv;charset=utf-8'}),recordName+'_Chords.csv');
    };
    $('liveUse').onclick=async()=>{
      if(!audioBlob||stream||importing)return;
      if(isBusy()){state.textContent='Wait for the current import or analysis to finish first.';return;}
      if(!window.confirm('Load this recording as the current song? Save your current song first. Normal song analysis may upload the recording to your configured analysis service.'))return;
      importing=true;sync();state.textContent='Loading recording…';
      try{player.pause();const ok=await loadRecording(new File([audioBlob],recordName+'.'+extension(),{type:audioBlob.type}));
        state.textContent=ok?'Recording loaded. Use Analyse Bass for the full analysis.':'Could not load this recording. You can still save the audio.';
        if(ok)dialog.close();
      }catch(_){state.textContent='Could not load this recording. You can still save the audio.';}
      finally{importing=false;sync();}
    };
    $('liveVoiceMode').onchange=()=>{autoCandidate='';autoCount=0;autoHarmony=false;history=[];shown='—';chord.textContent='—';aiNotes='';$('liveNotes').textContent='Notes: —';aiKey='Gathering notes';$('liveKey').textContent=$('liveVoiceMode').value==='speech'?'Key: not estimated for speech':'Key: gathering notes';};
    window.addEventListener('beforeunload',e=>{if(recording()||finishing||(audioBlob&&!downloaded)){e.preventDefault();e.returnValue='';}});
    window.addEventListener('pagehide',()=>void stop('Microphone off.'));
    sync();
  }
  return Object.freeze({init});
})();
