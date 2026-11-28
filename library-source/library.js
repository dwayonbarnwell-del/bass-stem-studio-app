/* RC195: local saved-project library. No audio or index is sent to a server. */
window.BassLibrary=(()=>{
  const DB='bass-studio-library-v1',SUPPORTED=/\.(bassstudio|bssproject|json)$/i;
  const PROJECT_FILE_TYPES=[{description:'Bass Studio saved songs',accept:{'application/json':['.bassstudio','.bssproject','.json']}}];
  let dbPromise,ready,folder=null,index={},rows=[],hooks={},dialog,busy=false,scan=0,downloadURLs=[],folderAccess='unknown',scanning=false,scanJob=null;
  const el=id=>document.getElementById(id);
  const abort=()=>new DOMException('Cancelled','AbortError');
  const clean=v=>String(v||'').trim();
  // Chord catalogues belong to Song Chords, not the audio-project library.
  const isChordCatalogue=p=>p?.format==='BassStemSongReferences'||p?.format==='BassStemSongChordPack';
  function database(){
    if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{
      let expired=false;
      const timer=setTimeout(()=>{expired=true;reject(Error('Device storage is not responding. Close other Bass Stem tabs and try again.'));},15000);timer?.unref?.();
      const r=indexedDB.open(DB,1);
      r.onupgradeneeded=()=>{r.result.createObjectStore('settings');r.result.createObjectStore('songs',{keyPath:'id'});};
      r.onsuccess=()=>{globalThis.clearTimeout?.(timer);if(expired){r.result.close();return;}r.result.onversionchange=()=>r.result.close();resolve(r.result);};
      r.onerror=()=>{globalThis.clearTimeout?.(timer);reject(r.error);};
      r.onblocked=()=>{expired=true;globalThis.clearTimeout?.(timer);reject(Error('Close other Bass Stem tabs, then try again.'));};
    }).catch(e=>{dbPromise=null;throw e;});
    return dbPromise;
  }
  async function store(name,mode,action){
    const db=await database();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(name,mode),request=action(tx.objectStore(name));
      const timer=setTimeout(()=>{try{tx.abort();}catch{}reject(Error('Device storage is not responding. Try again.'));},name==='songs'&&mode==='readwrite'?90000:15000);timer?.unref?.();
      tx.oncomplete=()=>{globalThis.clearTimeout?.(timer);resolve(request?.result);};
      tx.onerror=tx.onabort=()=>{globalThis.clearTimeout?.(timer);reject(tx.error||request?.error||Error('Could not save on this device.'));};
    });
  }
  const get=(key)=>store('settings','readonly',s=>s.get(key));
  const put=(key,value)=>store('settings','readwrite',s=>s.put(value,key));
  function metadata(p,file){
    if(p?.format!=='Bass Stem Studio Project'||Number(p.schemaVersion??1)!==2||!Array.isArray(p.analysis?.notes)||!p.source?.audioBase64)
      throw Error('This file is not a supported saved Bass Stem project.');
    return {title:clean(p.projectName)||file.name.replace(SUPPORTED,''),artist:clean(p.library?.artist),
      key:clean(p.analysis.scale),bpm:Number(p.analysis.tempoBpm)||null,duration:Number(p.source.duration)||0,
      filename:file.name,size:file.size,modified:file.lastModified||Date.now(),savedAt:clean(p.savedAt),
      sourceName:clean(p.source?.name),sourceSize:Number(p.source?.size)||0,
      muteReady:p.analysis.bassBacking?.version===2&&window.BassBacking?.canRestore(p.analysis.bassBacking,p.source.duration),
      hasChordAnalysis:Array.isArray(p.analysis?.chords)&&p.analysis.chords.length>0,
      hasBassAnalysis:Array.isArray(p.analysis?.notes)&&p.analysis.notes.length>0};
  }
  async function audioIdentity(project){
    const bytes=new TextEncoder().encode(project.source.audioBase64);
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  }
  async function indexedMetadata(project,file){
    return {...metadata(project,file),audioId:await audioIdentity(project)};
  }
  function uniqueSongs(list){
    const seen=new Map();
    for(const row of list){
      // Never merge different recordings merely because their titles match.
      const key=row.audioId||row.storageLabel+':'+(row.id||row.filename);
      const existing=seen.get(key);
      if(existing)existing.searchNames.push(row.filename,row.title,row.sourceName);
      else seen.set(key,{...row,searchNames:[...(row.searchNames||[])]});
    }
    return [...seen.values()];
  }
  const openedFiles=new WeakMap();
  let pendingWrite=Promise.resolve();
  const writes=new Set();
  function sameSong(row,target){
    if(!target)return false;
    if(row.audioId&&target.audioId&&row.audioId===target.audioId)return true;
    if(row.filename===target.filename||row.id&&row.id===target.id)return true;
    return false;
  }
  function inWriteOrder(action,target){
    const job={target};
    writes.add(job);
    const result=pendingWrite.then(()=>action(job));
    job.done=result.catch(()=>{}).finally(()=>writes.delete(job));
    pendingWrite=job.done;
    return result;
  }
  function within(promise,ms=45000,message='Storage did not respond. Reconnect the folder or check free space, then tap Save.'){
    let timer;
    return Promise.race([promise,new Promise((_,reject)=>{
      timer=setTimeout(()=>reject(new DOMException(message,'TimeoutError')),ms);
      timer?.unref?.();
    })]).finally(()=>globalThis.clearTimeout?.(timer));
  }
  async function matchingTarget(project){
    await ready;
    const identity=await audioIdentity(project);
    let row=rows.find(r=>r.audioId===identity);
    if(!row){await refresh();row=rows.find(r=>r.audioId===identity);}
    return row?{...row,dir:row.dir||(row.handle?folder:null)}:null;
  }
  // Large recordings stay in separate Blob parts. The file is ordinary project JSON.
  const readProject=(file,options)=>globalThis.BassProjectJSON?BassProjectJSON.read(file,options):file.text().then(JSON.parse);
  function projectBlob(project){
    const marker='bss'+crypto.randomUUID().replace(/-/g,'')+'_',audio=[];
    const json=JSON.stringify(project,(key,value)=>{
      if(!/base64$/i.test(key)||typeof value!=='string'||value.length<65536||/[^A-Za-z0-9+/=]/.test(value))return value;
      audio.push(value);return marker+(audio.length-1);
    });
    const parts=[],pattern=new RegExp('"'+marker+'(\\d+)"','g');
    let start=0;
    for(const match of json.matchAll(pattern)){
      parts.push(json.slice(start,match.index+1),audio[Number(match[1])]);start=match.index+match[0].length-1;
    }
    parts.push(json.slice(start));
    return new Blob(parts,{type:'application/json'});
  }
  function errorText(e){
    if(e?.name==='QuotaExceededError')return 'Device storage is full. Choose a folder or free some space, then save again.';
    if(e?.name==='NotAllowedError'||e?.name==='SecurityError')return 'Folder access is needed. Select Reconnect folder and allow access.';
    if(e?.name==='NotFoundError')return 'This file or folder has moved. Choose its new location.';
    if(e instanceof SyntaxError)return 'This saved project is damaged or invalid.';
    return e?.message||'Could not complete this action. Please try again.';
  }
  function status(message){if(el('libraryStatus'))el('libraryStatus').textContent=message;}
  function paintLocation(){
    if(!dialog)return;
    el('libraryLocation').textContent=folder?'Save folder: '+folder.name+(folderAccess==='reconnect'?' · Reconnect needed':' · Auto-scan'):'Save location: In this app';
    el('libraryChoose').textContent=folder?'Change save folder':'Choose save folder';
    el('libraryHint').textContent=folder?(folderAccess==='reconnect'?'Tap Reconnect folder to see saved songs there. Songs in the app remain available.':'Saved songs in this folder appear when you open Library. New saves go here.'):'Saved songs appear here automatically. Choose a save folder to keep normal files.';
    el('libraryDevice').hidden=!folder;
    el('libraryReconnect').hidden=!folder||folderAccess!=='reconnect';
    el('libraryChoose').hidden=typeof window.showDirectoryPicker!=='function';
    if(!window.showDirectoryPicker&&!folder)el('libraryHint').textContent='Songs are kept in this app. Download backups before clearing browser data.';
  }
  function filterRows(list,query,sort){
    const words=clean(query).toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return list.filter(r=>words.every(w=>[r.title,r.artist,r.filename,r.sourceName,...(r.searchNames||[]),r.key,r.bpm].join(' ').toLocaleLowerCase().includes(w)))
      .sort((a,b)=>sort==='name'?a.title.localeCompare(b.title):((Date.parse(b.savedAt)||b.modified)-(Date.parse(a.savedAt)||a.modified))||a.title.localeCompare(b.title));
  }
  const songItems=new Map();
  let opening=null,lastOpenError=null;
  const rowKey=row=>row.storageLabel+':'+row.filename;
  function render(){
    if(!dialog?.open)return;paintLocation();
    const list=el('librarySongs');
    const oldURLs=downloadURLs;downloadURLs=[];setTimeout(()=>oldURLs.forEach(url=>URL.revokeObjectURL(url)),60000);

    const shown=filterRows(rows,el('librarySearch').value,el('librarySort').value);
    el('libraryCount').textContent=folderAccess==='reconnect'&&!shown.length?'Folder not connected':shown.length+' '+(shown.length===1?'song':'songs');
    const visible=new Set(shown.map(rowKey));
    for(const [key,entry] of songItems)if(!visible.has(key)){entry.item.remove();songItems.delete(key);}
    list.querySelector('.library-empty')?.remove();
    if(!shown.length){const p=document.createElement('p');p.className='library-empty';p.textContent=rows.length?'No matching songs.':folderAccess==='reconnect'?'Reconnect to view songs.':(busy||scanning)?'Checking songs…':'Import saved songs to begin.';list.append(p);}
    for(const [position,row] of shown.entries()){
      const key=rowKey(row);
      let entry=songItems.get(key);
      if(!entry){
        const item=document.createElement('li'),info=document.createElement('button'),title=document.createElement('strong'),details=document.createElement('span'),actions=document.createElement('div');
        info.type='button';info.className='library-song-info';info.append(title,details);
        actions.className='library-song-actions';
        const open=document.createElement('button');open.type='button';
        const download=document.createElement('a');download.className='library-download';download.textContent='Download';download.href='#';
        actions.append(open,download);item.append(info,actions);
        const choose=document.createElement('button');choose.type='button';choose.textContent='Choose this file';choose.hidden=true;
        item.append(choose);
        choose.onclick=()=>browseProject(entry.row);
        entry={item,info,title,details,open,download,choose,row};
        songItems.set(key,entry);
        info.onclick=open.onclick=()=>run(()=>openRow(entry.row));
        item.onclick=e=>{if(e.target===item)info.click();};
        download.onclick=async e=>{
          e.preventDefault();if(busy)return;stopScan();
          try{
            const file=await rowFile(entry.row),url=URL.createObjectURL(file),link=document.createElement('a');
            link.href=url;link.download=entry.row.filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
            status('Download requested for '+entry.row.title+'.');
          }catch(err){status(errorText(err));}
        };
      }
      const {item,info,title,details,open,download,choose}=entry;entry.row=row;
      if(title.textContent!==row.title)title.textContent=row.title;
      const minutes=Math.floor((row.duration||0)/60),seconds=Math.floor(row.duration%60).toString().padStart(2,'0');
      const detail=[row.artist,row.key&&row.key!=='—'?row.key:'',row.bpm?Math.round(row.bpm)+' BPM':'',row.duration?minutes+':'+seconds:'',row.storageLabel].filter(Boolean).join(' · ')||row.filename;
      const detailText=opening?.key===key&&opening.message||lastOpenError?.key===key&&lastOpenError.message||detail;
      if(details.textContent!==detailText)details.textContent=detailText;
      choose.hidden=!(lastOpenError?.key===key&&lastOpenError.fileAccess||folderAccess==='reconnect'&&(row.dir||row.handle));
      choose.disabled=busy;
      open.textContent=opening?.row===row?'Opening…':'Open';info.disabled=open.disabled=busy;
      info.setAttribute('aria-label','Open '+row.title);open.setAttribute('aria-label','Open '+row.title);
      download.setAttribute('aria-label','Download '+row.title);download.download=row.filename;
      if(list.children[position]!==item)list.insertBefore(item,list.children[position]||null);
    }
    if(el('libraryStop'))el('libraryStop').hidden=!scanning;
    for(const id of ['libraryChoose','libraryDevice','libraryReconnect','libraryRefresh','libraryOpenFile','libraryAdd','libraryBatch'])el(id).disabled=busy;
  }
  async function run(fn){
    if(busy)return;stopScan();busy=true;render();
    try{await fn();}catch(e){if(e?.name!=='AbortError')status(errorText(e));}
    finally{busy=false;render();}
  }
  async function permission(handle,mode,request=false){
    if(await handle.queryPermission({mode})==='granted')return true;
    return request&&await handle.requestPermission({mode})==='granted';
  }
  // Folder reads may never settle on a disconnected mobile storage provider.
  // Keep cached songs usable and discard every late result from a cancelled scan.
  function stopScan(){
    scanJob?.cancel();scanJob?.worker?.terminate();scanJob=null;scan++;scanning=false;
  }
  function scanWait(promise,job){
    let timer;
    const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(Error('Folder check paused. Try Refresh or change save folder.'),{name:'TimeoutError'})),15000);timer?.unref?.();});
    return Promise.race([promise,timeout,job.cancelled]).finally(()=>globalThis.clearTimeout?.(timer));
  }
  async function refresh(){
    stopScan();const token=scan;
    const job={};job.cancelled=new Promise((_,reject)=>{job.cancel=()=>reject(abort());});job.cancelled.catch(()=>{});scanJob=job;
    const check=()=>{if(token!==scan)throw abort();};
    const wait=async promise=>{const result=await scanWait(promise,job);check();return result;};
    scanning=true;
    let deviceRows=rows.filter(r=>r.storageLabel==='In app'),found=[],next={},skipped=0,checked=0,lastPaint=0;
    const cachedRows=()=>Object.values(index).filter(m=>m.filename&&m.kind!=='chord-catalogue').map(m=>({...m,dir:folder,storageLabel:'Save folder'}));
    const publish=(complete=false)=>{
      check();const known=new Map((complete?[]:cachedRows()).map(r=>[r.filename,r]));
      for(const row of found)known.set(row.filename,row);
      rows=uniqueSongs([...known.values(),...deviceRows]);render();
    };
    try{
      await wait(ready);publish();status('Checking songs…');
      try{
        deviceRows=(await wait(store('songs','readonly',s=>s.getAll()))||[])
          .filter(r=>r?.filename&&SUPPORTED.test(r.filename)).map(r=>({...r,storageLabel:'In app'}));
      }catch(error){
        if(error.name==='AbortError'||!folder)throw error;
      }
      publish();
      // Existing metadata remains visible while old in-app entries gain audio IDs.
      for(let i=0;i<deviceRows.length;i++){
        if(deviceRows[i].audioId)continue;
        try{const row=deviceRows[i],file=new File([row.blob],row.filename,{type:'application/json'});
          const meta=await wait(scanMetadata(file));
          deviceRows[i]={...row,...meta};await wait(store('songs','readwrite',s=>s.put(deviceRows[i])));
        }catch(e){if(e.name==='AbortError')throw e;if(e.name==='TimeoutError'){job.worker?.terminate();job.worker=null;}}
      }
      if(!folder){rows=uniqueSongs(deviceRows);status('');return;}
      const directory=folder;
      if(!await wait(permission(directory,'read'))){
        folderAccess='reconnect';publish();status('Reconnect the folder or choose a saved file directly.');return;
      }
      folderAccess='ready';const iterator=job.iterator=directory.entries()[Symbol.asyncIterator]();
      const pending=[];
      for(;;){
        const entry=await wait(iterator.next());if(entry.done)break;
        const [name,handle]=entry.value;
        if(handle.kind!=='file'||!SUPPORTED.test(name))continue;
        pending.push([name,handle]);
        if(/\.(bassstudio|bssproject)$/i.test(name)){
          const row={title:name.replace(SUPPORTED,''),...index[name],filename:name,handle,dir:directory,storageLabel:'Save folder'};
          found.push(row);
          if(Date.now()-lastPaint>200){publish();lastPaint=Date.now();}
        }
      }
      publish();
      const listed=new Map(found.map(r=>[r.filename,r]));
      for(const [name,handle] of pending){
        try{
          const file=await wait(handle.getFile()),cached=index[name];
          const unchanged=cached&&cached.size===file.size&&cached.modified===file.lastModified;
          if(unchanged&&cached.kind==='chord-catalogue'){next[name]=cached;continue;}
          const meta=unchanged&&cached.audioId?cached:await wait(scanMetadata(file));
          next[name]=meta;
          if(meta.kind!=='chord-catalogue'){
            const row={...meta,handle,dir:directory,storageLabel:'Save folder'};
            if(listed.has(name))Object.assign(listed.get(name),row);
            else found.push(row);
          }
          // Save progress after each newly read file, so an interrupted scan can resume.
          if(!unchanged){index[name]=meta;await wait(put('index',{...index}));}
        }catch(e){
          if(e.name==='AbortError')throw e;
          if(e.name==='TimeoutError'){job.worker?.terminate();job.worker=null;}
          skipped++;
        }
        checked++;
        if(Date.now()-lastPaint>200){publish();status('Checking songs… '+checked+' checked');lastPaint=Date.now();}
        await wait(new Promise(resolve=>setTimeout(resolve,0)));
      }
      check();index=next;publish(true);await wait(put('index',index));
      status(skipped?skipped+' unreadable saved '+(skipped===1?'file':'files')+' could not be indexed.':'');
    }catch(error){
      if(token!==scan)throw abort();
      if(error.name!=='AbortError')status(error.name==='TimeoutError'?error.message:'Could not finish checking this folder. Try Refresh or change save folder.');
      throw error;
    }finally{
      job.worker?.terminate();
      if(job.iterator?.return)void Promise.resolve().then(()=>job.iterator.return()).catch(()=>{});
      if(token===scan){scanning=false;scanJob=null;render();}
    }
  }
  async function scanMetadata(file){
    // Parse large embedded audio and calculate its identity off the UI thread.
    const job=scanJob;
    if(typeof Worker==='function'&&job){
      const worker=job.worker||(job.worker=new Worker('./library-source/scan-worker-rc295.js?v=rc364'));
      return new Promise((resolve,reject)=>{
        worker.onmessage=event=>{event.data.error?reject(Error(event.data.error)):resolve(event.data.meta);};
        worker.onerror=()=>reject(Error('Could not read this saved song.'));
        worker.postMessage(file);
      });
    }
    const project=await readProject(file,{playback:true});
    if(isChordCatalogue(project))return {kind:'chord-catalogue',size:file.size,modified:file.lastModified};
    return indexedMetadata(project,file);
  }
  let backgroundScan;
  const scanInBackground=()=>{backgroundScan=refresh();void backgroundScan.catch(e=>{if(e.name!=='AbortError')status(errorText(e));});};
  async function chooseFolder(){
    // The picker must run directly from the button gesture, before other awaits.
    const options={id:'bass-studio-library',mode:'readwrite'};
    if(folder)options.startIn=folder;
    const dir=await window.showDirectoryPicker(options);
    await ready;
    await put('folder',dir);await put('index',{});
    folder=dir;folderAccess='ready';index={};rows=[];scanInBackground();
  }
  async function useDevice(){await put('folder',null);await put('index',{});folder=null;folderAccess='device';index={};rows=rows.filter(r=>r.storageLabel==='In app');scanInBackground();}
  async function reconnect(){
    if(folder){
      try{if(!await within(permission(folder,'readwrite',true),15000,'Folder access did not respond. Choose the folder again.'))throw Error('Access was not granted.');folderAccess='ready';}
      catch(e){folderAccess='reconnect';throw Error('Folder permission was not granted. Your saved files are unchanged.');}
    }
    scanInBackground();
  }
  async function ensureBatchAccess(){
    await ready;
    if(folder){
      try {
        if(!await permission(folder,'readwrite',true))throw Error('Permission was not granted.');
        folderAccess='ready';return true;
      }catch(err){
        folderAccess='reconnect';
        throw Error('The folder “'+folder.name+'” is remembered. Open Library or select Reconnect folder to allow access. '+(err?.message||''));
      }
    }
    await database();
    return true;
  }
  async function hasProject(name){
    await ready;
    const filename=String(name).replace(/[\\/:*?"<>|]+/g,'_').trim().slice(0,100)+'.bassstudio';
    if(folder){
      if(!await permission(folder,'read'))throw Error('Reconnect your library folder before batch processing.');
      try{await folder.getFileHandle(filename);return true;}
      catch(e){if(e?.name==='NotFoundError')return false;throw e;}
    }
    return !!await store('songs','readonly',s=>s.get(filename.toLocaleLowerCase()));
  }
  async function prepareSave(name){
    await ready;
    const filename=String(name).replace(/[\\/:*?"<>|]+/g,'_').trim().slice(0,100)+'.bassstudio';
    const dir=folder;
    if(dir){
      if(!await permission(dir,'readwrite',true))throw Error('Allow folder access before saving, or choose On this device in Library.');
      let existing;
      try{existing=await dir.getFileHandle(filename);}catch(e){if(e.name!=='NotFoundError')throw e;}
      if(existing&&!await window.BassDialog.confirm('A saved song with this name already exists in this folder.',{title:'Replace saved song',accept:'Replace'}))throw abort();
      return {dir,filename};
    }
    const id=filename.toLocaleLowerCase();
    if(await store('songs','readonly',s=>s.get(id))&&!await window.BassDialog.confirm('A saved song with this name already exists on this device.',{title:'Replace saved song',accept:'Replace'}))throw abort();
    return {dir:null,filename,id};
  }
  function save(project,blob,target,options={}){
    return inWriteOrder(job=>writeProject(project,blob,target,{...options,job}),options.exact?target:null);
  }
  async function writeProject(project,blob,target,{exact=false,requestAccess=false,alsoMelody=false,maintenance=false,onProgress=()=>{},job}={}){
    await ready;
    let match=exact?target:await matchingTarget(project);
    if(match)target=match;
    if(!target?.filename)throw Error('Choose a save location for this song.');
    if(job)job.target=target;
    const directory=target.dir,access=directory||target.handle;
    if(access&&!await within(permission(access,'readwrite',requestAccess)))
      throw Error(directory?'Reconnect the folder in Library, then tap Save.':'Tap Save and allow this file to be updated.');
    onProgress('Saving '+target.filename+'…');
    let handle=target.handle,existing,record;
    if(access){
      try{handle=handle||await within(directory.getFileHandle(target.filename));existing=await within(handle.getFile());}
      catch(e){if(e.name!=='NotFoundError'||exact)throw e;}
    }else{
      record=await store('songs','readonly',s=>s.get(target.id));
      existing=record?.blob;
      if(exact&&!existing)throw Error('The saved song has moved. Reopen it from Library.');
    }
    const unchanged=match&&existing&&existing.size===match.size&&(access?existing.lastModified===match.modified:record.savedAt===match.savedAt);
    if(maintenance&&!unchanged)throw Error('File changed during the check. Run the check again.');
    let previous=null;
    if(existing&&(!unchanged||alsoMelody||(!exact&&!project.analysis.bassBacking))){
      previous=await readProject(existing);
      if(await audioIdentity(previous)!==await audioIdentity(project)){
        if(exact||match)throw Error('This file now contains another recording. Reopen the correct song from Library.');
        const suffix=(await audioIdentity(project)).slice(0,12);
        target={...target,filename:target.filename.replace(SUPPORTED,'')+' - '+suffix+'.bassstudio'};
        target.id=target.filename.toLocaleLowerCase();
        return writeProject(project,blob,target,{exact:false,alsoMelody,onProgress,requestAccess,job});
      }
    }
    if(previous?.analysis?.bassBacking?.version===2&&project.analysis.bassBacking?.version!==2){
      project={...project,analysis:{...project.analysis,bassBacking:previous.analysis.bassBacking}};blob=null;
    }
    if(previous?.analysis?.melody&&Number(previous.analysis.melody.updatedAt)>Number(project.analysis.melody?.updatedAt||0)){
      project={...project,analysis:{...project.analysis,melody:previous.analysis.melody}};blob=null;
    }
    if(alsoMelody&&previous){
      project={...previous,savedAt:project.savedAt,analysis:{...previous.analysis,melody:project.analysis.melody}};
      blob=null;
    }
    blob=blob||projectBlob(project);
    const f=new File([blob],target.filename,{type:'application/json',lastModified:Date.now()});
    const meta={...metadata(project,f),audioId:unchanged&&match.audioId||await audioIdentity(project)};
    if(access){
      handle=handle||await within(directory.getFileHandle(target.filename,{create:true}));
      const stream=await within(handle.createWritable());
      try{
        const chunk=4*1024*1024;
        if(blob.size<=chunk)await within(stream.write(blob),90000);
        else for(let offset=0;offset<blob.size;offset+=chunk){
          const end=Math.min(offset+chunk,blob.size);
          await within(stream.write(blob.slice(offset,end)),90000);
          onProgress('Saving '+target.filename+' · '+Math.floor(99*end/blob.size)+'%');
        }
        onProgress('Finishing '+target.filename+'…');
        await within(stream.close(),90000);
      }catch(e){try{void Promise.resolve(stream.abort()).catch(()=>{});}catch{}throw e;}
      const committed=await within(handle.getFile());
      if(committed.size!==blob.size)throw Error('File size check failed. Reopen the folder and try Save again.');
      meta.modified=committed.lastModified;
      if(directory&&directory===folder){index[target.filename]=meta;void put('index',{...index}).catch(()=>{});}
    }else{
      await store('songs','readwrite',s=>s.put({...meta,id:target.id,blob}));
      try{void navigator.storage?.persist?.().catch(()=>{});}catch{}
    }
    Object.assign(target,meta,{handle});
    if(!access||directory===folder){
      const updated={...target,storageLabel:access?'Save folder':'In app'};
      rows=uniqueSongs([updated,...rows.filter(r=>!(r.dir===directory&&r.filename===target.filename))]);if(dialog?.open)render();
    }
    window.dispatchEvent(new Event('bass-stem:project-saved'));
    return {target,location:access?(directory?'folder “'+directory.name+'”':'the selected file'):'this device'};
  }
  async function rowFile(row,onWait){
    const relevant=[...writes].filter(job=>sameSong(row,job.target));
    if(relevant.length){
      onWait?.();
      // A stalled save must not hold the last committed file hostage.
      await within(Promise.all(relevant.map(job=>job.done)),3000).catch(()=>{});
    }
    let file;
    if(row.handle||row.dir){
      const dir=row.dir||(row.where==='your saved folder'?folder:null);
      let handle=row.handle;
      const message='The saved folder did not respond. Choose this file directly or reconnect the folder.';
      const timeout=promise=>within(promise,6000,message);
      try{
        if(handle)file=await timeout(handle.getFile());
        else handle=await timeout(dir.getFileHandle(row.filename));
      }catch(error){
        if(!dir||!row.handle||!['TimeoutError','NotFoundError','NotReadableError','InvalidStateError'].includes(error.name))throw error;
        handle=await timeout(dir.getFileHandle(row.filename));
      }
      if(!file)file=await timeout(handle.getFile());
      row={...row,handle,dir};
    }else{
      const saved=await store('songs','readonly',s=>s.get(row.id));
      if(!saved?.blob)throw Error('This saved song is no longer available.');
      row={...row,filename:saved.filename,audioId:saved.audioId,size:saved.blob.size,savedAt:saved.savedAt};
      file=new File([saved.blob],saved.filename,{type:'application/json'});
    }
    const {blob,...target}=row;
    if((target.handle||target.dir)&&(file.size!==target.size||file.lastModified!==target.modified))delete target.audioId;
    openedFiles.set(file,{...target,size:file.size,modified:file.lastModified});
    return file;
  }
  function selectedFile(file,handle){openedFiles.set(file,{filename:file.name,size:file.size,modified:file.lastModified,handle});}
  async function lastProject(ref){
    await ready;
    if(!ref?.filename||!ref?.audioId)return null;
    if(ref.inFolder&&(!folder||folder.name!==ref.folder||!await within(permission(folder,'read'))))return null;
    const row=ref.inFolder?{dir:folder,filename:ref.filename}:{id:ref.id,filename:ref.filename};
    const file=await rowFile(row);
    const target=openedFiles.get(file);
    if(file.size!==ref.size||(ref.inFolder?file.lastModified!==ref.modified:target.savedAt!==ref.savedAt))return null;
    target.audioId=ref.audioId;
    return file;
  }
  async function openRow(row,selectedFile){
    const key=rowKey(row),reason=hooks.openBlocked?.();
    if(reason){lastOpenError={key,message:reason};throw Error(reason);}
    lastOpenError=null;
    const controller=new AbortController(),request={row,key,controller,ready:false};
    const closed=new Promise((_,reject)=>controller.signal.addEventListener('abort',()=>reject(abort()),{once:true}));
    opening=request;render();
    const progress=text=>{
      if(opening!==request||!dialog.open)return;
      request.message=text;status(text);
      const entry=songItems.get(key);if(entry)entry.details.textContent=text;
    };
    progress(selectedFile?'Opening '+row.title+'…':'Finding '+row.title+'…');
    try{
      const file=selectedFile||await Promise.race([rowFile(row,()=>progress('Finishing the save for '+row.title+'…')),closed]);
      if(controller.signal.aborted)throw abort();
      let present;
      const presented=new Promise(resolve=>{present=resolve;});
      request.file=file;
      request.present=()=>{request.ready=true;dialog.close();present(true);};
      const imported=hooks.open(file,{onStatus:progress,signal:controller.signal});
      const ok=await Promise.race([imported,presented,closed]);
      if(ok){if(!request.ready&&dialog.open)dialog.close();}
      else if(!controller.signal.aborted)lastOpenError={key,message:request.message};
    }catch(error){
      if(error.name!=='AbortError'){
        const fileAccess=!request.file&&!selectedFile&&!!(row.handle||row.dir);
        if(fileAccess)folderAccess='reconnect';
        lastOpenError={key,message:errorText(error),fileAccess};
      }
      throw error;
    }finally{if(opening===request)opening=null;}
  }
  async function addFiles(files){
    let added=0,failed=0,cancelled=0,duplicates=0,chordCatalogues=0;
    let firstError;
    for(const file of files){
      try{
        status('Adding '+file.name+'…');
        const p=await readProject(file);
        if(isChordCatalogue(p)){chordCatalogues++;continue;}
        metadata(p,file);
        if(await matchingTarget(p)){duplicates++;continue;}
        const target=await prepareSave(clean(p.projectName)||file.name.replace(SUPPORTED,''));
        await save(p,projectBlob(p),target);added++;
      }catch(e){if(e?.name==='AbortError')cancelled++;else{failed++;firstError??=errorText(e);}}
    }
    await refresh();status(added+' added'+(duplicates?' · '+duplicates+' already saved':'')+(cancelled?' · '+cancelled+' cancelled':'')+(failed?' · '+failed+' could not be added. '+firstError:'.')+(chordCatalogues?' Open chord backups in Song Chords → Import charts / backup.':''));
  }

  function projectPickerOptions(multiple=false){
    const options={id:'bass-studio-projects',multiple,types:PROJECT_FILE_TYPES};
    if(folder)options.startIn=folder;
    return options;
  }

  async function pickProjects(input,onFiles){
    if(busy)return;
    input.value='';
    if(typeof window.showOpenFilePicker!=='function'){input.click();return;}
    let handles;
    try{handles=await window.showOpenFilePicker(projectPickerOptions(input.multiple));}
    catch(error){if(error?.name!=='AbortError')input.click();return;}
    if(!handles?.length)return;
    await run(async()=>{
      const files=await Promise.all(handles.map(handle=>within(handle.getFile(),15000,'The selected file did not respond. Try choosing it again.')));
      return onFiles(files);
    });
  }

  async function openPickedProject(file,expected){
    if(expected&&file.name!==expected.filename){
      status('Choose '+expected.filename+' to open this song.');
      return;
    }
    return openRow(expected||{title:file.name,filename:file.name},file);
  }

  function browseProject(expected=null){
    const input=el('libraryOpenInput');
    input.expectedRow=expected;
    return pickProjects(input,([file])=>openPickedProject(file,expected));
  }

  /* RC227: Reuse saved analysed songs before loading audio or creating a paid job. */
  function songKey(value){
    return String(value||'').split(/[\\/]/).pop().replace(/\.(?:mp3|wav|m4a|aac|flac|ogg|opus|mp4|mov|webm|bassstudio|bssproject|json)$/i,'')
      .normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  }
  function audioMatchScore(file,row){
    const name=songKey(file?.name),source=songKey(row?.sourceName),
      title=songKey(row?.title),savedName=songKey(row?.filename);
    if(!name)return 0;
    const named=name===source||name===title||name===savedName;
    const base=name.split(/\s+\b(?:feat|ft)\b\s+/)[0].trim();
    const plain=name.replace(/\s+(?:official|lyrics|audio|video|remastered)\s*$/,'').trim();
    const similar=[base,plain].some(k=>k&&k!==name&&(k===source||k===title));
    if(source===name&&Number(row?.sourceSize)>0&&Number(file?.size)>0&&Number(row.sourceSize)===Number(file.size))return 100;
    if(source===name)return 85;
    if(title===name||savedName===name)return 75;
    if(similar)return 55;
    return 0;
  }
  async function audioMatches(file){
    await ready;
    const all=[],seen=new Set();
    const stored=await store('songs','readonly',s=>s.getAll());
    for(const r of stored||[]){
      if(!r?.filename||!SUPPORTED.test(r.filename))continue;
      const id='device:'+String(r.id||r.filename).toLowerCase();if(seen.has(id))continue;
      seen.add(id);all.push({...r,where:'this device'});
    }
    let folderNotConnected=false;
    if(folder){
      try{
        if(!await permission(folder,'read'))folderNotConnected=true;
        else for await(const [name,handle] of folder.entries()){
          if(handle.kind!=='file'||!SUPPORTED.test(name))continue;
          const id='folder:'+name.toLowerCase();if(seen.has(id))continue;
          try{
            const f=await handle.getFile(),memo=index[name]||{};
            const row={...memo,title:memo.title||name.replace(SUPPORTED,''),
              filename:name,size:f.size,modified:f.lastModified,handle,where:'your saved folder'};
            seen.add(id);all.push(row);
          }catch(err){if(err?.name==='NotAllowedError')folderNotConnected=true;}
        }
      }catch{folderNotConnected=true;}
    }
    const matches=all.map(row=>({row,score:audioMatchScore(file,row)}))
      .filter(x=>x.score>0).sort((a,b)=>b.score-a.score||String(a.row.title).localeCompare(String(b.row.title)))
      .slice(0,16);
    return {matches,folderNotConnected};
  }
  function chooseSavedVersion(file,matches){
    return new Promise(resolve=>{
      const previous=document.activeElement,d=document.createElement('dialog');
      d.className='bass-saved-match';d.setAttribute('aria-labelledby','savedAudioTitle');
      const heading=document.createElement('h2');heading.id='savedAudioTitle';heading.textContent='Saved song found';
      const explanation=document.createElement('p');
      explanation.textContent='A song with a matching name is in your library. Open it to reuse saved notes and chords without new analysis.';
      const label=document.createElement('label');label.textContent=matches.length>1?'Choose saved version':'Saved version';
      const picker=document.createElement('select');picker.setAttribute('aria-label','Saved song version');
      matches.forEach((item,i)=>{
        const option=document.createElement('option');option.value=String(i);
        const r=item.row;
        option.textContent=String(r.title||r.filename).slice(0,90)+' · '+r.where+
          (item.score===100?' · same file name and size':item.score<85?' · check version':'');
        picker.append(option);
      });
      label.append(picker);
      const hint=document.createElement('p');hint.className='saved-match-hint';
      hint.textContent='If this is a different recording, choose Import this audio. You can decide when to analyse it.';
      const actions=document.createElement('div');actions.className='saved-match-actions';
      const open=document.createElement('button');open.type='button';open.className='saved-open';open.textContent='Open saved song';
      const fresh=document.createElement('button');fresh.type='button';fresh.textContent='Import this audio';
      const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancel';
      actions.append(open,fresh,cancel);
      d.append(heading,explanation,label,hint,actions);document.body.append(d);
      let finished=false;
      const finish=(choice)=>{
        if(finished)return;finished=true;d.close();d.remove();
        if(previous?.isConnected)previous.focus({preventScroll:true});
        resolve(choice);
      };
      open.onclick=()=>finish({action:'open',index:Number(picker.value)});
      fresh.onclick=()=>finish({action:'audio'});
      cancel.onclick=()=>finish({action:'cancel'});
      d.addEventListener('cancel',e=>{e.preventDefault();finish({action:'cancel'});});
      try{d.showModal();}catch{finish({action:'cancel'});}
      if(d.open)open.focus({preventScroll:true});
    });
  }
  async function checkAudioImport(file){
    if(!file)return 'cancel';
    if(hooks.isBusy?.()){status('Finish the current song before importing another.');return 'cancel';}
    let found;
    try{found=await audioMatches(file);}
    catch(err){status('Could not check saved songs: '+errorText(err));return 'cancel';}
    if(!found.matches.length){
      if(found.folderNotConnected){
        const approved=await window.BassDialog.confirm(
          'Your saved-song folder needs reconnecting. Open Library and select Reconnect folder to check it, or continue with this audio.',
          {title:'Check saved songs first',accept:'Import audio'});
        return approved?'audio':'cancel';
      }
      return 'audio';
    }
    const exact=found.matches.filter(match=>match.score>=75);
    const choice=exact.length===1?{action:'open',index:found.matches.indexOf(exact[0])}:await chooseSavedVersion(file,found.matches);
    if(choice.action!=='open')return choice.action;
    const match=found.matches[choice.index];
    if(!match)return 'cancel';
    try{
      const saved=await rowFile(match.row);
      const ok=await hooks.open(saved);
      if(ok){status('Opened saved song. No new analysis was started.');return 'opened';}
      status('Could not open that saved song. Your current song is unchanged.');return 'cancel';
    }catch(err){
      status('Could not open the saved song: '+errorText(err));return 'cancel';
    }
  }


  // Read-only inventory: scan only the device library and an already-authorised folder.
  async function analysisSummary(){
    await ready;
    const stored=await store('songs','readonly',s=>s.getAll());
    const all=[],issues=[],seen=new Set();
    for(const entry of stored||[]){
      if(!entry?.filename||!SUPPORTED.test(entry.filename))continue;
      try{
        let meta=entry;
        if(typeof meta.hasChordAnalysis!=='boolean'||typeof meta.hasBassAnalysis!=='boolean'){
          const file=new File([entry.blob],entry.filename,{type:'application/json'});
          meta={...entry,...metadata(await readProject(file),file)};
        }
        const id='device:'+String(entry.id||entry.filename).toLowerCase();
        if(seen.has(id))continue;
        seen.add(id);all.push({location:'device',id:String(entry.id||entry.filename),...meta});
      }catch{issues.push('A device file could not be read.');}
    }
    let reconnect=false;
    if(folder){
      try{
        if(!await permission(folder,'read'))reconnect=true;
        else {
          let updated=false;
          for await(const [name,handle] of folder.entries()){
            if(handle.kind!=='file'||!SUPPORTED.test(name))continue;
            const id='folder:'+name.toLowerCase();if(seen.has(id))continue;
            try{
              const file=await handle.getFile();
              let info=index[name];
              if(info?.kind==='chord-catalogue'&&info.size===file.size&&info.modified===file.lastModified)continue;
              if(!info||info.size!==file.size||info.modified!==file.lastModified
                ||typeof info.hasBassAnalysis!=='boolean'||typeof info.hasChordAnalysis!=='boolean'){
                const project=await readProject(file);
                if(isChordCatalogue(project)){index[name]={kind:'chord-catalogue',size:file.size,modified:file.lastModified};updated=true;continue;}
                info=metadata(project,file);
                index[name]=info;updated=true;
              }
              seen.add(id);all.push({location:'folder',id:name,...info});
            }catch{issues.push('A saved folder file could not be read.');}
          }
          if(updated)await put('index',index).catch(()=>{});
        }
      }catch{reconnect=true;}
    }
    return {songs:all.map(r=>({
      location:r.location,id:r.id,filename:clean(r.filename),title:clean(r.title),
      artist:clean(r.artist),sourceName:clean(r.sourceName),duration:Number(r.duration)||0,
      hasChordAnalysis:r.hasChordAnalysis===true,hasBassAnalysis:r.hasBassAnalysis===true
    })),reconnect,issues:issues.length};
  }
  async function openForAnalysis(location,id){
    await ready;
    if(hooks.isBusy?.())throw Error('Finish the current song first.');
    let file;
    if(location==='folder'){
      if(!folder)throw Error('Open Library and reconnect your saved folder first.');
      file=await rowFile({dir:folder,filename:id});
    }else{
      file=await rowFile({id:String(id).toLowerCase()});
    }
    return !!await hooks.open(file);
  }

  let maintenance=false,stopMaintenance=false;
  async function checkLibrary(){
    if(maintenance){stopMaintenance=true;stopScan();return;}
    if(busy)return;
    const activeScan=scanning?backgroundScan:null;
    busy=true;maintenance=true;stopMaintenance=false;render();
    const button=el('libraryCheck'),report=el('libraryCheckStatus');
    button.textContent='Stop check';
    let updated=0,readyCount=0,other=0,failed=[];
    const counts=()=>readyCount+' already ready · '+updated+' updated'+(other?' · '+other+' other files skipped':'')+' · '+failed.length+' need review';
    const stopped=()=>stopMaintenance||!dialog.open;
    try{
      await ensureBatchAccess();
      report.textContent='Finding songs in your Library…';
      if(!stopped())await (activeScan||refresh());
      const list=rows.map(({blob,searchNames,...row})=>row);
      for(const [i,row] of list.entries()){
        if(stopped())break;
        try{
          const show=(percent='')=>{report.textContent=(i+1)+' / '+list.length+' · '+row.filename+percent+' · '+counts();};
          show();
          const file=await rowFile(row),target=openedFiles.get(file);
          row.filename=file.name;
          show();
          const receipt='ready-v2:'+JSON.stringify([row.audioId,row.dir?'folder':'app',file.name]);
          const stamp=JSON.stringify([file.size,row.dir?file.lastModified:target.savedAt]);
          if(row.audioId&&((row.muteReady&&target.size===row.size&&(row.dir?row.modified===file.lastModified:row.savedAt===target.savedAt))||await get(receipt)===stamp)){readyCount++;show();continue;}
          const project=await readProject(file);
          if(isChordCatalogue(project)){other++;show();continue;}
          metadata(project,file);
          const backing=project.analysis.bassBacking;
          if(backing?.version===2&&window.BassBacking.canRestore(backing,project.source.duration)){if(row.audioId)await put(receipt,stamp);readyCount++;show();continue;}
          const result=await hooks.prepareLibraryBacking(project,stopped,p=>show(' · '+p+'%'));
          if(stopped())break;
          project.analysis.bassBacking=result.backing;project.source.duration=result.backing.duration;
          await save(project,null,target,{exact:true,maintenance:true});
          updated++;await result.clearParts();
        }catch(e){if(stopped())break;failed.push((row.filename||row.id)+' ('+errorText(e)+')');}
      }
      report.textContent=(stopped()?'Stopped. ':'')+counts()+(failed.length?' · '+failed.join(', '):'');
    }catch(e){report.textContent=stopped()?'Check stopped.':errorText(e);}
    finally{busy=false;maintenance=false;button.textContent='Check and fix files';render();}
  }

  function build(){
    if(dialog)return;
    dialog=document.createElement('dialog');dialog.id='bassLibraryDialog';dialog.className='bass-library';dialog.setAttribute('aria-labelledby','libraryTitle');
    dialog.innerHTML='<div class="library-heading"><div><h2 id="libraryTitle">Song library</h2><p id="libraryLocation"></p></div><button id="libraryClose" type="button">Close</button></div><div class="library-toolbar"><button id="libraryChoose" type="button">Choose save folder</button><button id="libraryReconnect" type="button">Reconnect folder</button><button id="libraryDevice" type="button">Save in app</button><button id="libraryOpenFile" type="button">Open saved file</button><button id="libraryAdd" type="button">Import saved file</button><button id="libraryBatch" type="button">Batch ZIP</button><button id="libraryCheck" type="button">Check and fix files</button><button id="libraryRefresh" type="button">Refresh</button><button id="libraryStop" type="button" hidden>Stop checking</button></div><p id="libraryCheckStatus" role="status"></p><p id="libraryHint"></p><div class="library-filters"><div><label for="librarySearch">Search songs</label><input id="librarySearch" type="search" placeholder="Title, artist, key or BPM" autocomplete="off"></div><div><label for="librarySort">Sort by</label><select id="librarySort"><option value="name">Alphabetical (A–Z)</option><option value="recent">Recently saved</option></select></div></div><div class="library-summary"><span id="libraryCount"></span><span id="libraryStatus" role="status" aria-live="polite"></span></div><ul id="librarySongs"></ul><input id="libraryOpenInput" type="file" accept=".bassstudio,.bssproject,.json,application/json" hidden><input id="libraryFiles" type="file" accept=".bassstudio,.bssproject,.json,application/json" multiple hidden>';
    document.body.append(dialog);
    el('libraryCheck').onclick=checkLibrary;
    el('libraryClose').onclick=()=>dialog.close();
    dialog.addEventListener('close',()=>{stopMaintenance=true;if(opening&&!opening.ready)opening.controller.abort();stopScan();document.getElementById('importProjectBtn')?.focus();});
    el('librarySearch').oninput=render;el('librarySort').onchange=render;
    el('libraryChoose').onclick=()=>run(chooseFolder);el('libraryDevice').onclick=()=>run(useDevice);
    el('libraryStop').onclick=()=>{stopScan();status('Folder check stopped.');render();};
    el('libraryRefresh').onclick=scanInBackground;el('libraryReconnect').onclick=()=>run(reconnect);
    el('libraryOpenFile').onclick=()=>browseProject();
    el('libraryOpenInput').onchange=e=>{
      const file=e.target.files?.[0],expected=e.target.expectedRow;
      e.target.value='';e.target.expectedRow=null;
      if(!file)return;
      void run(()=>openPickedProject(file,expected));
    };
    el('libraryAdd').onclick=()=>pickProjects(el('libraryFiles'),addFiles);
    el('libraryBatch').onclick=()=>{window.BassBatch?.show();};
    el('libraryFiles').onchange=e=>{const files=Array.from(e.target.files||[]);e.target.value='';void run(()=>addFiles(files));};
  }
  async function show(){
    build();if(!dialog.open)dialog.showModal();el('librarySearch').focus();
    if(!busy)scanInBackground();
  }

  function init(options){
    hooks=options;
    ready=(async()=>{
      folder=await get('folder')||null;
      index=await get('index')||{};
      folderAccess=folder?'unknown':'device';
    })();
    ready.catch(()=>{});
  }

  /* RC219: read only small analysis fields from each existing local project. */
  async function chartProjects(){
    if(ready)await ready;
    if(folder&&!await permission(folder,'read'))throw Error('Reconnect your saved-song folder in Library first.');
    await refresh();
    if(folder&&folderAccess==='reconnect')throw Error('Reconnect the saved-song folder in Library first.');
    return rows.filter(r=>r&&r.filename).map(r=>({
      id:String(r.id||r.filename).toLowerCase(),title:r.title||'',filename:r.filename,
      size:Number(r.size)||0,modified:Number(r.modified)||0
    }));
  }
  async function chartProject(id){
    const row=rows.find(r=>String(r.id||r.filename).toLowerCase()===String(id).toLowerCase());
    if(!row)throw Error('The saved project is not available in your current library.');
    if(Number(row.size)>120*1024*1024)throw Error('This saved project is too large to chart on this device.');
    const file=await rowFile(row),project=await readProject(file);
    if(project?.format!=='Bass Stem Studio Project'||!Array.isArray(project.analysis?.chords))
      throw Error('No compatible saved chord analysis was found.');
    // Never send the original source, audio, stems, lyrics or full note timeline to Song chords.
    const a=project.analysis;
    return {format:project.format,projectName:project.projectName,
      library:{artist:project.library?.artist||''},
      source:{name:project.source?.name||'',duration:project.source?.duration||0},
      analysis:{baseScale:a.baseScale||{},scale:a.scale||'',tempoBpm:a.tempoBpm,
        structure:{segments:a.structure?.segments||[],downbeats:a.structure?.downbeats||[]},
        chords:a.chords.map(c=>({start:c.start,end:c.end,rootPc:c.rootPc,
          quality:c.quality,confidence:c.confidence,uncertain:c.uncertain,manual:c.manual}))},
      settings:{sections:project.settings?.sections||{}}};
  }
  // Update the exact saved song, without a naming prompt or new analysis.
  // A same-named project with different audio is never overwritten.
  function defaultTarget(project,openedName){
    const filename=openedName&&SUPPORTED.test(openedName)&&!/[\\/]/.test(openedName)?openedName:String(project.projectName||'Song').replace(/[\\/:*?"<>|]+/g,'_').trim().slice(0,100)+'.bassstudio';
    return {dir:folder,filename,id:filename.toLocaleLowerCase()};
  }
  async function saveAnalysisProject(project,target,options={}){
    await ready;
    return save(project,null,target||defaultTarget(project,options.openedName),{...options,exact:!!target});
  }
  async function saveMelodyProject(project,target,options={}){
    await ready;
    return save(project,null,target||defaultTarget(project,options.openedName),{...options,exact:!!target,alsoMelody:true});
  }

  const practiceId=row=>row.audioId?'audio:'+row.audioId:(row.handle||row.dir?'folder:':'device:')+String(row.id||row.filename).toLowerCase();
  async function practiceProjects(){
    await ready;await refresh();
    return {songs:rows.map(row=>({id:practiceId(row),title:row.title,filename:row.filename,stamp:[row.size,row.modified,row.savedAt].join(':')})),reconnect:folderAccess==='reconnect'};
  }
  async function practiceRow(id){
    if(ready)await ready;
    let row=rows.find(r=>practiceId(r)===id);
    if(!row){await refresh();row=rows.find(r=>practiceId(r)===id);}
    if(!row)throw Error('Reconnect the song folder in Library, then scan again.');
    return row;
  }
  async function practiceProject(id){
    const row=await practiceRow(id);
    if(Number(row.size)>240*1024*1024)throw Error('Song too large to scan on this device.');
    const project=await readProject(await rowFile(row)),a=project.analysis||{};
    // Keep audio, stems and lyrics out of the transition catalogue.
    return {projectName:project.projectName,source:{duration:project.source?.duration},settings:{sections:project.settings?.sections||{}},analysis:{notes:a.notes,chords:a.chords,baseScale:a.baseScale,scale:a.scale,tempoBpm:a.tempoBpm,keySections:a.keySections,keyCorrections:a.keyCorrections,structure:{segments:a.structure?.segments||[]}}};
  }
  async function openPracticeSong(id,stamp){
    if(hooks.isBusy?.())throw Error('Finish the current song first.');
    await refresh();const row=await practiceRow(id);
    if(stamp&&stamp!==[row.size,row.modified,row.savedAt].join(':'))throw Error('This song has changed. Scan your library again.');
    const file=await rowFile(row);
    if(!hooks.openPractice)throw Error('Reload the platform to open this part.');
    return !!await hooks.openPractice(file);
  }
  return {init,show,projectPickerOptions,presentOpened(file){if(opening?.file===file)opening.present();else if(dialog?.open&&!opening&&openedFiles.has(file))dialog.close();},readProject,projectBlob,selectedFile,lastProject,targetFor:file=>openedFiles.get(file),prepareSave,save:(p,b,t)=>save(p,b,t).then(r=>r.location),saveAnalysisProject,saveMelodyProject,hasProject,ensureBatchAccess,errorText,chartProjects,chartProject,checkAudioImport,analysisSummary,openForAnalysis,practiceProjects,practiceProject,openPracticeSong};
})();
