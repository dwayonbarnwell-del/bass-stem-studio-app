/* RC200: measured 10–20 song ZIP batches. Retains RC198 import, RunPod analysis and save functions without any new server. */
window.BassBatch = (() => {
  const audio = new Set(['mp3','wav','wave','m4a','m4b','aac','aif','aiff','aifc','caf','flac','ogg','oga','opus','wma']);
  const video = new Set(['mp4','m4v','mov','webm','mkv','avi','mpeg','mpg','3gp','3g2','ogv','wmv']);
  const MAX_ZIP = 2 * 1024 * 1048576, MAX_ENTRY = 200 * 1048576, MAX_TOTAL = 3 * 1024 * 1048576, MAX_SONGS = 150;
  let hooks = {}, dialog, archive, entries = [], working = false, stopAfterCurrent = false, completed = new Set(), storageKey = '', checking = false;
  let loadingZip=false, selectionId=0, selectedName='', archiveMessage='Choose a ZIP containing music files.', connectionMessage='', accessWarning='', ticker=null;
  const $ = id => document.getElementById(id);
  const number = (v, offset, size) => size === 2 ? v.getUint16(offset, true) : v.getUint32(offset, true);
  const ext = name => String(name).split('.').pop().toLowerCase();
  const clean = name => String(name).replace(/\\/g,'/').split('/').pop().replace(/\.[^.]+$/,'').trim();
  const projectTitle = name => clean(name).replace(/[\\/:*?"<>|]+/g,'_').replace(/\s+/g,' ').slice(0,95) || 'Untitled song';
  const errorMessage = err => String(err && err.message || err || 'Unknown error');
  const rowStatus = item => item.status || 'Queued';
  const formatElapsed = ms => {
    const seconds=Math.max(0,Math.floor((Number(ms)||0)/1000));
    const m=Math.floor(seconds/60),s=String(seconds%60).padStart(2,'0');
    return m>=60?Math.floor(m/60)+'h '+String(m%60).padStart(2,'0')+'m '+s+'s':m+'m '+s+'s';
  };
  function updateElapsed(){
    const element=$('batchTiming');
    if(!element)return;
    const active=entries.find(item=>item.startedAt && ['Opening','Reopening','Analysing','Saving'].includes(item.status));
    element.textContent=active ? active.status+' · '+active.name+' · '+formatElapsed(Date.now()-active.startedAt) : '';
  }
  function tell(message) { if ($('batchStatus')) $('batchStatus').textContent = message; }
  function draw() {
    if (!dialog) return;
    const selected=entries.filter(i=>i.status==='Saved').length;
    const actionable=entries.filter(i=>!['Saved','Skipped','Needs review'].includes(i.status)).length;
    const issues=entries.filter(i=>['Later','Needs review'].includes(i.status)).length;
    $('batchFileName').textContent=selectedName || 'No ZIP selected';
    $('batchFileName').title=selectedName;
    $('batchArchive').textContent=archiveMessage;
    $('batchCount').textContent=loadingZip?'Reading selected ZIP…':
      entries.length ? entries.length+' songs · '+(accessWarning?'saved songs not checked':selected+' saved')+' · '+actionable+' to process'+(issues?' · '+issues+' need review':'') : 'No songs loaded';
    const heldReady=entries.some(item=>item.status==='Needs review'&&(hooks.heldJobs?.()||[]).some(job=>matchesHeld(item,job)));
    $('batchStart').disabled=working||loadingZip||!archive||(actionable===0&&!heldReady);
    $('batchStart').textContent=working?'Processing…':actionable===0&&heldReady?'Check saved analysis':hooks.hasPending?.()?'Continue other songs':entries.some(i=>['Later','Error'].includes(i.status))?'Retry remaining':entries.some(i=>i.status==='Saved')?'Continue batch':'Start batch';
    if($('batchLimit'))$('batchLimit').disabled=working||loadingZip;
    $('batchCheck').disabled=working||checking;
    $('batchCheck').textContent=checking?'Checking…':'Check connection';
    $('batchStop').disabled=!working;
    $('batchPick').disabled=working||loadingZip;
    $('batchClose').disabled=working;
    $('batchConnection').textContent=connectionMessage;
    $('batchConnection').hidden=!connectionMessage;
    const list=$('batchSongs');list.replaceChildren();
    list.hidden=!entries.length;
    entries.forEach((item,index)=>{
      const line=document.createElement('li'),title=document.createElement('span'),state=document.createElement('strong');
      title.textContent=(index+1)+'. '+item.name;
      state.textContent=(item.status||'Queued')+(Number.isFinite(item.timing?.totalMs)?' · '+formatElapsed(item.timing.totalMs):'');
      const details=[item.reason, item.timing&&[
        Number.isFinite(item.timing.openMs)?'Open '+formatElapsed(item.timing.openMs):'',
        Number.isFinite(item.timing.analyseMs)?'Analyse '+formatElapsed(item.timing.analyseMs):'',
        Number.isFinite(item.timing.saveMs)?'Save '+formatElapsed(item.timing.saveMs):''
      ].filter(Boolean).join(' · ')].filter(Boolean).join(' | ');
      if(details)state.title=details;
      line.append(title,state);list.append(line);
    });
  }
  async function listZip(file) {
    if (!file || !/\.zip$/i.test(file.name)) throw Error('Choose a ZIP file.');
    if (file.size > MAX_ZIP) throw Error('This ZIP exceeds 2 GB. Divide it into smaller ZIP files.');
    const end = Math.max(0, file.size - 65557);
    const tail = new Uint8Array(await file.slice(end).arrayBuffer());
    const view = new DataView(tail.buffer);
    let eocd = -1;
    for (let i = tail.length - 22; i >= 0; i--) {
      if (number(view,i,4) === 0x06054b50 && i + 22 + number(view,i+20,2) <= tail.length) { eocd = i; break; }
    }
    if (eocd < 0) throw Error('The ZIP directory could not be found.');
    if (number(view,eocd+4,2) || number(view,eocd+6,2)) throw Error('Multi-volume ZIP files are not supported.');
    const count = number(view,eocd+10,2), length = number(view,eocd+12,4), offset = number(view,eocd+16,4);
    if (count === 65535 || length === 0xffffffff || offset === 0xffffffff) throw Error('ZIP64 archives are not supported. Make smaller ZIP files.');
    if (offset + length > file.size || count > 5000) throw Error('This ZIP has an invalid or oversized directory.');
    const dir = new Uint8Array(await file.slice(offset,offset+length).arrayBuffer());
    const dv = new DataView(dir.buffer), decoder = new TextDecoder('utf-8');
    let at = 0, total = 0; const found = [];
    for (let i=0; i<count; i++) {
      if (at + 46 > dir.length || number(dv,at,4) !== 0x02014b50) throw Error('The ZIP directory is damaged.');
      const flags = number(dv,at+8,2), method = number(dv,at+10,2);
      const compressed = number(dv,at+20,4), size = number(dv,at+24,4), crc = number(dv,at+16,4);
      const nameLength = number(dv,at+28,2), extraLength = number(dv,at+30,2), noteLength = number(dv,at+32,2), localOffset = number(dv,at+42,4);
      const next = at + 46 + nameLength + extraLength + noteLength;
      if (next > dir.length) throw Error('A ZIP entry is incomplete.');
      const name = decoder.decode(dir.slice(at+46,at+46+nameLength)); at = next;
      const kind = ext(name);
      if (name.endsWith('/') || (!audio.has(kind) && !video.has(kind))) continue;
      if (flags & 1) throw Error('Password-protected songs are not supported.');
      let reason='';
      if (method !== 0 && method !== 8) reason='Unsupported compression for this song';
      else if (!size || size > MAX_ENTRY || compressed > MAX_ENTRY || localOffset === 0xffffffff) reason='This song is empty or exceeds the 200 MB per-song limit';
      else if (total + size > MAX_TOTAL) reason='Unpacked songs exceed the 3 GB batch limit';
      if(!reason)total+=size;
      if(found.length>=MAX_SONGS)throw Error('The ZIP contains over 150 music files. Split it into smaller ZIPs.');
      found.push({name,size,compressed,method,localOffset,crc,status:reason?'Skipped':'Queued',reason,title:projectTitle(name)});
    }
    if (!found.length) throw Error('This ZIP contains no supported audio or video files.');
    const used = new Map();
    for (const item of found) {
      const key = item.title.toLocaleLowerCase();
      if (used.has(key) && item.status==='Queued') item.status = 'Skipped', item.reason = 'Duplicate song name in this ZIP';
      else if(item.status==='Queued') used.set(key,true);
    }
    if(!found.some(i=>i.status==='Queued'))throw Error('All music files in this ZIP are unsupported, oversized or duplicates. Use a smaller ZIP or review the files.');
    return found;
  }
  async function getSong(item) {
    const buf = await archive.slice(item.localOffset, item.localOffset+30).arrayBuffer();
    if (buf.byteLength !== 30) throw Error('Incomplete ZIP entry.');
    const h = new DataView(buf);
    if (number(h,0,4) !== 0x04034b50) throw Error('Invalid song header.');
    const offset = item.localOffset + 30 + number(h,26,2) + number(h,28,2);
    if (offset + item.compressed > archive.size) throw Error('Song exceeds the ZIP boundary.');
    const payload = archive.slice(offset,offset+item.compressed);
    let blob;
    if (item.method === 0) blob = payload;
    else {
      if (typeof DecompressionStream !== 'function') throw Error('This browser cannot open compressed ZIP files.');
      blob = await new Response(payload.stream().pipeThrough(new DecompressionStream('deflate-raw'))).blob();
    }
    if (blob.size !== item.size) throw Error('The extracted song is incomplete.');
    const name = item.name.split('/').pop().split('\\').pop();
    const type = audio.has(ext(name)) ? (ext(name)==='mp3'?'audio/mpeg':'audio/'+ext(name)) : 'video/'+ext(name);
    return new File([blob],name,{type,lastModified:archive.lastModified});
  }
  async function choose(file) {
    if (working || !file) return;
    const request=++selectionId;
    archive=null;entries=[];accessWarning='';selectedName=String(file.name||'');
    loadingZip=true;archiveMessage='Checking '+selectedName+'…';tell('');draw();
    try {
      const found=await listZip(file);
      if(request!==selectionId)return;
      storageKey='bass-batch-v1|'+[file.name,file.size,file.lastModified].join('|');
      try {completed=new Set(JSON.parse(localStorage.getItem(storageKey)||'[]'));}catch{completed=new Set();}
      archive=file;entries=found;
      archiveMessage='ZIP opened. Checking your saved songs…';draw();
      let index=0;
      for(const item of entries){
        if(request!==selectionId)return;
        if(item.status==='Skipped')continue;
        try {
          if(await window.BassLibrary.hasProject(item.title)){
            item.status='Saved';completed.add(item.name+'|'+item.size+'|'+item.crc);
          }
        }catch(err){
          accessWarning=errorMessage(err);
          break; // Keep the valid ZIP. Ask for library permission on Start.
        }
        if(++index%12===0){
          archiveMessage='ZIP opened. Checked '+index+' songs in your library…';draw();
          await new Promise(r=>setTimeout(r,0));
        }
      }
      if(request!==selectionId)return;
      const ready=entries.filter(i=>i.status==='Queued').length;
      const saved=entries.filter(i=>i.status==='Saved').length;
      const skipped=entries.filter(i=>i.status==='Skipped').length;
      archiveMessage=entries.length+' songs found · '+(accessWarning?'Saved projects not yet checked. Tap Start batch to reconnect your library folder.':saved+' already saved · '+ready+' ready'+(skipped?' · '+skipped+' skipped':'')+'.');
      if(!accessWarning)markHeldRows();
    }catch(err){
      if(request!==selectionId)return;
      archive=null;entries=[];
      archiveMessage='Cannot open '+selectedName+': '+errorMessage(err);
    }finally{
      if(request===selectionId){loadingZip=false;draw();}
    }
  }
  async function checkConnection() {
    if (working || checking) return false;
    checking=true;connectionMessage='Checking the RunPod connection…';draw();
    try {
      if(!hooks.checkConnection)throw Error('Connection check is unavailable in this version.');
      const result=await hooks.checkConnection();
      const workers=result?.workers||{},jobs=result?.jobs||{};
      const idle=Number(workers.idle)||0,running=Number(workers.running)||0,queued=Number(jobs.inQueue)||0;
      const unfinished=hooks.hasPending?.()||(hooks.heldJobs?.()||[]).length;
      connectionMessage='RunPod connected · '+running+' active worker(s) · '+queued+' queued job(s). '+
        (idle+running?'Ready to accept requests.':'Workers can start when needed.')+
        ' No paid analysis started by this check.'+(unfinished?' Earlier analysis records still need checking; an empty queue does not prove cancellation.':'');
      return true;
    }catch(err){
      connectionMessage='RunPod connection failed: '+errorMessage(err)+'. No paid analysis started.';
      return false;
    }finally{checking=false;draw();}
  }
  async function attempt(item, {allowNewAnalysis=true,retry=false}={}) {
    if (await window.BassLibrary.hasProject(item.title)) {
      item.status='Saved';item.reason='Already saved in your chosen library';return;
    }
    if (hooks.hasPending?.()) throw Error('An earlier bass analysis job may still be charged or awaiting a result. Resolve it before processing another song.');
    item.status=retry?'Reopening':'Opening';draw();tell((retry?'Returning to: ':'Opening: ')+item.name);
    item.startedAt=Date.now();item.timing={};
    const openStart=Date.now();
    const file=await getSong(item);
    if (!await hooks.load(file)) throw Error('This song could not be imported.');
    item.timing.openMs=Date.now()-openStart;
    const recovered=!!hooks.hasCompletedBass?.();
    if (!recovered && !allowNewAnalysis) throw Error('No completed bass analysis could be restored. A second paid analysis was NOT started.');
    if (!recovered) {
      item.status='Analysing';draw();tell('Analysing '+item.name+' with the existing engine…');
      const analysisStart=Date.now();
      const result=await hooks.analyse();
      item.timing.analyseMs=Date.now()-analysisStart;
      if (!result || !result.count || !result.partCount || !result.bassStemReady) {
        throw Error('Full bass analysis was not confirmed. No incomplete project was saved.');
      }
    }
    item.status='Saving';draw();tell('Checking full analysis and saving: '+item.name);
    const saveStart=Date.now();
    const saved=await hooks.save(item.title);
    item.timing.saveMs=Date.now()-saveStart;
    if (!saved?.noteCount) throw Error('The saved project was not confirmed.');
    item.timing.totalMs=Date.now()-item.startedAt;
    item.startedAt=null;
    item.status='Saved';item.reason='';
    completed.add(item.name+'|'+item.size+'|'+item.crc);
    try {localStorage.setItem(storageKey,JSON.stringify([...completed]));}catch {}
    draw();
  }

  function matchesHeld(item,job){
    const base=name=>String(name||'').replace(/\\/g,'/').split('/').pop().toLocaleLowerCase();
    const name=base(job.batchEntryName||job.name);
    return !!name&&base(item.name)===name;
  }
  function markHeldRows(){
    const held=hooks.heldJobs?.()||[];
    for(const item of entries){
      if(['Saved','Skipped'].includes(item.status))continue;
      if(held.some(job=>matchesHeld(item,job))){
        item.status='Needs review';
        item.reason='Earlier analysis preserved for recovery. This song will not be charged again automatically.';
      }
    }
  }
  async function saveRecovered(job){
    const item=entries.find(row=>matchesHeld(row,job));
    if(!item)return false;
    try{
      if(!hooks.hasCompletedBass?.())throw Error('Full recovered bass analysis is not ready.');
      item.status='Saving';item.reason='Saving recovered analysis';draw();
      const saved=await hooks.save(item.title);
      if(!saved?.noteCount)throw Error('Saved project was not confirmed.');
      item.status='Saved';item.reason='';
      completed.add(item.name+'|'+item.size+'|'+item.crc);
      try{localStorage.setItem(storageKey,JSON.stringify([...completed]));}catch{}
      hooks.removeHeld?.(job.signature);
      draw();return true;
    }catch(err){
      item.status='Needs review';
      item.reason='Recovered result needs review before saving: '+errorMessage(err);
      draw();return false;
    }
  }
  async function recoverHeldRows(){
    for(const job of hooks.heldJobs?.()||[]){
      const item=entries.find(row=>matchesHeld(row,job)&&row.status!=='Saved'&&row.status!=='Skipped');
      if(!item||!job.parts?.every(p=>p.id&&!p.submitting&&!p.failedStatus))continue;
      if(hooks.hasPending?.())break;
      try{
        if(!hooks.activateHeld?.(job.signature))continue;
        tell('Checking earlier completed analysis: '+item.name);
        const checked=await hooks.inspectPending?.();
        if(checked?.state==='completed'){
          const yes=await window.BassDialog.confirm(
            'RunPod confirms an earlier bass job has finished. Retrieve its results and try to save the song? Missing song sections may require additional processing charges.',
            {title:'Recover saved analysis',accept:'Recover existing result'}
          );
          if(yes&&await hooks.resumeVerified?.()){
            await saveRecovered(job);
          }else{
            if(hooks.hasPending?.())hooks.holdPending?.(job.batchEntryName||job.name);
            item.status='Needs review';
            item.reason='Earlier results are kept. No additional analysis was started.';
          }
        }else{
          if(hooks.hasPending?.())hooks.holdPending?.(job.batchEntryName||job.name);
          item.status='Needs review';
          item.reason=checked?.message||'Earlier job is '+(checked?.state||'not yet confirmed')+'. Its record is kept.';
        }
      }catch(err){
        if(hooks.hasPending?.()){
          try{hooks.holdPending?.(job.batchEntryName||job.name);}catch{}
        }
        item.status='Needs review';item.reason=errorMessage(err);
      }
      draw();
    }
  }
  async function run() {
    if(working||!archive)return;
    if(hooks.isBusy?.()){tell('Finish the current song first.');return;}
    // Check the actual library before trusting the saved count or starting a new job.
    try{
      tell('Checking library permission and saved projects…');
      if(window.BassLibrary.ensureBatchAccess)await window.BassLibrary.ensureBatchAccess();
      for(const item of entries){
        if(item.status==='Skipped'||item.status==='Saved')continue;
        if(await window.BassLibrary.hasProject(item.title)){
          item.status='Saved';item.reason='';
          completed.add(item.name+'|'+item.size+'|'+item.crc);
        }
      }
      accessWarning='';
      archiveMessage='Library connected · '+entries.filter(i=>i.status==='Saved').length+' saved songs recognised.';
      markHeldRows();draw();
    }catch(err){
      accessWarning=errorMessage(err);
      tell('Batch not started: '+accessWarning+'. Open Library and select Reconnect folder. No analysis was started.');
      draw();return;
    }
    if(hooks.hasPending?.()){
      tell('Checking the earlier RunPod job without starting a new paid analysis…');
      let checked={state:'check-failed'};
      try{checked=await hooks.inspectPending?.()||checked;}catch(err){checked.message=errorMessage(err);}
      if(checked.state==='completed'){
        const recover=await window.BassDialog.confirm(
          'Your earlier bass job is complete. Retrieve the existing results and try to save this song? Missing song sections may require additional processing charges.',
          {title:'Recover earlier job',accept:'Recover existing result'}
        );
        if(recover&&await hooks.resumeVerified?.())await saveRecovered(checked);
      }
      if(hooks.hasPending?.()){
        const accepted=await window.BassDialog.confirm(
          'An earlier RunPod job is not fully resolved. Keep its details safely on this device and continue with other songs? The earlier job may still be charged. It will not be analysed again automatically until reviewed.',
          {title:'Unfinished analysis',accept:'Keep for review'}
        );
        if(!accepted){tell('Paused. The earlier job is still recorded. No new analysis started.');draw();return;}
        try{
          const held=hooks.holdPending?.(checked.batchEntryName||checked.name||'');
          if(!held)throw Error('The earlier analysis was not saved for review.');
        }catch(err){tell('Unable to preserve the earlier job: '+errorMessage(err)+'. Batch stopped.');draw();return;}
      }
    }
    markHeldRows();draw();
    // Read-only recovery of previously saved job IDs. Unknown uploads stay on hold.
    await recoverHeldRows();
    markHeldRows();draw();
    const remaining=entries.filter(i=>!['Saved','Skipped','Needs review'].includes(i.status));
    if(!remaining.length){
      const issues=entries.filter(i=>i.status==='Needs review').length;
      tell(issues?'No new paid analysis started. '+issues+' song(s) kept for review. Check RunPod job history before authorising a fresh upload.':'All songs are already saved or skipped.');
      return;
    }
    const perRun=[10,15,20].includes(Number($('batchLimit')?.value))?Number($('batchLimit').value):10;
    const selectedForRun=remaining.slice(0,perRun);
    const confirmed=await window.BassDialog.confirm(
      'Process '+selectedForRun.length+' of '+remaining.length+' remaining songs using your existing RunPod analysis? Jobs may incur charges. One song runs at a time. Keep this tab open until the small batch finishes.',
      {title:'Confirm batch analysis',accept:'Start batch'}
    );
    if(!confirmed){tell('New analysis cancelled. Saved songs and earlier job records are kept.');return;}
    working=true;stopAfterCurrent=false;draw();
    if(ticker&&typeof clearInterval==='function')clearInterval(ticker);
    if(typeof setInterval==='function')ticker=setInterval(updateElapsed,1000);
    let blocked=false;
    for(const item of selectedForRun){
      if(stopAfterCurrent)break;
      if(['Saved','Skipped','Needs review'].includes(item.status))continue;
      item.reason='';
      try{await attempt(item,{allowNewAnalysis:true});}
      catch(err){
        item.reason=errorMessage(err);
        if(item.startedAt){item.timing={...(item.timing||{}),totalMs:Date.now()-item.startedAt};item.startedAt=null;}
        if(hooks.hasPending?.()){
          const approved=await window.BassDialog.confirm(
            item.name+' stopped while contacting RunPod. Preserve this job for review and continue with other songs? The earlier job may still be charged. This song will not be analysed again automatically.',
            {title:'Interrupted song',accept:'Keep for review'}
          );
          if(approved){
            try{
              const held=hooks.holdPending?.(item.name);
              if(!held)throw Error('No earlier job was preserved.');
              item.status='Needs review';
              tell('Kept '+item.name+' for later review. Continuing with the next song.');
            }catch(holdError){
              item.status='Needs review';item.reason=errorMessage(holdError);
              blocked=true;stopAfterCurrent=true;
              tell('Paused. Could not safely preserve the interrupted job.');
            }
          }else{
            item.status='Needs review';blocked=true;stopAfterCurrent=true;
            tell('Paused to prevent a possible duplicate charge. The interrupted job remains recorded.');
          }
        }else{
          item.status='Later';
          tell('Set aside '+item.name+'. Continuing with the next song.');
        }
        draw();
      }
    }
    if(!stopAfterCurrent){
      const deferred=selectedForRun.filter(i=>i.status==='Later');
      for(const item of deferred){
        if(stopAfterCurrent)break;
        try{await attempt(item,{allowNewAnalysis:false,retry:true});}
        catch(err){
          item.status='Needs review';item.reason=errorMessage(err);
          if(item.startedAt){item.timing={...(item.timing||{}),totalMs:Date.now()-item.startedAt};item.startedAt=null;}
          if(hooks.hasPending?.()){blocked=true;stopAfterCurrent=true;}
          draw();
        }
      }
    }
    working=false;if(ticker&&typeof clearInterval==='function')clearInterval(ticker);ticker=null;updateElapsed();draw();
    const saved=entries.filter(i=>i.status==='Saved').length;
    const issues=entries.filter(i=>i.status==='Needs review').length;
    const left=entries.filter(i=>!['Saved','Skipped','Needs review'].includes(i.status)).length;
    if(blocked)tell('Paused to avoid a possible duplicate RunPod charge. '+saved+' saved; '+issues+' need review.');
    else if(stopAfterCurrent)tell('Stopped after the current song. '+saved+' saved; '+issues+' need review.');
    else tell('Small batch finished. '+saved+' saved; '+left+' left to process; '+issues+' kept for review. Continue batch for the next songs.');
  }
  function build() {
    if(dialog)return;
    const css=document.createElement('style');
    css.textContent="\n#bassBatchDialog{box-sizing:border-box;width:min(660px,calc(100vw - 24px));max-width:none;max-height:calc(100dvh - 28px);padding:18px;background:#122335;color:#edf5fc;border:1px solid #49677d;border-radius:16px;box-shadow:0 20px 60px #0008;overflow:auto;font:600 14px/1.45 system-ui,-apple-system,Arial,sans-serif}\n#bassBatchDialog *,#bassBatchDialog *::before,#bassBatchDialog *::after{box-sizing:border-box}\n#bassBatchDialog::backdrop{background:rgba(2,9,17,.72)}\n#bassBatchDialog h2{font:750 18px/1.25 system-ui,-apple-system,Arial,sans-serif;margin:0 0 8px;color:#fff}\n#bassBatchDialog p{margin:0}\n#bassBatchDialog .batch-description{color:#c6d5e3;font:600 14px/1.5 system-ui,-apple-system,Arial,sans-serif;margin:0 0 16px}\n#bassBatchDialog .batch-file-card{padding:14px;border:1px solid #385a75;border-radius:12px;background:#0b1b2b}\n#bassBatchDialog .batch-label{display:block;font-weight:750;font-size:14px;margin-bottom:8px}\n#bassBatchDialog .batch-file-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:stretch;gap:10px}\n#bassBatchDialog button{font:750 14px/1.3 system-ui,-apple-system,Arial,sans-serif;min-width:0;min-height:56px;width:100%;padding:10px 8px;border-radius:10px;border:1px solid #5a819b;color:#f4f9ff;background:#245371;display:flex;align-items:center;justify-content:center;text-align:center;white-space:normal;overflow-wrap:break-word;cursor:pointer}\n#bassBatchDialog button:focus-visible{outline:3px solid #9adaf0;outline-offset:2px}\n#bassBatchDialog button:disabled{opacity:.50;cursor:not-allowed}\n#bassBatchDialog #batchStart{background:#276f6a;border-color:#64a9a1}\n#bassBatchDialog #batchClose{background:#132c42}\n#bassBatchDialog .batch-file-name{display:flex;align-items:center;justify-content:center;min-width:0;overflow-wrap:anywhere;text-align:center;padding:10px;border:1px solid #344f66;border-radius:10px;color:#e6f0f6;font-size:14px;background:#112b3d}\n#bassBatchDialog .batch-file-input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}\n#bassBatchDialog .batch-archive{font:600 14px/1.45 system-ui,-apple-system,Arial,sans-serif;color:#c7e2ef;margin:10px 0 0}\n#bassBatchDialog .batch-summary{margin:12px 0 8px;color:#f3fbff}\n#bassBatchDialog .batch-size{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:10px;margin:12px 0;font:700 14px/1.4 system-ui,sans-serif;color:#fff}\n#bassBatchDialog .batch-size select{min-height:44px;min-width:70px;padding:8px;border-radius:8px;border:1px solid #6893aa;background:#102d42;color:#fff;font:700 14px system-ui,sans-serif}\n#bassBatchDialog #batchTiming{margin-top:8px;color:#bde9f0;font:700 14px/1.5 system-ui,sans-serif}\n#bassBatchDialog #batchSongs{list-style:none;margin:8px 0;padding:0;max-height:32dvh;overflow:auto;border:1px solid #38536b;border-radius:10px;background:#0c1b2d}\n#bassBatchDialog #batchSongs li{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;padding:11px 12px;border-bottom:1px solid #284359;color:#eaf4fc}\n#bassBatchDialog #batchSongs li:last-child{border-bottom:0}\n#bassBatchDialog #batchSongs li span{min-width:0;overflow-wrap:anywhere}\n#bassBatchDialog #batchSongs li strong{font-size:13px;text-align:right;color:#c4e7e5}\n#bassBatchDialog .batch-feedback{font:600 14px/1.45 system-ui,-apple-system,Arial,sans-serif;color:#bfe5ef;margin:10px 0}\n#bassBatchDialog .batch-feedback:empty{display:none}\n#bassBatchDialog .batch-actions{position:sticky;bottom:-18px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:12px 0 18px;background:#122335}\n@media(max-width:370px){#bassBatchDialog{padding:14px}#bassBatchDialog button{font-size:13px;min-height:60px}#bassBatchDialog .batch-actions{bottom:-14px;padding-bottom:14px}}\n";
    document.head.appendChild(css);
    dialog=document.createElement('dialog');
    dialog.id='bassBatchDialog';
    dialog.setAttribute('aria-labelledby','batchTitle');
    dialog.innerHTML="<h2 id=\"batchTitle\">Batch ZIP analysis</h2>\n<p class=\"batch-description\">Process 10, 15 or 20 songs at a time, then continue the same ZIP. Each saved song stays in your library.</p>\n<div class=\"batch-file-card\">\n<label class=\"batch-label\" for=\"batchFile\">Audio or video ZIP</label>\n<div class=\"batch-file-row\"><button id=\"batchPick\" type=\"button\">Choose ZIP</button><span id=\"batchFileName\" class=\"batch-file-name\">No ZIP selected</span></div>\n<input id=\"batchFile\" class=\"batch-file-input\" type=\"file\" accept=\".zip,application/zip,application/x-zip-compressed\">\n<p id=\"batchArchive\" class=\"batch-archive\" role=\"status\" aria-live=\"polite\">Choose a ZIP containing music files.</p>\n</div>\n<div class=\"batch-size\"><label for=\"batchLimit\">Songs per run</label><select id=\"batchLimit\"><option value=\"10\" selected>10</option><option value=\"15\">15</option><option value=\"20\">20</option></select></div>\n<p id=\"batchCount\" class=\"batch-summary\" role=\"status\" aria-live=\"polite\">No songs loaded</p>\n<p id=\"batchTiming\" class=\"batch-feedback\" aria-live=\"polite\"></p>\n<ul id=\"batchSongs\" aria-label=\"Songs in this ZIP\"></ul>\n<p id=\"batchConnection\" class=\"batch-feedback\" role=\"status\" aria-live=\"polite\" hidden></p>\n<p id=\"batchStatus\" class=\"batch-feedback\" role=\"status\" aria-live=\"polite\"></p>\n<div class=\"batch-actions\">\n<button id=\"batchCheck\" type=\"button\">Check connection</button><button id=\"batchStart\" type=\"button\">Start batch</button>\n<button id=\"batchStop\" type=\"button\" disabled>Stop after song</button><button id=\"batchClose\" type=\"button\">Close</button>\n</div>";
    document.body.appendChild(dialog);
    $('batchPick').onclick=()=>{$('batchFile').click();};
    $('batchFile').onchange=e=>{const file=e.target.files?.[0];e.target.value='';if(file)void choose(file);};
    $('batchLimit').onchange=e=>{try{localStorage.setItem('bassBatchRunLimit',e.target.value);}catch{}};
    try{const saved=localStorage.getItem('bassBatchRunLimit');if(['10','15','20'].includes(saved))$('batchLimit').value=saved;}catch{}
    $('batchCheck').onclick=()=>void checkConnection();
    $('batchStart').onclick=()=>void run();
    $('batchStop').onclick=()=>{stopAfterCurrent=true;tell('Will stop once the current song is saved or checked.');};
    $('batchClose').onclick=()=>dialog.close();
    dialog.addEventListener('cancel',e=>{if(working){e.preventDefault();stopAfterCurrent=true;tell('Will stop after the current song.');}});
    draw();
  }
  function init(callbacks) {hooks=callbacks;}
  function show() {build(); if (!dialog.open) dialog.showModal(); draw();}
  return {init,show,isRunning:()=>working,listZip};
})();