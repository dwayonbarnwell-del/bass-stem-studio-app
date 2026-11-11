const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const source=fs.readFileSync('library-source/library.js','utf8'),html=fs.readFileSync('index.html','utf8');
for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
assert(html.includes(source.trim()));assert(html.includes(fs.readFileSync('ai-source/piano.js','utf8').trim()));
const data={settings:new Map(),songs:new Map()},files=new Map();let writes=0;
const indexedDB={open(){const r={};setImmediate(()=>{r.result={close(){},transaction(name){const tx={};tx.objectStore=()=>({get:k=>req(()=>data[name].get(k)),getAll:()=>req(()=>[...data[name].values()]),put:(v,k)=>req(()=>data[name].set(k??v.id,v))});function req(fn){const q={};setImmediate(()=>{try{q.result=fn();tx.oncomplete?.();}catch(e){tx.error=e;tx.onerror?.();}});return q;}return tx;}};r.onsuccess();});return r;}};
const handle=name=>({kind:'file',getFile:async()=>new File([files.get(name)],name,{lastModified:123}),createWritable:async()=>({write:async b=>{files.set(name,b);writes++;},close:async()=>{},abort:async()=>{}})});
const folder={name:'Songs',queryPermission:async()=> 'granted',async *entries(){for(const name of files.keys())yield [name,handle(name)];},getFileHandle:async(name,opt)=>{if(!files.has(name)){if(!opt?.create)throw new DOMException('missing','NotFoundError');files.set(name,new Blob());}return handle(name);}};
const ctx={File,Blob,DOMException,TextEncoder,Uint8Array,crypto:webcrypto,indexedDB,console,setTimeout,Event,navigator:{storage:{}},document:{getElementById:()=>null},window:{dispatchEvent(){},BassDialog:{confirm:async()=>true}}};vm.createContext(ctx);vm.runInContext(source.replace('return {init,show,','return {refresh,uniqueSongs,matchingTarget,addFiles,getRows:()=>rows,init,show,'),ctx);const lib=ctx.window.BassLibrary;
const project=(audio,title='Song')=>({format:'Bass Stem Studio Project',schemaVersion:2,projectName:title,source:{audioBase64:audio,name:'song.mp3',duration:200},analysis:{notes:[{start:1,end:2,midi:40}],chords:[{manual:true}],structure:{segments:[{start:0,end:200}]},manualCorrections:[{value:'keep'}]},settings:{sections:{Verse:{start:0,end:200}}}});
const blob=p=>new Blob([JSON.stringify(p)]);
(async()=>{
 const p=project('AAAA');data.songs.set('song.bassstudio',{id:'song.bassstudio',filename:'song.bassstudio',blob:blob(p)});files.set('original.json',blob(p));files.set('original (1).json',blob(p));files.set('different.json',blob(project('BBBB')));data.settings.set('folder',folder);lib.init({});await lib.refresh();assert.equal(lib.getRows().length,2,'folder copies plus device copy shown once by audio, different recording retained');
 await lib.addFiles([new File([blob(p)],'renamed.json')]);assert.equal(files.size,3);assert.equal(writes,0,'reimport must not write duplicates');
 const updated=project('AAAA');updated.analysis.melody={notes:[{midi:60,start:0,end:1}],done:[{start:0,end:200}]};updated.analysis.chords=[];await lib.saveMelodyProject(updated);const saved=JSON.parse(await files.get('original.json').text());assert.deepEqual(saved.analysis.chords,p.analysis.chords);assert.deepEqual(saved.settings,p.settings);assert.equal(saved.analysis.melody.notes.length,1);assert.equal(files.size,3,'melody updates existing JSON');
 await lib.save(project('CCCC'),blob(project('CCCC')),{dir:folder,filename:'original.json'});assert.equal(files.size,4,'different recording with same filename is protected');assert.equal(JSON.parse(await files.get('original.json').text()).source.audioBase64,'AAAA');
 console.log('PASS library identity, duplicate imports, folder/device count, JSON melody updates and different-recording protection');
})().catch(e=>{console.error(e);process.exitCode=1});
