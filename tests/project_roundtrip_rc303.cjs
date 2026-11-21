const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const {openAsBlob}=require('node:fs');

async function main(){
  const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'bass-project-'));
  const data={settings:new Map(),songs:new Map()},cache=new Map();
  let enumerations=0,writes=0,failClose=false,permission='granted',holdClose;
  const folder={
    name:'Practice',queryPermission:async()=>permission,requestPermission:async()=>permission,
    async *entries(){enumerations++;for(const filename of await fs.readdir(tmp))yield [filename,handle(filename)];},
    async getFileHandle(filename,{create=false}={}){
      if(!create)try{await fs.access(path.join(tmp,filename));}catch{throw new DOMException('missing','NotFoundError');}
      return handle(filename);
    }
  };
  function handle(name){
    const file=path.join(tmp,name);
    return {kind:'file',async getFile(){const stat=await fs.stat(file);return new File([await openAsBlob(file)],name,{lastModified:stat.mtimeMs});},
      async createWritable(){
        writes++;const temp=file+'.writing',writer=await fs.open(temp,'w');let closed=false;
        return {async write(blob){await writer.writeFile(Buffer.from(await blob.arrayBuffer()));},
          async close(){if(holdClose)await holdClose;if(failClose)throw Error('No space for song');await writer.close();closed=true;await fs.rename(temp,file);},
          async abort(){if(!closed)await writer.close();await fs.rm(temp,{force:true});}};
      }};
  }
  const indexedDB={open(){const request={};setImmediate(()=>{
    request.result={close(){},transaction(name){
      const tx={};tx.objectStore=()=>({get:k=>op(()=>data[name].get(k)),put:(v,k)=>op(()=>data[name].set(k??v.id,v)),getAll:()=>op(()=>[...data[name].values()])});
      function op(action){const r={};setImmediate(()=>{try{r.result=action();tx.oncomplete?.();}catch(e){tx.error=e;tx.onerror?.();}});return r;}
      return tx;
    }};request.onsuccess();
  });return request;}};
  let metadataFailure=false,duration=250;
  class Audio extends EventTarget{
    constructor(){super();this.duration=duration;this.paused=true;}
    load(){if(this.src)queueMicrotask(()=>this.dispatchEvent(new Event(metadataFailure?'error':'loadedmetadata')));}
    pause(){this.paused=true;} removeAttribute(){this.src='';}
  }
  const sandbox={window:{dispatchEvent(){}},document:{getElementById:()=>null},TextEncoder,TextDecoderStream,
    Uint8Array,DataView,ArrayBuffer,Blob,File,URL,Audio,atob,crypto:webcrypto,Event,indexedDB,DOMException,
    setTimeout,clearTimeout,navigator:{storage:{}}};
  const ctx=vm.createContext(sandbox);
  const code=async file=>fs.readFile(file,'utf8');
  vm.runInContext(await code('library-source/project-json.js'),ctx);
  vm.runInContext(await code('library-source/library.js'),ctx);
  const lib=ctx.window.BassLibrary,filename='Never Lost test.json';
  let opened;
  // A playable four-minute-ten-second PCM source, with bass and higher pitches.
  const sampleRate=8000,source=Buffer.alloc(44+duration*sampleRate*2);
  source.write('RIFF');source.writeUInt32LE(source.length-8,4);source.write('WAVEfmt ',8);
  source.writeUInt32LE(16,16);source.writeUInt16LE(1,20);source.writeUInt16LE(1,22);
  source.writeUInt32LE(sampleRate,24);source.writeUInt32LE(sampleRate*2,28);source.writeUInt16LE(2,32);
  source.writeUInt16LE(16,34);source.write('data',36);source.writeUInt32LE(source.length-44,40);
  for(let i=0;i<duration*sampleRate;i++)source.writeInt16LE(Math.round(8000*Math.sin(i*2*Math.PI*62/sampleRate)+3500*Math.sin(i*2*Math.PI*440/sampleRate)),44+i*2);
  const project={format:'Bass Stem Studio Project',schemaVersion:2,projectName:'Song',source:{name:'fixture.wav',duration,audioBase64:source.toString('base64')},
    analysis:{notes:[{midi:35,start:0,end:1}],melody:{notes:[{midi:73,start:0,end:1}],done:[{start:0,end:duration}]},chords:[{start:0,end:2,label:'B'}]},settings:{practiceView:'bassroll'}};
  const backingSource=await code('fretflow-source/backing.js');
  let session=1,calls=[],saves=0,cancelAt,muted=false;
  const master=new Audio();
  function freshBacking(){
    vm.runInContext(backingSource,ctx);
    const backing=ctx.window.BassBacking;
    const gain=()=>({gain:{setTargetAtTime(){}},connect(){return this;}});
    backing.init({get:()=>({session,duration,loaded:true,busy:false,master,bassMuted:muted}),pause(){},update(){},setMuted(v){muted=v;},
      graph:()=>({ctx:{createGain:gain,createMediaElementSource:gain},bass:[]}),
      cacheKey:async()=>'mute-audio-v2:same-audio',readCache:async k=>cache.get(k),
      writePart:async(id,frames,parts)=>cache.set(id,{frames,parts}),removePart:async k=>cache.delete(k),
      writeCache:async(id,duration,blobs)=>cache.set(id,{duration,blobs}),
      encode:async blob=>Buffer.from(await blob.arrayBuffer()).toString('base64'),
      save(){saves++;},
      async extract(from,to,progress){
        calls.push(from);progress(50);
        if(cancelAt===calls.length){backing.cancel();return {};}
        const length=Math.ceil((to-from)*44100),channel=Float32Array.from({length},(_,i)=>.15*Math.sin((i+Math.round(from*44100))*2*Math.PI*62/44100));
        return {numberOfChannels:6,sampleRate:44100,length,getChannelData:()=>channel};
      }});
    return backing;
  }
  try{
    await fs.writeFile(path.join(tmp,filename),JSON.stringify(project));
    await fs.writeFile(path.join(tmp,'Older copy.json'),JSON.stringify(project));
    data.settings.set('folder',folder);lib.init({open:async f=>{opened=f;return true;}});
    await lib.openForAnalysis('folder',filename);
    const target=lib.targetFor(opened);
    assert.equal(target.filename,filename);
    let backing=freshBacking();cancelAt=3;
    await backing.prepareForSong();
    assert.equal(calls.length,3);assert.equal(saves,0);assert.equal(cache.size,2);
    session++;cancelAt=null;calls=[];backing=freshBacking();
    await backing.prepareForSong();
    assert.equal(calls.length,11,'resume skips the two finished passages');assert.equal(saves,1);
    assert(backing.state().vocalsReady);
    project.analysis.bassBacking=backing.exportData();
    let committed=false,release;
    holdClose=new Promise(r=>{release=r;});
    const writing=lib.saveAnalysisProject(project,target).then(r=>{committed=true;return r;});
    while(!writes)await new Promise(r=>setTimeout(r,10));
    assert(!committed,'no success before file close');
    await lib.openForAnalysis('folder','Older copy.json');
    assert.equal(opened.name,'Older copy.json','an unrelated file can open during a pending write');
    let sameOpened=false;
    const sameRead=lib.openForAnalysis('folder',filename).then(()=>{sameOpened=true;});
    await new Promise(r=>setImmediate(r));
    assert(!sameOpened,'a read of the file being written waits for its commit');
    release();holdClose=null;await sameRead;
    const result=await writing;
    assert.equal(result.target.filename,filename);assert.equal(enumerations,0,'no catalogue scan for the opened file');
    assert(result.target.size>175000000,'full length stereo WAV audio in portable JSON');
    assert.equal(JSON.parse(await fs.readFile(path.join(tmp,'Older copy.json'))).analysis.bassBacking,undefined);
    cache.clear();calls=[];session++;backing=freshBacking();
    await lib.openForAnalysis('folder',filename);
    const progress=[];
    const restored=await lib.readProject(opened,{playback:true,onProgress:p=>progress.push(p)});
    assert.equal(progress.at(-1),100);assert(progress.length>1);
    assert(restored.analysis.bassBacking.bassBase64 instanceof Blob,'opening the notes does not allocate the mute strings');
    restored.analysis.bassBacking=await ctx.BassProjectJSON.loadBacking(restored.analysis.bassBacking);
    assert.equal(restored.source.audioBase64,project.source.audioBase64);
    assert.equal(restored.analysis.notes[0].midi,35);assert.equal(restored.analysis.melody.notes[0].midi,73);
    assert.deepEqual(JSON.parse(JSON.stringify(restored.settings)),project.settings);
    await backing.restore(restored.analysis.bassBacking);await backing.prepareForSong();
    await backing.toggle('vocals');assert(backing.state().vocalsMuted);await backing.toggle('bass');assert(muted);
    assert.deepEqual(calls,[],'cold reopen and both mute buttons perform no separation');assert.equal(saves,1,'cold reopen does not write again');
    session++;backing=freshBacking();metadataFailure=true;
    await backing.restore(restored.analysis.bassBacking);assert(!backing.state().ready);assert(backing.state().canRetry);
    metadataFailure=false;await backing.toggle('vocals');assert(backing.state().vocalsMuted);assert.deepEqual(calls,[]);
    const small={...project,source:{...project.source,audioBase64:'QUVG'},analysis:{...project.analysis,bassBacking:null}};
    await fs.writeFile(path.join(tmp,'short.json'),JSON.stringify(small));
    await lib.openForAnalysis('folder','short.json');const smallTarget=lib.targetFor(opened);
    failClose=true;await assert.rejects(lib.saveAnalysisProject(small,smallTarget),/No space/);failClose=false;
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(tmp,'short.json'))),small);
    await lib.saveAnalysisProject(small,smallTarget);
    permission='denied';await assert.rejects(lib.saveAnalysisProject(small,smallTarget),/Reconnect the folder/);permission='granted';
    const deviceName='device.bassstudio',deviceBlob=lib.projectBlob(small);
    data.songs.set(deviceName,{id:deviceName,filename:deviceName,blob:deviceBlob});
    await lib.openForAnalysis('device',deviceName);const device=lib.targetFor(opened);
    await lib.saveAnalysisProject(small,device);
    assert.deepEqual(JSON.parse(await data.songs.get(deviceName).blob.text()),small);
    const parse=ctx.BassProjectJSON;
    const escaped=JSON.stringify({'short':'A\\B"C','large':'X'.repeat(70000),'keynote':'£🎹',array:[1,true,'end']});
    const bytes=new TextEncoder().encode(escaped);
    const chunked={size:20000000,stream:()=>new ReadableStream({start(c){for(let i=0;i<bytes.length;i+=5)c.enqueue(bytes.slice(i,i+5));c.close();}})};
    assert.deepEqual(JSON.parse(JSON.stringify(await parse.read(chunked))),JSON.parse(escaped));
    const controller=new AbortController();
    controller.abort();
    await assert.rejects(parse.playback(new File(['{}'],'cancel.json'),{signal:controller.signal}),{name:'AbortError'});
    const field='a'.repeat(65540),wide={format:'Project 🌍',prefix:'ü'.repeat(8*1024*1024),notes:[{title:'saved "take"'}],
      analysis:{bassBacking:{bassBase64:field,vocalsBase64:field}},other:{bassBase64:field}};
    const largeFile=new File([JSON.stringify(wide)],'unicode.json');
    const parsed=await parse.playback(largeFile);
    assert.equal(parsed.format,wide.format);assert.equal(parsed.other.bassBase64,field);
    assert.equal(parsed.notes[0].title,wide.notes[0].title);
    assert.equal((await parse.loadBacking(parsed.analysis.bassBacking)).vocalsBase64,field);
    console.log('PASS 4:10 portable JSON, interrupted preparation, exact folder/device saves, failed commit and retry, cold reopen, bass and melody data, both mutes and saved audio retry.');
  }finally{await fs.rm(tmp,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
