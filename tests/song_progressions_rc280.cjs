'use strict';
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const path=require('node:path'),root=path.join(__dirname,'..');
const data={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'song-reference/data.js'),'utf8'),data);
const catalogue=data.window.BassSongReferenceData,manifest=JSON.parse(fs.readFileSync(path.join(root,'song-reference/sources-rc280.json'),'utf8'));
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
assert.equal(digest(catalogue.songs.slice(0,manifest.baselineCount)),manifest.baselineSongsSha256,'all existing charts, IDs and metadata preserved');
const added=catalogue.songs.slice(manifest.baselineCount);
assert.equal(added.length,1000);assert.equal(catalogue.songs.length,3944);assert.equal(new Set(catalogue.songs.map(s=>s.id)).size,catalogue.songs.length);
const identity=s=>String(s).toLowerCase().replace(/’/g,"'").replace(/&/g,'and').replace(/^\s*\d+[.)]\s*/,'').replace(/\([^)]*\)|\[[^\]]*\]|\s[-–]\s.*/g,'').replace(/\s+(?:live|acoustic|instrumental|remastered)(?:\s+version)?$/i,'').normalize('NFKD').replace(/[^\x00-\x7F]/g,'').replace(/[^a-z0-9]/g,'');
const seen=new Set(catalogue.songs.slice(0,manifest.baselineCount).flatMap(s=>[s.title,...(s.aliases||[])]).map(identity));
let sections=0;
for(const song of added){
 const key=identity(song.title);assert.ok(key&&!seen.has(key),'unique title: '+song.title);seen.add(key);
 assert.ok(song.sections.length>=2);assert.match(song.key,/^[A-G][#b]?$/);
 assert.ok(song.collections.includes('Added RC280'));assert.equal(song.notes.lines.length,0);
 const sourceUrl=new URL(song.source.url);assert.equal(sourceUrl.protocol,'https:');assert.equal(sourceUrl.hostname,'www.psalmnote.com');assert.match(sourceUrl.pathname,/^\/song\/[^/]+$/);
 for(const s of song.sections){
  assert.equal(s.source,'community');assert.equal(s.sourceKey,song.key);assert.ok(s.part.trim());assert.ok(s.chords.trim());
  for(const token of s.chords.split(/\s+/))assert.match(token,/^[b#]?[1-7](?:\([0-9]+\)|m?maj7|maj(?:7|9|11|13)|m(?:6|7|9|11|13)?(?:b5|sus4?)?|sus[24]?|add(?:2|4|9|11)|dim7?|aug|7sus[24]?)?(?:\/[b#]?[1-7])?$/,'valid number: '+token);
  sections++;
 }
}
assert.equal(sections,6343);assert.equal(catalogue.stats.withSectionChords,3809);assert.equal(catalogue.stats.needsProgression,135);
assert.equal(manifest.added.length,1000);assert.deepEqual(manifest.added.map(s=>s.id),Array.from(added,s=>s.id));
const script=fs.readFileSync(path.join(root,'song-reference/chords.js'),'utf8');
const window={BassSongReferenceData:catalogue};
const storage=new Map(),localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
const document={readyState:'loading',addEventListener(){}};
vm.runInNewContext(script.replace('window.BassChordLibrary={','window.__test={summary,captionText,fits,currentSong,changes,putSaved,allSaved,setFilter:f=>filter=f};window.BassChordLibrary={'),{window,document,localStorage,setTimeout,clearTimeout});
const api=window.__test;api.setFilter('recent');assert.equal(catalogue.songs.filter(api.fits).length,1000,'New additions filter');
api.setFilter('sourced');assert.ok(added.every(api.fits),'new community charts included in sourced filter');assert.match(api.captionText(added[0]),/^Psalmnote reference/);
const existing=catalogue.songs[0],custom=JSON.parse(JSON.stringify(existing));custom.sections=[{part:'Chorus',chords:'1 4 2m 5'}];
api.changes.set(existing.id,{song:custom,hidden:true,favourite:true,referenceBase:existing});
const restored=api.currentSong(existing.id);assert.equal(restored.hidden,true);assert.equal(restored.favourite,true);assert.equal(restored.sections[0].chords,'1 4 2m 5');
api.changes.set(added[0].id,{song:added[0],hidden:true});assert.equal(api.currentSong(added[0].id).hidden,true,'new references support persistent removal');
(async()=>{await api.putSaved({id:existing.id,song:custom,hidden:true,favourite:true});const saved=await api.allSaved();assert.equal(saved[0].hidden,true);assert.equal(saved[0].favourite,true);assert.equal(saved[0].song.sections[0].chords,'1 4 2m 5');
console.log(JSON.stringify({result:'PASS',newSongs:added.length,newSections:sections,existingPreserved:manifest.baselineCount,checks:'titles, chords, source, counts, filters, edits, favourites, removals'}));

})().catch(e=>{console.error(e);process.exitCode=1;});
