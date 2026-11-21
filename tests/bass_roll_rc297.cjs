const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
const context = vm.createContext({
  window: {}, songSession: 1, aiBusy: false, offlineAnalysisReady: false,
  notes: [], analysedBassNotes: [], rebuildSimpleTimeline() {}, drawAll() {},
  updateProjectButtons() {}, queueMelodyProjectSave(full) { assert.equal(full, true); },
  setTimeout
});
function part(from, to) {
  const start = html.indexOf(from);
  const end = html.indexOf(to, start);
  assert.ok(start >= 0 && end > start);
  return html.slice(start, end);
}
vm.runInContext(part('window.BassPracticeDSP=', '</script>'), context);
vm.runInContext(fs.readFileSync('ai-source/piano-audio.js','utf8'), context);
vm.runInContext(part('  let localBassSession', '  let automaticMelodyTimer'), context);
(async () => {
  const rate = 44100;
  const samples = Float32Array.from({length: rate * 2}, (_, i) => {
    const bass = i < rate ? 30.868 : 41.203;
    return .35 * Math.sin(2*Math.PI*i*bass/rate) + .16*Math.sin(2*Math.PI*i*440/rate);
  });
  await context.estimateMissingBass({sampleRate:rate,numberOfChannels:1,duration:2,getChannelData:()=>samples},1);
  assert.deepEqual(Array.from(context.notes,n=>n.midi),[23,28]);
  assert.ok(context.notes.every(n=>n.source==='estimated-bass-stem' && n.end<=2));
  console.log('PASS low B and E bass notes with a simultaneous A4 melody');
})().catch(error=>{console.error(error);process.exitCode=1;});
