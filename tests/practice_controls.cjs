const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const marker='  initAnalysisTools();\n  renderBassFretboard();';
const fixture=`window.__practice={
 async load(){ensureCtx();const b=ctx.createBuffer(1,60*8000,8000);const p={format:'Bass Stem Studio Project',schemaVersion:2,projectName:'Practice example',source:{name:'Practice example.wav',type:'audio/wav',audioBase64:arrayBufferToBase64(await wavBlob(b).arrayBuffer())},analysis:{notes:Array.from({length:100},(_,i)=>({midi:36+i%10,start:i*.2,end:i*.2+.18,confidence:.95,isFill:i%3===0})),scale:'C major',tempoBpm:120,chords:Array.from({length:20},(_,i)=>({start:i,end:i+1,rootPc:i%2?5:0,quality:'maj',confidence:.95,evidenceVersion:'chord-timeline-v4'})),structure:{version:'song-structure-v1-allinone',segments:[{name:'Verse 1',start:0,end:20},{name:'Chorus 1',start:20,end:40},{name:'Bridge',start:40,end:60}]}}};await importBassStudioProject(new File([JSON.stringify(p)],'practice.bassstudio'));return p;},
 state(){return {start:loopStart,end:loopEnd,multi:multiSectionMode,loop:loopEnabled,timeframe:timeframeLoopMode,queue:sectionQueue,index:queueIndex,selected:[...selectedSections],times:[...selectedTimeframes],draft:[...repeatSectionDraft],overrides:[...repeatRangeOverrides],notes:notes.map(n=>({...n})),transposeSemitones};},
 dense(){notes=Array.from({length:24},(_,i)=>({midi:36+i%8,start:i/24,end:(i+1)/24,confidence:.95}));rebuildSimpleTimeline._sig="";drawAll();},
 advance:advanceSelectedSection,at(t){seekTo(t);drawAll();scrollTimelineToTime(t);},
 follow(t){pausedAt=t;playing=true;updateSimpleTimeline(t);playing=false;},import:importBassStudioProject
};\n`;
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox','--disable-gpu','--no-zygote']});
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>r.abort());await page.route('http://127.0.0.1:8151/index.html',r=>r.fulfill({contentType:'text/html',body:html.replace(marker,fixture+marker)}));
 await page.goto('http://127.0.0.1:8151/index.html');await page.evaluate(async()=>{window.fixtureProject=await __practice.load();});
 assert.equal(await page.locator('#timelineSplitSelect').inputValue(),'1');
 assert.equal(await page.locator('#repeatAdjustments,#keyCorrectionTools,#analysisHistoryTools,#editAnalysisToggle').count(),0);
 await page.locator('#loopToggle').click();await page.locator('[data-repeat-section="Verse 1"]').click();await page.locator('[data-repeat-section="Bridge"]').click();await page.locator('#repeatChosenSections').click();await page.locator('#pauseBtn').click();
 assert.equal(await page.locator('#timeFrom').inputValue(),'0:00');assert.equal(await page.locator('#timeTo').inputValue(),'0:20');
 await page.locator('#timeFrom').fill('002');await page.locator('#timeFrom').press('Tab');
 await page.locator('#timeTo').fill('018');await page.locator('#timeTo').press('Tab');
 let s=await page.evaluate(()=>__practice.state());assert.equal(s.start,2);assert.equal(s.end,18);assert.equal(s.multi,true);assert.equal(s.queue.length,2);
 await page.evaluate(()=>__practice.advance());assert.equal(await page.locator('#timeFrom').inputValue(),'0:40');assert.equal(await page.locator('#timeTo').inputValue(),'1:00');
 await page.evaluate(()=>__practice.advance());s=await page.evaluate(()=>__practice.state());assert.equal(s.start,2);assert.equal(s.end,18);
 await page.locator('#timeTo').fill('0:01');await page.locator('#timeTo').dispatchEvent('change');assert.equal((await page.evaluate(()=>__practice.state())).end,18,'invalid range leaves repeat intact');
 await page.locator('#clearLoop').click();s=await page.evaluate(()=>__practice.state());assert.equal(s.loop,false);assert.equal(s.multi,false);assert.equal(s.timeframe,false);for(const name of ['queue','selected','times','draft','overrides'])assert.deepEqual(s[name],[]);assert.equal(await page.locator('#timeFrom').inputValue(),'');
 await page.locator('.time-mark[data-time="4"]').click();assert.equal(await page.locator('#timeFrom').inputValue(),'0:04');assert.equal(await page.locator('#timeTo').inputValue(),'0:05');await page.locator('#clearLoop').click();
 await page.evaluate(()=>__practice.at(0));const before=await page.evaluate(()=>__practice.state());
 await page.locator('.note-token').first().click();assert(await page.locator('.note-time-cell .note-inline-editor').isVisible());
 await page.screenshot({path:path.join(__dirname,'../../work158/inline-edit.png')});
 await page.locator('.note-inline-editor input').fill('H2');await page.locator('.note-inline-editor button[type=submit]').click();assert.match(await page.locator('.note-inline-editor [role=alert]').innerText(),/octave/);
 await page.locator('.note-inline-editor input').fill('D2');await page.locator('.note-inline-editor button[type=submit]').click();s=await page.evaluate(()=>__practice.state());assert.equal(s.notes[0].midi,38);assert.equal(s.notes[0].start,before.notes[0].start);assert.equal(s.notes[0].end,before.notes[0].end);assert.deepEqual(s.times,[]);
 await page.locator('.note-token').first().press('Enter');await page.locator('.note-inline-editor').getByRole('button',{name:'Undo',exact:true}).click();assert.equal((await page.evaluate(()=>__practice.state())).notes[0].midi,before.notes[0].midi);
 // Unsupported rotation is explained, not falsely reported as a completed turn.
 await page.evaluate(()=>Object.defineProperty(screen.orientation,'lock',{configurable:true,value:async()=>{throw Error('unsupported');}}));
 await page.locator('#orientationToggle').click();await page.waitForFunction(()=>document.querySelector('#orientationMessage').textContent.includes('Turn your phone'));assert.match(await page.locator('#orientationMessage').innerText(),/Turn your phone to landscape/);
 const geometry=[];
 for(const [width,height] of [[360,800],[412,915],[844,390],[740,360]]){
  await page.setViewportSize({width,height});await page.evaluate(()=>{window.scrollTo(0,0);__practice.at(12.05);});await page.waitForTimeout(100);
  const m=await page.evaluate(()=>{const r=e=>{const x=e.getBoundingClientRect();return {x:x.x,y:x.y,w:x.width,h:x.height,b:x.bottom,r:x.right};};return {overflow:document.documentElement.scrollWidth>innerWidth+2,controls:['orientationToggle','fontSizeInput','bassStringSelect','tempo','timelineSplitSelect','playBtn','pauseBtn','loopToggle','timeFrom','timeTo','clearLoop','scaleSelect'].map(id=>({id,...r(document.getElementById(id))})),panel:r(document.querySelector('.simple-timeline-card')),scroll:r(document.querySelector('#timelineScroll')),ruler:r(document.querySelector('#timeRuler')),chords:r(document.querySelector('#chordRuler')),active:r(document.querySelector('.note-time-cell.active')),cards:[...document.querySelectorAll('.note-token')].map(r)};});
  assert(!m.overflow,`overflow ${width} ${JSON.stringify(m)}`);
  for(const c of m.controls){assert(c.x>=-1&&c.r<=width+1&&c.y>=-1&&c.b<=height+1,`control clipped ${width} ${JSON.stringify(c)}`);}
  assert(m.scroll.h>=120,`timeline too short ${width} ${JSON.stringify(m)}`);
  assert(m.active.x>=m.scroll.x-1&&m.active.r<=m.scroll.r+1,`active bar clipped ${width}`);
  assert(m.ruler.b<=height&&m.chords.b<=height,`headers clipped ${width}`);
  assert(m.cards.every(c=>Math.abs(c.w-m.cards[0].w)<1&&Math.abs(c.h-m.cards[0].h)<1));geometry.push({width,height,m});
  await page.screenshot({path:path.join(__dirname,`../../work158/practice-${width}.png`)});
 }
 await page.setViewportSize({width:844,height:390});await page.locator('#practiceViewSelect').selectOption('bass');
 const fret=await page.locator('#bassFretboard').boundingBox();assert(fret.y>=0&&fret.y+fret.height<=390,`bass neck outside landscape ${JSON.stringify(fret)}`);
 await page.locator('#practiceViewSelect').selectOption('timeline');
 await page.evaluate(()=>{__practice.dense();__practice.at(.96);__practice.follow(.96);});
 const followed=await page.evaluate(()=>{const n=document.querySelector('.note-token.active').getBoundingClientRect(),v=document.querySelector('#timelineScroll').getBoundingClientRect(),c=document.querySelector('#chordRuler').getBoundingClientRect();return {top:n.top,bottom:n.bottom,visibleTop:c.bottom,visibleBottom:v.bottom,count:document.querySelectorAll('.note-token').length};});
 assert.equal(followed.count,24);assert(followed.top>=followed.visibleTop&&followed.bottom<=followed.visibleBottom,JSON.stringify(followed));
 // Importing another song closes any inline editor and cannot apply the old edit.
 await page.evaluate(()=>__practice.at(0));await page.locator('.note-token').first().click();await page.evaluate(()=>__practice.import(new File([JSON.stringify(fixtureProject)],'replacement.bassstudio')));assert.equal(await page.locator('.note-inline-editor').count(),0);
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(__dirname,'../../work158/layout-results.json'),JSON.stringify(geometry,null,2));
 console.log('PASS: editable queued ranges, clear all repeats, one-second default, inline edit/undo, import isolation, rotation fallback, portrait/landscape controls and active bars.');await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
