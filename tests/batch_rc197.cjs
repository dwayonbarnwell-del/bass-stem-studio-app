const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {deflateRawSync}=require('node:zlib'),{File}=require('node:buffer');
const source=fs.readFileSync(__dirname+'/../batch-source/batch.js','utf8');
const page=fs.readFileSync(__dirname+'/../index.html','utf8');
assert(page.includes(source.trim()),'Updated batch must be embedded in the live app');
assert(page.includes('checkBatchRunPodConnection'),'The read-only RunPod health check must be connected');
const inserted=source.replace('return {init,show,isRunning:()=>working,listZip};',
'return {init,show,isRunning:()=>working,listZip,choose,run,checkConnection,entries:()=>entries};');
assert(inserted!==source,'Expose limited test hooks');
function makeZip(items){
  const local=[],central=[];let offset=0;
  for(const [name,body] of items){
    const raw=Buffer.from(body),packed=deflateRawSync(raw),n=Buffer.from(name);
    const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50,0);h.writeUInt16LE(8,8);
    h.writeUInt32LE(packed.length,18);h.writeUInt32LE(raw.length,22);h.writeUInt16LE(n.length,26);
    local.push(h,n,packed);
    const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(8,10);
    c.writeUInt32LE(packed.length,20);c.writeUInt32LE(raw.length,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(offset,42);
    central.push(c,n);offset+=h.length+n.length+packed.length;
  }
  const d=Buffer.concat(central),e=Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50,0);e.writeUInt16LE(items.length,8);e.writeUInt16LE(items.length,10);
  e.writeUInt32LE(d.length,12);e.writeUInt32LE(offset,16);
  return new File([...local,d,e],'worship.zip',{type:'application/zip',lastModified:42});
}
function setup(){
  const saved=new Set(),cache=new Map();
  const context={File,Blob,Response,DecompressionStream,TextDecoder,DataView,Set,Map,Error,Number,String,JSON,Uint8Array,
   document:{getElementById:()=>null},localStorage:{getItem:k=>cache.get(k)||null,setItem:(k,v)=>cache.set(k,v)},
   window:{BassDialog:{confirm:async()=>true},BassLibrary:{hasProject:async name=>saved.has(name)}}};
  vm.createContext(context);vm.runInContext(inserted,context);
  return {batch:context.window.BassBatch,saved};
}
(async()=>{
  {
    const {batch,saved}=setup(),analysed=new Set(),order=[];let active='',analysisCalls=0,firstFailure=true;
    batch.init({
      isBusy:()=>false,hasPending:()=>false,
      load:async file=>{active=file.name;order.push('load:'+active);return true;},
      hasCompletedBass:()=>analysed.has(active),
      analyse:async()=>{analysisCalls++;analysed.add(active);return {count:8,partCount:1,bassStemReady:true};},
      save:async name=>{if(name==='A'&&firstFailure){firstFailure=false;throw Error('Sections are not ready');}
        saved.add(name);order.push('saved:'+name);return {noteCount:8};},
      checkConnection:async()=>({workers:{idle:1,running:0},jobs:{inQueue:0}})
    });
    assert(await batch.checkConnection(),'GET-only connection check should report success');
    await batch.choose(makeZip([['A.mp3','one'],['B.mp3','two']]));
    await batch.run();
    assert.deepEqual(Array.from(batch.entries(),x=>x.status),['Saved','Saved']);
    assert.equal(analysisCalls,2,'Failed song retry must reuse recovered bass analysis');
    assert.deepEqual(order.filter(x=>x.startsWith('saved:')),['saved:B','saved:A'],'Other songs must finish before deferred song');
  }
  {
    const {batch,saved}=setup();let active='',count=0;const analysed=new Set();
    batch.init({
      isBusy:()=>false,hasPending:()=>false,
      load:async file=>{active=file.name;return true;},
      hasCompletedBass:()=>analysed.has(active),
      analyse:async()=>{count++;if(active==='A.mp3')return null;analysed.add(active);return {count:2,partCount:1,bassStemReady:true};},
      save:async name=>{saved.add(name);return {noteCount:2};}
    });
    await batch.choose(makeZip([['A.mp3','one'],['B.mp3','two']]));await batch.run();
    assert.deepEqual(Array.from(batch.entries(),x=>x.status),['Needs review','Saved']);
    assert.equal(count,2,'Second pass must never pay to reanalyse a failed bass job');
  }
  {
    const {batch}=setup();let pending=false,analysisCalls=0;
    batch.init({
      isBusy:()=>false,hasPending:()=>pending,
      load:async()=>true,hasCompletedBass:()=>false,
      analyse:async()=>{analysisCalls++;pending=true;throw Error('Unknown response to paid request');},
      save:async()=>{throw Error('Must not save');}
    });
    await batch.choose(makeZip([['A.mp3','one'],['B.mp3','two']]));await batch.run();
    assert.equal(analysisCalls,1);
    assert.deepEqual(Array.from(batch.entries(),x=>x.status),['Needs review','Queued'],
     'Unresolved paid job must pause safely, not overwrite it with the next song');
  }
  console.log('PASS: continue after section errors; return to failed songs; reuse bass results; never auto-reanalyse failed bass; pause for outstanding paid jobs; health check.');
})().catch(e=>{console.error(e);process.exitCode=1;});