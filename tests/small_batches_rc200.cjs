const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {File}=require('node:buffer'),{deflateRawSync}=require('node:zlib');
const source=fs.readFileSync(__dirname+'/../batch-source/batch.js','utf8');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
assert(html.includes(source.trim()),'Maintained and embedded batch modules must match');
assert(html.includes('isCurrentFile:file=>activeAudioFile===file'),'Reuse must check the actual loaded file identity');
assert(html.includes('Payments & Billing'),'Keep the published payment links');
const anchor='return {init,show,isRunning:()=>working,listZip};';
const instrumented=source.replace(anchor,'return {init,show,isRunning:()=>working,listZip,choose,run,checkConnection,entries:()=>entries,limit:value=>{batchLimit=value;},stop:()=>{stopAfterCurrent=true;}};');
assert.notEqual(source,instrumented);
function zip(count){
 const local=[],central=[];let offset=0;
 for(let i=0;i<count;i++){
  const name=Buffer.from(String.fromCharCode(65+i)+'.mp3'),raw=Buffer.from('fixture '+i),data=deflateRawSync(raw);
  const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50,0);h.writeUInt16LE(8,8);h.writeUInt32LE(data.length,18);h.writeUInt32LE(raw.length,22);h.writeUInt16LE(name.length,26);
  local.push(h,name,data);
  const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(8,10);c.writeUInt32LE(data.length,20);c.writeUInt32LE(raw.length,24);c.writeUInt16LE(name.length,28);c.writeUInt32LE(offset,42);
  central.push(c,name);offset+=h.length+name.length+data.length;
 }
 const d=Buffer.concat(central),e=Buffer.alloc(22);e.writeUInt32LE(0x06054b50,0);e.writeUInt16LE(count,8);e.writeUInt16LE(count,10);e.writeUInt32LE(d.length,12);e.writeUInt32LE(offset,16);
 return new File([...local,d,e],'fixture.zip',{lastModified:42});
}
function setup(){
 const saved=new Set(),analysed=new Set(),messages=[],counts={loads:0,analyses:0,saves:0,confirms:0};let active=null;
 const ctx={File,Blob,Response,DecompressionStream,TextDecoder,DataView,Set,Map,Error,Number,String,JSON,Uint8Array,setTimeout,console,
  document:{hidden:false,getElementById:id=>id==='batchStatus'?{set textContent(v){messages.push(v);}}:null},
  navigator:{onLine:true},localStorage:{getItem:()=>null,setItem:()=>{}},
  window:{BassLibrary:{hasProject:async name=>saved.has(name),ensureBatchAccess:async()=>true},BassDialog:{confirm:async()=>{counts.confirms++;return true;}}}};
 vm.createContext(ctx);vm.runInContext(instrumented,ctx);
 const batch=ctx.window.BassBatch;
 const hooks={isBusy:()=>false,hasPending:()=>false,isCurrentFile:file=>active===file,
  load:async file=>{counts.loads++;active=file;return true;},hasCompletedBass:()=>!!active&&analysed.has(active.name),
  analyse:async()=>{counts.analyses++;analysed.add(active.name);return {count:4,partCount:1,bassStemReady:true};},
  save:async name=>{counts.saves++;saved.add(name);return {noteCount:4};}};
 batch.init(hooks);
 return {ctx,batch,hooks,saved,analysed,counts,messages};
}
(async()=>{
 let t=setup();await t.batch.choose(zip(8));await t.batch.run();
 assert.equal(t.counts.analyses,3,'Default must be three songs, not the full ZIP');
 assert.equal(t.batch.entries().filter(i=>i.status==='Queued').length,5);
 await t.batch.run();assert.equal(t.counts.analyses,6);await t.batch.run();assert.equal(t.counts.analyses,8);
 assert.equal(t.saved.size,8,'Start next must not redo saved songs');
 t=setup();t.batch.limit(1);await t.batch.choose(zip(8));await t.batch.run();assert.equal(t.saved.size,1);
 t.batch.limit(5);await t.batch.run();assert.equal(t.saved.size,6);t.batch.limit(150);await t.batch.run();assert.equal(t.saved.size,8);
 // Lock immediately, including storage permission checks and the confirmation dialog.
 t=setup();let release;const wait=new Promise(r=>{release=r;});t.ctx.window.BassLibrary.ensureBatchAccess=()=>wait;
 await t.batch.choose(zip(4));const run=t.batch.run();assert(t.batch.isRunning());await t.batch.run();await t.batch.choose(zip(1));
 release();await run;assert.equal(t.counts.confirms,1);assert.equal(t.counts.analyses,3);assert.equal(t.batch.entries().length,4);
 t=setup();await t.batch.choose(zip(2));t.ctx.window.BassDialog.confirm=()=>waitForConfirm;
 let resolveConfirm;const waitForConfirm=new Promise(r=>{resolveConfirm=r;});const cancelling=t.batch.run();await Promise.resolve();await t.batch.run();resolveConfirm(false);await cancelling;
 assert.equal(t.counts.analyses,0);assert.equal(t.batch.isRunning(),false);
 t=setup();await t.batch.choose(zip(2));t.ctx.window.BassDialog.confirm=async()=>{throw Error('Dialog failure');};await t.batch.run();assert.equal(t.batch.isRunning(),false);assert.equal(t.counts.analyses,0);
 // An in-memory completed song should not be extracted, decoded or restored again for a save retry.
 t=setup();let first=true;const save=t.hooks.save;t.hooks.save=async name=>{if(first){first=false;throw Error('Sections still finishing');}return save(name);};
 await t.batch.choose(zip(1));await t.batch.run();assert.equal(t.counts.loads,1);assert.equal(t.counts.analyses,1);assert.equal(t.saved.size,1);
 // Do not reuse the previous file when another song is now active.
 t=setup();let failA=true;const saveDifferent=t.hooks.save;t.hooks.save=async name=>{if(name==='A'&&failA){failA=false;throw Error('Wait for sections');}return saveDifferent(name);};
 await t.batch.choose(zip(2));await t.batch.run();assert.equal(t.counts.loads,3);assert.equal(t.counts.analyses,2);assert.equal(t.saved.size,2);
 // Deferred retries stay inside the chosen group and cannot submit a second bass analysis.
 t=setup();const normalAnalyse=t.hooks.analyse;let attempted=0;t.hooks.analyse=async()=>{attempted++;if(attempted===1)return null;return normalAnalyse();};
 await t.batch.choose(zip(5));await t.batch.run();assert.equal(attempted,3);assert.deepEqual(Array.from(t.batch.entries(),i=>i.status),['Needs review','Saved','Saved','Queued','Queued']);
 t=setup();let pending=false;t.hooks.hasPending=()=>pending;t.hooks.analyse=async()=>{t.counts.analyses++;pending=true;throw Error('No confirmed upload reply');};
 await t.batch.choose(zip(4));await t.batch.run();assert.equal(t.counts.analyses,1);assert.equal(t.batch.entries()[1].status,'Queued');assert.equal(t.batch.isRunning(),false);
 // Recheck after the user confirms, in case another operation started while the dialog was open.
 t=setup();let busy=false;t.hooks.isBusy=()=>busy;t.ctx.window.BassDialog.confirm=async()=>{busy=true;return true;};await t.batch.choose(zip(1));await t.batch.run();assert.equal(t.counts.analyses,0);
 // Do not start a new song when the app is hidden or offline. Do not abort submitted work.
 for(const reason of ['hidden','offline']){
  t=setup();const saveFirst=t.hooks.save;t.hooks.save=async name=>{const r=await saveFirst(name);if(reason==='hidden')t.ctx.document.hidden=true;else t.ctx.navigator.onLine=false;return r;};
  await t.batch.choose(zip(4));await t.batch.run();assert.equal(t.saved.size,1,reason);assert.equal(t.counts.analyses,1,reason);assert.equal(t.batch.isRunning(),false);
 }
 t=setup();const analyseStop=t.hooks.analyse;t.hooks.analyse=async()=>{const r=await analyseStop();t.batch.stop();return r;};await t.batch.choose(zip(4));await t.batch.run();assert.equal(t.saved.size,1);assert.equal(t.counts.analyses,1);
 t=setup();t.ctx.window.BassLibrary.ensureBatchAccess=async()=>{throw Error('Permission denied');};await t.batch.choose(zip(1));await t.batch.run();assert.equal(t.counts.analyses,0);assert.equal(t.batch.isRunning(),false);
 console.log('PASS RC200: 3-song default; selectable size; continue next group; immediate start lock; cancellation and error unlock; exact current-file reuse; other-song isolation; bounded retries; no repeat paid bass calls; pending job guard; hidden/offline boundary pause; stop after song. All analysis calls are mocked.');
})().catch(e=>{console.error(e);process.exitCode=1;});
