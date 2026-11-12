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
  completeSong:async options=>{events.push(['sections',current,options]);return opts.completeSong?opts.completeSong(options,api):true},
  sectionStatus:()=>opts.sectionStatus?opts.sectionStatus(api):({state:'missing'}),
  preparePaidRestart:async name=>{events.push(['restart',name]);held=held.filter(j=>j.name!==name);pending=null;return true;},
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
  window:{BassDialog:{confirm:async msg=>{prompts.push(msg);return typeof opts.confirm==='function'?opts.confirm(msg,api):opts.confirm!==false;}},BassLibrary:{hasProject:async name=>saved.has(name),ensureBatchAccess:async()=>{if(opts.permissionFail)throw Error('Permission denied');}}}
 };
 vm.createContext(ctx);vm.runInContext(exposed,ctx);batch=ctx.window.BassBatch;api.batch=batch;batch.init(hooks);batch.forceDisplay();
 return {...api,batch,ctx};
}
const job=(name='A.mp3',extra={})=>({signature:name,name,parts:[{id:'original-'+name}],...extra});
const statuses=h=>[...h.batch.entries()].map(i=>i.status);
const calls=(h,type)=>h.events.filter(e=>e[0]===type);

const tests=[];const test=(name,fn)=>tests.push([name,fn]);
test('19 saved and 13 unfinished: repair only the 13, without touching saved work',async()=>{
 const all=Array.from({length:32},(_,i)=>`Song ${i+1}.mp3`), saved=all.slice(0,19).map(n=>n.replace('.mp3',''));
 const h=harness({saved});h.get('batchLimit').value='all';await h.batch.choose(zip(all));
 for(const row of h.batch.entries().slice(19))Object.assign(row,{analysisStarted:true,status:'Needs review',submittedThisRun:true});
 await h.batch.run();assert.equal(h.saved.size,32);assert.equal(calls(h,'analyse').length,13);assert.equal(calls(h,'restart').length,13);assert(calls(h,'analyse').every(e=>!saved.includes(e[1].replace('.mp3',''))));
});
test('A second Repair click can approve another failed attempt without reloading ZIP',async()=>{
 let tries=0;const h=harness({analyse:async api=>{tries++;if(tries<=2)throw Error('Unconfirmed response');api.cache.add(api.current);return {count:10,partCount:1,bassStemReady:true}}});
 await h.batch.choose(zip(['A.mp3']));await h.batch.run();assert.equal(tries,1);
 await h.batch.run();assert.equal(tries,2);assert.notEqual(h.batch.entries()[0].status,'Saved');
 await h.batch.run();assert.equal(tries,3);assert.equal(h.batch.entries()[0].status,'Saved');assert.equal(calls(h,'restart').length,2);
});
test('Newly completed bass can repair missing sections in the same run',async()=>{
 const h=harness({completeSong:async options=>!!options.paidRestart});await h.batch.choose(zip(['A.mp3']));await h.batch.run();
 assert.equal(h.batch.entries()[0].status,'Saved');assert.equal(calls(h,'analyse').length,1);assert.equal(calls(h,'restart').length,0);
 const requests=calls(h,'sections');assert.equal(requests.filter(e=>e[2].paidRestart).length,1);assert(h.prompts.some(p=>p.includes('cost more')));
});
test('In-progress section job is checked again and saved, without another upload',async()=>{
 let checks=0;const h=harness({completeSong:async()=>++checks>=4,sectionStatus:()=>({state:'pending',message:'Still running'})});await h.batch.choose(zip(['A.mp3']));await h.batch.run();
 assert.equal(h.saved.size,1);assert.equal(calls(h,'analyse').length,1);assert.equal(calls(h,'sections').filter(e=>e[2].allowNewSections).length,1);assert.equal(calls(h,'restart').length,0);
});
test('Persistently running sections do not cause extra paid requests',async()=>{
 const h=harness({completeSong:async()=>false,sectionStatus:()=>({state:'pending'})});await h.batch.choose(zip(['A.mp3']));await h.batch.run();
 assert.equal(h.saved.size,0);assert.equal(calls(h,'analyse').length,1);assert.equal(calls(h,'sections').filter(e=>e[2].allowNewSections).length,1);assert.equal(calls(h,'restart').length,0);
});
test('Completed section results are collected before starting the next song',async()=>{
 let checks=0;
 const h=harness({completeSong:async(options,api)=>api.current!=='A.mp3'||++checks>=2,sectionStatus:()=>({state:'pending'})});
 await h.batch.choose(zip(['A.mp3','B.mp3']));await h.batch.run();
 const saveA=h.events.findIndex(e=>e[0]==='save'&&e[1]==='A');
 const loadB=h.events.findIndex(e=>e[0]==='load'&&e[1]==='B.mp3');
 assert(saveA>=0&&saveA<loadB);
 assert.equal(calls(h,'analyse').filter(e=>e[1]==='A.mp3').length,1);
 assert.equal(calls(h,'sections').filter(e=>e[1]==='A.mp3'&&e[2].allowNewSections).length,1);
});
test('Refused extra charge keeps unfinished song and saved bass',async()=>{
 const h=harness({completeSong:async()=>false,confirm:msg=>!msg.includes('cost more')});await h.batch.choose(zip(['A.mp3']));await h.batch.run();
 assert.equal(h.saved.size,0);assert.equal(calls(h,'analyse').length,1);assert.equal(calls(h,'restart').length,0);assert(h.cache.has('A.mp3'));
});
test('Ongoing or unreachable bass job is not replaced',async()=>{
 for(const state of ['running','check-failed','missing-key','unresolved']){
 const h=harness({held:[job()],inspect:async()=>state});await h.batch.choose(zip(['A.mp3']));await h.batch.run();assert.equal(calls(h,'analyse').length,0,state);assert.equal(calls(h,'restart').length,0,state);
 }
});
test('Missing sections survive closing and reopening the ZIP',async()=>{
 const storage=new Map(),h=harness({storage,completeSong:async()=>false,sectionStatus:()=>({state:'pending'})});const z=zip(['A.mp3']);await h.batch.choose(z);await h.batch.run();
 const next=harness({storage,cache:['A.mp3'],completeSong:async()=>true});await next.batch.choose(z);assert.equal(next.batch.entries()[0].sectionIncomplete,true);await next.batch.run();assert.equal(next.saved.size,1);assert.equal(calls(next,'analyse').length,0);
});
test('Double click remains single processing run',async()=>{const h=harness();await h.batch.choose(zip(['A.mp3','B.mp3']));await Promise.all([h.batch.run(),h.batch.run()]);assert.equal(calls(h,'analyse').length,2);assert.equal(h.saved.size,2)});
test('Folder permission and local storage failures start no paid work',async()=>{for(const opt of [{permissionFail:true},{storageFail:true}]){const h=harness(opt);await h.batch.choose(zip(['A.mp3']));await h.batch.run();assert.equal(calls(h,'analyse').length,0)}});
test('Stop stops checks and leaves the recovery record',async()=>{const h=harness({held:[job()],inspect:async()=> 'running',onWait:api=>api.batch.stop()});await h.batch.choose(zip(['A.mp3']));await h.batch.run();assert.equal(calls(h,'restart').length,0);assert.match(h.get('batchStatus').textContent,/Stopped/)});
test('Only complete projects reach the existing save function',async()=>{const h=harness({completeSong:async()=>false,sectionStatus:()=>({state:'pending'})});await h.batch.choose(zip(['A.mp3']));await h.batch.run();assert.equal(calls(h,'save').length,0)});
test('Full app retains save checks, new polling bounds and no background batch sections',async()=>{
 for(const s of ["maxChecks:2,pollMs:500","await window.BassPiano.analyse({automatic:true})","saveBassStudioProject({batchName:name})",'rc206'])assert(html.includes(s),s);
});
(async()=>{for(const [name,fn]of tests){await fn();console.log('PASS '+name)}console.log('PASS '+tests.length+' batch repair scenarios. Mocked; no paid analysis.')})().catch(e=>{console.error(e);process.exitCode=1});
