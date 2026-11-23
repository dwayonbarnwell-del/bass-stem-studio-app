// Check the audible keyboard pattern against the recording pulse, independent
// of the chord label, requested tempo or passage selected in the trainer.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const window={},context=vm.createContext({window});
for(const file of ['uploaded-data-rc267','lesson-data-rc272','reggae-data-rc273','african-data-rc274',
 'recording-grids','uploaded-core-rc267','drum-loops-data-rc294','supplied-drums-rc294','accompaniment-rc293']){
 vm.runInContext(fs.readFileSync('ear-source/'+file+'.js','utf8'),context);
}
const {BassUploadedCore:U,BassAccompaniment:H,BassRecordingTiming:timing}=window;
function reference(points,t){
 let lo=0,hi=points.length-1;
 while(lo+1<hi){const m=(lo+hi)>>>1;if(points[m][0]<=t)lo=m;else hi=m;}
 const [a,p]=points[lo],[b,q]=points[lo+1];
 return p+(t-a)*(q-p)/(b-a);
}
let selections=0,attacks=0;
for(const clip of U.items){
 const points=timing[clip.id].pulse;
 assert(points.every(([t,p],i)=>!i||t>points[i-1][0]&&p>points[i-1][1]));
 for(const part of [...clip.parts.keys(),...(U.loop(clip.id)?['beat']:[])]){
  const plan=U.practicePlan(clip.id,part),spans=plan.pulseSpans;
  const rate=60/plan.bpm;
  assert(Math.abs(plan.phase-reference(points,plan.sourceStart))<1e-5,'A passage inherits the same drum bar as the full recording');
  for(const [i,s] of spans.entries()){
   if(i){const prev=spans[i-1];assert(Math.abs(prev.end-s.start)<1e-7);
    assert(Math.abs(prev.pulse+(prev.end-prev.start)/prev.scale-s.pulse)<1e-6);}
   assert(s.scale>0&&s.end>s.start);
  }
  // Reggae skanks at every half-beat, even when a passage starts on a pickup.
  const keys=H.arrange(plan,'reggae'),starts=[...new Set(keys.map(n=>n.beat))];
  assert(starts.every((v,i)=>!i||v>starts[i-1]));
  const first=spans[0].pulse,last=spans.at(-1);
  const low=first+(plan.chords[0].beat-spans[0].start)/spans[0].scale;
  const end=last.pulse+(last.end-last.start)/last.scale;
  // Some songs begin with a rest. Only count events after the first harmony.
  const min=reference(points,plan.sourceStart+plan.chords[0].beat*plan.step);
  const expected=Math.ceil(end-.5-1e-8)-Math.ceil((part==='beat'?low:min)-.5-1e-8);
  assert.equal(starts.length,expected,clip.id+' '+part+' missing or doubled skank');
  for(const beat of starts){
   const s=spans.find(v=>v.end>beat+1e-10)||last;
   const pulse=s.pulse+(beat-s.start)/s.scale;
   assert(Math.abs(pulse-(Math.round(pulse-.5)+.5))<1e-6);
   if(part!=='beat')assert(Math.abs(pulse-reference(points,plan.sourceStart+beat*plan.step))<1e-5);
   else assert(Math.abs(pulse-reference(points,plan.sourceStart+beat*plan.step))*rate<.015);
  }
  attacks+=starts.length;selections++;
 }
}
console.log('Passed '+attacks+' keyboard attacks across '+selections+' recording selections, including pickups, gaps and tempo changes.');
