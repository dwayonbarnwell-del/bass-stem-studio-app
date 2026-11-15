const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const env={window:{}};vm.createContext(env);for(const f of ['uploaded-data-rc267.js','uploaded-core-rc267.js'])vm.runInContext(fs.readFileSync('ear-source/'+f,'utf8'),env);
const U=env.window.BassUploadedCore;assert.equal(U.items.length,43);assert.equal(new Set(U.items.map(c=>c.id)).size,43);let total=0,plans=0;
for(const c of U.items){
 assert(c.notes.length>0,c.id+' has notes');assert(fs.existsSync(c.audio.replace(/^\.\//,'')),c.id+' recording exists');
 assert(c.notes.every((n,i)=>n.start>=0&&n.end>n.start&&n.end<=c.duration+.05&&Number.isInteger(n.midi)&&n.midi>=21&&n.midi<=108&&(!i||n.start>=c.notes[i-1].start)));total+=c.notes.length;
 for(let part=0;part<c.parts.length;part++)for(const speed of [25,50,100,125])for(const transpose of [-12,0,12]){
  const p=U.plan(c.id,part,speed,transpose);assert(p&&p.chords.length===0);assert.equal(p.bpm,60*speed/100);assert.equal(p.audio,c.audio);assert(p.beats>0);assert(p.bass.every(n=>n.beat>=0&&n.length>0&&n.beat+n.length<=p.beats+.001&&n.midi>=21&&n.midi<=108));plans++;
 }
 const a=U.plan(c.id,0,100,0),b=U.plan(c.id,0,50,0);assert.equal(a.beats,b.beats);assert.equal(a.bpm,2*b.bpm,'half speed doubles duration without changing note pitches');assert.deepEqual(Array.from(a.bass,n=>n.midi),Array.from(b.bass,n=>n.midi));
}
assert.equal(U.plan('missing'),null);assert.equal(U.items.filter(c=>c.group==='bass-lady').length,11);assert.equal(U.items.filter(c=>c.group==='bassmatics').length,10);assert.equal(U.items.filter(c=>c.group==='bass-sounds').length,22);
console.log(`PASS ${U.items.length} uploaded clips, ${total} notes and ${plans} section/speed/transpose combinations; recordings present and no invented chords.`);
