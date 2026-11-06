const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {File}=require('node:buffer'),{deflateRawSync}=require('node:zlib');
const source=fs.readFileSync(__dirname+'/../batch-source/batch.js','utf8');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
assert(html.includes(source.trim()),'Installed batch module must match maintained source');
assert(html.includes("saveBassStudioProject({batchName:name})"),'Original full project saving must be retained');
const exposed=source.replace('return {init,show,isRunning:()=>working,listZip};',
  'return {init,show,isRunning:()=>working,listZip,choose,run,entries:()=>entries,forceDisplay:()=>{dialog={};draw();}};');
assert.notEqual(exposed,source);
function zip(names){
  const local=[],central=[];let offset=0;
  for(const name of names){
    const raw=Buffer.from('audio for '+name),packed=deflateRawSync(raw),n=Buffer.from(name);
    const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50,0);h.writeUInt16LE(8,8);
    h.writeUInt32LE(packed.length,18);h.writeUInt32LE(raw.length,22);h.writeUInt16LE(n.length,26);
    local.push(h,n,packed);
    const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(8,10);
    c.writeUInt32LE(packed.length,20);c.writeUInt32LE(raw.length,24);c.writeUInt16LE(n.length,28);
    c.writeUInt32LE(offset,42);central.push(c,n);
    offset+=h.length+n.length+packed.length;
  }
  const dir=Buffer.concat(central),e=Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50,0);e.writeUInt16LE(names.length,8);e.writeUInt16LE(names.length,10);
  e.writeUInt32LE(dir.length,12);e.writeUInt32LE(offset,16);
  return new File([...local,dir,e],'short-worship.zip',{type:'application/zip',lastModified:41});
}
const dom=new Map(), saved=new Set(), confirmations=[], analysed=[];
function get(id){
  if(!dom.has(id))dom.set(id,{value:id==='batchLimit'?'2':'',textContent:'',title:'',disabled:false,hidden:false,replaceChildren(){},append(){}});
  return dom.get(id);
}
const ctx={File,Blob,Response,DecompressionStream,TextDecoder,DataView,Uint8Array,Set,Map,Number,String,Date,JSON,Error,
  document:{getElementById:get,createElement:()=>({append(){}})},
  localStorage:{getItem:()=>null,setItem:()=>{}},
  window:{BassDialog:{confirm:async msg=>{confirmations.push(msg);return true;}},BassLibrary:{
    hasProject:async name=>saved.has(name),ensureBatchAccess:async()=>true
  }}
};
vm.createContext(ctx);vm.runInContext(exposed,ctx);const batch=ctx.window.BassBatch;
batch.init({
 isBusy:()=>false,hasPending:()=>false,hasCompletedBass:()=>false,
 load:async()=>true,
 analyse:async()=>{analysed.push('original-engine');return {count:10,partCount:1,bassStemReady:true};},
 save:async title=>{saved.add(title);return {noteCount:10};}
});
(async()=>{
  batch.forceDisplay();
  await batch.choose(zip(['First.mp3','Second.mp3','Third.mp3','Fourth.mp3']));
  assert.equal(batch.entries().length,4);
  await batch.run();
  assert.deepEqual([...batch.entries()].map(x=>x.status),['Saved','Saved','Queued','Queued']);
  assert.equal(analysed.length,2);
  assert.match(confirmations[0],/Process 2 of 4 remaining songs/);
  for(const song of batch.entries().slice(0,2)){
    assert(Number.isFinite(song.timing?.openMs));
    assert(Number.isFinite(song.timing?.analyseMs));
    assert(Number.isFinite(song.timing?.saveMs));
    assert(Number.isFinite(song.timing?.totalMs));
  }
  await batch.run();
  assert.deepEqual([...batch.entries()].map(x=>x.status),['Saved','Saved','Saved','Saved']);
  assert.equal(analysed.length,4,'Completed songs must not be analysed again');
  assert.match(confirmations[1],/Process 2 of 2 remaining songs/);
  assert.match(get('batchStatus').textContent,/0 left to process/);
  console.log('PASS: two-song runs, next-song continuation, timings, unchanged full analysis callback, no repeated paid analysis.');
})().catch(e=>{console.error(e);process.exitCode=1;});