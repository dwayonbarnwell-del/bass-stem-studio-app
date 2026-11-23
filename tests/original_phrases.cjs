const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
global.window = global;
for (const file of ['fills-rc264','practice-rc264b','catalogue-rc269','curated-rc289','groups-rc290','original-studies','uploaded-core-rc267','accompaniment-rc293','drum-loops-data-rc294','groove-library','supplied-drums-rc294','study-display-rc294']) require('../ear-source/'+file+'.js');
assert.equal(BassUploadedCore.items.length,20);
for (const clip of BassUploadedCore.items) {
  assert.ok(!clip.id.startsWith('clip-'));
  const plan = BassUploadedCore.practicePlan(clip.id,'phrase-0');
  assert.equal(plan.bpm,plan.originalBpm);
  assert.ok(plan.recording.originalMix);
  assert.ok(plan.bass.length);
  assert.ok(plan.bass.every(n=>n.beat>=0 && n.beat+n.length<=plan.beats+.001));
  assert.ok(fs.existsSync(plan.audio));
  assert.ok(BassStudyDisplay.clip(clip).length<=12);
}
const samples = Float32Array.from({length:44100},(_,i)=>.3*Math.sin(i*2*Math.PI*110/44100));
let result;
const self={postMessage:r=>{result=r;}};
vm.runInNewContext(fs.readFileSync('ear-source/loop-tempo-worker.js','utf8'),{self,Float32Array,Math});
self.onmessage({data:{channels:[samples,samples.slice()],frames:63000,sampleRate:44100}});
assert.ok(!result.error);
for (const channel of result.channels) {
  assert.equal(channel.length,63000);
  assert.ok(channel.every(Number.isFinite));
  const rms=Math.sqrt(channel.reduce((s,x)=>s+x*x,0)/channel.length);
  assert.ok(rms>.18 && rms<.23);
  let crossings=0;
  for(let i=1001;i<channel.length-1000;i++)if(channel[i-1]<=0 && channel[i]>0)crossings++;
  const pitch=crossings*44100/(channel.length-2000);
  assert.ok(Math.abs(pitch-110)<2,'Pitch must survive the tempo change');
}
console.log('20 replacement phrases, bounded notes, native defaults and stereo tempo pitch passed');
