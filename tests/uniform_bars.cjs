const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const html=fs.readFileSync(process.env.BASS_HTML||path.join(__dirname,'../index.html'),'utf8');
const marker='  initAnalysisTools();\n  renderBassFretboard();';
const fixture=`window.__bars={
 async load(){ensureCtx();buffer=ctx.createBuffer(1,60*8000,8000);
 notes=[{start:0,midi:36},{start:29,midi:43},{start:29.25,midi:33},{start:29.5,midi:32},{start:29.75,midi:36},{start:44,midi:43},{start:44.4,midi:36},{start:45,midi:34},{start:46,midi:32},{start:46.5,midi:43},...Array.from({length:7},(_,i)=>({start:49+i/7,midi:36+i}))].map(n=>({...n,end:n.start+.12,confidence:.95,isFill:false}));
 const c=(start,end,rootPc,quality,bassPc=null,uncertain=false)=>({start,end,rootPc,quality,bassPc,uncertain,confidence:.95,evidenceVersion:'chord-timeline-v4'});
 detectedChordChanges=[c(0,1.4,0,'7'),c(1.4,2,0,'maj'),c(25,26,5,'maj'),c(26,27,0,'7'),c(29,30,10,'maj7',null,true),c(30,31.5,10,'maj9',0,true),c(31.5,32,0,'7',null,true),c(42,43,0,'min',null,true),c(43,43.5,10,'maj'),c(43.5,44,8,'maj7'),c(44,44.5,8,'maj7',null,true),c(44.5,45,10,'maj'),c(45,45.5,0,'sus4',null,true),c(45.5,46,3,'sus2',10,true),c(46,46.25,3,'sus2',null,true),c(46.25,46.5,1,'sus2',8,true),c(46.5,46.75,1,'sus2',null,true),c(46.75,47,0,'sus2',7,true)];
 offlineAnalysisReady=true;drawAll();},at(t){seekTo(t);drawAll();scrollTimelineToTime(t);}
};\n`;
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox','--disable-gpu','--no-zygote']});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>r.abort());await page.route('http://127.0.0.1:8151/index.html',r=>r.fulfill({contentType:'text/html',body:html.replace(marker,fixture+marker)}));
 await page.goto('http://127.0.0.1:8151/index.html');await page.evaluate(()=>__bars.load());
 const results=[];
 for(const [width,height] of [[360,640],[390,844],[740,360],[844,390]]){
  await page.setViewportSize({width,height});
  await page.evaluate(()=>{window.scrollTo(0,0);__bars.at(45.1);});await page.waitForTimeout(70);
  const geometry=await page.evaluate(()=>{
   const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
   const rows=['.time-mark','.chord-cell','.note-time-cell'].map(sel=>[...document.querySelectorAll(sel)].map(rect));
   const m=document.createElement('canvas').getContext('2d');m.font='900 14px '+getComputedStyle(document.querySelector('#noteLane')).fontFamily;const longest=Math.max(...[...document.querySelectorAll('.chord-name')].map(e=>m.measureText(e.textContent).width));return {rows,longest,width:document.querySelector('#timelineScroll').clientWidth,vertical:document.querySelector('#timelineScroll').scrollHeight-document.querySelector('#timelineScroll').clientHeight};
  });
  assert(geometry.rows[0][0].w-geometry.longest<=21&&geometry.rows[0][0].w>=geometry.longest+18,'bar width closely follows longest chord, not viewport');
  const all=geometry.rows.flat();assert(Math.max(...all.map(e=>e.w))-Math.min(...all.map(e=>e.w))<1,'all bars must have the same width, including 0:45 and 0:46');
  for(const row of geometry.rows)row.slice(1).forEach((c,i)=>assert(Math.abs(c.x-row[i].right)<1,'no blank packing gaps between bars'));
  for(let i=0;i<geometry.rows[0].length;i++)for(const row of geometry.rows.slice(1))assert(Math.abs(row[i].x-geometry.rows[0][i].x)<1,'chords and notes align with their timestamp');
  assert(geometry.rows[0][0].w<=geometry.width/2+1,'recording-style passage retains at least two bars across');
  assert(geometry.vertical<=1,'no vertical timeline scrolling');
  for(const t of [1.1,1.6,25.1,44.25,45.25,45.75,46.75,49.1,59.1]){
   await page.evaluate(t=>__bars.at(t),t);
   const m=await page.evaluate(t=>{
    const v=document.querySelector('#timelineScroll').getBoundingClientRect(),h=document.querySelector('#chordRuler').getBoundingClientRect();
    const cell=document.querySelector('.note-time-cell[data-start="'+Math.floor(t)+'"]'),c=cell.getBoundingClientRect(),ch=document.querySelector('.chord-cell[data-start="'+Math.floor(t)+'"]');
    const notes=[...cell.querySelectorAll('.note-token')],labels=[...ch.querySelectorAll('.chord-name')];
    const stacked=labels.every((n,i)=>!i||n.getBoundingClientRect().top>=labels[i-1].getBoundingClientRect().bottom-.1);return {stacked,current:document.querySelector('.current-chord')?.textContent,chordHeight:h.height,cellFits:c.left>=v.left-1&&c.right<=v.right+1,notesFit:notes.every(n=>{const r=n.getBoundingClientRect();return r.top>=h.bottom&&r.bottom<=v.bottom-2&&r.left>=c.left&&r.right<=c.right&&n.scrollWidth<=n.clientWidth+1;}),chordsFit:labels.every(n=>{const range=document.createRange();range.selectNodeContents(n);const r=range.getBoundingClientRect();return r.left>=c.left&&r.right<=c.right&&r.top>=h.top&&r.bottom<=h.bottom;}),playhead:parseFloat(document.querySelector('#timelinePlayhead').style.left),barLeft:parseFloat(cell.style.left),barWidth:c.width,font:notes.map(n=>getComputedStyle(n).fontSize)};
   },t);
   assert(m.stacked,'chords must appear one per row');if(t===1.1)assert.equal(m.current,'C7');if(t===1.6)assert.equal(m.current,'CM');if(t===45.25)assert.equal(m.current,'Csus4?');if(t===45.75)assert.equal(m.current,'Ebsus2/Bb?');if(t===25.1)assert(m.chordHeight<40,'distant dense bars do not add empty header space');
   assert(m.cellFits&&m.notesFit&&m.chordsFit,JSON.stringify({width,t,m}));
   assert(m.font.every(f=>f==='14px'),'recording-style passage keeps 14px');
   assert(Math.abs(m.playhead-m.barLeft-(t%1)*m.barWidth)<1,'playhead stays proportional to actual time');
   if(t===1.1)await page.screenshot({path:path.join(__dirname,`../../work163/stacked-${width}.png`)});
   if(t===45.25)await page.screenshot({path:path.join(__dirname,`../../work163/uniform-${width}.png`)});
  }
  results.push({width,height,barWidth:geometry.rows[0][0].w});
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(__dirname,'../../work163/uniform-results.json'),JSON.stringify(results,null,2));console.log('PASS: compact equal bars, chords stacked one per row, timed C7/CM and slash-chord highlights, aligned timestamps/playhead, no clipping at 14px.');await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
