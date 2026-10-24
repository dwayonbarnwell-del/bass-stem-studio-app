const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const marker="  initAnalysisTools();\n  renderBassFretboard();";
assert(html.includes(marker));
const fixture=`window.__test={
 async fixture(){ensureCtx();buffer=ctx.createBuffer(1,20*8000,8000);activeAudioFile=new File([wavBlob(buffer)],'fixture.wav',{type:'audio/wav',lastModified:100});
 notes=[{midi:36,start:0.1,end:.8,confidence:.9,cloudMidi:36},{midi:43,start:3.1,end:3.8,confidence:.9}];analysedBassNotes=notes.map(n=>({...n}));offlineAnalysisReady=true;
 applySongContext({song_scale:'C major',tempo_bpm:100,chords:[{start:0,end:4,root_pc:0,quality:'maj',confidence:.9,evidence_version:'chord-timeline-v3'}]});
 audioKeyBuffer=buffer;audioKeyReady=true;audioKeySections=[{start:0,end:10,scale:'C major'},{start:10,end:20,scale:'D major'}];detectedBaseScale=parseSongScaleContext('C major');drawAll();},
 state(){return {notes,detectedChordChanges,transposeSemitones,currentScaleContext,detectedScaleContext,manualCorrections,keyCorrections,analysisHistory,playing,selected:[...selectedTimeframes]};},
 correctSongKey,updateSectionKey,analysisSnapshot,restoreAnalysisSnapshot,restoreDeviceAnalysis,persistAnalysisRecovery,
 replayManualCorrections,applySectionAnalysis,openAnalysisEditor,commitAnalysisEdit,
 recoveryStore,selectedAnalysisRange,parseNotePitch,scaleDegreeLabel,collectPendingAnalysisParts,applySegmentedRunPodResults,
 setNotes(value){notes=value;},setChords(value){detectedChordChanges=value;},
 reset(){notes=[];detectedChordChanges=[];manualCorrections=[];keyCorrections=[];analysisHistory=[];},
 select(value){selectedTimeframes=new Set(value);},
 async project(){await saveBassStudioProject();},
 importProject:importBassStudioProject
};\n`;
const testHtml=html.replace(marker,fixture+marker);
(async()=>{
 const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox','--disable-gpu','--disable-software-rasterizer','--no-zygote']});
 const page=await browser.newPage({viewport:{width:360,height:800}});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:8151/')?route.continue():route.abort());
 await page.route('http://127.0.0.1:8151/index.html',route=>route.fulfill({contentType:'text/html',body:testHtml}));
 await page.goto('http://127.0.0.1:8151/index.html');await page.evaluate(()=>__test.fixture());
 await page.locator('#analysisTools summary').click();
 await page.evaluate(()=>__test.correctSongKey(5,'minor','section'));
 let s=await page.evaluate(()=>__test.state());assert.equal(s.transposeSemitones,0);assert.equal(s.currentScaleContext.rootPc,5);assert.equal(s.currentScaleContext.mode,'minor');
 assert.equal(await page.evaluate(()=>__test.scaleDegreeLabel(41)),'1');
 await page.evaluate(()=>__test.updateSectionKey(12));s=await page.evaluate(()=>__test.state());assert.equal(s.currentScaleContext.rootPc,2,'later modulation kept');
 await page.evaluate(()=>__test.updateSectionKey(1));s=await page.evaluate(()=>__test.state());assert.equal(s.currentScaleContext.rootPc,5);
 await page.locator('#transposeInput').fill('2');await page.locator('#transposeApply').click();s=await page.evaluate(()=>__test.state());assert.equal(s.transposeSemitones,2);assert.equal(s.currentScaleContext.rootPc,7);
 await page.locator('#editAnalysisToggle').click();
 await page.locator('.note-token').first().click();assert(await page.locator('#analysisEditDialog').isVisible());
 await page.locator('#editPitch').fill('D2');await page.locator('#analysisEditForm button[type=submit]').click();
 s=await page.evaluate(()=>__test.state());assert.equal(s.notes[0].midi,38);assert.equal(s.notes[0].cloudMidi,36);assert.equal(s.notes[0].manual,true);assert.deepEqual(s.selected,[]);
 await page.locator('.chord-name').first().click();await page.locator('#editChordRoot').selectOption('7');await page.locator('#editChordQuality').selectOption('7');await page.locator('#analysisEditForm button[type=submit]').click();
 s=await page.evaluate(()=>__test.state());assert.equal(s.detectedChordChanges[0].rootPc,7);assert.equal(s.detectedChordChanges[0].manual,true);
 assert((await page.locator('.chord-name').first().innerText()).startsWith('A7'));
 // Export/import must preserve the manual pitch rather than overwrite it with cloudMidi.
 page.once('dialog',d=>d.accept('Correction roundtrip'));
 const downloadPromise=page.waitForEvent('download');await page.evaluate(()=>__test.project());
 const download=await downloadPromise;await download.saveAs('/tmp/bass151-roundtrip.bassstudio');
 const projectText=fs.readFileSync('/tmp/bass151-roundtrip.bassstudio','utf8');const project=JSON.parse(projectText);
 assert.equal(project.schemaVersion,2);assert.equal(project.analysis.notes[0].midi,38);assert.equal(project.analysis.notes[0].cloudMidi,36);
 await page.evaluate(text=>__test.importProject(new File([text],'test.bassstudio',{type:'application/json'})),projectText);
 s=await page.evaluate(()=>__test.state());assert.equal(s.notes[0].midi,38);assert.equal(s.detectedChordChanges[0].rootPc,7);
 // Saved completed parts are reused without contacting the cloud service.
 await page.evaluate(()=>__test.recoveryStore('results',store=>store.put({id:'finished-fixture',signature:'test-audio',data:{status:'COMPLETED',output:{ok:true,notes:[]}}})));
 const cached=await page.evaluate(()=>__test.collectPendingAnalysisParts({signature:'test-audio',parts:[{id:'finished-fixture',label:'P1'}]},'unused-test-key'));
 assert.equal(cached.length,1);assert.equal(cached[0].status,'COMPLETED');
 // A rerun changes the detector output; corrections must still win once.
 await page.evaluate(()=>{__test.setNotes([{midi:36,start:.11,end:.9,confidence:.9}]);__test.setChords([{start:0,end:4,rootPc:0,quality:'maj'}]);__test.replayManualCorrections();__test.replayManualCorrections();});
 s=await page.evaluate(()=>__test.state());assert.equal(s.notes.length,1);assert.equal(s.notes[0].midi,38);assert.equal(s.detectedChordChanges.length,1);
 await page.evaluate(()=>__test.persistAnalysisRecovery());await page.evaluate(()=>__test.reset());assert(await page.evaluate(()=>__test.restoreDeviceAnalysis()));
 s=await page.evaluate(()=>__test.state());assert.equal(s.notes[0].midi,38);assert.equal(s.detectedChordChanges[0].rootPc,7);assert.equal(s.keyCorrections.length,1);
 // Reanalysis only replaces the selected onset range, retaining outside notes.
 await page.evaluate(async()=>{__test.setNotes([{midi:36,start:.1,end:1},{midi:43,start:8,end:9}]);await __test.applySectionAnalysis({scope:'section',range:{start:2,end:4},parts:[{coreStart:2,coreEnd:4,audioStart:1,audioEnd:5}]},[{status:'COMPLETED',output:{ok:true,notes:[{midi:40,start:1.2,end:1.8,confidence:.9}],chords:[]}}]);});
 s=await page.evaluate(()=>__test.state());assert(s.notes.some(n=>n.start===8&&n.midi===43));assert(s.notes.some(n=>n.start===2.2&&n.midi===40));
 const beforeFailure=await page.evaluate(()=>JSON.stringify(__test.state()));
 assert(await page.evaluate(async()=>{try{await __test.applySegmentedRunPodResults({parts:[{coreStart:0,coreEnd:20,audioStart:0,audioEnd:20}]},[{status:'COMPLETED',output:{ok:true,song_scale:'B major',notes:[]}}]);return false;}catch{return true;}}));
 assert.equal(await page.evaluate(()=>JSON.stringify(__test.state())),beforeFailure,'failed analysis must preserve previous notes/key');
 await page.evaluate(async()=>{await __test.applySectionAnalysis({scope:'section',range:{start:4,end:6},parts:[{coreStart:4,coreEnd:6,audioStart:3,audioEnd:7}]},[{status:'COMPLETED',output:{ok:true,notes:[{midi:41,start:1.2,end:1.8}],chords:[{start:1,end:3,root_pc:5,quality:'min',confidence:.9,evidence_version:'chord-timeline-v4'}]}}]);});
 assert((await page.locator('.chord-name').allTextContents()).some(x=>x==='Gm'),'new neural chords must appear after section reanalysis');
 await page.evaluate(()=>__test.select([0,4]));assert(await page.evaluate(()=>{try{__test.selectedAnalysisRange();return false;}catch{return true;}}));
 // Reject invalid editing without changing the current notes.
 await page.evaluate(()=>__test.openAnalysisEditor('note',__test.state().notes[0]));await page.locator('#editPitch').fill('H2');await page.locator('#analysisEditForm button[type=submit]').click();assert(await page.locator('#editEventError').innerText());await page.locator('#closeAnalysisEdit').click();
 for(const width of [360,412,800]){await page.setViewportSize({width,height:900});for(const size of [11,14,22]){
   await page.locator('#fontSizeInput').fill(String(size));await page.locator('#fontSizeInput').dispatchEvent('change');
   const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+2,cards:[...document.querySelectorAll('.note-token')].map(e=>{let r=e.getBoundingClientRect();return [r.width,r.height];})}));
   assert(!layout.overflow,`overflow ${width}/${size}`);if(layout.cards.length>1)assert(layout.cards.every(c=>Math.abs(c[0]-layout.cards[0][0])<1&&Math.abs(c[1]-layout.cards[0][1])<1));
 }}
 await page.setViewportSize({width:412,height:900});await page.locator('#fontSizeInput').fill('14');await page.locator('#fontSizeInput').dispatchEvent('change');
 await page.screenshot({path:'/tmp/bass151-tools.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS: key correction, modulation, transpose, manual notes/chords, replay, recovery, section merging, validation, equal cards and mobile sizes.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
