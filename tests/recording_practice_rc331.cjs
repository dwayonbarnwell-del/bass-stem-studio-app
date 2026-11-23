// Check the same catalogue, practice plans and displayed chords as the trainer.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const window = {};
const context = vm.createContext({window,localStorage:{getItem:()=>null,setItem(){}}});
for (const file of ['fills-rc264','practice-rc264b','catalogue-rc269','curated-rc289','groups-rc290',
  'uploaded-data-rc267','lesson-data-rc272','reggae-data-rc273','african-data-rc274','recording-grids',
  'uploaded-core-rc267','drum-loops-data-rc294','supplied-drums-rc294','accompaniment-rc293','study-display-rc294']) {
  vm.runInContext(fs.readFileSync('ear-source/'+file+'.js','utf8'),context);
}
const {BassUploadedCore:U,BassPracticeCore:P,BassFillCore:F,BassAccompaniment:H,BassStudyDisplay:N}=window;
let parts=0,patterns=0;
for (const clip of U.items) {
  const genre=H.category(clip,true),name=clip.originalTitle.toLowerCase();
  for(const [word,group] of [['reggae','reggae'],['makossa','makossa'],['seben','seben'],['soukous','soukous'],['soca','soca'],['zouk','zouk']]){
    if(name.includes(word))assert.equal(genre,group,clip.id);
  }
  const automatic=H.resolve(U.practicePlan(clip.id,0)).loop;
  if(genre==='seben'||genre==='soukous')assert(automatic.title.toLowerCase().includes(genre));
  const manual=H.resolve(U.practicePlan(clip.id,0),{kit:'reggae'}).loop;
  assert.equal(manual.genre,'reggae','manual kit takes priority');
  const range=U.loop(clip.id);
  for(const part of [...clip.parts.keys(),...(range?['beat']:[])]) {
    const p=U.practicePlan(clip.id,part),faster=U.practicePlan(clip.id,part,135);
    const segments=N.segments(p);
    assert(segments.length&&p.degrees.length===segments.length);
    for(const [i,s] of segments.entries()){
      assert(s.label.startsWith(p.degrees[i]+' · '));
      assert.equal(N.active(segments,s.beat),i);
    }
    assert(p.bass.length&&p.beats>0&&p.speed>0);
    assert(Math.abs(p.beats*p.step-(p.sourceEnd-p.sourceStart))<1e-6);
    assert.equal(faster.bpm,135);
    assert.deepEqual(faster.bass,p.bass);
    assert.deepEqual(faster.chords,p.chords);
    const loop=H.resolve(p).loop;
    assert(loop&&fs.existsSync(loop.url));
    if(clip.collection==='recorded-reggae')assert.equal(loop.genre,'reggae');
    const timing=window.BassRecordingTiming[clip.id];
    assert.equal(loop.id,timing.loop);
    assert(!/\b(?:19|20)\d{2}\b|\b(?:November|October|May)\b/i.test(N.clip(clip)));
    const local=Number(part)>0?timing.sections.find(row=>Math.abs(row[0]-clip.parts[part].start)<.001):null;
    if(local||range)assert(Math.abs(p.bpm-60/(local?local[2]:range.step))<1e-6);
    else if(loop.genre==='reggae')assert.equal(p.bpm,77);
    parts++;
  }
}
for(const [kind,rows] of [['fills',F.styles],['runs',P.runs],['basslines',P.lines]]) {
  for(let idea=0;idea<rows.length;idea++){
    const p=P.make(kind,{idea,from:1,to:4,bpm:77});
    const {id,loop}=H.resolve(p);
    assert(loop&&fs.existsSync(loop.url)&&N.segments(p).length,kind+' '+idea);
    if(['reggae','highlife','makossa','soukous'].includes(id))assert.equal(loop.genre,id);
    patterns++;
  }
}
console.log('Passed '+patterns+' generated patterns and '+parts+' selections from '+U.items.length+' recordings.');
