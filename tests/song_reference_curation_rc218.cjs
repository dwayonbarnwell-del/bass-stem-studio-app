'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm'),path=require('node:path');
const dir=path.join(__dirname,'..');
const src=fs.readFileSync(path.join(dir,'song-reference/data.js'),'utf8');
const data=JSON.parse(src.replace(/^window\.BassSongReferenceData=/,'').replace(/;\s*$/,''));
const code=fs.readFileSync(path.join(dir,'song-reference/chords.js'),'utf8');
assert.equal(data.version,'RC218');
assert.equal(data.songs.length,899);
assert.equal(data.songs.filter(s=>s.sections?.some(x=>String(x.chords||'').trim())).length,565);
const testIds=[515,522,525,821,833,835];
for(const id of testIds){
 const s=data.songs.find(s=>s.id===id);
 assert.ok(s.sections.length>=1);
 assert.ok(s.previousReference&&!s.previousReference.sections?.length);
 for(const p of s.sections){
   assert.equal(p.source,'public-domain');
   assert.ok(/^https:\/\//.test(s.source.url));
   assert.ok(p.chords.replace(/(?:\d(?:m|\(\d+\))?|[| ])+/g,'').length===0,'unexpected number token');
 }
}
assert.equal(data.songs.filter(s=>s.category==='Nigerian praise & worship'&&!s.sections?.some(p=>p.chords)).length,49);
new Function(code);
let initial, visible;
const testCode=code.replace('window.BassChordLibrary={','window.__test={everySong,currentSong,archiveUnchartedChartOnly,changes};window.BassChordLibrary={');
const window={BassSongReferenceData:data};
const document={readyState:'loading',addEventListener(){},getElementById(){return null}};
const localStorage={};
vm.runInNewContext(testCode,{window,document,localStorage,console});
const api=window.__test;
assert.equal(api.everySong().length,850);
assert.equal(api.everySong().filter(s=>!s.sections?.some(p=>String(p.chords||'').trim())).length,285);
const a=data.songs.find(s=>s.id===628);
assert.equal(api.archiveUnchartedChartOnly(a),true);
api.changes.set(a.id,{id:a.id,favourite:true,song:{id:a.id,title:a.title,sections:[]}});
assert.ok(api.everySong().find(s=>s.id===a.id),'saved favourite protected');
console.log('RC218 curation checks passed.');
