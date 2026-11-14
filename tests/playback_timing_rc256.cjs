const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync('index.html','utf8'),helper=fs.readFileSync('library-source/playback-timing.js','utf8');
function fn(name){const a=html.indexOf('  function '+name+'('),b=html.indexOf('\n  }',a)+4;assert(a>=0,name);return html.slice(a,b);}
const context={window:{}};vm.runInNewContext(helper,context);const timing=context.window.BassPlaybackTiming;
const close=(a,b)=>assert(Math.abs(a-b)<1e-9,`${a} != ${b}`);
close(timing.outputDelay({state:'running',outputLatency:.08,baseLatency:.01},.01),.1);
assert.equal(timing.outputDelay(null),0);assert.equal(timing.outputDelay({state:'suspended',outputLatency:.08},.01),0);
close(timing.outputDelay({state:'running',outputLatency:NaN,baseLatency:-1},.01),.01);
for(const rate of [.5,1,1.5])close(timing.position(10,{playing:true,rate,delay:.1}),10-.1*rate);
assert.equal(timing.position(10,{playing:false,delay:.1}),10);
assert.equal(timing.position(10.03,{playing:true,delay:.1,floor:10}),10);
assert.equal(timing.position(2,{playing:true,delay:.1,floor:10}),2);
const rows=[{start:.25,end:2.5},{start:1.25,end:1.5},{start:3,end:4}],before=JSON.stringify(rows),idx=timing.index(rows);
for(const [time,item] of [[0,null],[.25,rows[0]],[1.1,rows[0]],[1.25,rows[1]],[1.5,rows[0]],[2.5,null],[3,rows[2]],[4,null],[.5,rows[0]]])assert.equal(idx.at(time),item);
assert.equal(JSON.stringify(rows),before,'timing must never quantise detected events');
function node(start,end){const c=new Set();return {dataset:{start,end},classList:{add:k=>c.add(k),remove:k=>c.delete(k)},has:k=>c.has(k)};}
const sustain=node(.25,2.5),short=node(1.25,1.5),cells=[node(0,1),node(1,2),node(2,3)];
const c={window:context.window,buffer:{duration:4},noteLane:{children:cells},timelineCurrentNote:null,timelinePlayhead:null,inlineNoteEditor:null,TIMELINE_CELL_SECONDS:1,updateCurrentChord(){},keepPracticeItemVisible(){},notes:rows};
vm.createContext(c);vm.runInContext(fn('updateSimpleTimeline')+fn('noteAtTime')+fn('fmt'),c);
c.updateSimpleTimeline.tokens=timing.index([sustain,short],n=>n.dataset.start,n=>n.dataset.end);
c.updateSimpleTimeline(1.1);assert(sustain.has('active'));assert(cells[1].has('active'));
c.updateSimpleTimeline(1.3);assert(short.has('active'));assert(!sustain.has('active'));
c.updateSimpleTimeline(1.5);assert(sustain.has('active'));assert(!short.has('active'));
c.updateSimpleTimeline(2.5);assert(!sustain.has('active'));assert.equal(c.noteAtTime(2.5),null);
assert.equal(c.fmt(.999),'0:00');assert.equal(c.fmt(59.999),'0:59');assert.equal(c.fmt(60),'1:00');
// Exact audio scheduling, including leading silence, speed and cancellation.
const calls=[],voices=[],audio={state:'running',currentTime:5,createOscillator(){const v={frequency:{setValueAtTime(){}},connect(g){return g},start:t=>calls.push(t),stop(){v.stopped=true},disconnect(){}};voices.push(v);return v;},createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}}}};
const m={ctx:audio,window:{BassAutoLevel:{latency:()=>.01}},loopFadeGain:{},metronomeVol:{value:70},metronomeEnabled:true,melodySolo:false,playing:true,masterAudio:{paused:false,seeking:false,playbackRate:1},detectedBeatTimes:[.18,.68,1.18,1.68,2.18],detectedBeatsPerBar:4,detectedDownbeatPhase:0,currentTempoBpm:()=>120,buffer:{duration:10},lastMetronomeBeat:-1,lastMetronomeTime:null};
vm.createContext(m);vm.runInContext('const metronomeVoices=new Set();'+fn('cancelMetronome')+fn('metronomeClick')+fn('updateMetronome'),m);
m.updateMetronome(0);assert.equal(calls.length,0,'no false click during leading silence');
m.updateMetronome(.1);close(calls.at(-1),5.09);m.updateMetronome(.12);assert.equal(calls.length,1,'no duplicate scheduled click');
m.cancelMetronome();assert(voices.every(v=>v.stopped));
m.masterAudio.playbackRate=.5;m.updateMetronome(.64);close(calls.at(-1),5.09);
m.masterAudio.paused=true;m.updateMetronome(.65);assert.equal(m.lastMetronomeTime,null);
m.masterAudio.paused=false;m.masterAudio.seeking=true;m.updateMetronome(1.18);assert.equal(calls.length,2);
m.masterAudio.seeking=false;m.masterAudio.playbackRate=1;m.updateMetronome(1.1);close(calls.at(-1),5.09);
m.updateMetronome(8);assert.equal(calls.length,3,'no burst of missed beats after backgrounding');
m.cancelMetronome();m.detectedBeatTimes=[];m.updateMetronome(.25);assert.equal(calls.length,3,'BPM fallback must not click at arbitrary seek point');m.updateMetronome(.4);close(calls.at(-1),5.11);
// Analysed playback updates only the moving view. Invalidation still rebuilds it.
let rebuilds=0,frames=0;const frame={practiceVisualMode:'timeline',displayTime:()=>1.3,updateSectionKey(){},rebuildSimpleTimeline:Object.assign(()=>rebuilds++,{_sig:'ready'}),curTime:{},seek:{},fmt:c.fmt,buffer:{duration:4},updateSongInfo(){frames++},followPlaybackPage(){},drawWaveform(){},drawRoll(){}};
vm.createContext(frame);vm.runInContext(fn('drawPlaybackFrame'),frame);frame.drawPlaybackFrame();assert.equal(rebuilds,0);assert.equal(frames,1);frame.rebuildSimpleTimeline._sig='';frame.drawPlaybackFrame();assert.equal(rebuilds,1);
for(const name of ['pause','stop','seekTo','applyTempo'])assert(fn(name).includes('cancelMetronome();'),name+' must cancel pending clicks');
assert(html.includes(helper.trim()));assert(html.includes(fs.readFileSync('ai-source/piano.js','utf8').trim()));
for(const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(script[1]);
console.log('PASS RC256 audible clock, sustain across columns, exact boundaries, non-quantised events, timer, metronome scheduling/cancellation and lightweight frames');
