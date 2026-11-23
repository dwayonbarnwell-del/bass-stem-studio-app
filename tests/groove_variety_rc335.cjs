const assert = require('node:assert/strict');
global.window = global;
global.localStorage = {getItem: () => null};
for (const file of ['fills-rc264','practice-rc264b','catalogue-rc269','curated-rc289','groups-rc290','uploaded-data-rc267','lesson-data-rc272','african-data-rc274','reggae-data-rc273','recording-grids','recording-phrases','uploaded-core-rc267','accompaniment-rc293','drum-loops-data-rc294','groove-library','supplied-drums-rc294']) {
  require('../ear-source/' + file + '.js');
}
const {assignments} = BassGrooveLibrary;
const basslineBeats = new Set();
let checked = 0, slowed = 0;
function check(plan, key) {
  const {loop} = BassAccompaniment.resolve(plan);
  assert.equal(loop.id, assignments[key][0], key);
  assert.equal(BassAccompaniment.resolve(plan,{groove:'gmd-reggae-1'}).loop.id,'gmd-reggae-1');
  checked++;
  return loop.id;
}
for (const [kind,list] of [['basslines',BassPracticeCore.lines],['runs',BassPracticeCore.runs],['fills',BassFillCore.styles]]) {
  for (const [idea,line] of list.entries()) {
    const count = kind === 'basslines' ? BassPracticeCore.phrases(line.degrees).length : 1;
    for (let part=0; part<count; part++) {
      const id = check(BassPracticeCore.make(kind,{idea,part,from:1,to:4}),[kind,idea,part].join('/'));
      if (kind==='basslines') basslineBeats.add(id);
    }
  }
}
for (const clip of BassUploadedCore.items) {
  for (const [i,row] of BassRecordedPhrases[clip.id].entries()) {
    const part = 'phrase-'+i;
    const p = BassUploadedCore.practicePlan(clip.id,part);
    assert.ok(p.bpm<=108);
    if (p.bpm<p.originalBpm-.01) slowed++;
    if (!row[5]) check(p,clip.id+'/'+i);
    assert.equal(BassUploadedCore.practicePlan(clip.id,part,140).bpm,140);
  }
}
assert.equal(checked,Object.keys(assignments).length);
assert.equal(BassSuppliedDrums.available.length,198);
assert.ok(basslineBeats.size>60);
console.log({checked, distinctBasslineBeats:basslineBeats.size, slowerRecordingClips:slowed});
