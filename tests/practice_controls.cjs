const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const marker='  initAnalysisTools();\n  renderBassFretboard();';
const fixture=`window.__practice={
 async load(){ensureCtx();const b=ctx.createBuffer(1,60*8000,8000);const p={format:'Bass Stem Studio Project',schemaVersion:2,projectName:'Practice example',source:{name:'Practice example.wav',type:'audio/wav',audioBase64:arrayBufferToBase64(await wavBlob(b).arrayBuffer())},analysis:{notes:Array.from({length:100},(_,i)=>({midi:36+i%10,start:i*.2,end:i*.2+.18,confidence:.95,isFill:i%3===0})),scale:'C major',tempoBpm:120,chords:Array.from({length:20},(_,i)=>({start:i,end:i+1,rootPc:i%2?5:0,quality:'maj',confidence:.95,evidenceVersion:'chord-timeline-v4'})),structure:{version:'song-structure-v1-allinone',segments:[{name:'Verse 1',start:0,end:20},{name:'Chorus 1',start:20,end:40},{name:'Bridge',start:40,end:60}]}}};await importBassStudioProject(new File([JSON.stringify(p)],'practice.bassstudio'));return p;},
 state(){return {start:loopStart,end:loopEnd,multi:multiSectionMode,loop:loopEnabled,timeframe:timeframeLoopMode,queue:sectionQueue,index:queueIndex,selected:[...selectedSections],times:[...selectedTimeframes],draft:[...repeatSectionDraft],overrides:[...repeatRangeOverrides],notes:notes.map(n=>({...n})),transposeSemitones};},
 dense(){notes=Array.from({length:24},(_,i)=>({midi:36+i%8,start:i/24,end:(i+1)/24,confidence:.95}));rebuildSimpleTimeline._sig="";drawAll();},
 crowded(){notes=Array.from({length:24},(_,i)=>({midi:36+i%8,start:i/24,end:(i+1)/24,confidence:.95,isFill:true}));detectedChordChanges=Array.from({length:8},(_,i)=>({start:i/8,end:(i+1)/8,rootPc:i,quality:i%2?'min7':'maj',confidence:.95,evidenceVersion:'chord-timeline-v4'}));rebuildSimpleTimeline._sig="";drawAll();},
 realistic(){notes=[7,3,10,2].flatMap((count,bar)=>Array.from({length:count},(_,i)=>({midi:36+i%11,start:4+bar+i/count,end:4+bar+(i+.8)/count,confidence:.95,isFill:true})));detectedChordChanges=[...Array.from({length:3},(_,i)=>({start:5+i/3,end:5+(i+1)/3,rootPc:i*3,quality:'maj',confidence:.95,evidenceVersion:'chord-timeline-v4'})),...Array.from({length:12},(_,i)=>({start:40+i/12,end:40+(i+1)/12,rootPc:i,quality:'7sus4',confidence:.95,evidenceVersion:'chord-timeline-v4'}))];rebuildSimpleTimeline._sig='';drawAll();},
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
 await page.locator('#playBtn').click();await page.locator('#pauseBtn').click();assert.equal((await page.evaluate(()=>__practice.state())).queue.length,2,'resuming keeps every selected part');
 await page.locator('#timeTo').fill('0:01');await page.locator('#timeTo').dispatchEvent('change');assert.equal((await page.evaluate(()=>__practice.state())).end,18,'invalid range leaves repeat intact');
 await page.locator('#clearLoop').click();s=await page.evaluate(()=>__practice.state());assert.equal(s.loop,false);assert.equal(s.multi,false);assert.equal(s.timeframe,false);for(const name of ['queue','selected','times','draft','overrides'])assert.deepEqual(s[name],[]);assert.equal(await page.locator('#timeFrom').inputValue(),'');
 await page.locator('.time-mark[data-time="4"]').click();assert.equal(await page.locator('#timeFrom').inputValue(),'0:04');assert.equal(await page.locator('#timeTo').inputValue(),'0:05');await page.locator('#clearLoop').click();
 await page.evaluate(()=>__practice.at(0));const before=await page.evaluate(()=>__practice.state());
 await page.locator('.note-token').first().click();assert(await page.locator('.note-time-cell .note-inline-editor').isVisible());
 await page.screenshot({path:path.join(__dirname,'../../work163/inline-edit.png')});
 await page.locator('.note-inline-editor input').fill('H2');await page.locator('.note-inline-editor button[type=submit]').click();assert.match(await page.locator('.note-inline-editor [role=alert]').innerText(),/octave/);
 await page.locator('.note-inline-editor input').fill('D2');await page.locator('.note-inline-editor button[type=submit]').click();s=await page.evaluate(()=>__practice.state());assert.equal(s.notes[0].midi,38);assert.equal(s.notes[0].start,before.notes[0].start);assert.equal(s.notes[0].end,before.notes[0].end);assert.deepEqual(s.times,[]);
 await page.locator('.note-token').first().press('Enter');await page.locator('.note-inline-editor').getByRole('button',{name:'Undo',exact:true}).click();assert.equal((await page.evaluate(()=>__practice.state())).notes[0].midi,before.notes[0].midi);
 assert.equal(await page.locator('#orientationToggle,#orientationMessage').count(),0);
 assert.equal(await page.locator('#displaySizeControl').evaluate(e=>e.nextElementSibling.classList.contains('source-below')),true);
 const geometry=[];
 for(const [width,height] of [[360,800],[412,915],[844,390],[740,360]]){
  await page.setViewportSize({width,height});await page.evaluate(()=>{window.scrollTo(0,0);__practice.at(12.05);});await page.waitForTimeout(100);
  const m=await page.evaluate(()=>{const r=e=>{const x=e.getBoundingClientRect();return {x:x.x,y:x.y,w:x.width,h:x.height,b:x.bottom,r:x.right};};return {overflow:document.documentElement.scrollWidth>innerWidth+2,controls:['playBtn','pauseBtn','loopToggle','timeFrom','timeTo','clearLoop','scaleSelect'].map(id=>({id,...r(document.getElementById(id))})),panel:r(document.querySelector('.simple-timeline-card')),scroll:r(document.querySelector('#timelineScroll')),ruler:r(document.querySelector('#timeRuler')),chords:r(document.querySelector('#chordRuler')),active:r(document.querySelector('.note-time-cell.active')),cards:[...document.querySelectorAll('.note-token')].map(r)};});
  assert(!m.overflow,`overflow ${width} ${JSON.stringify(m)}`);
  for(const c of m.controls){assert(c.x>=-1&&c.r<=width+1&&c.y>=-1&&c.b<=height+1,`control clipped ${width} ${JSON.stringify(c)}`);}
  assert(m.scroll.h>=120,`timeline too short ${width} ${JSON.stringify(m)}`);
  assert(m.active.x>=m.scroll.x-1&&m.active.r<=m.scroll.r+1,`active bar clipped ${width}`);
  assert(m.ruler.b<=height&&m.chords.b<=height,`headers clipped ${width}`);
  assert(m.cards.every(c=>Math.abs(c.w-m.cards[0].w)<1&&Math.abs(c.h-m.cards[0].h)<1));geometry.push({width,height,m});
  await page.screenshot({path:path.join(__dirname,`../../work163/practice-${width}.png`)});
 }
 await page.setViewportSize({width:844,height:390});await page.locator('#practiceViewSelect').selectOption('bass');
 const fret=await page.locator('#bassFretboard').boundingBox();assert(fret.y>=0&&fret.y+fret.height<=390,`bass neck outside landscape ${JSON.stringify(fret)}`);
 await page.locator('#practiceViewSelect').selectOption('timeline');
 await page.evaluate(()=>{__practice.dense();__practice.at(.96);__practice.follow(.96);});
 const followed=await page.evaluate(()=>{const n=document.querySelector('.note-token.active').getBoundingClientRect(),v=document.querySelector('#timelineScroll').getBoundingClientRect(),c=document.querySelector('#chordRuler').getBoundingClientRect();return {top:n.top,bottom:n.bottom,visibleTop:c.bottom,visibleBottom:v.bottom,count:document.querySelectorAll('.note-token').length};});
 assert.equal(followed.count,24);assert(followed.top>=followed.visibleTop&&followed.bottom<=followed.visibleBottom,JSON.stringify(followed));

 // Every event in a crowded bar must be visible simultaneously, including while paused.
 for(const [width,height] of [[360,640],[390,844],[844,390],[740,360]]){
  await page.setViewportSize({width,height});await page.evaluate(()=>{window.scrollTo(0,0);__practice.crowded();__practice.at(.96);});await page.waitForTimeout(100);
  const fit=await page.evaluate(()=>{
   const rect=e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right};};
   const v=rect(document.querySelector('#timelineScroll')),c=rect(document.querySelector('#chordRuler'));
   return {v,c,widths:[...document.querySelectorAll('.time-mark,.chord-cell,.note-time-cell')].map(e=>e.getBoundingClientRect().width),scrollHeight:document.querySelector('#timelineScroll').scrollHeight,clientHeight:document.querySelector('#timelineScroll').clientHeight,notes:[...document.querySelectorAll('.note-time-cell[data-start="0"] .note-token')].map(rect),chords:[...document.querySelectorAll('.chord-cell[data-start="0"] .chord-name')].map(rect),pageScroll:scrollY};
  });
  assert.equal(fit.notes.length,24);assert.equal(fit.chords.length,8);assert(Math.max(...fit.widths)-Math.min(...fit.widths)<1,'every time, chord and note bar has the same width');
  assert(fit.notes.every(n=>n.top>=fit.c.bottom-1&&n.bottom<=fit.v.bottom-2&&n.left>=fit.v.left&&n.right<=fit.v.right),`note clipped ${width} ${JSON.stringify(fit)}`);
  assert(fit.chords.every(c=>c.top>=fit.c.top-1&&c.bottom<=fit.c.bottom+1&&c.left>=fit.v.left&&c.right<=fit.v.right),`chord clipped ${width} ${JSON.stringify(fit)}`);
  assert.equal(fit.pageScroll,0);assert(fit.scrollHeight<=fit.clientHeight+1,`vertical scrolling required ${width} ${JSON.stringify(fit)}`);
  await page.screenshot({path:path.join(__dirname,`../../work163/dense-${width}.png`)});
  await page.locator('#practiceViewSelect').selectOption('bass');await page.locator('#bassStringSelect').selectOption('6');await page.evaluate(()=>{window.scrollTo(0,0);__practice.at(.96);});
  const strings=await page.locator('.bass-string-row').evaluateAll(rows=>rows.map(e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height};}));
  assert.equal(strings.length,6);assert(strings.every(r=>r.top>=0&&r.bottom<=height&&r.height>=22),`six strings clipped ${width} ${JSON.stringify(strings)}`);
  await page.screenshot({path:path.join(__dirname,`../../work163/bass-${width}.png`)});
  await page.locator('#practiceViewSelect').selectOption('timeline');
 }
 // Playback continues across a device rotation and keeps its active bar in view.
 await page.evaluate(()=>__practice.at(.2));await page.locator('#playBtn').click();
 for(const [width,height] of [[390,844],[844,390]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(120);
  assert(await page.locator('#playBtn').isDisabled(),'rotation must not pause playback');
  const v=await page.locator('#timelineScroll').boundingBox(),a=await page.locator('.note-time-cell.active').boundingBox();
  assert(a.x>=v.x-1&&a.x+a.width<=v.x+v.width+1,'playing bar follows rotation');
 }
 await page.locator('#pauseBtn').click();
 // A later crowded chord passage must not push earlier bass notes off screen.
 // Repeating a crowded bar must still select its original exact time interval.
 for(const [width,height] of [[360,640],[390,844],[740,360],[844,390]]){
  await page.setViewportSize({width,height});await page.evaluate(()=>{window.scrollTo(0,0);__practice.realistic();});
  for(const start of [4,5,6,7]){
   await page.evaluate(t=>__practice.at(t+.1),start);await page.waitForTimeout(30);
   const result=await page.evaluate(start=>{
    const box=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};};
    const v=document.querySelector('#timelineScroll'),h=document.querySelector('#chordRuler'),cell=document.querySelector('.note-time-cell[data-start="'+start+'"]');
    const n=[...cell.querySelectorAll('.note-token')];
    const clipped=n.filter(e=>{const r=box(e),b=box(v),c=box(h);return r.left<b.left||r.right>b.right||r.top<c.bottom||r.bottom>b.bottom-2;});
    const labels=[...document.querySelectorAll('.chord-cell[data-start="'+start+'"] .chord-name')].map(e=>{const range=document.createRange();range.selectNodeContents(e);const r=range.getBoundingClientRect(),p=e.parentElement.getBoundingClientRect();return r.left>=p.left&&r.right<=p.right;});
    return {clipped:clipped.length,count:n.length,font:n.map(e=>getComputedStyle(e).fontSize),textFits:n.every(e=>e.scrollWidth<=e.clientWidth+1),labelsFit:labels.every(Boolean),verticalOverflow:v.scrollHeight>v.clientHeight+1};
   },start);
   assert.equal(result.count,[7,3,10,2][start-4]);assert.equal(result.clipped,0,JSON.stringify({width,start,result}));assert(result.textFits&&result.labelsFit&&!result.verticalOverflow,JSON.stringify({width,start,result}));assert(result.font.every(f=>parseFloat(f)>=10&&parseFloat(f)<=14),'readable fitted notation '+JSON.stringify({width,height,start,font:result.font}));
   if(start===4)await page.screenshot({path:path.join(__dirname,`../../work163/complete-bar-${width}.png`)});
  }
 }
 await page.evaluate(()=>__practice.at(6.5));
 const beforeRepeat=await page.evaluate(()=>__practice.state().notes);
 await page.locator('.time-mark[data-time="6"]').click();assert.equal(await page.locator('#timeFrom').inputValue(),'0:06');assert.equal(await page.locator('#timeTo').inputValue(),'0:07');
 await page.locator('#clearLoop').click();assert.deepEqual(await page.evaluate(()=>__practice.state().notes),beforeRepeat);
 // Importing another song closes any inline editor and cannot apply the old edit.
 await page.evaluate(()=>__practice.at(0));await page.locator('.note-token').first().click();await page.evaluate(()=>__practice.import(new File([JSON.stringify(fixtureProject)],'replacement.bassstudio')));assert.equal(await page.locator('.note-inline-editor').count(),0);
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(__dirname,'../../work163/layout-results.json'),JSON.stringify(geometry,null,2));
 console.log('PASS: editable queued ranges, clear all repeats, one-second default, inline edit/undo, import isolation, device orientation, portrait/landscape controls, all 24 notes and all 8 chords simultaneously visible, and no vertical timeline overflow.');await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
