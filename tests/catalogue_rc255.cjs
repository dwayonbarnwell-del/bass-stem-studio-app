const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),cp=require('node:child_process');
const ctx={window:{},document:{readyState:'loading',addEventListener:()=>{}},console,setTimeout,clearTimeout};vm.createContext(ctx);
vm.runInContext(fs.readFileSync('song-reference/data.js','utf8'),ctx);
const previous={window:{}};vm.createContext(previous);vm.runInContext(cp.execFileSync('git',['show','6b2702a4739faec1f39a449c4f6dfa3f0da5d25a:song-reference/data.js'],{encoding:'utf8',maxBuffer:10000000}),previous);
vm.runInContext(fs.readFileSync('song-reference/chords.js','utf8').replace('window.BassChordLibrary={','window.catalogueTest={fits,setFilter:v=>filter=v,currentSong,changes};window.BassChordLibrary={'),ctx);
const data=ctx.window.BassSongReferenceData,baseline=previous.window.BassSongReferenceData,manifest=JSON.parse(fs.readFileSync('song-reference/sources-rc255.json'));
const plain=x=>JSON.parse(JSON.stringify(x));
const normal=s=>s.replace(/\([^)]*\)/g,'').replace(/\b(?:live|acoustic|radio version|radio edit|studio version)\b/gi,'').normalize('NFKD').replace(/[^a-z0-9]/gi,'').toLowerCase();
assert.equal(manifest.addedSongs,1000);assert.equal(data.songs.length,baseline.songs.length+1000);
assert.equal(new Set(data.songs.map(s=>s.id)).size,data.songs.length);
assert.equal(manifest.completedRecords.length,manifest.completedExisting);
for(const old of baseline.songs){
 const current=data.songs.find(s=>s.id===old.id),completed=manifest.completedRecords.find(r=>r.id===old.id);
 if(!completed){assert.deepEqual(plain(current),plain(old),'Existing charts and notes must remain unchanged: '+old.title);continue;}
 assert.equal(old.sections.length,0);assert.equal(current.title,old.title);assert.equal(current.artist,old.artist);assert.deepEqual(plain(current.notes),plain(old.notes));assert.equal(current.source.url,completed.url);assert(current.sections.length>0);
 ctx.window.catalogueTest.changes.set(old.id,{id:old.id,favourite:true,song:plain(old)});assert.equal(ctx.window.catalogueTest.currentSong(old.id).sections.length,current.sections.length);
 const edited={...plain(old),sections:[{part:'My chorus',chords:'1 6m 4 5',source:'edited'}]};ctx.window.catalogueTest.changes.set(old.id,{id:old.id,song:edited});assert.equal(ctx.window.catalogueTest.currentSong(old.id).sections[0].chords,'1 6m 4 5');
}
ctx.window.catalogueTest.changes.clear();
const titles=new Set(baseline.songs.flatMap(s=>[s.title,...(s.aliases||[])]).map(normal)),cclis=new Set();
for(const record of manifest.records){
 const song=data.songs.find(s=>s.id===record.id);assert(song);assert(!titles.has(normal(song.title)),'Duplicate title: '+song.title);titles.add(normal(song.title));
 if(record.ccli){assert(!cclis.has(record.ccli),'Duplicate registered song');cclis.add(record.ccli);}
 assert.equal(song.title,record.title);assert.equal(song.artist,record.artist);assert.equal(song.source.url,record.url);assert.match(record.sourceSha256,/^[a-f0-9]{64}$/);assert.match(record.url,/^https:\/\/(www\.worshiptogether\.com|sovereigngracemusic\.com)\//);
 assert(song.sections.length>=1);assert(song.sections.some(s=>/Verse|Chorus|Bridge/i.test(s.part)));assert.equal(song.sections.length,record.sections);
 for(const s of song.sections){assert.equal(s.source,'publisher');assert.equal(s.sourceKey,record.sourceKey);assert(s.chords.split(' ').length<=16);assert.match(s.chords,/^[b#1-7]/);assert(!/[A-G]/.test(s.chords),'Numbers only');assert(!s.letterChords&&!s.cue,'No copied lyrics');}
 if(record.resourceDate){assert(record.resourceDate>='2016-01-01'&&record.resourceDate<='2026-11-14');assert(!song.year,'Resource dates must not be presented as first release years');}else assert(record.year>=2000&&record.year<=2026);
}
ctx.window.catalogueTest.setFilter('recent');assert.equal(data.songs.filter(ctx.window.catalogueTest.fits).length,1000);
ctx.window.catalogueTest.setFilter('modern');for(const record of manifest.records)assert(ctx.window.catalogueTest.fits(data.songs.find(s=>s.id===record.id)));
const filled=data.songs.filter(s=>s.sections.some(c=>String(c.chords||'').trim())).length;assert.equal(data.statistics.storedSongs,data.songs.length);assert.equal(data.stats.withSectionChords,filled);assert.equal(data.statistics.missingSongs,data.songs.length-filled);
console.log('PASS 1,000 additional sourced progressions, existing charts and personal edits preserved, missing charts completed, unique titles and registration IDs, dates accurately labelled, filters and counts.');
