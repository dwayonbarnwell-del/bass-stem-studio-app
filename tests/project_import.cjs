const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const html=fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8');
const marker='  initAnalysisTools();\n  renderBassFretboard();';
assert(html.includes(marker));
const fixture=`window.__imports={
 async project(name,duration,midi,parts=false){
  ensureCtx();const b=ctx.createBuffer(1,duration*8000,8000);
  const audio=arrayBufferToBase64(await wavBlob(b).arrayBuffer());
  return {format:'Bass Stem Studio Project',schemaVersion:2,projectName:name,
   source:{name:name+'.wav',type:'audio/wav',audioBase64:audio},
   analysis:{notes:[{midi,start:.1,end:.7,confidence:.95}],scale:'F major',tempoBpm:110,
    keyReady:true,keySections:[{start:0,end:duration,scale:'F major'}],
    chords:[{start:0,end:duration,rootPc:5,quality:'maj',confidence:.95,evidence_version:'chord-timeline-v4'}],
    ...(parts?{parts:[{label:'P1',coreStart:0,coreEnd:duration,audioStart:0,audioEnd:duration,bassAudioBase64:audio,bassAudioMime:'audio/wav'}]}:{})}};
 },
 import(p){return importBassStudioProject(new File([JSON.stringify(p)],'test.bassstudio',{type:'application/json'}));},
 state(){return {name:objectName,project:loadedProjectName,duration:buffer?.duration,notes:notes.map(n=>n.midi),
  chords:detectedChordChanges.map(c=>c.rootPc),parts:analysisParts.length,offset:stemTimelineOffset,
  sections,loopStart,loopEnd,loopEnabled,selection:[...selectedTimeframes],transposeSemitones,
  speed:tempo.value,main:origVol.value,bass:bassVol.value,history:analysisHistory.length,
  corrections:manualCorrections.length,keys:keyCorrections.length,playing,at:currentTime(),
  source:masterAudio.src,bassSource:bassStemAudio.getAttribute('src'),noBassSource:noBassAudio.getAttribute('src'),
  bassReady:bassStemReady,noBassReady,aiBusy,status:aiState.textContent,title:sourceFileTitle.textContent};},
 dirty(){sections={Old:{start:1,end:9}};loopStart=1;loopEnd=8;loopEnabled=true;selectedTimeframes.add(2);
  transposeSemitones=3;tempo.value='75';origVol.value='21';bassVol.value='32';
  manualCorrections=[{old:true}];keyCorrections=[{start:0,end:10,rootPc:1,mode:'major'}];
  analysisHistory=[analysisSnapshot('Old')];masterAudio.currentTime=3;},
 holdStem(){let heldURL='';Object.defineProperty(bassStemAudio,'src',{configurable:true,get:()=>heldURL,set:value=>{heldURL=value;}});
  this.releaseStem=()=>{delete bassStemAudio.src;if(bassStemURL){bassStemAudio.src=bassStemURL;bassStemAudio.load();}};},
 delayedProject(p){let release;const promise=new Promise(r=>{release=r;});this.releaseProject=()=>release(JSON.stringify(p));
  return importBassStudioProject({text:()=>promise});},
 delayedRecovery(){const original=recoveryStore;let release;
  recoveryStore=async function(store,operation){const result=await original(store,operation);
   if(store==='analyses'&&!release)await new Promise(r=>{release=r;window.recoveryWaiting=true;});return result;};
  this.releaseRecovery=()=>{recoveryStore=original;release?.();};return restoreDeviceAnalysis();},
 startCloud(){localStorage.setItem(RUNPOD_SAVED_KEY,'local-fixture-only');return analyseBassWithAI();},
 replaceState(){notes=[{midi:55,start:.2,end:.9,confidence:.9}];detectedChordChanges=[];drawAll();},
 importRaw:importBassStudioProject,
 importAudio(p){return loadAudioFile(new File([base64ToUint8Array(p.source.audioBase64)],p.source.name,{type:'audio/wav',lastModified:42}));},
 loadAudioFile,restoreDeviceAnalysis,restoreLatestSession,analyseBassWithAI,activateAnalysisPart,
 recoveryStore,persistAnalysisRecovery,cacheAudioForRecovery,
};\n`;
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox','--disable-gpu','--no-zygote']});
 const page=await browser.newPage({viewport:{width:412,height:900}});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>r.abort());
 await page.route('http://127.0.0.1:8151/index.html',r=>r.fulfill({contentType:'text/html',body:html.replace(marker,fixture+marker)}));
 await page.goto('http://127.0.0.1:8151/index.html');
 await page.evaluate(async()=>{window.a=await __imports.project('Song A',10,36);window.b=await __imports.project('Song B',6,41,true);await __imports.import(a);});
 await page.locator('#playBtn').click();await page.waitForFunction(()=>__imports.state().playing);
 await page.evaluate(()=>{__imports.dirty();__imports.holdStem();window.pendingImport=__imports.import(b);});
 await page.waitForFunction(()=>__imports.state().name==='Song B.wav');
 let s=await page.evaluate(()=>__imports.state());
 assert.equal(s.title,'Song B.wav','new song must be visible before the saved stem finishes loading');
 assert.deepEqual(s.notes,[41]);assert.deepEqual(s.chords,[5]);assert.equal(s.duration,6);
 assert.equal(s.loopEnabled,false);assert.deepEqual(s.selection,[]);assert.equal(s.at,0);assert.equal(s.playing,false);
 assert(!s.sections.Old);assert.equal(s.transposeSemitones,0);assert.equal(s.speed,'100');assert.equal(s.main,'70');assert.equal(s.bass,'70');
 assert.equal(s.history,0);assert.equal(s.corrections,0);assert.equal(s.keys,0);
 await page.evaluate(async()=>{__imports.releaseStem();await pendingImport;});
 s=await page.evaluate(()=>__imports.state());assert.equal(s.bassReady,true);assert.equal(s.parts,1);
 assert.equal(await page.locator('#saveProjectBtn').isDisabled(),false);
 // Importing a file without stems removes the previous song's stems and parts.
 await page.evaluate(()=>__imports.import(a));s=await page.evaluate(()=>__imports.state());
 assert.equal(s.parts,0);assert.equal(s.bassReady,false);assert.equal(s.noBassReady,false);
 assert.equal(s.bassSource,null);assert.equal(s.noBassSource,null);assert.deepEqual(s.notes,[36]);
 // Invalid original audio must retain the current usable project, with a clear error.
 const previous=await page.evaluate(()=>__imports.state());
 assert.equal(await page.evaluate(()=>__imports.import({...b,source:{...b.source,audioBase64:'not valid base64'}})),false);
 s=await page.evaluate(()=>__imports.state());assert.equal(s.name,previous.name);assert.equal(s.source,previous.source);assert.deepEqual(s.notes,previous.notes);
 assert.match(s.status,/damaged/);
 assert.equal(await page.evaluate(()=>__imports.import({...b,analysis:{...b.analysis,parts:[null]}})),false);
 s=await page.evaluate(()=>__imports.state());assert.equal(s.source,previous.source);assert.deepEqual(s.notes,previous.notes);
 // A newer selection wins even if an older file finishes reading later.
 await page.evaluate(()=>{window.slowImport=__imports.delayedProject(a);});
 await page.evaluate(()=>__imports.import(b));
 await page.evaluate(async()=>{__imports.releaseProject();await slowImport;});
 s=await page.evaluate(()=>__imports.state());assert.equal(s.name,'Song B.wav');assert.deepEqual(s.notes,[41]);
 // Replace a project while it is waiting for a stem. Its continuation must
 // not attach the old no-bass track or touch the newer project.
 await page.evaluate(()=>{__imports.holdStem();window.slowStem=__imports.import({...b,analysis:{...b.analysis,parts:[],bassAudioBase64:b.source.audioBase64,
  bassAudioMime:'audio/wav',noBassAudioBase64:b.source.audioBase64,noBassAudioMime:'audio/wav',rehearsalVersion:'rehearsal-v10-keyboard-chord-evidence'}});});
 await page.waitForFunction(()=>__imports.state().name==='Song B.wav'&&document.querySelector('#importProjectBtn').getAttribute('aria-busy')==='true');
 await page.evaluate(async()=>{await __imports.import(a);await slowStem;__imports.releaseStem();});
 s=await page.evaluate(()=>__imports.state());assert.equal(s.name,'Song A.wav');assert.equal(s.bassReady,false);assert.equal(s.noBassReady,false);assert.equal(s.parts,0);
 // A recovery response read before the switch cannot restore the old notes.
 await page.evaluate(async()=>{await __imports.persistAnalysisRecovery();window.recoveryWaiting=false;window.delayedRecovery=__imports.delayedRecovery();});
 await page.waitForFunction(()=>window.recoveryWaiting);
 await page.evaluate(()=>__imports.import(b));
 await page.evaluate(async()=>{__imports.releaseRecovery();await delayedRecovery;});
 s=await page.evaluate(()=>__imports.state());assert.equal(s.name,'Song B.wav');assert.deepEqual(s.notes,[41]);
 // Real file-input changes must support selecting the same saved file again.
 const fileB=await page.evaluate(()=>JSON.stringify(b));
 const input={name:'Song B.bassstudio',mimeType:'application/json',buffer:Buffer.from(fileB)};
 await page.locator('#projectFileInput').setInputFiles(input);
 await page.waitForFunction(()=>document.querySelector('#importProjectBtn').getAttribute('aria-busy')==='false');
 await page.evaluate(()=>__imports.replaceState());
 await page.locator('#projectFileInput').setInputFiles(input);
 await page.waitForFunction(()=>document.querySelector('#importProjectBtn').getAttribute('aria-busy')==='false'&&__imports.state().notes[0]===41);
 // No paid request: intercept a real analysis request, then return an old
 // result only after a different saved project has replaced the audio.
 let releaseResponse,requestStarted;
 const started=new Promise(r=>{requestStarted=r;});
 const release=new Promise(r=>{releaseResponse=r;});
 await page.route('https://api.runpod.ai/**',async route=>{
  requestStarted();await release;
  await route.fulfill({contentType:'application/json',body:JSON.stringify({id:'old-job',status:'COMPLETED',output:{ok:true,notes:[{midi:60,start:.1,end:1}]}})});
 });
 await page.evaluate(()=>{window.oldAnalysis=__imports.startCloud();});await started;
 await page.evaluate(()=>__imports.import(a));releaseResponse();
 await page.evaluate(()=>oldAnalysis);
 s=await page.evaluate(()=>__imports.state());assert.equal(s.name,'Song A.wav');assert.deepEqual(s.notes,[36]);assert.equal(s.aiBusy,false);assert.match(s.status,/Opened/);
 // Missing optional audio must settle rather than leave the old song or a
 // permanently busy Import button. Shorten only that 15s test timer.
 await page.evaluate(()=>{const native=setTimeout;window.setTimeout=(callback,ms,...args)=>native(callback,ms===15000?50:ms,...args);
  __imports.holdStem();});
 assert.equal(await page.evaluate(()=>__imports.import(b)),true);
 s=await page.evaluate(()=>__imports.state());assert.equal(s.name,'Song B.wav');assert.deepEqual(s.notes,[41]);assert.equal(s.bassReady,false);assert.match(s.status,/backing audio unavailable/);
 assert.equal(await page.locator('#importProjectBtn').getAttribute('aria-busy'),'false');
 await page.evaluate(()=>__imports.releaseStem());
 // Saved settings take precedence, while raw audio has no old note/stem data.
 await page.evaluate(()=>__imports.import({...a,settings:{mainVolume:33,bassVolume:45,speed:80,transposeSemitones:2,sections:{Verse:{start:0,end:5}}}}));
 s=await page.evaluate(()=>__imports.state());assert.equal(s.main,'33');assert.equal(s.bass,'45');assert.equal(s.speed,'80');assert.equal(s.transposeSemitones,2);assert.deepEqual(s.sections,{Verse:{start:0,end:5}});
 await page.evaluate(()=>__imports.importAudio(b));s=await page.evaluate(()=>__imports.state());
 assert.equal(s.name,'Song B.wav');assert.equal(s.title,'Song B.wav');assert.equal(s.duration,6);assert.deepEqual(s.notes,[]);assert.equal(s.parts,0);assert.equal(s.bassReady,false);
 // Ordinary analysis still finishes and re-enables Save (all network mocked).
 await page.unroute('https://api.runpod.ai/**');
 await page.route('https://api.runpod.ai/**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({id:'new-job',status:'COMPLETED',output:{ok:true,song_scale:'F major',notes:[{midi:41,start:.1,end:1,confidence:.95}],chords:[]}})}));
 await page.evaluate(()=>__imports.startCloud());s=await page.evaluate(()=>__imports.state());
 assert.deepEqual(s.notes,[41]);assert.equal(s.aiBusy,false);assert.match(s.status,/Analysis ready/);assert.equal(await page.locator('#saveProjectBtn').isDisabled(),false);
 assert.deepEqual(errors,[]);await browser.close();
 console.log('PASS: full project replacement, repeat selection, missing stems, invalid file preservation, latest import wins, stale stem/recovery/cloud protection.');
})().catch(e=>{console.error(e);process.exit(1);});
