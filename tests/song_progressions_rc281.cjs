'use strict';
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.join(__dirname,'..'),box={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'song-reference/data.js'),'utf8'),box);
const data=box.window.BassSongReferenceData,m=JSON.parse(fs.readFileSync(path.join(root,'song-reference/sources-rc281.json'),'utf8'));
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const digest=v=>crypto.createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
const byId=new Map(data.songs.map(s=>[s.id,s]));assert.equal(byId.size,data.songs.length);assert.equal(data.songs.length,4944);
for(const old of m.existing)assert.equal(digest(byId.get(old.id)),old.sha256,'unchanged existing record '+old.id);
for(const old of m.filled){const s=byId.get(old.id);assert.equal(digest(Object.fromEntries(Object.entries(s).filter(([k])=>!['sections','key','source','previousReference'].includes(k)))),old.protectedSha256,'preserved title, artist, notes and collections '+s.title);assert.ok(s.sections.length);assert.ok(!old.before.sections?.some(p=>p.chords));}
const identity=s=>String(s||'').toLowerCase().replace(/’/g,"'").replace(/&/g,'and').normalize('NFKD').replace(/[^\x00-\x7f]/g,'').replace(/^\s*\d+[.)]\s*/,'').replace(/\([^)]*\)|\[[^\]]*\]|\s[-–]\s.*/g,'').replace(/\s+(?:feat\.?|featuring|ft\.?).*$/,'').replace(/\s+(?:live|acoustic|instrumental|remastered|remix)(?:\s+version)?$/,'').replace(/\b(?:the|a|an)\b/g,'').replace(/[^a-z0-9]/g,'');
const added=data.songs.slice(m.baselineCount),seen=new Set(data.songs.slice(0,m.baselineCount).flatMap(s=>[s.title,...(s.aliases||[])]).map(identity));
assert.equal(added.length,1000);let sections=0,letters=0;
for(const s of added){
 const id=identity(s.title);assert.ok(!seen.has(id),'no duplicate '+s.title);seen.add(id);
 assert.ok(s.collections.includes('Added RC281'));assert.equal(s.notes.lines.length,0);assert.ok(s.sections.length);
 assert.doesNotMatch(s.title,/hymn|medley|I Heard The Bells On Christmas Day|Grace Like Rain/i);assert.doesNotMatch(s.artist,/getty|cityalight|stuart townend|sovereign grace/i);
 assert.equal(new URL(s.source.url).protocol,'https:');assert.match(s.source.sha256,/^[a-f0-9]{64}$/);
 assert.ok(s.popularity.length);for(const e of s.popularity){assert.ok(e.year>=1999&&e.year<=2026);assert.ok(e.rank>0);assert.ok(!e.date||e.date<='2026-11-16');assert.equal(new URL(e.evidenceUrl).protocol,'https:');}
 if(s.key)assert.match(s.key,/^[A-G][#b]?m?$/);else letters++;
 for(const p of s.sections){assert.ok(p.part&&p.chords);sections++;assert.equal(p.sourceKey.replace(/m$/,''),s.key.replace(/m$/,''));
  for(const c of p.chords.split(/\s+/))assert.match(c,s.key?/^[b#]?[1-7][a-z0-9#b()/]*$/:/^[A-G][#b]?[a-zA-Z0-9#b()+/]*$/,'chord '+c+' in '+s.title);
  if(!s.key)assert.equal(p.letterChords,p.chords);
 }
}
assert.equal(sections,m.counts.addedSections);assert.equal(letters,m.counts.letterChordNewSongs);assert.equal(data.stats.needsProgression,m.unresolved.length);assert.equal(m.existing.length+m.filled.length,m.baselineCount);
const script=fs.readFileSync(path.join(root,'song-reference/chords.js'),'utf8'),window={BassSongReferenceData:data};
class Element {constructor(){this.children=[];this._text='';this.className='';this.classList={add:n=>{this.className+=' '+n;}};}set textContent(v){this._text=String(v);this.children=[];}get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}append(...xs){this.children.push(...xs);}replaceChildren(...xs){this.children=xs;this._text='';}querySelector(q){return this.children.find(c=>c.className.split(' ').includes(q.slice(1)))||null;}}
const ids=new Map(),document={readyState:'loading',addEventListener(){},createElement:()=>new Element(),getElementById:id=>{if(!ids.has(id))ids.set(id,new Element());return ids.get(id);}};
const storage=new Map(),localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
vm.runInNewContext(script.replace('window.BassChordLibrary={','window.__test={renderOverview,summary,captionText,fits,currentSong,changes,putSaved,allSaved,setFilter:f=>filter=f};window.BassChordLibrary={'),{window,document,localStorage,setTimeout,clearTimeout});
const api=window.__test;api.setFilter('recent');assert.equal(data.songs.filter(api.fits).length,1000);api.setFilter('modern');assert.ok(added.every(api.fits));api.setFilter('sourced');assert.ok(added.every(api.fits));
assert.match(api.captionText(added.find(s=>!s.key)),/key not confirmed/);assert.match(api.captionText(added.find(s=>s.key&&s.source.name.startsWith('E-Chords'))),/^Community/);
const filled=byId.get(m.filled[0].id),prior=JSON.parse(JSON.stringify(filled.previousReference));
api.changes.set(filled.id,{song:{...prior,id:filled.id},favourite:true,hidden:true});const updated=api.currentSong(filled.id);assert.equal(updated.sections[0].chords,filled.sections[0].chords);assert.equal(updated.favourite,true);assert.equal(updated.hidden,true);
api.changes.set(filled.id,{song:{...prior,id:filled.id,sections:[{part:'My chorus',chords:'1 4 2m 5'}]},referenceBase:prior,favourite:true});assert.equal(api.currentSong(filled.id).sections[0].chords,'1 4 2m 5');
for(const song of [added.find(s=>!s.key),added.find(s=>s.key.endsWith('m')),filled]){api.renderOverview(song);assert.equal(ids.get('bsRefOverviewSections').children.length,song.sections.length);assert.ok(ids.get('bsRefOverviewSections').textContent.includes(song.sections[0].chords));assert.ok(ids.get('bsRefOverviewSources').textContent.includes('Source'));}
console.log(JSON.stringify({result:'PASS',...m.counts,checks:'existing records, filled notes, title duplicates, dates, sources, chord notation, filters and saved edits'}));
