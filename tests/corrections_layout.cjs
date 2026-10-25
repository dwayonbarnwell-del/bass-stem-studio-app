const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const marker="  initAnalysisTools();\n  renderBassFretboard();";
const fixture=`window.__layout={
 async load(){ensureCtx();buffer=ctx.createBuffer(1,20*8000,8000);activeAudioFile=new File([wavBlob(buffer)],'layout.wav',{type:'audio/wav'});
 notes=Array.from({length:18},(_,i)=>({midi:36+i%8,start:i*.3,end:i*.3+.2,confidence:.9,isFill:i%2===0}));
 analysedBassNotes=notes.map(n=>({...n}));offlineAnalysisReady=true;
 const c=(start,end,rootPc,quality,uncertain=false,bassPc=null)=>({start,end,rootPc,quality,uncertain,bassPc,confidence:.9,evidenceVersion:'chord-timeline-v4'});
 detectedChordChanges=[c(0,.25,1,'sus2',true),c(.25,.75,8,'maj'),c(.75,1,8,'maj',true),c(1,1.4,8,'11'),c(1.4,2,0,'min7'),c(2,4,6,'maj'),c(4,6,1,'7sus4',true,8)];
 detectedBaseScale=parseSongScaleContext('C# major');audioKeyBuffer=buffer;audioKeyReady=true;audioKeySections=[{start:0,end:10,scale:'C# major'},{start:10,end:20,scale:'F# major'}];
 setTimelineCellSeconds(2,{clearSelection:false,rebuild:false});drawAll();},
 state(){return {notes,detectedChordChanges,transposeSemitones,analysisEditMode,keyCorrections,selected:[...selectedTimeframes]};},
 busy(value){aiBusy=value;updateAnalysisToolsState();},
 select(value){selectedTimeframes=new Set(value);loopStart=null;loopEnd=null;updateAnalysisToolsState();},
 reset(){buffer=null;resetSongContext();notes=[];offlineAnalysisReady=false;updateAnalysisToolsState();},
 at(t){updateSimpleTimeline(t);},
 refresh(){rebuildSimpleTimeline._sig='';drawAll();}
};\n`;
(async()=>{
 const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox','--disable-gpu','--disable-software-rasterizer','--no-zygote']});
 const page=await browser.newPage({viewport:{width:360,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:8151/')?r.continue():r.abort());
 await page.route('http://127.0.0.1:8151/index.html',r=>r.fulfill({contentType:'text/html',body:html.replace(marker,fixture+marker)}));
 await page.goto('http://127.0.0.1:8151/index.html');
 assert(await page.locator('#analyseSelection').isDisabled());
 assert.equal(await page.locator('#transposeInput,#transposeApply').count(),0,'only the existing Scale control transposes');
 assert.equal(await page.locator('#analysisHistoryTools').count(),0);
 await page.evaluate(()=>__layout.load());
 const original=await page.evaluate(()=>JSON.stringify([__layout.state().notes,__layout.state().detectedChordChanges]));
 const first=page.locator('.chord-cell').first();
 assert.deepEqual(await first.locator('.chord-name').allTextContents(),['C#sus2?','AbM?','Ab11','Cm7']);
 assert.equal(await page.locator('.chord-more').count(),0,'no chord is hidden behind a count');
 await page.evaluate(()=>__layout.at(1.5));assert.equal(await page.locator('.current-chord').innerText(),'Cm7','fourth chord follows the clock');
 await page.evaluate(()=>__layout.at(.5));assert.equal(await page.locator('.current-chord').innerText(),'AbM?');
 assert(await page.locator('.current-chord.tentative').isVisible(),'highlight must preserve uncertainty');
 await page.evaluate(()=>__layout.at(6.5));assert.equal(await page.locator('.current-chord').count(),0,'no invented chord in a gap');
 assert.equal(await page.evaluate(()=>JSON.stringify([__layout.state().notes,__layout.state().detectedChordChanges])),original,'preview does not rewrite analysis');
 await first.locator('.chord-name').nth(1).click();
 assert(await page.locator('#chordDetailsDialog').isVisible());
 assert.equal(await page.locator('.chord-detail-row').count(),5,'all original changes remain available');
 assert((await page.locator('#chordDetailsList').innerText()).includes('0:00.750 to 0:01'));
 await page.locator('#closeChordDetails').click();
 // A single chord is also accessible by keyboard and does not toggle repeat.
 await page.locator('.chord-cell').nth(1).locator('.chord-name').press('Enter');
 assert(await page.locator('#analysisEditDialog').isVisible());
 assert.deepEqual((await page.evaluate(()=>__layout.state())).selected,[]);
 await page.locator('#closeAnalysisEdit').click();
 await page.evaluate(()=>__layout.select([0,4]));assert(await page.locator('#analyseSelection').isDisabled());
 await page.evaluate(()=>__layout.select([0,2]));assert(await page.locator('#analyseSelection').isEnabled());
 assert.equal(await page.locator('#analyseSelection').innerText(),'Reanalyse 0:00 to 0:04');
 assert.equal(await page.locator('#keyCorrectionTools,#editAnalysisToggle').count(),0);
 await page.locator('.chord-cell').first().locator('.chord-name').nth(1).click();
 assert(await page.locator('#chordDetailsDialog').isVisible(),'merged chord fragments remain individually editable');
 await page.locator('#chordDetailsList button').nth(2).click();
 assert(await page.locator('#analysisEditDialog').isVisible());
 assert.equal(await page.locator('#editEventStart').inputValue(),'0.75');
 await page.locator('#closeAnalysisEdit').click();
 await page.evaluate(()=>__layout.busy(true));
 for(const id of ['undoAnalysisEdit','analyseSelection'])assert(await page.locator('#'+id).isDisabled(),id);
 await page.evaluate(()=>__layout.busy(false));
 const measurements=[];
 for(const width of [360,412,800]){await page.setViewportSize({width,height:900});for(const font of [11,14,22]){
  await page.locator('#fontSizeInput').fill(String(font));await page.locator('#fontSizeInput').dispatchEvent('change');await page.evaluate(()=>__layout.refresh());
  const metrics=await page.evaluate(()=>{
   const ruler=document.querySelector('#chordRuler').getBoundingClientRect();
   const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,width:r.width,height:r.height,top:r.top,bottom:r.bottom};};
   return {overflow:document.documentElement.scrollWidth>innerWidth+2,ruler:rect(document.querySelector('#chordRuler')),
    cells:[...document.querySelectorAll('.chord-cell')].map(rect),times:[...document.querySelectorAll('.time-mark')].map(rect),
    labels:[...document.querySelectorAll('.chord-name')].map(e=>({...rect(e),scroll:e.scrollHeight,client:e.clientHeight})),
    cards:[...document.querySelectorAll('.note-token')].map(rect)};
  });
  assert(!metrics.overflow,`page overflow ${width}/${font}`);
  metrics.cells.forEach((c,i)=>{assert(Math.abs(c.x-metrics.times[i].x)<1);assert(Math.abs(c.width-metrics.times[i].width)<1);});
  for(const r of metrics.labels){assert(r.top>=metrics.ruler.top-1&&r.bottom<=metrics.ruler.bottom+1,`label outside chord row ${width}/${font}`);assert(r.scroll<=r.client+1);}
  for(const r of metrics.cards){assert(Math.abs(r.width-metrics.cards[0].width)<1);assert(Math.abs(r.height-metrics.cards[0].height)<1);}
  if(font===14)assert(metrics.ruler.height<100,'crowded row stays compact at default size');
  measurements.push({width,font,chordHeight:metrics.ruler.height});
 }}
 await page.setViewportSize({width:412,height:900});await page.locator('#fontSizeInput').fill('14');await page.locator('#fontSizeInput').dispatchEvent('change');
 await page.locator('.simple-timeline-card').scrollIntoViewIfNeeded();
 await page.screenshot({path:'/workspace/scratch/fd45fc3be636/work153/timeline-mobile.png'});
 await page.locator('#analysisTools').scrollIntoViewIfNeeded();
 await page.screenshot({path:'/workspace/scratch/fd45fc3be636/work153/corrections-mobile.png'});
 await page.evaluate(()=>__layout.reset());assert(await page.locator('#undoAnalysisEdit').isDisabled());
 assert.deepEqual(errors,[]);console.log(JSON.stringify({result:'PASS',measurements}));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
