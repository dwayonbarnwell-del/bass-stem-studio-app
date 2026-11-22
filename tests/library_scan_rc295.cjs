const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const source=fs.readFileSync('library-source/library.js','utf8');
const html=fs.readFileSync('index.html','utf8');
assert(html.includes(source.trim()),'inline library must match maintained source');
assert.match(source,/<select id="librarySort"><option value="name">Alphabetical \(A–Z\)<\/option><option value="recent">/);
const data={settings:new Map(),songs:new Map()},files=new Map(),status={textContent:''};let writes=0,reads=0,modified=1;
const indexedDB={open(){const r={};setImmediate(()=>{r.result={close(){},transaction(name){const tx={};tx.objectStore=()=>({get:k=>req(()=>data[name].get(k)),getAll:()=>req(()=>[...data[name].values()]),put:(v,k)=>req(()=>data[name].set(k??v.id,v))});function req(fn){const q={};setImmediate(()=>{try{q.result=fn();tx.oncomplete?.();}catch(e){tx.error=e;tx.onerror?.();}});return q;}return tx;}};r.onsuccess();});return r;}};
const handle=name=>({kind:'file',getFile:async()=>{const f=new File([files.get(name)],name,{lastModified:modified}),text=f.text.bind(f);f.text=()=>{reads++;return text();};return f;},createWritable:async()=>({write:async b=>{files.set(name,b);writes++;},close:async()=>{}})});
const folder={name:'Songs and charts',queryPermission:async()=> 'granted',async *entries(){for(const name of files.keys())yield [name,handle(name)];}};
const ctx={File,Blob,DOMException,TextEncoder,Uint8Array,crypto:webcrypto,indexedDB,console,setTimeout:(fn,ms)=>setTimeout(fn,ms===15000?100:ms),clearTimeout,Event,navigator:{storage:{}},document:{getElementById:id=>id==='libraryStatus'?status:null},window:{dispatchEvent(){}}};
vm.createContext(ctx);vm.runInContext(source.replace('return {init,show,','return {refresh,addFiles,stopScan,chooseFolder,useDevice,rowFile,pickProjects,filterRows,isScanning:()=>scanning,getRows:()=>rows,init,show,'),ctx);const lib=ctx.window.BassLibrary;
const project={format:'Bass Stem Studio Project',schemaVersion:2,projectName:'Saved song',source:{audioBase64:'AAAA',name:'song.mp3',duration:12},analysis:{notes:[{midi:40,start:0,end:1}],chords:[{chord:'C'}]}};
const names=['BassStem_SongChords_2026-11-08.json','BassStem_Praise_Worship_Number_Charts.json'];
const charts=[{format:'BassStemSongReferences',changes:[]},{format:'BassStemSongChordPack',songs:[]}];
const put=(name,value)=>files.set(name,JSON.stringify(value));
const keepAlive=setInterval(()=>{},1000);
(async()=>{
 const matched=[];
 put('one.bassstudio',project);data.settings.set('folder',folder);
 lib.init({open:async file=>{matched.push(file.name);return true;}});
 await lib.refresh();
 const scanned=lib.getRows()[0];
 let retries=0;
 const reopened=await lib.rowFile({...scanned,handle:{getFile:async()=>{throw new DOMException('Stale file','NotReadableError');}},
   dir:{getFileHandle:async name=>{retries++;return handle(name);}}});
 assert.equal(reopened.name,'one.bassstudio');assert.equal(retries,1,'failed file handle is refreshed without scanning the folder');
 assert.deepEqual(JSON.parse(await reopened.text()),project);
 const before=reads;await lib.refresh();assert.equal(reads,before,'unchanged files are not parsed or hashed again');

 const start=html.indexOf('  async function chooseImportFile(');
 vm.runInContext(html.slice(start,html.indexOf('\n  }',start)+4),ctx);
 let fallbackClicks=0;
 const input={multiple:false,value:'',click(){fallbackClicks++;}};
 ctx.fileInput=input;
 ctx.projectFileInput=input;
 ctx.window.BassMedia={picker:[{description:'Audio',accept:{'audio/*':['.mp3','.wav']}}]};
 ctx.importAudioCheckingLibrary=file=>lib.checkAudioImport(file);
 const selectedProjects=[];
 ctx.importBassStudioProject=file=>selectedProjects.push(file.name);
 ctx.window.showOpenFilePicker=async options=>{
   if(options.id==='bass-studio-audio'){
     assert.equal(options.startIn,undefined,'audio uses its own remembered folder');
     const name=matched.length?'song.wav':'song.mp3';
     return [{getFile:async()=>new File(['audio fixture'],name)}];
   }
   assert.equal(options.id,'bass-studio-projects');
   assert.equal(options.startIn,folder,'project browsing starts in the connected save folder');
   assert.equal(options.multiple,input.multiple);
   return [handle('one.bassstudio')];
 };
 await ctx.chooseImportFile('audio');
 await ctx.chooseImportFile('audio');
 assert.deepEqual(matched,['one.bassstudio','one.bassstudio'],'MP3 and WAV reopen the matching analysed song');
 assert.equal(data.settings.get('folder'),folder);
 await ctx.chooseImportFile('project');
 input.multiple=true;
 await lib.pickProjects(input,([file])=>selectedProjects.push(file.name));
 assert.deepEqual(selectedProjects,['one.bassstudio','one.bassstudio']);
 ctx.window.showOpenFilePicker=async()=>{throw new DOMException('Picker cancelled','AbortError');};
 await lib.pickProjects(input,()=>assert.fail('Cancel must not select a project'));
 assert.equal(fallbackClicks,0);
 delete ctx.window.showOpenFilePicker;
 await lib.pickProjects(input,()=>assert.fail('The fallback waits for a file selection'));
 assert.equal(fallbackClicks,1);
 const sorted=[{title:'Zebra',modified:2},{title:'Alpha',modified:1}];
 assert.equal(lib.filterRows(sorted,'','name')[0].title,'Alpha');
 assert.equal(lib.filterRows(sorted,'','recent')[0].title,'Zebra');

 const originalEntries=folder.entries;let release;
 folder.entries=()=>({[Symbol.asyncIterator](){return this;},next(){return new Promise(r=>release=r);}});
 const pending=lib.refresh();const result=pending.catch(e=>e);
 await new Promise(r=>setTimeout(r,15));assert.equal(lib.getRows().length,1,'cached songs displayed before enumeration');assert(lib.isScanning());
 lib.stopScan();assert.equal((await result).name,'AbortError');assert(!lib.isScanning());
 let newReads=0;const other={name:'New folder',queryPermission:async()=> 'granted',async *entries(){newReads++;yield ['two.bassstudio',{kind:'file',getFile:async()=>new File([JSON.stringify({...project,projectName:'New song',source:{...project.source,audioBase64:'BBBB'}})],'two.bassstudio',{lastModified:2})}];}};
 ctx.window.showDirectoryPicker=async options=>{
   assert.equal(options.id,'bass-studio-library');
   assert.equal(options.startIn,folder);
   return other;
 };
 await lib.chooseFolder();
 await new Promise(r=>setTimeout(r,30));assert.equal(lib.getRows()[0].title,'New song');
 release({done:false,value:['old.bassstudio',handle('one.bassstudio')]});await new Promise(r=>setTimeout(r,10));assert.equal(lib.getRows()[0].title,'New song','late old-folder scan cannot replace new folder results');
 assert.equal(data.settings.get('folder'),other);assert(!data.settings.get('index')['one.bassstudio']);
 // A stalled file is bounded, with earlier results cached for the next visit.
 other.entries=async function*(){yield ['two.bassstudio',{kind:'file',getFile:()=>new Promise(()=>{})}];};
 await lib.refresh();assert(!lib.isScanning());assert.equal(lib.getRows()[0].title,'New song');assert.match(status.textContent,/could not be indexed/);
 await lib.useDevice();await new Promise(r=>setTimeout(r,10));assert.equal(data.settings.get('folder'),null);assert.equal(lib.getRows().length,0);
 // Permission checks are bounded too, and no longer block initialisation.
 data.settings.set('folder',{name:'Unavailable',queryPermission:()=>new Promise(()=>{})});lib.init({});
 await assert.rejects(lib.refresh(),{name:'TimeoutError'});assert(!lib.isScanning());
 assert.equal(writes,0,'scanning never writes to song files');
 console.log('PASS independent pickers, MP3/WAV reuse, alphabetical sorting, scan cache, folder switch, cancellation and timeouts.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>clearInterval(keepAlive));
