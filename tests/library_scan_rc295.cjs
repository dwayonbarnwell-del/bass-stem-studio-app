const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const source=fs.readFileSync('library-source/library.js','utf8');
assert(fs.readFileSync('index.html','utf8').includes(source.trim()),'inline library must match maintained source');
const data={settings:new Map(),songs:new Map()},files=new Map(),status={textContent:''};let writes=0,reads=0,modified=1;
const indexedDB={open(){const r={};setImmediate(()=>{r.result={close(){},transaction(name){const tx={};tx.objectStore=()=>({get:k=>req(()=>data[name].get(k)),getAll:()=>req(()=>[...data[name].values()]),put:(v,k)=>req(()=>data[name].set(k??v.id,v))});function req(fn){const q={};setImmediate(()=>{try{q.result=fn();tx.oncomplete?.();}catch(e){tx.error=e;tx.onerror?.();}});return q;}return tx;}};r.onsuccess();});return r;}};
const handle=name=>({kind:'file',getFile:async()=>{const f=new File([files.get(name)],name,{lastModified:modified}),text=f.text.bind(f);f.text=()=>{reads++;return text();};return f;},createWritable:async()=>({write:async b=>{files.set(name,b);writes++;},close:async()=>{}})});
const folder={name:'Songs and charts',queryPermission:async()=> 'granted',async *entries(){for(const name of files.keys())yield [name,handle(name)];}};
const ctx={File,Blob,DOMException,TextEncoder,Uint8Array,crypto:webcrypto,indexedDB,console,setTimeout:(fn,ms)=>setTimeout(fn,ms===15000?100:ms),clearTimeout,Event,navigator:{storage:{}},document:{getElementById:id=>id==='libraryStatus'?status:null},window:{dispatchEvent(){}}};
vm.createContext(ctx);vm.runInContext(source.replace('return {init,show,','return {refresh,addFiles,stopScan,chooseFolder,useDevice,rowFile,isScanning:()=>scanning,getRows:()=>rows,init,show,'),ctx);const lib=ctx.window.BassLibrary;
const project={format:'Bass Stem Studio Project',schemaVersion:2,projectName:'Saved song',source:{audioBase64:'AAAA',name:'song.mp3',duration:12},analysis:{notes:[{midi:40,start:0,end:1}],chords:[{chord:'C'}]}};
const names=['BassStem_SongChords_2026-11-08.json','BassStem_Praise_Worship_Number_Charts.json'];
const charts=[{format:'BassStemSongReferences',changes:[]},{format:'BassStemSongChordPack',songs:[]}];
const put=(name,value)=>files.set(name,JSON.stringify(value));
const keepAlive=setInterval(()=>{},1000);
(async()=>{
 put('one.bassstudio',project);data.settings.set('folder',folder);lib.init({});await lib.refresh();
 const scanned=lib.getRows()[0];
 let retries=0;
 const reopened=await lib.rowFile({...scanned,handle:{getFile:async()=>{throw new DOMException('Stale file','NotReadableError');}},
   dir:{getFileHandle:async name=>{retries++;return handle(name);}}});
 assert.equal(reopened.name,'one.bassstudio');assert.equal(retries,1,'failed file handle is refreshed without scanning the folder');
 assert.deepEqual(JSON.parse(await reopened.text()),project);
 const before=reads;await lib.refresh();assert.equal(reads,before,'unchanged files are not parsed or hashed again');
 const originalEntries=folder.entries;let release;
 folder.entries=()=>({[Symbol.asyncIterator](){return this;},next(){return new Promise(r=>release=r);}});
 const pending=lib.refresh();const result=pending.catch(e=>e);
 await new Promise(r=>setTimeout(r,15));assert.equal(lib.getRows().length,1,'cached songs displayed before enumeration');assert(lib.isScanning());
 lib.stopScan();assert.equal((await result).name,'AbortError');assert(!lib.isScanning());
 let newReads=0;const other={name:'New folder',queryPermission:async()=> 'granted',async *entries(){newReads++;yield ['two.bassstudio',{kind:'file',getFile:async()=>new File([JSON.stringify({...project,projectName:'New song',source:{...project.source,audioBase64:'BBBB'}})],'two.bassstudio',{lastModified:2})}];}};
 ctx.window.showDirectoryPicker=()=>Promise.resolve(other);await lib.chooseFolder();
 await new Promise(r=>setTimeout(r,30));assert.equal(lib.getRows()[0].title,'New song');
 release({done:false,value:['old.bassstudio',handle('one.bassstudio')]});await new Promise(r=>setTimeout(r,10));assert.equal(lib.getRows()[0].title,'New song','late old-folder scan cannot replace new folder results');
 assert.equal(data.settings.get('folder'),other);assert(!data.settings.get('index')['one.bassstudio']);
 // A stalled file is bounded, with earlier results cached for the next visit.
 other.entries=async function*(){yield ['two.bassstudio',{kind:'file',getFile:()=>new Promise(()=>{})}];};
 await assert.rejects(lib.refresh(),{name:'TimeoutError'});assert(!lib.isScanning());assert.equal(lib.getRows()[0].title,'New song');assert.match(status.textContent,/Refresh or change save folder/);
 await lib.useDevice();await new Promise(r=>setTimeout(r,10));assert.equal(data.settings.get('folder'),null);assert.equal(lib.getRows().length,0);
 // Permission checks are bounded too, and no longer block initialisation.
 data.settings.set('folder',{name:'Unavailable',queryPermission:()=>new Promise(()=>{})});lib.init({});
 await assert.rejects(lib.refresh(),{name:'TimeoutError'});assert(!lib.isScanning());
 assert.equal(writes,0,'scanning never writes to song files');
 console.log('PASS cached-first scan, cache reuse, cancellation, folder switch, stale results, stalled file/permission timeouts and no song writes.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>clearInterval(keepAlive));
