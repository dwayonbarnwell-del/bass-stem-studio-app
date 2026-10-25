const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const html=fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8');
const marker='  initAnalysisTools();\n  renderBassFretboard();';
const fixture=`window.__sections={
 async project(name='Structure song',duration=60){
  ensureCtx();const b=ctx.createBuffer(1,duration*8000,8000);
  return {format:'Bass Stem Studio Project',schemaVersion:2,projectName:name,
   source:{name:name+'.wav',type:'audio/wav',audioBase64:arrayBufferToBase64(await wavBlob(b).arrayBuffer())},
   analysis:{notes:[{midi:36,start:.1,end:.7,confidence:.95}],scale:'C major',tempoBpm:120}};
 },
 import(p){return importBassStudioProject(new File([JSON.stringify(p)],'song.bassstudio'));},
 importAudio(p){return loadAudioFile(new File([base64ToUint8Array(p.source.audioBase64)],p.source.name,{type:'audio/wav',lastModified:42}));},
 structure(){return {version:'song-structure-v1-allinone',segments:[
  {name:'Verse 1',label:'verse',start:0,end:20},
  {name:'Chorus 1',label:'chorus',start:20,end:40},
  {name:'Section 1',label:'section',start:40,end:60,uncertain:true}],beats:Array.from({length:120},(_,i)=>i*.5)};},
 install:installSongStructure,normalise:normaliseSongStructure,ensure:ensureSongStructure,
 persist:persistAnalysisRecovery,restore:restoreDeviceAnalysis,save:saveBassStudioProject,
 at(t){seekTo(t);},current:currentSectionName,
 selectTime(t){toggleTimeframeSelection(t);},
 state(){return {sections,structure:songStructure,name:objectName,start:loopStart,end:loopEnd,loop:loopEnabled,
  timeframe:timeframeLoopMode,selected:[...selectedTimeframes],playing,at:currentTime(),busy:structureBusy,error:structureError,
  multi:multiSectionMode,queue:sectionQueue,index:queueIndex,picked:[...selectedSections],draft:[...repeatSectionDraft],
  notes:notes.map(n=>n.midi),chords:detectedChordChanges};},
 key(){localStorage.setItem(RUNPOD_SAVED_KEY,'fixture-only');},
 reset(){songStructure=null;sections={};structureError='';repeatSectionDraft.clear();renderRepeatChooser();},
 noKey(){localStorage.removeItem(RUNPOD_SAVED_KEY);sessionStorage.removeItem(RUNPOD_SAVED_KEY);},
 ended(){masterAudio.dispatchEvent(new Event('ended'));},
 clearSectionJobs(){localStorage.removeItem(STRUCTURE_CACHE_KEY);localStorage.removeItem(STRUCTURE_PENDING_KEY);},
 timeoutSoon(){const original=window.setTimeout;window.setTimeout=(fn,delay,...args)=>original(fn,delay===30000?10:delay,...args);this.restoreTimer=()=>{window.setTimeout=original;};},
};\n`;
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox','--disable-gpu','--no-zygote']});
 const page=await browser.newPage({viewport:{width:360,height:800}});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>r.abort());
 await page.route('http://127.0.0.1:8151/index.html',r=>r.fulfill({contentType:'text/html',body:html.replace(marker,fixture+marker)}));
 await page.goto('http://127.0.0.1:8151/index.html');
 await page.evaluate(async()=>{window.project=await __sections.project();await __sections.import(project);__sections.install(__sections.structure());});
 const initial=await page.evaluate(()=>__sections.state());
 assert.equal(initial.structure.segments.length,3);
 assert.equal(await page.evaluate(()=>__sections.current(20)),'Chorus 1');
 assert.equal(await page.evaluate(()=>__sections.current(60)),'Section 1');
 assert.equal(await page.evaluate(()=>__sections.normalise({segments:[{name:'x',start:4,end:60}]},60)),null);
 assert.equal(await page.evaluate(()=>__sections.normalise({segments:[{name:'x',start:0,end:20},{name:'x',start:20,end:60}]},60)),null);
 await page.evaluate(()=>__sections.at(22));await page.locator('#loopToggle').click();
 assert.equal(await page.locator('#repeatSectionDialog').isVisible(),true);
 assert.match(await page.locator('#repeatCurrentSection').innerText(),/Chorus 1/);
 await page.locator('#repeatCurrentSection').click();await page.waitForFunction(()=>__sections.state().playing);
 let state=await page.evaluate(()=>__sections.state());assert.equal(state.start,20);assert.equal(state.end,40);assert.equal(state.loop,true);assert.equal(state.playing,true);
 assert.equal(await page.locator('#repeatSectionDialog').isVisible(),false);
 await page.locator('#loopToggle').click();assert.equal((await page.evaluate(()=>__sections.state())).loop,false);
 // Existing cell repeat remains available and a named section takes ownership cleanly.
 await page.evaluate(()=>__sections.selectTime(4));await page.locator('#loopToggle').click();await page.locator('#loopToggle').click();
 assert.equal(await page.locator('#repeatSelection').isVisible(),true);
 await page.locator('[data-repeat-section="Verse 1"]').click();
 assert.equal(await page.locator('#repeatSectionDialog').isVisible(),true);
 await page.locator('#repeatChosenSections').click();state=await page.evaluate(()=>__sections.state());
 assert.deepEqual(state.selected,[]);assert.equal(state.timeframe,false);assert.equal(state.start,0);assert.equal(state.end,20);
 // Choose out of order, remove a choice, then repeat the remaining sections
 // in song order, skipping the gap. The list stays open during selection.
 await page.locator('#loopToggle').click();await page.locator('#pauseBtn').click();
 await page.locator('#clearLoop').click();await page.locator('#loopToggle').click();
 await page.evaluate(()=>{document.querySelector('#timeFrom').value='0:10';document.querySelector('#timeTo').value='0:15';});
 await page.locator('[data-repeat-section="Section 1"]').click();
 await page.locator('[data-repeat-section="Chorus 1"]').click();
 await page.locator('[data-repeat-section="Verse 1"]').click();
 await page.locator('[data-repeat-section="Chorus 1"]').click();
 assert.equal(await page.locator('#repeatChosenSections').innerText(),'Repeat 2 parts');
 assert.equal(await page.locator('[data-repeat-section="Chorus 1"]').getAttribute('aria-pressed'),'false');
 assert.equal(await page.locator('[data-repeat-section="Verse 1"]').getAttribute('aria-pressed'),'true');
 await page.locator('#repeatChosenSections').click();await page.waitForFunction(()=>__sections.state().playing);
 state=await page.evaluate(()=>__sections.state());assert.equal(state.multi,true);
 assert.equal(await page.locator('#timeFrom').inputValue(),'');assert.equal(await page.locator('#timeTo').inputValue(),'');
 assert.deepEqual(state.queue.map(s=>s.name),['Verse 1','Section 1']);assert.equal(state.start,0);
 await page.evaluate(()=>__sections.at(19.99));await page.waitForFunction(()=>__sections.state().start===40);
 state=await page.evaluate(()=>__sections.state());assert.equal(state.end,60);assert.equal(state.index,1);
 // Native audio ending must wrap to the first chosen part, including if a
 // backgrounded browser did not run its animation-frame boundary check.
 await page.evaluate(()=>__sections.ended());await page.waitForFunction(()=>__sections.state().playing&&__sections.state().start===0);
 await page.locator('#loopToggle').click();state=await page.evaluate(()=>__sections.state());
 assert.equal(state.multi,false);assert.deepEqual(state.queue,[]);
 await page.locator('#loopToggle').click();
 assert.equal(await page.locator('#repeatChosenSections').innerText(),'Repeat 2 parts');
 // Closing the chooser does not change the active transport.
 await page.locator('#closeRepeatSections').click();assert.equal((await page.evaluate(()=>__sections.state())).multi,false);
 await page.locator('#loopToggle').click();await page.locator('#repeatCurrentSection').click();
 await page.locator('#loopToggle').click();await page.locator('#pauseBtn').click();await page.locator('#loopToggle').click();
 await page.locator('#repeatAdjustments summary').click();await page.locator('#adjustSectionSelect').selectOption('Chorus 1');
 await page.getByRole('button',{name:'Start one beat earlier',exact:true}).click();
 state=await page.evaluate(()=>__sections.state());assert.equal(state.sections['Chorus 1'].start,19.5);assert.equal(state.sections['Verse 1'].end,19.5);
 assert.equal(state.structure.adjusted,true);
 // Save/load and device recovery retain detected sections and shared-edge adjustments.
 await page.evaluate(()=>{project.analysis.structure=__sections.state().structure;});
 await page.locator('#closeRepeatSections').click();
 await page.evaluate(()=>__sections.import(project));state=await page.evaluate(()=>__sections.state());assert.equal(state.sections['Chorus 1'].start,19.5);
 await page.evaluate(async()=>{await __sections.persist();__sections.reset();await __sections.restore();});
 state=await page.evaluate(()=>__sections.state());assert.equal(state.sections['Chorus 1'].start,19.5);
 page.once('dialog',d=>d.accept('Sections test'));
 const downloaded=page.waitForEvent('download');await page.evaluate(()=>__sections.save());const download=await downloaded;
 const saved=JSON.parse(fs.readFileSync(await download.path(),'utf8'));assert.equal(saved.analysis.structure.segments[1].start,19.5);
 // Mobile dialog remains within the viewport and readable at the editable large font.
 await page.locator('#loopToggle').click();
 for(const size of [14,22]){
  await page.evaluate(size=>document.documentElement.style.setProperty('--ui-font-size',size+'px'),size);
  const geometry=await page.locator('#repeatSectionDialog').evaluate(e=>({width:e.getBoundingClientRect().width,inner:e.clientWidth,scroll:e.scrollWidth,font:getComputedStyle(e).fontSize}));
  assert(geometry.width<=360);assert(geometry.scroll<=geometry.inner+1);assert.equal(geometry.font,size+'px');
  const footer=await page.locator('#repeatActions').boundingBox();assert(footer.y>=0&&footer.y+footer.height<=800,'repeat action must remain visible on mobile');
 }
 await page.screenshot({path:'/tmp/bass155-repeat-mobile.png'});
 await page.locator('#closeRepeatSections').click();
 // A delayed section job from the old song may not overwrite the new import.
 let releaseResponse,requestStarted;const started=new Promise(r=>requestStarted=r),release=new Promise(r=>releaseResponse=r);
 await page.route('https://api.runpod.ai/**',async route=>{requestStarted();await release;await route.fulfill({contentType:'application/json',body:JSON.stringify({id:'sections-test',status:'COMPLETED',output:{ok:true,structure:saved.analysis.structure}})});});
 await page.evaluate(()=>{__sections.reset();__sections.clearSectionJobs();__sections.key();window.waitingSections=__sections.ensure();});await started;
 await page.evaluate(async()=>{const p=await __sections.project('Replacement');p.analysis.structure={segments:[{name:'Replacement section',start:0,end:60}]};await __sections.import(p);});releaseResponse();await page.evaluate(()=>waitingSections);
 state=await page.evaluate(()=>__sections.state());assert.equal(state.name,'Replacement.wav');assert.equal(state.structure.segments.length,1);assert.equal(state.structure.segments[0].name,'Replacement section');assert.equal(state.busy,false);
 // Successful service result is independently applied without altering notes/chords.
 await page.unroute('https://api.runpod.ai/**');
 await page.route('https://api.runpod.ai/**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({status:'COMPLETED',output:{ok:true,structure:saved.analysis.structure}})}));
 await page.evaluate(()=>{__sections.reset();__sections.clearSectionJobs();});
 assert.equal(await page.evaluate(()=>__sections.ensure()),true);state=await page.evaluate(()=>__sections.state());
 assert.equal(state.structure.segments.length,3);assert.deepEqual(state.notes,[36]);assert.deepEqual(state.chords,[]);
 // The screenshot regression: waiting is not presented as a clickable but
 // disabled section. Background completion changes the existing Repeat card.
 await page.evaluate(()=>{__sections.reset();__sections.clearSectionJobs();});
 await page.unroute('https://api.runpod.ai/**');
 let postCount=0,getCount=0,releaseStatus,statusStarted;
 const statusWaiting=new Promise(r=>statusStarted=r),statusGate=new Promise(r=>releaseStatus=r);
 await page.route('https://api.runpod.ai/**',async route=>{
  if(route.request().method()==='POST'){postCount++;return route.fulfill({contentType:'application/json',body:JSON.stringify({id:'queued-sections',status:'IN_QUEUE'})});}
  getCount++;if(getCount===1){statusStarted();await statusGate;return route.abort('failed');}
  return route.fulfill({contentType:'application/json',body:JSON.stringify({id:'queued-sections',status:'COMPLETED',output:{ok:true,structure:saved.analysis.structure}})});
 });
 await page.locator('#loopToggle').click();await statusWaiting;
 assert.equal(await page.locator('#repeatCurrentSection').isVisible(),false);
 assert.equal(await page.locator('#repeatProgress').isVisible(),true);
 assert.match(await page.locator('#repeatSectionHint').innerText(),/Choices appear here when ready/);
 assert.match(await page.locator('#repeatElapsed').innerText(),/Time waiting:/);
 assert.equal(await page.locator('#closeRepeatSections').innerText(),'Keep practising');
 await page.locator('#closeRepeatSections').click();releaseStatus();
 await page.waitForFunction(()=>!__sections.state().busy);
 await page.locator('#loopToggle').click();
 assert.equal(await page.locator('#repeatFindSections').innerText(),'Check progress');
 assert.match(await page.locator('#repeatSectionStatus').innerText(),/Connection interrupted/);
 await page.locator('#closeRepeatSections').click();
 // Reopening the same older saved project changes File.lastModified, but the
 // audio hash must still recover the existing job, with no second POST.
 await page.evaluate(()=>__sections.import(project));
 await page.evaluate(()=>__sections.reset());
 assert.equal(await page.evaluate(()=>__sections.ensure()),true);
 assert.equal(postCount,1);assert.equal(getCount,2);
 assert.equal(await page.locator('#repeatReadyLabel').isVisible(),true);
 assert.equal(await page.locator('#loopToggle svg').isVisible(),false);
 await page.locator('#loopToggle').click();
 assert.equal(await page.locator('[data-repeat-section]').count(),3);
 assert.equal(await page.locator('#repeatProgress').isVisible(),false);
 assert.equal(await page.locator('#repeatReadyLabel').isVisible(),false);
 assert.equal(await page.locator('#loopToggle svg').isVisible(),true);
 await page.locator('#closeRepeatSections').click();
 // Completed sections are reused by matching the audio, even for an older
 // project without a section map. No further service request is made.
 const countBefore=postCount+getCount;
 await page.evaluate(async()=>{await __sections.import(project);__sections.reset();await __sections.ensure();});
 assert.equal(postCount+getCount,countBefore);
 assert.equal((await page.evaluate(()=>__sections.state())).structure.segments.length,3);
 // An unresponsive network request ends visibly and retains the job for retry.
 await page.unroute('https://api.runpod.ai/**');
 await page.evaluate(()=>{__sections.reset();__sections.clearSectionJobs();__sections.timeoutSoon();});
 let releaseHung;const hung=new Promise(r=>releaseHung=r);
 await page.route('https://api.runpod.ai/**',async route=>{
  if(route.request().method()==='POST')return route.fulfill({contentType:'application/json',body:JSON.stringify({id:'hung-sections',status:'IN_QUEUE'})});
  await hung;try{await route.abort();}catch{}
 });
 assert.equal(await page.evaluate(()=>__sections.ensure()),false);releaseHung();
 await page.evaluate(()=>__sections.restoreTimer());
 assert.equal((await page.evaluate(()=>__sections.state())).busy,false);
 await page.locator('#loopToggle').click();
 assert.equal(await page.locator('#repeatFindSections').innerText(),'Check progress');
 assert.equal(await page.locator('#repeatProgress').isVisible(),false);
 assert.equal(await page.locator('#repeatCurrentSection').isVisible(),false);
 await page.locator('#closeRepeatSections').click();
 // Both audio and older saved-project imports start section detection without
 // opening Repeat. A saved map and a cached map need no API key or new job.
 await page.unroute('https://api.runpod.ai/**');
 let autoPosts=0;
 await page.route('https://api.runpod.ai/**',route=>{
  assert.equal(route.request().method(),'POST');autoPosts++;
  return route.fulfill({contentType:'application/json',body:JSON.stringify({status:'COMPLETED',output:{ok:true,structure:{segments:[{name:'Verse 1',label:'verse',start:0,end:60}]}}})});
 });
 await page.evaluate(async()=>{__sections.clearSectionJobs();window.rawProject=await __sections.project('Auto raw');await __sections.importAudio(rawProject);});
 await page.waitForFunction(()=>__sections.state().structure?.segments.length===1&&!__sections.state().busy);
 assert.equal(autoPosts,1);assert.equal(await page.locator('#repeatSectionDialog').isVisible(),false);
 await page.evaluate(async()=>{__sections.clearSectionJobs();window.oldProject=await __sections.project('Auto saved');await __sections.import(oldProject);});
 await page.waitForFunction(()=>__sections.state().structure?.segments.length===1&&!__sections.state().busy);
 assert.equal(autoPosts,2);assert.equal(await page.locator('#repeatSectionDialog').isVisible(),false);
 await page.evaluate(async()=>{__sections.noKey();await __sections.import(oldProject);});
 await page.waitForFunction(()=>__sections.state().structure?.segments.length===1&&!__sections.state().busy);
 assert.equal(autoPosts,2,'cached sections must load without credentials');
 await page.evaluate(async()=>{__sections.clearSectionJobs();await __sections.import(project);});
 assert.equal(autoPosts,2,'saved section maps must not create a job');
 // A failed import leaves the current song and never starts extra analysis.
 assert.equal(await page.evaluate(()=>__sections.import({...project,source:{...project.source,audioBase64:'bad'}})),false);
 assert.equal(autoPosts,2);
 // No credentials means a clear connection action, not a hidden key prompt.
 await page.evaluate(async()=>{await __sections.import(oldProject);});
 await page.waitForFunction(()=>!__sections.state().busy);
 assert.match((await page.evaluate(()=>__sections.state())).error,/Connect once/);
 assert.equal(autoPosts,2);
 assert.deepEqual(errors,[]);await browser.close();
 console.log('PASS: multiple selection, song-order playback, gap skipping, end wrap, stop, mobile, automatic raw/project imports, no duplicate jobs, cache without credentials, and existing section recovery/import guards.');
})().catch(e=>{console.error(e);process.exit(1);});
