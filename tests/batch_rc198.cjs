const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{deflateRawSync}=require('node:zlib'),{File}=require('node:buffer');
const source=fs.readFileSync(__dirname+'/../batch-source/batch.js','utf8');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
assert(html.includes(source.trim()),'RC198 batch source must be in the deployed page');
assert(/#bassBatchDialog \.batch-actions\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/.test(source),'Action buttons must be equal two-column sizes');
assert(/#bassBatchDialog button\{[^}]*align-items:center;justify-content:center;text-align:center/.test(source),'All buttons must be centred and same height');
assert(source.includes("MAX_ZIP = 2 * 1024 * 1048576"),'Streaming ZIP should accept up to 2 GB');
const testSource=source.replace('return {init,show,isRunning:()=>working,listZip};',
  'return {init,show,isRunning:()=>working,listZip,choose,run,checkConnection,entries:()=>entries,forceDisplay:()=>{dialog={};draw();}};');
assert.notEqual(testSource,source);
function zip(songs,trail=0){
  const local=[],central=[];let offset=0;
  for(const item of songs){
    const name=Buffer.from(item.name),plain=Buffer.from(item.body||'audio'),packed=deflateRawSync(plain);
    const l=Buffer.alloc(30);l.writeUInt32LE(0x04034b50,0);l.writeUInt16LE(8,8);l.writeUInt32LE(packed.length,18);l.writeUInt32LE(plain.length,22);l.writeUInt16LE(name.length,26);
    local.push(l,name,packed);
    const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(8,10);c.writeUInt32LE(packed.length,20);
    c.writeUInt32LE(item.claimedSize||plain.length,24);c.writeUInt16LE(name.length,28);c.writeUInt32LE(offset,42);
    central.push(c,name);offset+=l.length+name.length+packed.length;
  }
  const dir=Buffer.concat(central),e=Buffer.alloc(22);e.writeUInt32LE(0x06054b50,0);e.writeUInt16LE(songs.length,8);e.writeUInt16LE(songs.length,10);e.writeUInt32LE(dir.length,12);e.writeUInt32LE(offset,16);
  return new File([...local,dir,e,Buffer.alloc(trail)],'Worship 2 Mp3.zip',{type:'application/zip',lastModified:17});
}
function setup(){
  const dom=new Map(),saved=new Set();let access=false;
  const get=id=>{if(!dom.has(id))dom.set(id,{textContent:'',disabled:false,hidden:false,replaceChildren(){this.items=[];},append(){}});return dom.get(id)};
  const ctx={File,Blob,Response,DecompressionStream,TextDecoder,DataView,Set,Map,Error,Number,String,JSON,Uint8Array,setTimeout,
    document:{getElementById:get,createElement:()=>({append(){},title:'',textContent:''})},
    localStorage:{getItem:()=>null,setItem:()=>{}},
    window:{BassDialog:{confirm:async()=>true},BassLibrary:{
      hasProject:async name=>{if(!access)throw Error('Folder permission expired');return saved.has(name);},
      ensureBatchAccess:async()=>{access=true;return true;}
    }}
  };
  vm.createContext(ctx);vm.runInContext(testSource,ctx);
  return {batch:ctx.window.BassBatch,get,saved};
}
(async()=>{
  const {batch,get,saved}=setup();let analysisCalls=0,loaded='';
  batch.init({
    isBusy:()=>false,hasPending:()=>false,hasCompletedBass:()=>false,
    checkConnection:async()=>({workers:{idle:0,running:0},jobs:{inQueue:0}}),
    load:async f=>{loaded=f.name;return true;},
    analyse:async()=>{analysisCalls++;return {count:5,partCount:1,bassStemReady:true};},
    save:async name=>{saved.add(name);return {noteCount:5};}
  });
  batch.forceDisplay();
  await batch.choose(zip([{name:'Worship/Ada Ehi - Cheta.mp3'},{name:'Breathe.mp3'}],9));
  assert.equal(batch.entries().length,2,'Valid songs must remain after library permission errors');
  assert.equal(get('batchStart').disabled,false,'Start must enable when ZIP is valid, even before permission is reconnected');
  assert.match(get('batchArchive').textContent,/Library access needs confirming/);
  assert.match(get('batchCount').textContent,/2 songs/);
  const archiveFeedback=get('batchArchive').textContent;
  assert.equal(await batch.checkConnection(),true);
  assert.equal(get('batchArchive').textContent,archiveFeedback,'API checks must not overwrite ZIP errors or status');
  assert.match(get('batchConnection').textContent,/RunPod connected/);
  assert.equal(await batch.run(),undefined);
  assert.equal(analysisCalls,2);
  assert.deepEqual(Array.from(batch.entries(),v=>v.status),['Saved','Saved']);
  assert.equal(loaded,'Breathe.mp3');
  const oneOversized=zip([{name:'too-big.mp3',claimedSize:201*1048576},{name:'normal.mp3',body:'music'}]);
  assert.deepEqual(Array.from(await batch.listZip(oneOversized),v=>v.status),['Skipped','Queued'],
   'One oversized song must not reject every other song');
  await batch.choose({name:'oversized.zip',size:2*1024*1048576+1});
  assert.equal(get('batchStart').disabled,true,'An invalid ZIP must not enable paid processing');
  assert.match(get('batchArchive').textContent,/exceeds 2 GB/,'File errors must remain visible');
  assert.match(get('batchConnection').textContent,/RunPod connected/,'Connection result remains separate');
  console.log('PASS: mobile two-column alignment, import errors remain visible, ZIP stays ready after folder permission error, connection status separate, permission recovered on Start, large ZIP limit, unsupported song skip, safe batch processing.');
})().catch(e=>{console.error(e);process.exitCode=1;});