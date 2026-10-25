const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const html=fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8');
const marker='  initAnalysisTools();\n  renderBassFretboard();';
const fixture=`window.__sections={
 async project(name='Structure song'){
  ensureCtx();const b=ctx.createBuffer(1,60*8000,8000);
  return {format:'Bass Stem Studio Project',schemaVersion:2,projectName:name,
   source:{name:name+'.wav',type:'audio/wav',audioBase64:arrayBufferToBase64(await wavBlob(b).arrayBuffer())},
   analysis:{notes:[{midi:36,start:.1,end:.7,confidence:.95}],scale:'C major',tempoBpm:120}};
 },
 import(p){return importBassStudioProject(new File([JSON.stringify(p)],'song.bassstudio'));},
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
  notes:notes.map(n=>n.midi),chords:detectedChordChanges};},
 key(){localStorage.setItem(RUNPOD_SAVED_KEY,'fixture-only');},
 reset(){songStructure=null;sections={};structureError='';renderRepeatChooser();},
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
 await page.locator('[data-repeat-section="Verse 1"]').click();state=await page.evaluate(()=>__sections.state());
 assert.deepEqual(state.selected,[]);assert.equal(state.timeframe,false);assert.equal(state.start,0);assert.equal(state.end,20);
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
 }
 await page.screenshot({path:'/tmp/bass155-repeat-mobile.png'});
 await page.locator('#closeRepeatSections').click();
 // A delayed section job from the old song may not overwrite the new import.
 let releaseResponse,requestStarted;const started=new Promise(r=>requestStarted=r),release=new Promise(r=>releaseResponse=r);
 await page.route('https://api.runpod.ai/**',async route=>{requestStarted();await release;await route.fulfill({contentType:'application/json',body:JSON.stringify({id:'sections-test',status:'COMPLETED',output:{ok:true,structure:saved.analysis.structure}})});});
 await page.evaluate(()=>{__sections.reset();__sections.key();window.waitingSections=__sections.ensure();});await started;
 await page.evaluate(async()=>{const p=await __sections.project('Replacement');await __sections.import(p);});releaseResponse();await page.evaluate(()=>waitingSections);
 state=await page.evaluate(()=>__sections.state());assert.equal(state.name,'Replacement.wav');assert.equal(state.structure,null);assert.deepEqual(state.sections,{});assert.equal(state.busy,false);
 // Successful service result is independently applied without altering notes/chords.
 await page.unroute('https://api.runpod.ai/**');
 await page.route('https://api.runpod.ai/**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({status:'COMPLETED',output:{ok:true,structure:saved.analysis.structure}})}));
 assert.equal(await page.evaluate(()=>__sections.ensure()),true);state=await page.evaluate(()=>__sections.state());
 assert.equal(state.structure.segments.length,3);assert.deepEqual(state.notes,[36]);assert.deepEqual(state.chords,[]);
 assert.deepEqual(errors,[]);await browser.close();
 console.log('PASS: section chooser, current section, repeat start/stop, cell coexistence, beat adjustments, save/import/recovery, mobile layout, and stale-job isolation.');
})().catch(e=>{console.error(e);process.exit(1);});
