// Isolated test-page fixture; never included in the production page.
const timingBox=document.createElement('div');
timingBox.innerHTML='<button id="runTimingAudit" style="position:fixed;top:48px;left:8px;z-index:999999">Run timing checks</button><pre id="timingResults" style="position:fixed;top:92px;left:8px;z-index:999999;background:#fff;color:#111;max-height:65vh;max-width:95%;overflow:auto;white-space:pre-wrap;font:12px monospace"></pre><pre id="auditErrors"></pre>';
document.body.append(timingBox);
$('runTimingAudit').onclick=async()=>{
 const out=$('timingResults'),wait=ms=>new Promise(r=>setTimeout(r,ms)),check=(ok,message)=>{if(!ok)throw Error(message)};
 let passed=0,failed=0;out.textContent='Running RC256 timing checks…\n';$('runTimingAudit').disabled=true;
 const test=async(name,run)=>{try{await run();passed++;out.textContent+='PASS '+name+'\n'}catch(e){failed++;out.textContent+='FAIL '+name+': '+e.message+'\n'}finally{pause();}};
 ensureCtx();await ctx.resume();
 const beats=Array.from({length:16},(_,i)=>.18+i*.5),bass=[{midi:36,start:.25,end:2.25,confidence:.99},{midi:40,start:2.25,end:2.75,confidence:.99},{midi:43,start:3.25,end:4.5,confidence:.99},{midi:36,start:5,end:7.8,confidence:.99}];
 const chart=[{rootPc:0,quality:'maj',start:.18,end:.75},{rootPc:9,quality:'min',start:.75,end:1.25},{rootPc:5,quality:'maj',start:1.25,end:2.1},{rootPc:7,quality:'maj',start:2.4,end:4.5},{rootPc:0,quality:'maj',start:5,end:7.9}].map(c=>({...c,confidence:.99,evidence_version:'chord-timeline-v4'}));
 const audio=ctx.createBuffer(2,ctx.sampleRate*8,ctx.sampleRate);
 for(let ch=0;ch<2;ch++){const data=audio.getChannelData(ch);for(let i=0;i<data.length;i++){const t=i/ctx.sampleRate,n=bass.find(n=>t>=n.start&&t<n.end),beat=beats.find(b=>t>=b&&t<b+.035);if(n)data[i]+=.08*Math.sin(2*Math.PI*440*2**((n.midi-69)/12)*t);if(beat!==undefined)data[i]+=.15*Math.sin(2*Math.PI*1000*(t-beat))*Math.exp(-100*(t-beat));}}
 const wav=BassLoopShare.wav(audio,BassLoopShare.bounds(audio,0,8)),base={format:'Bass Stem Studio Project',schemaVersion:2,projectName:'Timing check',source:{name:'timing-check.wav',type:'audio/wav',audioBase64:arrayBufferToBase64(await wav.arrayBuffer())},analysis:{ready:true,notes:bass,chords:chart,tempoBpm:120,beatTimes:beats},settings:{speed:100,practiceView:'timeline'}};
 await test('saved event times remain exact',async()=>{
  check(await importBassStudioProject(new File([JSON.stringify(base)],'timing-check.bassstudio')),'project import');
  await wait(100);setPracticeVisualMode('timeline');setTimelineCellSeconds(1,{clearSelection:true,rebuild:true});
  check(notes.length===bass.length&&notes.every((n,i)=>n.start===bass[i].start&&n.end===bass[i].end),'bass times changed');
  check(detectedChordChanges.length===chart.length&&detectedChordChanges.every((c,i)=>c.start===chart[i].start&&c.end===chart[i].end),'chord times changed');
  check(detectedBeatTimes.every((t,i)=>t===beats[i]),'beat times changed');
 });
 const snapshots=[];let observe=false;
 const originalFrame=drawPlaybackFrame;drawPlaybackFrame=function(){originalFrame();if(observe)snapshots.push({raw:currentTime(),t:displayTime(),note:noteLane.querySelector('.note-token.active')?.dataset.start??null,chord:chordRuler.querySelector('.current-chord')?.dataset.eventIndex??null,pulse:$('songTempoWrap').classList.contains('on-beat'),timer:curTime.textContent});};
 const checkFrames=()=>{
  check(snapshots.length>15,'too few animation frames');let checks=0;
  const edges=[...bass.flatMap(n=>[n.start,n.end]),...chart.flatMap(c=>[c.start,c.end]),...beats.flatMap(t=>[t,t+.12])];
  for(const s of snapshots){if(edges.some(t=>Math.abs(t-s.t)<.025))continue;const n=bass.find(n=>s.t>=n.start&&s.t<n.end),ci=chart.findIndex(c=>s.t>=c.start&&s.t<c.end),last=beats.filter(t=>t<=s.t).at(-1);
   check(s.note===(n?String(n.start):null),'bass highlight at '+s.t.toFixed(3));
   check(s.chord===(ci>=0?String(ci):null),'chord highlight at '+s.t.toFixed(3));
   check(s.pulse===(last!==undefined&&s.t-last<.12),'beat flash at '+s.t.toFixed(3));
   check(s.timer===Math.floor(s.t/60)+':'+String(Math.floor(s.t)%60).padStart(2,'0'),'timer at '+s.t.toFixed(3));checks++;
  }check(checks>10,'too few non-boundary checks');
 };
 for(const speed of [100,50,150])await test('audio clock, beat, chords and sustained bass at '+speed+'%',async()=>{
  tempo.value=speed;applyTempo();seekTo(.05);await wait(60);snapshots.length=0;observe=true;await play();await wait(speed===50?5300:3200);observe=false;checkFrames();
  check(snapshots.some(s=>s.t>1&&s.t<2.2&&s.note==='.25')||snapshots.some(s=>s.t>1&&s.t<2.2&&s.note==='0.25'),'sustain lost across columns');
  const delay=window.BassPlaybackTiming.outputDelay(ctx,window.BassAutoLevel.latency(loopFadeGain));
  check(snapshots.filter(s=>s.raw>.5).every(s=>Math.abs(s.raw-s.t-delay*speed/100)<.03),'display not following audible clock');
 });
 await test('pause, forward seek and backward seek',async()=>{
  pause();seekTo(2.25);await wait(80);drawAll();check(noteLane.querySelector('.note-token.active')?.dataset.start==='2.25','exact boundary');
  seekTo(3);await wait(80);drawAll();check(!noteLane.querySelector('.note-token.active'),'gap contains stale bass');
  seekTo(1.1);await wait(80);drawAll();check(noteLane.querySelector('.note-token.active')?.dataset.start==='0.25','backward seek lost sustain');
  check(!$('songTempoWrap').classList.contains('on-beat'),'pulse left on while paused');check(displayTime()===currentTime(),'pause clock offset');
 });
 await test('metronome cancellation and speed changes during playback',async()=>{
  metronomeEnabled=true;seekTo(.6);await wait(80);await play();await wait(130);pause();check(metronomeVoices.size===0,'queued click after pause');
  await play();await wait(150);tempo.value=50;applyTempo();check(metronomeVoices.size===0,'old-rate click remains');await wait(200);seekTo(3.1);check(metronomeVoices.size===0,'old-position click remains');metronomeEnabled=false;cancelMetronome();
 });
 await test('loop restart follows the new song position',async()=>{
  tempo.value=100;applyTempo();loopStart=2.4;loopEnd=3.4;loopEnabled=true;seekTo(3.2);await wait(80);snapshots.length=0;observe=true;await play();await wait(1500);observe=false;check(snapshots.some((s,i)=>i&&s.raw<snapshots[i-1].raw-.4),'loop did not restart');checkFrames();loopEnabled=false;loopStart=null;loopEnd=null;
 });
 observe=false;loopEnabled=false;metronomeEnabled=false;cancelMetronome();tempo.value=100;applyTempo();seekTo(1.5);drawAll();
 out.textContent+='DONE '+passed+' passed, '+failed+' failed\n';$('runTimingAudit').disabled=false;
};
