const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {File}=require('node:buffer');
const source=fs.readFileSync('batch-source/batch.js','utf8'),html=fs.readFileSync('index.html','utf8');
assert(html.includes(source.trim()));
const exposed=source.replace('return {init,show,isRunning:()=>working,listZip};',
 'return {init,show,isRunning:()=>working,listZip,choose,run,entries:()=>entries,stop:()=>{stopAfterCurrent=true},forceDisplay:()=>{dialog={};draw();}};');
assert.notEqual(exposed,source);
function zip(names){
 const local=[],central=[];let offset=0;
 for(const name of names){const raw=Buffer.from('mock audio for '+name),n=Buffer.from(name),h=Buffer.alloc(30),c=Buffer.alloc(46);
  h.writeUInt32LE(0x04034b50);h.writeUInt32LE(raw.length,18);h.writeUInt32LE(raw.length,22);h.writeUInt16LE(n.length,26);
  c.writeUInt32LE(0x02014b50);c.writeUInt32LE(raw.length,20);c.writeUInt32LE(raw.length,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(offset,42);
  local.push(h,n,raw);central.push(c,n);offset+=h.length+n.length+raw.length;
 }
 const dir=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(names.length,8);end.writeUInt16LE(names.length,10);end.writeUInt32LE(dir.length,12);end.writeUInt32LE(offset,16);
 return new File([...local,dir,end],'return-test.zip',{lastModified:41});
}
function harness(opts={}){
 const dom=new Map(),storage=opts.storage||new Map(),saved=new Set(opts.saved||[]),cache=new Set(opts.cache||[]);
 const events=[],prompts=[];let current='',pending=opts.pending||null,held=structuredClone(opts.held||[]),batch;
 const get=id=>{if(!dom.has(id))dom.set(id,{style:{},value:id==='batchLimit'?'10':'',textContent:'',hidden:false,disabled:false,append(){},replaceChildren(){}});return dom.get(id)};
 const api={get,events,prompts,saved,cache,storage,get current(){return current},get pending(){return pending},get held(){return held},setPending:v=>{pending=v}};
 const hooks={
  isBusy:()=>false,hasPending:()=>!!pending,hasCompletedBass:()=>cache.has(current),heldJobs:()=>structuredClone(held),
  load:async file=>{events.push(['load',file.name]);if(opts.load&&!await opts.load(file,api))return false;current=file.name;return true;},
  analyse:async()=>{events.push(['analyse',current]);if(opts.analyse)return opts.analyse(api);cache.add(current);return {count:10,partCount:1,bassStemReady:true};},
  save:async title=>{events.push(['save',title]);if(opts.save)await opts.save(title,api);saved.add(title);return {noteCount:10};},
  holdPending:name=>{if(!pending)return null;if(opts.holdFail)throw Error('Recovery storage full');const j={...pending,batchEntryName:name||pending.batchEntryName||pending.name};held=held.filter(h=>h.signature!==j.signature);held.push(structuredClone(j));pending=null;events.push(['hold',j.name]);return j;},
  activateHeld:sig=>{if(pending)return false;pending=structuredClone(held.find(j=>j.signature===sig));return !!pending;},
  removeHeld:sig=>{held=held.filter(j=>j.signature!==sig);},
  inspectPending:async()=>{events.push(['check',pending.name]);return {...pending,state:opts.inspect?await opts.inspect(api):'completed'};},
  retryFailed:async()=>{events.push(['retry',pending.name]);return opts.retry?opts.retry(api):{state:'running'};},
  resumeVerified:async()=>{events.push(['recover',pending.name]);current=pending.name;cache.add(current);pending=null;return true;}
 };
 const ctx={File,Blob,Response,DecompressionStream,TextDecoder,DataView,Uint8Array,Set,Map,Number,String,Date,JSON,Error,
  setTimeout:fn=>{opts.onWait?.(api);Promise.resolve().then(fn);},
  document:{getElementById:get,createElement:()=>({style:{},append(){}})},
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>{if(opts.storageFail)throw Error('Full');storage.set(k,v);}},
  window:{BassDialog:{confirm:async msg=>{prompts.push(msg);return opts.confirm!==false;}},BassLibrary:{hasProject:async name=>saved.has(name),ensureBatchAccess:async()=>{if(opts.permissionFail)throw Error('Permission denied');}}}
 };
 vm.createContext(ctx);vm.runInContext(exposed,ctx);batch=ctx.window.BassBatch;api.batch=batch;batch.init(hooks);batch.forceDisplay();
 return {...api,batch,ctx};
}
const job=(name='A.mp3',extra={})=>({signature:name,name,parts:[{id:'original-'+name}],...extra});
const statuses=h=>[...h.batch.entries()].map(i=>i.status);
const calls=(h,type)=>h.events.filter(e=>e[0]===type);
const tests=[];const test=(name,fn)=>tests.push([name,fn]);
test('10, 15 and 20 song limits, complete timings and saved-song skip',async()=>{
 const h=harness();await h.batch.choose(zip(Array.from({length:45},(_,i)=>`Song ${i+1}.mp3`)));
 for(const limit of [10,15,20]){h.get('batchLimit').value=String(limit);const before=calls(h,'analyse').length;await h.batch.run();assert.equal(calls(h,'analyse').length-before,limit);}
 assert.equal(h.saved.size,45);assert(statuses(h).every(s=>s==='Saved'));await h.batch.run();assert.equal(calls(h,'analyse').length,45);
 for(const row of h.batch.entries())assert(Number.isFinite(row.timing.totalMs));
});
test('pre-analysis failure returns after the next song and really runs its first analysis',async()=>{
 let failed=false;const h=harness({load:async f=>{if(f.name==='A.mp3'&&!failed){failed=true;return false}return true}});
 await h.batch.choose(zip(['A.mp3','B.mp3']));await h.batch.run();assert.deepEqual(statuses(h),['Saved','Saved']);
 assert.deepEqual(calls(h,'analyse').map(e=>e[1]),['B.mp3','A.mp3']);
});
test('save failure restores cached analysis rather than submitting again',async()=>{
 let once=true;const h=harness({save:async()=>{if(once){once=false;throw Error('Temporary save failure')}}});
 await h.batch.choose(zip(['A.mp3']));await h.batch.run();assert.deepEqual(statuses(h),['Saved']);assert.equal(calls(h,'analyse').length,1);assert.equal(calls(h,'save').length,2);
});
test('held running result is revisited and saved automatically',async()=>{
 let checks=0;const h=harness({held:[job()],inspect:async()=>++checks<2?'running':'completed'});
 await h.batch.choose(zip(['A.mp3','B.mp3']));await h.batch.run();assert.deepEqual(statuses(h),['Saved','Saved']);assert.equal(calls(h,'analyse').length,1);assert.equal(calls(h,'recover').length,1);assert(checks>=2);
});
test('interrupted job is preserved, next song completes, original result is recovered',async()=>{
 const h=harness({analyse:async api=>{if(api.current==='A.mp3'){api.setPending(job());throw Error('Network dropped')}api.cache.add(api.current);return {count:10,partCount:1,bassStemReady:true}}});
 await h.batch.choose(zip(['A.mp3','B.mp3']));await h.batch.run();assert.deepEqual(statuses(h),['Saved','Saved']);assert.equal(calls(h,'analyse').length,2);assert.equal(calls(h,'recover').length,1);
});
test('unconfirmed upload is held without another submission',async()=>{
 const h=harness({held:[job('A.mp3',{parts:[{submitting:true}]})]});await h.batch.choose(zip(['A.mp3']));await h.batch.run();
 assert.deepEqual(statuses(h),['Needs review']);assert.equal(calls(h,'analyse').length,0);assert.equal(calls(h,'check').length,0);assert.equal(h.get('batchStart').disabled,false);
});
test('running jobs have bounded checks, not an infinite paid retry loop',async()=>{
 const h=harness({held:[job()],inspect:async()=> 'running'});await h.batch.choose(zip(['A.mp3']));await h.batch.run();
 assert.equal(calls(h,'check').length,4);assert.equal(calls(h,'analyse').length,0);assert.deepEqual(statuses(h),['Later']);assert.match(h.get('batchStatus').textContent,/still running/);
});
test('a review row without a held ID can restore its cached result',async()=>{
 const h=harness({cache:['A.mp3']});await h.batch.choose(zip(['A.mp3']));Object.assign(h.batch.entries()[0],{status:'Needs review',analysisStarted:true});
 await h.batch.run();assert.deepEqual(statuses(h),['Saved']);assert.equal(calls(h,'analyse').length,0);
});
test('unconfirmed previous analysis is not repeated after reselecting the ZIP',async()=>{
 const storage=new Map(),archive=zip(['A.mp3']);const h=harness({storage,analyse:async()=>{throw Error('Unknown outcome')}});
 await h.batch.choose(archive);await h.batch.run();assert.equal(calls(h,'analyse').length,1);
 const next=harness({storage});await next.batch.choose(archive);await next.batch.run();assert.equal(calls(next,'analyse').length,0);assert.deepEqual(statuses(next),['Needs review']);
});
test('persistent review rows do not starve later songs',async()=>{
 const names=Array.from({length:12},(_,i)=>`Song ${i}.mp3`),h=harness({held:names.slice(0,10).map(n=>job(n,{parts:[{submitting:true}]}))});
 await h.batch.choose(zip(names));await h.batch.run();await h.batch.run();assert.equal(h.saved.size,2);assert.equal(calls(h,'analyse').length,2);
});
test('permission refusal, cancellation and storage failure never start paid work',async()=>{
 for(const opts of [{permissionFail:true},{confirm:false},{storageFail:true}]){const h=harness(opts);await h.batch.choose(zip(['A.mp3']));await h.batch.run();assert.equal(calls(h,'analyse').length,0);}
});
test('double start processes each song once',async()=>{
 const h=harness();await h.batch.choose(zip(['A.mp3','B.mp3']));await Promise.all([h.batch.run(),h.batch.run()]);assert.equal(calls(h,'analyse').length,2);
});
test('Stop prevents another return pass',async()=>{
 const h=harness({held:[job()],inspect:async()=> 'running',onWait:api=>api.batch.stop()});await h.batch.choose(zip(['A.mp3']));await h.batch.run();assert.equal(calls(h,'check').length,2);assert.match(h.get('batchStatus').textContent,/Stopped/);
});
test('failure to preserve an active job stops the next song',async()=>{
 const h=harness({holdFail:true,analyse:async api=>{api.setPending(job());throw Error('Interrupted')}});await h.batch.choose(zip(['A.mp3','B.mp3']));await h.batch.run();assert.equal(calls(h,'analyse').length,1);assert.match(h.get('batchStatus').textContent,/paused/);
});
// Execute the actual installed provider functions with an isolated mock transport.
function provider(opts={}){
 let pending=structuredClone(opts.job||job()),held=[],posts=0,reads=0;
 const ctx={RUNPOD_ENDPOINT:'test-only',songSession:1,Error,Number,String,encodeURIComponent,
  recoveryStore:async()=>opts.cached||null,readPendingRunPodJob:()=>structuredClone(pending),storedRunPodKey:()=> 'mock-not-a-real-key',
  batchHeldJobs:()=>structuredClone(held),savePendingRunPodJob:v=>{if(opts.storageFail)throw Error('Storage full');pending=structuredClone(v)},
  rememberBatchHeldJob:v=>{held=[structuredClone(v)]},
  runPodFetch:async(url,key,request,attempts)=>{
   assert.equal(attempts,1);
   if(request.method==='GET'){reads++;return {status:typeof opts.status==='function'?opts.status(posts,reads):opts.status||'FAILED',output:{ok:true,notes:[]}}}
   assert.equal(request.method,'POST');assert(url.includes('/retry/'));assert(!url.includes('/run/'));posts++;
   assert.equal(pending.parts.find(p=>url.endsWith(encodeURIComponent(p.id))).batchRetryCount,1,'Marker must exist before POST');
   if(opts.lostReply)throw Error('Lost retry response');
   return {id:opts.wrongID?'wrong-id':decodeURIComponent(url.split('/').pop()),status:'IN_QUEUE'};
  }
 };
 const a=html.indexOf('  async function inspectBatchPending(){'),b=html.indexOf('  window.BassBatch.init({',a);
 const m=html.indexOf('  function analysisFailureDetail('),n=html.indexOf('\n  }',m)+4;
 vm.createContext(ctx);vm.runInContext(html.slice(m,n)+html.slice(a,b),ctx);
 return {ctx,get posts(){return posts},get reads(){return reads},get pending(){return pending}};
}
test('FAILED and TIMED_OUT use the original job ID once only',async()=>{
 for(const status of ['FAILED','TIMED_OUT']){const p=provider({status});await p.ctx.retryVerifiedBatchJob();assert.equal(p.posts,1);await p.ctx.retryVerifiedBatchJob();assert.equal(p.posts,1);assert.equal(p.pending.parts[0].id,'original-A.mp3');}
});
test('running, completed, cancelled, unknown and missing-ID jobs never POST',async()=>{
 for(const status of ['IN_QUEUE','IN_PROGRESS','COMPLETED','CANCELLED','UNKNOWN']){const p=provider({status});await p.ctx.retryVerifiedBatchJob();assert.equal(p.posts,0);}
 const p=provider({job:job('A.mp3',{parts:[{submitting:true}]})});await p.ctx.retryVerifiedBatchJob();assert.equal(p.posts,0);assert.equal(p.reads,0);
});
test('lost retry reply and mismatched ID cannot cause a second retry',async()=>{
 for(const opts of [{lostReply:true},{wrongID:true}]){const p=provider(opts);await assert.rejects(p.ctx.retryVerifiedBatchJob());assert.equal(p.posts,1);await p.ctx.retryVerifiedBatchJob();assert.equal(p.posts,1);assert.equal(p.pending.parts[0].batchRetrySubmitting,true);}
});
test('completed result clears stale local failure without re-running',async()=>{
 const p=provider({status:'COMPLETED',job:job('A.mp3',{parts:[{id:'existing',failedStatus:'FAILED',batchRetryCount:1,batchRetrySubmitting:true}]})});const r=await p.ctx.inspectBatchPending();assert.equal(r.state,'completed');assert.equal(p.pending.parts[0].failedStatus,undefined);assert.equal(p.posts,0);
});
test('provider storage failure prevents retry POST',async()=>{
 const p=provider({storageFail:true});await p.ctx.retryVerifiedBatchJob();assert.equal(p.posts,0);
});
test('Unsent parts resume without replacing cached completed jobs',async()=>{
 const p=provider({job:job('A.mp3',{parts:[{id:'existing'},{index:1,label:'P2'}]}),cached:{signature:job().signature,data:{status:'COMPLETED',output:{ok:true,notes:[]}}}});
 const r=await p.ctx.inspectBatchPending();assert.equal(r.state,'partial');assert.equal(p.reads,0);assert.equal(p.posts,0);
});
test('RC202 interface, original full-save gate and background recovery exclusion retained',async()=>{
 for(const text of ['rc202-uniform-actions','rc202-share-platform','ai-assets-rc201.js','saveBassStudioProject({batchName:name})',"document.visibilityState==='visible'&&!window.BassBatch?.isRunning()"])
  assert(html.includes(text),text);
 assert(fs.readFileSync('sw.js','utf8').includes('bass-stem-studio-rc250'));
});
(async()=>{for(const [name,fn] of tests){await fn();console.log('PASS '+name)}console.log(`PASS ${tests.length} RC203 mocked scenarios. No live audio or paid analysis requests.`)})().catch(err=>{console.error(err);process.exitCode=1});
