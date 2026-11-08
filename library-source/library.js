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
      filename:file.name,size:file.size,modified:file.lastModified||Date.now(),savedAt:clean(p.savedAt)};
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
    el('libraryLocation').textContent=folder?'Folder: '+folder.name+(folderAccess==='ready'?' · Connected':folderAccess==='reconnect'?' · Permission needed':''):'Saved on this device';
    el('libraryHint').textContent=folder?(folderAccess==='reconnect'?'Your folder is remembered. Allow access when prompted, or select Reconnect folder. Choose “Allow on every visit” if your browser offers it.':'Projects stay in this folder. Select Refresh after adding files outside the app.'):'Download backups before clearing browser data. Choose a folder to keep projects as normal files.';
    el('libraryDevice').hidden=!folder;
    el('libraryReconnect').hidden=!folder;
    el('libraryChoose').hidden=typeof window.showDirectoryPicker!=='function';
    if(!window.showDirectoryPicker&&!folder)el('libraryHint').textContent='This browser cannot remember a normal folder. Projects stay in this browser; download backups before clearing its data.';
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
      details.textContent=[row.artist,row.key&&row.key!=='—'?row.key:'',row.bpm?Math.round(row.bpm)+' BPM':'',row.duration?minutes+':'+seconds:''].filter(Boolean).join(' · ')||row.filename;
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
    const token=++scan;await ready;rows=[];render();status('Loading saved songs…');
    if(!folder){
      rows=await store('songs','readonly',s=>s.getAll());
    }else{
      const dir=folder;
      if(!await permission(dir,'read')){folderAccess='reconnect';status('Folder remembered. Select Reconnect folder to allow access. Your saved songs are unchanged.');render();return;}
      folderAccess='ready';
      const found=[],next={};let skipped=0;
      for await(const [name,handle] of dir.entries()){
        if(token!==scan||dir!==folder)return;
        if(handle.kind!=='file'||!SUPPORTED.test(name))continue;
        try{
          const f=await handle.getFile(),cached=index[name];
          const meta=cached&&cached.size===f.size&&cached.modified===f.lastModified?cached:metadata(JSON.parse(await f.text()),f);
          next[name]=meta;found.push({...meta,handle,file:f});
        }catch{skipped++;}
      }
      if(token!==scan||dir!==folder)return;
      rows=found;index=next;
      await put('index',index).catch(()=>{});
      status(skipped?skipped+' unreadable or unsupported '+(skipped===1?'file was':'files were')+' skipped.':'');render();return;
    }
    if(token!==scan)return;status('');render();
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
  function build(){
    if(dialog)return;
    dialog=document.createElement('dialog');dialog.id='bassLibraryDialog';dialog.className='bass-library';dialog.setAttribute('aria-labelledby','libraryTitle');
    dialog.innerHTML='<div class="library-heading"><div><h2 id="libraryTitle">Song library</h2><p id="libraryLocation"></p></div><button id="libraryClose" type="button">Close</button></div><div class="library-toolbar"><button id="libraryChoose" type="button">Choose folder</button><button id="libraryReconnect" type="button">Reconnect folder</button><button id="libraryDevice" type="button">On this device</button><button id="libraryAdd" type="button">Add saved files</button><button id="libraryBatch" type="button">Batch ZIP</button><button id="libraryRefresh" type="button">Refresh</button></div><p id="libraryHint"></p><div class="library-filters"><div><label for="librarySearch">Search songs</label><input id="librarySearch" type="search" placeholder="Title, artist, key or BPM" autocomplete="off"></div><div><label for="librarySort">Sort by</label><select id="librarySort"><option value="recent">Recently saved</option><option value="name">Song name</option></select></div></div><div class="library-summary"><span id="libraryCount"></span><span id="libraryStatus" role="status" aria-live="polite"></span></div><ul id="librarySongs"></ul><input id="libraryFiles" type="file" accept=".bassstudio,.bssproject,.json,application/json" multiple hidden>';
    document.body.append(dialog);
    el('libraryClose').onclick=()=>dialog.close();
    dialog.addEventListener('close',()=>document.getElementById('importProjectBtn')?.focus());
    el('librarySearch').oninput=render;el('librarySort').onchange=render;
    el('libraryChoose').onclick=()=>run(chooseFolder);el('libraryDevice').onclick=()=>run(useDevice);
    el('libraryRefresh').onclick=()=>run(refresh);el('libraryReconnect').onclick=()=>run(reconnect);
    el('libraryAdd').onclick=()=>{el('libraryFiles').value='';el('libraryFiles').click();};
    el('libraryBatch').onclick=()=>{dialog.close();window.BassBatch?.show();};
    el('libraryFiles').onchange=e=>{const files=Array.from(e.target.files||[]);e.target.value='';void run(()=>addFiles(files));};
  }
  async function show(){
    build();if(!dialog.open)dialog.showModal();el('librarySearch').focus();
    // Open Library is a user gesture: request access now, not after the audio work.
    const access=ensureBatchAccess();
    await run(async()=>{await access;await refresh();});
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
  return {init,show,prepareSave,save,hasProject,ensureBatchAccess,errorText,chartProjects,chartProject};
})();
