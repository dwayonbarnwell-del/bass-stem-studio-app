/* RC195: local saved-project library. No audio or index is sent to a server. */
window.BassLibrary=(()=>{
  const DB='bass-studio-library-v1',SUPPORTED=/\.(bassstudio|bssproject|json)$/i;
  let dbPromise,ready,folder=null,index={},rows=[],hooks={},dialog,busy=false,scan=0,downloadURLs=[],folderAccess='unknown';
  const el=id=>document.getElementById(id);
  const abort=()=>new DOMException('Cancelled','AbortError');
  const clean=v=>String(v||'').trim();
  function database(){
    if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{
      const r=indexedDB.open(DB,1);
      r.onupgradeneeded=()=>{r.result.createObjectStore('settings');r.result.createObjectStore('songs',{keyPath:'id'});};
      r.onsuccess=()=>{r.result.onversionchange=()=>r.result.close();resolve(r.result);};
      r.onerror=()=>reject(r.error);
      r.onblocked=()=>reject(Error('Close other Bass Stem tabs, then try again.'));
    }).catch(e=>{dbPromise=null;throw e;});
    return dbPromise;
  }
  async function store(name,mode,action){
    const db=await database();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(name,mode),request=action(tx.objectStore(name));
      tx.oncomplete=()=>resolve(request?.result);
      tx.onerror=tx.onabort=()=>reject(tx.error||request?.error||Error('Could not save on this device.'));
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
      hasChordAnalysis:Array.isArray(p.analysis?.chords)&&p.analysis.chords.length>0,
      hasBassAnalysis:Array.isArray(p.analysis?.notes)&&p.analysis.notes.length>0};
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
    return list.filter(r=>words.every(w=>[r.title,r.artist,r.filename,r.key,r.bpm].join(' ').toLocaleLowerCase().includes(w)))
      .sort((a,b)=>sort==='name'?a.title.localeCompare(b.title):((Date.parse(b.savedAt)||b.modified)-(Date.parse(a.savedAt)||a.modified))||a.title.localeCompare(b.title));
  }
  function render(){
    if(!dialog)return;paintLocation();
    const list=el('librarySongs');
    const oldURLs=downloadURLs;downloadURLs=[];setTimeout(()=>oldURLs.forEach(url=>URL.revokeObjectURL(url)),60000);
    list.replaceChildren();
    const shown=filterRows(rows,el('librarySearch').value,el('librarySort').value);
    el('libraryCount').textContent=shown.length+' '+(shown.length===1?'song':'songs');
    if(!shown.length){const p=document.createElement('p');p.className='library-empty';p.textContent=rows.length?'No songs match your search.':'No saved songs here yet. Add saved files, or analyse a song and select Save.';list.append(p);}
    for(const row of shown){
      const item=document.createElement('li'),info=document.createElement('div'),title=document.createElement('strong'),details=document.createElement('span'),actions=document.createElement('div');
      title.textContent=row.title;
      const minutes=Math.floor(row.duration/60),seconds=Math.floor(row.duration%60).toString().padStart(2,'0');
      details.textContent=[row.artist,row.key&&row.key!=='—'?row.key:'',row.bpm?Math.round(row.bpm)+' BPM':'',row.duration?minutes+':'+seconds:'',row.storageLabel].filter(Boolean).join(' · ')||row.filename;
      info.className='library-song-info';info.append(title,details);actions.className='library-song-actions';
      const open=document.createElement('button');open.type='button';open.textContent='Open';open.setAttribute('aria-label','Open '+row.title);open.disabled=busy;open.onclick=()=>run(()=>openRow(row));actions.append(open);
      const download=document.createElement('a');download.className='library-download';download.textContent='Download';download.setAttribute('aria-label','Download '+row.title);
      download.href=URL.createObjectURL(row.file||row.blob);downloadURLs.push(download.href);download.download=row.filename;
      download.onclick=e=>{if(busy)e.preventDefault();else status('Download requested for '+row.title+'.');};actions.append(download);
      item.append(info,actions);list.append(item);
    }
    for(const id of ['libraryChoose','libraryDevice','libraryReconnect','libraryRefresh','libraryAdd','libraryBatch'])el(id).disabled=busy;
  }
  async function run(fn){
    if(busy)return;busy=true;render();
    try{await fn();}catch(e){if(e?.name!=='AbortError')status(errorText(e));}
    finally{busy=false;render();}
  }
  async function permission(handle,mode,request=false){
    if(await handle.queryPermission({mode})==='granted')return true;
    return request&&await handle.requestPermission({mode})==='granted';
  }
  async function refresh(){
    const token=++scan;await ready;rows=[];render();status('Checking saved songs…');
    const deviceRows=(await store('songs','readonly',s=>s.getAll())||[])
      .filter(r=>r?.filename&&SUPPORTED.test(r.filename))
      .map(r=>({...r,storageLabel:'In app'}));
    if(token!==scan)return;
    if(!folder){rows=deviceRows;status('');render();return;}
    const dir=folder;
    try{
      if(!await permission(dir,'read')){
        folderAccess='reconnect';rows=deviceRows;
        status('Tap Reconnect folder to see saved songs there.');render();return;
      }
      folderAccess='ready';
      const found=[],next={};let skipped=0;
      for await(const [name,handle] of dir.entries()){
        if(token!==scan||dir!==folder)return;
        if(handle.kind!=='file'||!SUPPORTED.test(name))continue;
        try{
          const file=await handle.getFile(),cached=index[name];
          const meta=cached&&cached.size===file.size&&cached.modified===file.lastModified
            ?cached:metadata(JSON.parse(await file.text()),file);
          next[name]=meta;found.push({...meta,handle,file,storageLabel:'Save folder'});
        }catch{skipped++;}
      }
      if(token!==scan||dir!==folder)return;
      rows=[...found,...deviceRows];index=next;
      await put('index',index).catch(()=>{});
      status(skipped?skipped+' unreadable saved '+(skipped===1?'file':'files')+' skipped.':'');
      render();
    }catch(error){
      if(token!==scan||dir!==folder)return;
      folderAccess='reconnect';rows=deviceRows;
      status('Could not read the save folder. Tap Reconnect folder. Your saved songs remain available.');
      render();
    }
  }
  async function chooseFolder(){
    // The picker must run directly from the button gesture, before other awaits.
    const dir=await window.showDirectoryPicker({id:'bass-studio-library',mode:'readwrite'});
    await ready;
    await put('folder',dir);await put('index',{});
    folder=dir;folderAccess='ready';index={};await refresh();
  }
  async function useDevice(){await put('folder',null);folder=null;folderAccess='device';index={};await refresh();}
  async function reconnect(){
    if(folder){
      try{if(!await permission(folder,'readwrite',true))throw Error('Access was not granted.');folderAccess='ready';}
      catch(e){folderAccess='reconnect';throw Error('Folder permission was not granted. Your saved files are unchanged.');}
    }
    await refresh();
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
  async function save(project,blob,target){
    const f=new File([blob],target.filename,{type:'application/json',lastModified:Date.now()}),meta=metadata(project,f);
    if(target.dir){
      const handle=await target.dir.getFileHandle(target.filename,{create:true});
      const stream=await handle.createWritable();
      try{await stream.write(blob);await stream.close();}catch(e){try{await stream.abort();}catch{}throw e;}
      if(target.dir===folder){index[target.filename]=meta;await put('index',index).catch(()=>{});}
    }else{
      await store('songs','readwrite',s=>s.put({...meta,id:target.id,blob}));
      // This is advisory: some browsers do not grant persistent storage.
      try{void navigator.storage?.persist?.().catch(()=>{});}catch{}
    }
    if(dialog?.open)await refresh().catch(e=>status(errorText(e)));
    window.dispatchEvent(new Event('bass-stem:project-saved'));
    return target.dir?'folder “'+target.dir.name+'”':'this device';
  }
  async function rowFile(row){
    if(row.handle)return row.handle.getFile();
    const saved=await store('songs','readonly',s=>s.get(row.id));
    if(!saved?.blob)throw Error('This saved song is no longer available.');
    return new File([saved.blob],saved.filename,{type:'application/json'});
  }
  async function openRow(row){
    if(hooks.isBusy?.())throw Error('Wait for the current song to finish, then open another.');
    status('Opening '+row.title+'…');
    const ok=await hooks.open(await rowFile(row));
    if(ok){dialog.close();return;}status('The song could not be opened. Check the message on the main screen.');
  }
  async function addFiles(files){
    let added=0,failed=0,cancelled=0;
    for(const file of files){
      try{
        status('Adding '+file.name+'…');
        const p=JSON.parse(await file.text());metadata(p,file);
        const target=await prepareSave(clean(p.projectName)||file.name.replace(SUPPORTED,''));
        await save(p,file,target);added++;
      }catch(e){if(e?.name==='AbortError')cancelled++;else failed++;}
    }
    await refresh();status(added+' added'+(cancelled?' · '+cancelled+' cancelled':'')+(failed?' · '+failed+' could not be added; check the file format, folder access and free space.':'.'));
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
    const choice=await chooseSavedVersion(file,found.matches);
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
          meta={...entry,...metadata(JSON.parse(await file.text()),file)};
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
              if(!info||info.size!==file.size||info.modified!==file.lastModified
                ||typeof info.hasBassAnalysis!=='boolean'||typeof info.hasChordAnalysis!=='boolean'){
                info=metadata(JSON.parse(await file.text()),file);
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
      if(!folder||!await permission(folder,'read'))throw Error('Open Library and reconnect your saved folder first.');
      const handle=await folder.getFileHandle(id);
      file=await handle.getFile();
    }else{
      const record=await store('songs','readonly',s=>s.get(String(id).toLowerCase()));
      if(!record?.blob)throw Error('This saved song is not available on the device.');
      file=new File([record.blob],record.filename,{type:'application/json'});
    }
    return !!await hooks.open(file);
  }

  function build(){
    if(dialog)return;
    dialog=document.createElement('dialog');dialog.id='bassLibraryDialog';dialog.className='bass-library';dialog.setAttribute('aria-labelledby','libraryTitle');
    dialog.innerHTML='<div class="library-heading"><div><h2 id="libraryTitle">Song library</h2><p id="libraryLocation"></p></div><button id="libraryClose" type="button">Close</button></div><div class="library-toolbar"><button id="libraryChoose" type="button">Choose save folder</button><button id="libraryReconnect" type="button">Reconnect folder</button><button id="libraryDevice" type="button">Save in app</button><button id="libraryAdd" type="button">Import saved file</button><button id="libraryBatch" type="button">Batch ZIP</button><button id="libraryRefresh" type="button">Refresh</button></div><p id="libraryHint"></p><div class="library-filters"><div><label for="librarySearch">Search songs</label><input id="librarySearch" type="search" placeholder="Title, artist, key or BPM" autocomplete="off"></div><div><label for="librarySort">Sort by</label><select id="librarySort"><option value="recent">Recently saved</option><option value="name">Song name</option></select></div></div><div class="library-summary"><span id="libraryCount"></span><span id="libraryStatus" role="status" aria-live="polite"></span></div><ul id="librarySongs"></ul><input id="libraryFiles" type="file" accept=".bassstudio,.bssproject,.json,application/json" multiple hidden>';
    document.body.append(dialog);
    el('libraryClose').onclick=()=>dialog.close();
    dialog.addEventListener('close',()=>document.getElementById('importProjectBtn')?.focus());
    el('librarySearch').oninput=render;el('librarySort').onchange=render;
    el('libraryChoose').onclick=()=>run(chooseFolder);el('libraryDevice').onclick=()=>run(useDevice);
    el('libraryRefresh').onclick=()=>run(refresh);el('libraryReconnect').onclick=()=>run(reconnect);
    el('libraryAdd').onclick=()=>{el('libraryFiles').value='';el('libraryFiles').click();};
    el('libraryBatch').onclick=()=>{window.BassBatch?.show();};
    el('libraryFiles').onchange=e=>{const files=Array.from(e.target.files||[]);e.target.value='';void run(()=>addFiles(files));};
  }
  async function show(){
    build();if(!dialog.open)dialog.showModal();el('librarySearch').focus();
    // Reuse the remembered folder automatically if access is still granted.
    // If the browser needs permission again, ask while Library is opening.
    await run(async()=>{
      await ready;
      if(folder)try{if(!await permission(folder,'read'))await permission(folder,'read',true);}catch{}
      await refresh();
    });
  }
  function init(options){
    hooks=options;
    ready=(async()=>{
      folder=await get('folder')||null;
      index=await get('index')||{};
      if(folder){
        try{folderAccess=await permission(folder,'readwrite')?'ready':'reconnect';}
        catch{folderAccess='reconnect';}
      }else folderAccess='device';
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
    const file=await rowFile(row),project=JSON.parse(await file.text());
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
  async function saveMelodyProject(project){
    await ready;
    let filename=String(project.projectName||'Song').replace(/[\\/:*?"<>|]+/g,'_').trim().slice(0,100)+'.bassstudio';
    let dir=folder&&await permission(folder,'readwrite')?folder:null;
    for(let i=0;i<100;i++){
      const id=filename.toLocaleLowerCase();let existing=null;
      if(dir){try{existing=await (await dir.getFileHandle(filename)).getFile();}catch(e){if(e.name!=='NotFoundError')throw e;}}
      else existing=(await store('songs','readonly',s=>s.get(id)))?.blob;
      if(existing){
        let previous;try{previous=JSON.parse(await existing.text());}catch{}
        if(!previous?.source?.audioBase64||previous.source.audioBase64!==project.source.audioBase64){filename=String(project.projectName||'Song').replace(/[\\/:*?"<>|]+/g,'_').slice(0,84)+' - melody '+(i+1)+'.bassstudio';continue;}
      }
      await save(project,new Blob([JSON.stringify(project)],{type:'application/json'}),{dir,filename,id});
      return dir?'folder':'device';
    }
    throw Error('Save melody manually');
  }
  return {init,show,prepareSave,save,saveMelodyProject,hasProject,ensureBatchAccess,errorText,chartProjects,chartProject,checkAudioImport,analysisSummary,openForAnalysis};
})();
