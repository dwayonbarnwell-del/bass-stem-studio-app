const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),cp=require('node:child_process');
const oldctx={window:{}},ctx={window:{},document:{readyState:'loading',addEventListener:()=>{}},console,setTimeout,clearTimeout};
vm.createContext(oldctx);vm.runInContext(cp.execFileSync('git',['show','a96eec6d0176881237492cb14130b65b86caf1ec:song-reference/data.js'],{encoding:'utf8',maxBuffer:10000000}),oldctx);
vm.createContext(ctx);vm.runInContext(fs.readFileSync('song-reference/data.js','utf8'),ctx);
const source=fs.readFileSync('song-reference/chords.js','utf8').replace('window.BassChordLibrary={','window.test={currentSong,changes,fits,setFilter:v=>filter=v};window.BassChordLibrary={');
vm.runInContext(source,ctx);const data=ctx.window.BassSongReferenceData,old=oldctx.window.BassSongReferenceData,manifest=JSON.parse(fs.readFileSync('song-reference/sources-rc254.json'));
assert.equal(new Set(data.songs.map(s=>s.id)).size,data.songs.length);
const plain=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
let filled=0;
for(const before of old.songs){
 const after=data.songs.find(s=>s.id===before.id);assert(after);assert.equal(after.title,before.title);assert.equal(after.artist,before.artist);assert.deepEqual(plain(after.notes),plain(before.notes));
 if(before.sections.length)assert.deepEqual(plain(after.sections),plain(before.sections));
 else if(after.sections.length){
  if(manifest.records.some(r=>r.id===before.id&&!r.newSong))filled++;assert(after.previousReference);ctx.window.test.changes.set(before.id,{id:before.id,favourite:true,song:plain(before)});
  assert.equal(ctx.window.test.currentSong(before.id).sections.length,after.sections.length);
  const edited={...plain(before),sections:[{part:'My chorus',chords:'1 6m 4 5',source:'edited'}]};ctx.window.test.changes.set(before.id,{id:before.id,song:edited});
  const result=ctx.window.test.currentSong(before.id);assert.equal(result.sections[0].chords,'1 6m 4 5');assert.equal(result._referenceUpdate.sections,true);
 }
}
assert.equal(filled,manifest.completedExisting);assert.equal(manifest.records.filter(r=>r.newSong).length,manifest.addedSongs);
for(const r of manifest.records){const song=data.songs.find(s=>s.id===r.id);assert.equal(song.source.url,r.url);assert(/^https:\/\//.test(r.url));assert(song.sections.length>0);for(const section of song.sections){assert(/^[b#1-7]/.test(section.chords));assert(!/[A-G]/.test(section.chords));assert.equal(section.sourceKey,r.sourceKey);assert(section.chords.split(' ').length<=24)}}
for(const r of manifest.records.filter(r=>r.newSong))assert(data.songs.find(s=>s.id===r.id).collections.includes('Added November 2026'));
assert.equal(data.statistics.missingSongs,data.songs.filter(s=>!s.sections.some(c=>String(c.chords||'').trim())).length);
console.log(`PASS RC254 catalogue: ${filled} completed, ${manifest.addedSongs} added, original notes and arrangements preserved, upgrade merges safe, unique IDs and source links verified.`);
