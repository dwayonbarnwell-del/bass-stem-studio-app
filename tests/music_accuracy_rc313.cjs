const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const chordRecovery=require('../chord-source/recovery.js');
const html=fs.readFileSync('index.html','utf8');
function slice(from,to){
  const start=html.indexOf(from),end=html.indexOf(to,start);
  assert(start>=0&&end>start,from);
  return html.slice(start,end);
}
const ctx=vm.createContext({
  window:{},songSession:1,aiBusy:false,songImportBusy:false,offlineAnalysisReady:false,
  notes:[],analysedBassNotes:[],rebuildSimpleTimeline(){},drawAll(){},updateProjectButtons(){},
  queueMelodyProjectSave(){},setTimeout,activeAudioFile:{},storedRunPodKey:()=>null
});
vm.runInContext(
  slice('window.BassPracticeDSP=', '</script>')+slice('window.BassPianoAudio=','</script>')+
  slice('  async function analysePianoPassage(', '  // Imported audio owns')+
  slice('  let localBassSession','  let automaticMelodyTimer')+
  slice('  function round3(v)', '  async function applySegmentedRunPodResults('),ctx
);
const hz=midi=>440*2**((midi-69)/12);
const sine=(midi,time)=>Math.sin(2*Math.PI*hz(midi)*time);
function clip(duration,signal,sampleRate=44100){
  const samples=Float32Array.from({length:Math.round(sampleRate*duration)},(_,i)=>signal(i/sampleRate));
  return {duration,sampleRate,length:samples.length,numberOfChannels:1,getChannelData:()=>samples};
}
function phrase(pitches){
  return [[.31,.98],[1.18,1.86],[2.08,2.85],[3.02,3.72]].map(([start,end],i)=>({start,end,midi:pitches[i]}));
}
function tone(notes,time,volume){
  const note=notes.find(n=>n.start<=time&&time<n.end);
  if(!note)return 0;
  const envelope=Math.min(1,(time-note.start)/.012,(note.end-time)/.025);
  return volume*envelope*(sine(note.midi,time)+.3*sine(note.midi+12,time));
}
function pitchAndTiming(actual,expected,onsetTolerance,endTolerance){
  assert.deepEqual(Array.from(actual,n=>n.midi),expected.map(n=>n.midi));
  actual.forEach((n,i)=>{
    assert(Math.abs(n.start-expected[i].start)<=onsetTolerance,'note onset');
    assert(Math.abs(n.end-expected[i].end)<=endTolerance,'note release');
  });
}
(async()=>{
  const harmony=[[60,'maj','C'],[67,'maj','G'],[69,'min','Am'],[65,'maj','F']];
  for(const step of [.5,1,2]){
    const mix=clip(step*4,time=>{
      const [root,quality]=harmony[Math.floor(time/step)];
      return [0,quality==='maj'?4:3,7].reduce((sum,interval)=>sum+.13*sine(root+interval,time)+.04*sine(root+interval+12,time),0);
    });
    const result=await chordRecovery.scan(mix);
    assert.deepEqual(result.added.map(n=>[n.label,n.start,n.end]),harmony.map((entry,i)=>[entry[2],i*step,(i+1)*step]));
  }
  let voiced=0;
  for(const low of [43,60])for(let root=low;root<low+12;root++)for(const [quality,third] of [['maj',4],['min',3]])for(let inversion=0;inversion<3;inversion++){
    const notes=[root,root+third,root+7].map((midi,i)=>midi+(i<inversion?12:0));
    const audio=clip(2,time=>notes.reduce((sum,midi,i)=>sum+(.2-i*.025)*sine(midi,time)+.055*sine(midi+12,time)+.02*Math.sin(6*Math.PI*hz(midi)*time),0));
    const {added}=await chordRecovery.scan(audio);
    assert.deepEqual(added.map(chord=>[chord.rootPc,chord.quality]),[[root%12,quality]]);
    voiced++;
  }
  const harmonicNote=clip(3,time=>Array.from({length:8},(_,i)=>i+1)
    .reduce((sum,n)=>sum+.25/n*Math.sin(2*Math.PI*hz(48)*n*time),0));
  assert.equal((await chordRecovery.scan(harmonicNote)).added.length,0,'a single note must not become a chord');
  assert.equal((await chordRecovery.scan(clip(3,()=>0))).added.length,0);
  const melody=phrase([57,64,60,69]),bass=phrase([23,28,33,31]);
  for(const bassLevel of [0,.19]){
    ctx.buffer=clip(4,time=>tone(melody,time,.38)+tone(bass,time,bassLevel));
    pitchAndTiming(await ctx.analysePianoPassage({from:0,to:4,job:{}},()=>{},()=>false,()=>{}),melody,.04,.04);
  }
  await ctx.estimateMissingBass(clip(4,time=>tone(bass,time,.38)+tone(melody,time,.12)),1);
  pitchAndTiming(ctx.notes,bass,.04,.105);

  const parts=[{coreStart:0,coreEnd:2.5,audioStart:0},{coreStart:2.5,coreEnd:5,audioStart:1.5}];
  const merged=ctx.chooseCombinedSongContext(parts,[
    {beat_times:[0,.5,1,1.5,2,2.5],beats_per_bar:4,downbeat_phase:1,beat_grid_confidence:.7},
    {beat_times:[0,.5,1,1.5,2,2.5,3,3.5],beats_per_bar:4,downbeat_phase:2,beat_grid_confidence:.93}
  ]);
  assert.deepEqual(Array.from(merged.beat_times),Array.from({length:11},(_,i)=>i/2));
  assert.equal(merged.downbeat_phase,1,'the strongest excerpt must keep the accent on the same physical beat');
  const mixedMeter=ctx.chooseCombinedSongContext([...parts,{coreStart:5,coreEnd:6,audioStart:5}],[
    {beat_times:[0,.5,1,1.5,2],beats_per_bar:4,downbeat_phase:1,beat_grid_confidence:.65},
    {beat_times:[0,.5,1,1.5,2,2.5,3,3.5],beats_per_bar:4,downbeat_phase:2,beat_grid_confidence:.7},
    {beat_times:[0,.5,1],beats_per_bar:3,downbeat_phase:0,beat_grid_confidence:.9}
  ]);
  assert.equal(mixedMeter.beats_per_bar,4);
  assert.equal(mixedMeter.downbeat_phase,1,'an excerpt in another meter must not set the bar accent');
  console.log(`PASS ${voiced} chord voicings, 12 timed chord changes, single-note and silence rejection, 8 melody pitches and 4 bass pitches with measured timing, and bar accents across excerpts.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
