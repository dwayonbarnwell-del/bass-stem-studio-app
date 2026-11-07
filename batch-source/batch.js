/* RC203: bounded return passes, original-job recovery and one verified failed-job retry. */
window.BassBatch = (() => {
  const audio = new Set(['mp3','wav','wave','m4a','m4b','aac','aif','aiff','aifc','caf','flac','ogg','oga','opus','wma']);
  const video = new Set(['mp4','m4v','mov','webm','mkv','avi','mpeg','mpg','3gp','3g2','ogv','wmv']);
  const MAX_ZIP = 2 * 1024 * 1048576, MAX_ENTRY = 200 * 1048576, MAX_TOTAL = 3 * 1024 * 1048576, MAX_SONGS = 150;
  let hooks = {}, dialog, archive, entries = [], working = false, stopAfterCurrent = false, completed = new Set(), storageKey = '', checking = false;
  let loadingZip=false, selectionId=0, selectedName='', archiveMessage='Choose a ZIP containing music files.', connectionMessage='', accessWarning='', ticker=null, starting=false;
  const $ = id => document.getElementById(id);
  const number = (v, offset, size) => size === 2 ? v.getUint16(offset, true) : v.getUint32(offset, true);
  const ext = name => String(name).split('.').pop().toLowerCase();
  const clean = name => String(name).replace(/\\/g,'/').split('/').pop().replace(/\.[^.]+$/,'').trim();
  const projectTitle = name => clean(name).replace(/[\\/:*?"<>|]+/g,'_').replace(/\s+/g,' ').slice(0,95) || 'Untitled song';
  const errorMessage = err => String(err && err.message || err || 'Unknown error');
  const rowStatus = item => item.status || 'Queued';
  const unfinished = item => !['Saved','Skipped'].includes(item.status);
  const itemKey = item => item.name+'|'+item.size+'|'+item.crc;
  // Rebuilt ZIPs have new timestamps and sometimes a different parent folder.
  // The song filename, uncompressed size and ZIP CRC remain stable.
  const portableKey = item => String(item.name||'').replace(/\\/g,'/').split('/').pop().toLocaleLowerCase()+'|'+item.size+'|'+item.crc;
  const PORTABLE_RETRY_KEY='bassBatchPortableRetryRC211';
  function mergeRetry(current,previous){
    if(!current||typeof current!=='object')return previous;
    if(!previous||typeof previous!=='object')return current;
    const recent=(Number(current.lastVisit)||0)>=(Number(previous.lastVisit)||0)?current:previous;
    return {...recent,
      analysisStarted:!!(current.analysisStarted||previous.analysisStarted),
      sectionIncomplete:!!(current.sectionIncomplete||previous.sectionIncomplete),
      sectionRequests:Math.max(Number(current.sectionRequests)||0,Number(previous.sectionRequests)||0),
      paidRestarts:Math.max(Number(current.paidRestarts)||0,Number(previous.paidRestarts)||0),
      lastVisit:Math.max(Number(current.lastVisit)||0,Number(previous.lastVisit)||0)
    };
  }
  function readPortableRetries(items){
    const stored=JSON.parse(localStorage.getItem(PORTABLE_RETRY_KEY)||'[]');
    if(!Array.isArray(stored))throw Error('The saved song recovery record is unreadable. Nothing has been resent.');
    portableRetryJournal=new Map(stored.filter(entry=>Array.isArray(entry)&&typeof entry[0]==='string'&&entry[1]&&typeof entry[1]==='object'));
    const wanted=new Set(items.map(portableKey));
    // Import older batch journals without replacing them or forgetting prior uploads.
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      if(!key||!key.startsWith('bass-batch-v1|')||!key.endsWith('|retry-v1'))continue;
      try{
        const previous=JSON.parse(localStorage.getItem(key)||'[]');
        if(!Array.isArray(previous))continue;
        for(const row of previous){
          if(!Array.isArray(row)||typeof row[0]!=='string'||!row[1])continue;
          const match=/^(.*)\\|(\\d+)\\|(\\d+)$/.exec(row[0]);
          if(!match)continue;
          const pkey=match[1].replace(/\\/g,'/').split('/').pop().toLocaleLowerCase()+'|'+match[2]+'|'+match[3];
          if(wanted.has(pkey))portableRetryJournal.set(pkey,mergeRetry(portableRetryJournal.get(pkey),row[1]));
        }
      }catch{ /* A different ZIP's damaged journal must not erase valid records. */ }
    }
  }
  const heldFor = item => (hooks.heldJobs?.()||[]).find(job=>matchesHeld(item,job));
  let retryJournal = new Map(),portableRetryJournal=new Map();
  function storeRetryState(item,strict=false){
    const state={analysisStarted:!!item.analysisStarted,status:item.status,reason:item.reason||'',lastVisit:item.lastVisit||0,sectionRequests:Number(item.sectionRequests)||0,paidRestarts:Number(item.paidRestarts)||0,sectionIncomplete:!!item.sectionIncomplete};
    retryJournal.set(itemKey(item),state);
    portableRetryJournal.set(portableKey(item),mergeRetry(portableRetryJournal.get(portableKey(item)),state));
    try{
      const value=JSON.stringify([...retryJournal]);
      localStorage.setItem(storageKey+'|retry-v1',value);
      if(strict&&localStorage.getItem(storageKey+'|retry-v1')!==value)throw Error('Storage check failed');
    }catch(err){if(strict)throw Error('Could not preserve the retry record. No new bass analysis was sent.');}
    // Secondary recovery index survives re-zipping without overwriting the original journal.
    try{localStorage.setItem(PORTABLE_RETRY_KEY,JSON.stringify([...portableRetryJournal]));}catch{}
  }
  function finishTiming(item){
    if(item.startedAt){item.timing={...(item.timing||{}),totalMs:Date.now()-item.startedAt};item.startedAt=null;}
  }
  async function pauseBeforeReturn(ms){
    for(let elapsed=0;elapsed<ms&&!stopAfterCurrent;elapsed+=500)
      await new Promise(resolve=>setTimeout(resolve,Math.min(500,ms-elapsed)));
  }
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
  function tell(message) {
    const status=$('batchStatus');if(!status)return;
    const active=entries.find(item=>item.startedAt&&['Opening','Reopening','Analysing','Saving'].includes(item.status));
    const repeated=active&&String(message).includes(active.name)&&/^(?:Opening:|Returning to:|Analysing |Checking full analysis and saving:)/.test(message);
    status.textContent=repeated?'':message;
  }
  function draw() {
    if (!dialog) return;
    const selected=entries.filter(i=>i.status==='Saved').length;
    const actionable=entries.filter(unfinished).length;
    const issues=entries.filter(i=>['Later','Needs review'].includes(i.status)).length;
    $('batchFileName').textContent=selectedName || 'No ZIP selected';
    $('batchFileName').title=selectedName;
    $('batchArchive').textContent=archiveMessage;
    $('batchCount').textContent=loadingZip?'Reading selected ZIP…':
      entries.length ? entries.length+' songs · '+(accessWarning?'saved songs not checked':selected+' saved')+' · '+actionable+' unfinished'+(issues?' · '+issues+' need help':'') : 'No songs loaded';
    $('batchStart').disabled=working||starting||loadingZip||!archive||actionable===0;
    $('batchStart').textContent=starting?'Checking…':working?'Processing…':entries.some(i=>['Later','Needs review','Error'].includes(i.status))?'Repair unfinished':entries.some(i=>i.status==='Saved')?'Continue batch':'Start batch';
    if($('batchLimit'))$('batchLimit').disabled=working||loadingZip;
    $('batchCheck').disabled=working||starting||checking;
    $('batchCheck').textContent=checking?'Checking…':'Check connection';
    $('batchStop').disabled=!working;
    $('batchPick').disabled=working||starting||loadingZip;
    $('batchClose').disabled=working||starting;
    $('batchConnection').textContent=connectionMessage;
    $('batchConnection').hidden=!connectionMessage;
    const list=$('batchSongs');list.replaceChildren();
    list.hidden=!entries.length;
    entries.forEach((item,index)=>{
      const line=document.createElement('li'),title=document.createElement('span'),state=document.createElement('strong');
      title.textContent=(index+1)+'. '+item.name;
      state.textContent=(item.status||'Queued')+(Number.isFinite(item.timing?.totalMs)?' · '+formatElapsed(item.timing.totalMs):'');
      const reason=String(item.reason||'').replace('RunPod can no longer find this result. Its record is kept; no duplicate upload was sent.',"We couldn't find this song's result. We haven't sent it again.");
      const details=[reason, item.timing&&[
        Number.isFinite(item.timing.openMs)?'Open '+formatElapsed(item.timing.openMs):'',
        Number.isFinite(item.timing.analyseMs)?'Analyse '+formatElapsed(item.timing.analyseMs):'',
        Number.isFinite(item.timing.saveMs)?'Save '+formatElapsed(item.timing.saveMs):''
      ].filter(Boolean).join(' · ')].filter(Boolean).join(' | ');
      if(details)state.title=details;
      line.append(title,state);
      if(unfinished(item)&&reason){
        const detail=document.createElement('small');
        detail.style.cssText='grid-column:1/-1;line-height:1.4;overflow-wrap:anywhere';
        detail.textContent=reason;
        line.append(detail);
      }
      list.append(line);
    });
    updateElapsed();
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
      try{
        const saved=JSON.parse(localStorage.getItem(storageKey+'|retry-v1')||'[]');
        if(!Array.isArray(saved))throw Error('Invalid retry record');
        retryJournal=new Map(saved);
      }catch{throw Error('The saved retry record could not be read. It has been kept to prevent duplicate analysis.');}
      readPortableRetries(entries);
      for(const item of entries){
        const saved=mergeRetry(retryJournal.get(itemKey(item)),portableRetryJournal.get(portableKey(item)));
        if(saved)retryJournal.set(itemKey(item),saved);
        item.analysisStarted=!!saved?.analysisStarted;item.lastVisit=Number(saved?.lastVisit)||0;
        item.sectionRequests=Number(saved?.sectionRequests)||0;item.sectionIncomplete=!!saved?.sectionIncomplete;
        item.paidRestarts=Number(saved?.paidRestarts)||0;
        if(item.status==='Queued'&&saved){
          item.status=item.analysisStarted?'Needs review':'Later';
          item.reason=saved.reason||'Returning to unfinished work';
        }
      }
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
  async function attempt(item, {allowNewAnalysis=true,retry=false,paidRestart=false}={}) {
    if (await window.BassLibrary.hasProject(item.title)) {
      item.status='Saved';item.reason='Already saved in your chosen library';return;
    }
    if (hooks.hasPending?.()) throw Error('An earlier bass analysis job may still be charged or awaiting a result. Resolve it before processing another song.');
    item.status=retry?'Reopening':'Opening';
    item.startedAt=Date.now();item.timing={};
    draw();tell((retry?'Returning to: ':'Opening: ')+item.name);
    const openStart=Date.now();
    const file=await getSong(item);
    if (!await hooks.load(file)) throw Error('This song could not be imported.');
    item.timing.openMs=Date.now()-openStart;
    const recovered=!!hooks.hasCompletedBass?.();item.bassReady=recovered;
    if (!recovered && !allowNewAnalysis) throw Error('No saved bass result is available. A fresh analysis needs your approval.');
    if (!recovered) {
      if(paidRestart){
        if(!hooks.preparePaidRestart||!await hooks.preparePaidRestart(item.name))throw Error('The old job could not be safely saved before restarting. Nothing was sent.');
        item.paidRestarts=(Number(item.paidRestarts)||0)+1;
      }
      const wasStarted=item.analysisStarted;item.analysisStarted=true;
      try{storeRetryState(item,true);}catch(err){item.analysisStarted=wasStarted;storeRetryState(item);throw err;}
      item.status='Analysing';draw();tell('Analysing '+item.name+' with the existing engine…');
      const analysisStart=Date.now();
      item.submittedThisRun=true;
      const result=await hooks.analyse();
      item.timing.analyseMs=Date.now()-analysisStart;
      if (!result || !result.count || !result.partCount || !result.bassStemReady) {
        throw Error('Full bass analysis was not confirmed. No incomplete project was saved.');
      }
      item.bassReady=true;
    }
    // Reuse the bass track first; only request sections when genuinely missing.
    // Saved and in-progress section jobs are checked before any new section upload.
    if(hooks.completeSong){
      const allowNewSections=!!paidRestart||(Number(item.sectionRequests)||0)===0;
      if(allowNewSections){
        item.sectionRequests=(Number(item.sectionRequests)||0)+1;
        storeRetryState(item,true);
      }
      if(paidRestart)item.sectionRepairThisRun=true;
      const complete=await hooks.completeSong({allowNewSections,paidRestart});
      if(!complete){
        item.sectionIncomplete=true;
        const status=hooks.sectionStatus?.();
        item.waitingForResult=status?.state==='pending';
        throw Error(status?.message||'Song sections are not ready. Your bass work is kept.');
      }
      item.sectionIncomplete=false;item.waitingForResult=false;
    }
    item.status='Saving';draw();tell('Checking full analysis and saving: '+item.name);
    const saveStart=Date.now();
    const saved=await hooks.save(item.title);
    item.timing.saveMs=Date.now()-saveStart;
    if (!saved?.noteCount) throw Error('The saved project was not confirmed.');
    item.timing.totalMs=Date.now()-item.startedAt;
    item.startedAt=null;
    item.status='Saved';item.reason='';item.analysisStarted=true;storeRetryState(item);
    completed.add(item.name+'|'+item.size+'|'+item.crc);
    try {localStorage.setItem(storageKey,JSON.stringify([...completed]));}catch {}
    const held=heldFor(item);
    if(held)hooks.removeHeld?.(held.signature);
    draw();
  }

  function matchesHeld(item,job){
    const base=name=>String(name||'').replace(/\\/g,'/').split('/').pop().toLocaleLowerCase();
    const name=base(job.batchEntryName||job.name);
    const originalSize=Number(job.size);
    return !!name&&base(item.name)===name&&
      (!Number.isFinite(originalSize)||originalSize<=0||originalSize===Number(item.size));
  }
  function markHeldRows(){
    const held=hooks.heldJobs?.()||[];
    for(const item of entries){
      if(['Saved','Skipped'].includes(item.status))continue;
      if(held.some(job=>matchesHeld(item,job))){
        item.analysisStarted=true;
        if(!item.reason)item.reason='Earlier analysis will be checked automatically. No duplicate upload will be sent.';
        if(item.status==='Queued')item.status='Needs review';
        storeRetryState(item);
      }
    }
  }
  async function saveRecovered(job){
    const item=entries.find(row=>matchesHeld(row,job));
    if(!item)return false;
    try{
      if(!hooks.hasCompletedBass?.())throw Error('Full recovered bass analysis is not ready.');
      item.bassReady=true;
      item.status='Saving';item.reason='Saving recovered analysis';draw();
      if(hooks.completeSong){
        const ok=await hooks.completeSong({allowNewSections:false,paidRestart:false});
        if(!ok){
          item.sectionIncomplete=true;
          const status=hooks.sectionStatus?.();item.waitingForResult=status?.state==='pending';
          throw Error(status?.message||'Bass is ready, but song sections still need finishing.');
        }
        item.sectionIncomplete=false;
      }
      const saved=await hooks.save(item.title);
      if(!saved?.noteCount)throw Error('Saved project was not confirmed.');
      item.status='Saved';item.reason='';item.waitingForResult=false;item.analysisStarted=true;storeRetryState(item);
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
  function preserveFailure(item,err,returnPass=false){
    finishTiming(item);item.reason=errorMessage(err);
    if(hooks.hasPending?.()){
      const held=hooks.holdPending?.(item.name);
      if(!held)throw Error('Could not preserve the interrupted job. Batch stopped to prevent duplicate charges.');
      item.analysisStarted=true;item.status='Needs review';
    }else item.status=returnPass?'Needs review':'Later';
    storeRetryState(item);draw();
  }
  async function recoverHeldRows(rows,{throttled=false}={}){
    for(const item of rows){
      if(stopAfterCurrent||hooks.hasPending?.())break;
      const job=heldFor(item);
      if(!unfinished(item)||!job)continue;
      if(throttled&&item.lastCheckedAt&&Date.now()-item.lastCheckedAt<15000)continue;
      item.waitingForResult=false;
      if(!job.parts?.length||!job.parts.every(part=>part.id&&!part.submitting)){
        item.lastCheckState='unconfirmed';
        item.status='Needs review';
        item.reason='Old upload could not be checked. No second upload was sent. After checking, you can approve a fresh try; it may cost more.';
        storeRetryState(item);draw();continue;
      }
      try{
        if(!hooks.activateHeld?.(job.signature))continue;
        item.status='Checking';item.lastCheckedAt=Date.now();
        item.recoveryChecks=(item.recoveryChecks||0)+1;draw();
        tell('Returning to unfinished song: '+item.name);
        let checked=await hooks.inspectPending?.();
        item.lastCheckState=checked?.state||'needs-review';
        if(stopAfterCurrent){item.status='Later';item.reason='Stopped after checking the existing job.';continue;}
        if(checked?.state==='retryable'&&hooks.retryFailed){
          item.status='Retrying';draw();
          tell('Retrying the confirmed failed job once: '+item.name);
          checked=await hooks.retryFailed();
          item.lastCheckState=checked?.state||'needs-review';
        }
        if(checked?.state==='completed'){
          if(await hooks.resumeVerified?.()){
            await saveRecovered(job);
          }else{
            item.status='Needs review';item.reason='Existing results could not yet be restored. They have not been replaced by a new upload.';
          }
        }else{
          item.waitingForResult=['running','check-failed'].includes(checked?.state);
          item.status=item.waitingForResult?'Later':'Needs review';
          item.reason=checked?.message||({
            running:'RunPod is still working. The batch will return to check this job.',
            'check-failed':'Connection check failed. The saved job will be checked again.',
            'missing-key':'The RunPod API key needs reconnecting before this result can be checked.',
            unconfirmed:'The upload is not confirmed. No duplicate upload was sent.',
            retryable:'This failed job needs an authorised retry.'
          }[checked?.state]||'The existing job needs attention. Its recovery record is kept.');
        }
      }catch(err){
        item.lastCheckState='check-failed';
        item.status='Needs review';item.reason=errorMessage(err);
      }finally{
        // Never leave a held job active while opening a different song.
        if(hooks.hasPending?.()){
          const saved=hooks.holdPending?.(job.batchEntryName||job.name);
          if(!saved)throw Error('Could not preserve the checked job. Batch stopped.');
        }
        storeRetryState(item);draw();
      }
    }
  }
  async function recoverLocalRows(rows){
    for(const item of rows){
      if(stopAfterCurrent)break;
      if(!unfinished(item)||!heldFor(item))continue;
      // Most unconfirmed uploads have no locally completed bass to restore.
      // Check the saved index first, instead of decoding every blocked ZIP song.
      const filename=item.name.replace(/\\/g,'/').split('/').pop();
      let saved=false;
      try{saved=!!(await hooks.hasSavedAnalysis?.(filename,item.size,archive?.lastModified||0));}
      catch{}
      if(!saved)continue;
      const held=heldFor(item);
      try{await attempt(item,{allowNewAnalysis:false,retry:true});}
      catch(err){preserveFailure(item,err);}
      if(item.status==='Saved'&&held)hooks.removeHeld?.(held.signature);
    }
  }
  async function recoverSectionRows(rows){
    for(const item of rows){
      if(stopAfterCurrent)break;
      if(!unfinished(item)||!item.sectionIncomplete||heldFor(item))continue;
      try{await attempt(item,{allowNewAnalysis:false,retry:true});}
      catch(err){preserveFailure(item,err,true);}
    }
  }
  function canOfferPaidRestart(item){
    if(!unfinished(item)||item.waitingForResult)return false;
    // A bass upload and a sections repair are separate steps. Do not block
    // section-only repair merely because the bass was completed in this run.
    if(item.bassReady&&item.sectionIncomplete)return !item.sectionRepairThisRun;
    if(item.submittedThisRun)return false;
    if(['running','check-failed','missing-key','unresolved'].includes(item.lastCheckState))return false;
    if(item.lastCheckState==='completed'&&!item.sectionIncomplete)return false;
    // Songs without any known earlier analysis should not be resent merely
    // because a damaged file could not be opened.
    return !!item.analysisStarted || !!heldFor(item);
  }
  async function restartMissingRows(rows){
    const candidates=rows.filter(canOfferPaidRestart);
    if(!candidates.length||stopAfterCurrent)return;
    const confirmed=await window.BassDialog.confirm(
      candidates.length+' song'+(candidates.length===1?'':'s')+' still need work. Try fresh analysis for these songs? This can cost more money. Some earlier uploads may also have been charged. Saved songs and jobs still running will not be sent again. We will reuse any bass results already on your device. Continue?',
      {title:'Fresh analysis may cost more',accept:'Approve and retry'}
    );
    if(!confirmed||stopAfterCurrent){tell('Your unfinished songs have been kept. No fresh analysis was started.');return;}
    for(const item of candidates){
      if(stopAfterCurrent)break;
      if(!canOfferPaidRestart(item))continue;
      try{await attempt(item,{allowNewAnalysis:true,retry:true,paidRestart:true});}
      catch(err){preserveFailure(item,err,true);}
      if(!stopAfterCurrent)await recoverHeldRows(rows,{throttled:true});
    }
  }
  async function run() {
    if(working||starting||!archive)return;
    if(hooks.isBusy?.()){tell('Finish the current song first.');return;}
    starting=true;working=true;stopAfterCurrent=false;draw();
    try{
      try{
        tell('Checking library permission and saved projects…');
        if(window.BassLibrary.ensureBatchAccess)await window.BassLibrary.ensureBatchAccess();
        for(const item of entries){
          if(stopAfterCurrent)break;
          if(!unfinished(item))continue;
          if(await window.BassLibrary.hasProject(item.title)){
            item.status='Saved';item.reason='';completed.add(itemKey(item));
          }
        }
        accessWarning='';
        archiveMessage='Library connected · '+entries.filter(i=>i.status==='Saved').length+' saved songs recognised.';
        markHeldRows();draw();
      }catch(err){
        accessWarning=errorMessage(err);
        tell('Batch not started: '+accessWarning+'. Reconnect your library folder. No analysis was started.');return;
      }
      if(stopAfterCurrent){tell('Stopped. No new analysis started.');return;}
      const remaining=entries.filter(unfinished);
      if(!remaining.length){tell('All songs are already saved or skipped.');return;}
      const selectedLimit=String($('batchLimit')?.value||'all');
      const perRun=['5','10','15','20'].includes(selectedLimit)?Number(selectedLimit):remaining.length;
      // Rotate previously checked rows so persistent failures cannot block later songs.
      const selectedForRun=remaining.slice().sort((a,b)=>(a.lastVisit||0)-(b.lastVisit||0)).slice(0,perRun);
      const confirmed=await window.BassDialog.confirm(
        (selectedLimit==='all'?'Process all '+remaining.length+' remaining songs continuously':'Process '+selectedForRun.length+' of '+remaining.length+' remaining songs')+' using your existing RunPod analysis? Songs run one at a time, and each completed project is saved immediately. Failed songs will be checked again before the run ends. You can stop after the current song. Analysis, missing sections and authorised failed-job retries may incur charges. Unknown uploads stay protected from duplicate submissions. Keep this tab open.',
        {title:'Confirm batch analysis',accept:'Start batch'}
      );
      if(!confirmed||stopAfterCurrent){tell('Batch cancelled. Saved songs and earlier job records are kept.');return;}
      starting=false;draw();
      for(const item of selectedForRun){
        // These guards belong to this click/run, not the lifetime of the ZIP.
        item.submittedThisRun=false;item.sectionRepairThisRun=false;item.waitingForResult=false;
        item.lastVisit=Date.now();storeRetryState(item);
      }
      if(hooks.hasPending?.()){
        const held=hooks.holdPending?.('');
        if(!held)throw Error('The earlier analysis could not be preserved. No new upload started.');
        markHeldRows();
      }
      if(typeof setInterval==='function')ticker=setInterval(updateElapsed,1000);
      await recoverLocalRows(selectedForRun);
      if(!stopAfterCurrent)await recoverHeldRows(selectedForRun);
      for(const item of selectedForRun){
        if(stopAfterCurrent)break;
        if(!unfinished(item)||heldFor(item))continue;
        try{await attempt(item,{allowNewAnalysis:item.analysisStarted===false,retry:item.status!=='Queued'});}
        catch(err){preserveFailure(item,err);}
        // Completed results can expire: collect earlier jobs between songs as well.
        if(!stopAfterCurrent)await recoverHeldRows(selectedForRun,{throttled:true});
      }
      if(!stopAfterCurrent){
        for(const item of selectedForRun.filter(item=>unfinished(item)&&!heldFor(item))){
          if(stopAfterCurrent)break;
          try{await attempt(item,{allowNewAnalysis:item.analysisStarted===false,retry:true});}
          catch(err){preserveFailure(item,err,true);}
        }
      }
      // Bounded return passes. Status checks do not submit new bass jobs.
      for(let pass=0;pass<3&&!stopAfterCurrent;pass++){
        if(pass){
          if(!selectedForRun.some(item=>unfinished(item)&&item.waitingForResult&&(heldFor(item)||item.sectionIncomplete)))break;
          tell('Waiting to recheck unfinished results · return pass '+(pass+1)+' of 3.');
          await pauseBeforeReturn(pass===1?15000:30000);
        }
        if(!stopAfterCurrent)await recoverHeldRows(selectedForRun);
        if(!stopAfterCurrent)await recoverSectionRows(selectedForRun);
      }
      // Ask separately before replacing expired or unconfirmed paid work.
      // Never restart jobs that are running, inaccessible due to network, or
      // already retried as a brand new upload in this same run.
      if(!stopAfterCurrent)await restartMissingRows(selectedForRun);
      const saved=entries.filter(i=>i.status==='Saved').length;
      const left=entries.filter(unfinished).length;
      const waiting=entries.filter(i=>unfinished(i)&&i.waitingForResult).length;
      const review=entries.filter(i=>i.status==='Needs review').length;
      tell((stopAfterCurrent?'Stopped after this song. ':'Batch finished. ')+saved+' saved; '+left+' left'+(waiting?'; '+waiting+' still running':'')+(review?'; '+review+' need help':'')+(left?'. All earlier work is kept.':'.'));
    }catch(err){
      tell('Batch paused: '+errorMessage(err)+'. Saved songs and recovery records are kept.');
    }finally{
      starting=false;working=false;
      if(ticker&&typeof clearInterval==='function')clearInterval(ticker);ticker=null;
      updateElapsed();draw();
    }
  }
  function build() {
    if(dialog)return;
    const css=document.createElement('style');
    css.textContent="\n#bassBatchDialog{box-sizing:border-box;width:min(660px,calc(100vw - 24px));max-width:none;max-height:calc(100dvh - 28px);padding:18px;background:#122335;color:#edf5fc;border:1px solid #49677d;border-radius:16px;box-shadow:0 20px 60px #0008;overflow:auto;font:600 14px/1.45 system-ui,-apple-system,Arial,sans-serif}\n#bassBatchDialog *,#bassBatchDialog *::before,#bassBatchDialog *::after{box-sizing:border-box}\n#bassBatchDialog::backdrop{background:rgba(2,9,17,.72)}\n#bassBatchDialog h2{font:750 18px/1.25 system-ui,-apple-system,Arial,sans-serif;margin:0 0 8px;color:#fff}\n#bassBatchDialog p{margin:0}\n#bassBatchDialog .batch-description{color:#c6d5e3;font:600 14px/1.5 system-ui,-apple-system,Arial,sans-serif;margin:0 0 16px}\n#bassBatchDialog .batch-file-card{padding:14px;border:1px solid #385a75;border-radius:12px;background:#0b1b2b}\n#bassBatchDialog .batch-label{display:block;font-weight:750;font-size:14px;margin-bottom:8px}\n#bassBatchDialog .batch-file-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:stretch;gap:10px}\n#bassBatchDialog button{font:750 14px/1.3 system-ui,-apple-system,Arial,sans-serif;min-width:0;min-height:56px;width:100%;padding:10px 8px;border-radius:10px;border:1px solid #5a819b;color:#f4f9ff;background:#245371;display:flex;align-items:center;justify-content:center;text-align:center;white-space:normal;overflow-wrap:break-word;cursor:pointer}\n#bassBatchDialog button:focus-visible{outline:3px solid #9adaf0;outline-offset:2px}\n#bassBatchDialog button:disabled{opacity:.50;cursor:not-allowed}\n#bassBatchDialog #batchStart{background:#276f6a;border-color:#64a9a1}\n#bassBatchDialog #batchClose{background:#132c42}\n#bassBatchDialog .batch-file-name{display:flex;align-items:center;justify-content:center;min-width:0;overflow-wrap:anywhere;text-align:center;padding:10px;border:1px solid #344f66;border-radius:10px;color:#e6f0f6;font-size:14px;background:#112b3d}\n#bassBatchDialog .batch-file-input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}\n#bassBatchDialog .batch-archive{font:600 14px/1.45 system-ui,-apple-system,Arial,sans-serif;color:#c7e2ef;margin:10px 0 0}\n#bassBatchDialog .batch-summary{margin:12px 0 8px;color:#f3fbff}\n#bassBatchDialog .batch-size{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:10px;margin:12px 0;font:700 14px/1.4 system-ui,sans-serif;color:#fff}\n#bassBatchDialog .batch-size select{min-height:44px;min-width:70px;padding:8px;border-radius:8px;border:1px solid #6893aa;background:#102d42;color:#fff;font:700 14px system-ui,sans-serif}\n#bassBatchDialog #batchTiming{margin-top:8px;color:#bde9f0;font:700 14px/1.5 system-ui,sans-serif}\n#bassBatchDialog #batchSongs{list-style:none;margin:8px 0;padding:0;max-height:32dvh;overflow:auto;border:1px solid #38536b;border-radius:10px;background:#0c1b2d}\n#bassBatchDialog #batchSongs li{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;padding:11px 12px;border-bottom:1px solid #284359;color:#eaf4fc}\n#bassBatchDialog #batchSongs li:last-child{border-bottom:0}\n#bassBatchDialog #batchSongs li span{min-width:0;overflow-wrap:anywhere}\n#bassBatchDialog #batchSongs li strong{font-size:13px;text-align:right;color:#c4e7e5}\n#bassBatchDialog .batch-feedback{font:600 14px/1.45 system-ui,-apple-system,Arial,sans-serif;color:#bfe5ef;margin:10px 0}\n#bassBatchDialog .batch-feedback:empty{display:none}\n#bassBatchDialog .batch-actions{position:sticky;bottom:-18px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:12px 0 18px;background:#122335}\n@media(max-width:370px){#bassBatchDialog{padding:14px}#bassBatchDialog button{font-size:13px;min-height:60px}#bassBatchDialog .batch-actions{bottom:-14px;padding-bottom:14px}}\n";
    document.head.appendChild(css);
    dialog=document.createElement('dialog');
    dialog.id='bassBatchDialog';
    dialog.setAttribute('aria-labelledby','batchTitle');
    dialog.innerHTML="<h2 id=\"batchTitle\">Batch ZIP analysis</h2>\n<p class=\"batch-description\">Process all songs automatically, one at a time. Each completed song is saved. You can pause after a set number if you prefer.</p>\n<div class=\"batch-file-card\">\n<label class=\"batch-label\" for=\"batchFile\">Audio or video ZIP</label>\n<div class=\"batch-file-row\"><button id=\"batchPick\" type=\"button\">Choose ZIP</button><span id=\"batchFileName\" class=\"batch-file-name\">No ZIP selected</span></div>\n<input id=\"batchFile\" class=\"batch-file-input\" type=\"file\" accept=\".zip,application/zip,application/x-zip-compressed\">\n<p id=\"batchArchive\" class=\"batch-archive\" role=\"status\" aria-live=\"polite\">Choose a ZIP containing music files.</p>\n</div>\n<div class=\"batch-size\"><label for=\"batchLimit\">Processing</label><select id=\"batchLimit\"><option value=\"all\" selected>Continuous (all songs)</option><option value=\"5\">Pause after 5</option><option value=\"10\">Pause after 10</option><option value=\"15\">Pause after 15</option><option value=\"20\">Pause after 20</option></select></div>\n<p id=\"batchCount\" class=\"batch-summary\" role=\"status\" aria-live=\"polite\">No songs loaded</p>\n<p id=\"batchTiming\" class=\"batch-feedback\" aria-live=\"polite\"></p>\n<p id=\"batchStatus\" class=\"batch-feedback\" role=\"status\" aria-live=\"polite\"></p>\n<ul id=\"batchSongs\" aria-label=\"Songs in this ZIP\"></ul>\n<p id=\"batchConnection\" class=\"batch-feedback\" role=\"status\" aria-live=\"polite\" hidden></p>\n<div class=\"batch-actions\">\n<button id=\"batchCheck\" type=\"button\">Check connection</button><button id=\"batchStart\" type=\"button\">Start batch</button>\n<button id=\"batchStop\" type=\"button\" disabled>Stop after song</button><button id=\"batchClose\" type=\"button\">Close</button>\n</div>";
    document.body.appendChild(dialog);
    $('batchPick').onclick=()=>{$('batchFile').click();};
    $('batchFile').onchange=e=>{const file=e.target.files?.[0];e.target.value='';if(file)void choose(file);};
    $('batchLimit').onchange=e=>{try{localStorage.setItem('bassBatchRunLimitRC204',e.target.value);}catch{}};
    try{const saved=localStorage.getItem('bassBatchRunLimitRC204');if(['all','5','10','15','20'].includes(saved))$('batchLimit').value=saved;}catch{}
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
