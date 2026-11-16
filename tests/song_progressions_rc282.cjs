'use strict';
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.join(__dirname,'..'),box={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'song-reference/data.js'),'utf8'),box);
const data=box.window.BassSongReferenceData,m=JSON.parse(fs.readFileSync(path.join(root,'song-reference/sources-rc282.json'),'utf8'));
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const digest=v=>crypto.createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
assert.equal(data.version,'RC282');assert.equal(data.songs.length,5944);assert.equal(m.baselineCount,4944);
const byId=new Map(data.songs.map(s=>[s.id,s]));assert.equal(byId.size,data.songs.length);
for(const old of m.existing)assert.equal(digest(byId.get(old.id)),old.sha256,'preserved existing record '+old.id);
const identity=s=>{s=String(s||'').toLowerCase().replace(/’/g,"'").replace(/&/g,'and').normalize('NFKD').replace(/[^\x00-\x7f]/g,'').replace(/^\s*\d+[.)]\s*/,'').replace(/\([^)]*\)|\[[^\]]*\]|\s[-–]\s.*/g,'').replace(/\s+(?:feat\.?|featuring|ft\.?).*$/,'').replace(/\s+(?:live|acoustic|instrumental|remastered|remix|ukulele|duet|v\d+(?:\.\d+)*)(?:\s+version)?$/,'');for(const [from,to]of Object.entries({'i m':'i am',"i'm":'i am',im:'i am',"i've":'i have',ive:'i have',"i'll":'i will',ill:'i will',"you're":'you are',youre:'you are',"we're":'we are',"we've":'we have',weve:'we have',"don't":'do not',dont:'do not',"can't":'cannot',cant:'cannot',"he's":'he is',hes:'he is',"it's":'it is',its:'it is',"there's":'there is',theres:'there is',"won't":'will not',wont:'will not',"didn't":'did not',didnt:'did not'}))s=s.replace(new RegExp('\\b'+from+'\\b','g'),to);return s.replace(/^were\b/,'we are').replace(/\b(?:the|a|an)\b/g,'').replace(/[^a-z0-9]/g,'');};
const added=data.songs.slice(m.baselineCount),seen=new Set(data.songs.slice(0,m.baselineCount).flatMap(s=>[s.title,...(s.aliases||[])]).map(identity)),manifest=new Map(m.added.map(s=>[s.id,s]));
assert.equal(added.length,1000);assert.equal(m.added.length,1000);let sections=0,letters=0,practice=0,dated=0;
const pitch=n=>({C:0,D:2,E:4,F:5,G:7,A:9,B:11}[n[0]]+(n[1]==='#'?1:n[1]==='b'?-1:0)+12)%12;
const degrees=['1','b2','2','b3','3','4','#4','5','b6','6','b7','7'];
const numbered=(c,key)=>{const z=/^([A-G][#b]?)(.*?)(?:\/([A-G][#b]?))?$/.exec(c);assert.ok(z,'valid source letter chord '+c);let suffix=z[2].replace(/M/g,'maj').replace(/^-/,'m');if(/^\d/.test(suffix))suffix='('+suffix+')';return degrees[(pitch(z[1])-pitch(key)+12)%12]+suffix+(z[3]?'/'+degrees[(pitch(z[3])-pitch(key)+12)%12]:'');};
for(const s of added){
 const r=manifest.get(s.id),id=identity(s.title);assert.ok(!seen.has(id),'no duplicate '+s.title);seen.add(id);
 assert.ok(m.requestedArtists.includes(r.requestedArtist)||m.relatedArtists.includes(r.requestedArtist));assert.equal(s.source.sha256,r.source.sha256);
 assert.ok(s.collections.includes('Added RC282'));assert.equal(s.notes.lines.length,0);assert.ok(s.sections.length);
 assert.doesNotMatch(s.title,/hymn|medley|playlist|performance|ukulele|v1\.1|as we lay|i don.t wanna know|i heard the bells on christmas day|hold to god.s unchanging hand/i);
 assert.equal(new URL(s.source.url).protocol,'https:');assert.match(s.source.sha256,/^[a-f0-9]{64}$/);assert.match(s.source.note,/not independently verified|not confirmed/);
 if(s.key)assert.match(s.key,/^[A-G][#b]?m?$/);else letters++;
 if(s.popularity){dated++;for(const e of s.popularity){assert.ok(e.year>=1999&&e.year<=2026);assert.ok(e.rank>0);assert.equal(new URL(e.evidenceUrl).protocol,'https:');}}
 if(s.source.arrangementType==='simplified-practice'){
  practice++;assert.equal(s.sections.length,1);assert.equal(s.sections[0].part,'Simplified practice sequence');assert.equal(s.sections[0].letterChords,r.sourceSequence.join(' '));assert.match(s.source.sectionNote,/not a complete arrangement/);
 }else assert.equal(s.source.arrangementType,'community-chart');
 for(const p of s.sections){assert.ok(p.part&&p.chords);sections++;assert.equal(p.sourceKey,s.key);assert.equal(p.source,'community');assert.ok(p.letterChords);
  const expected=s.key?p.letterChords.split(/\s+/).map(c=>numbered(c,s.key)).join(' '):p.letterChords;assert.equal(p.chords,expected,'source order and number conversion '+s.title);
 }
}
assert.equal(sections,m.counts.addedSections);assert.equal(letters,m.counts.letterChordNewSongs);assert.equal(practice,m.counts.simplifiedPracticeSongs);assert.equal(1000-practice,m.counts.communityChartSongs);assert.equal(dated,m.counts.datedPopularityEvidence);assert.equal(data.stats.needsProgression,7);assert.equal(m.existing.length,4944);
const script=fs.readFileSync(path.join(root,'song-reference/chords.js'),'utf8'),window={BassSongReferenceData:data};
class Element{constructor(){this.children=[];this._text='';this.className='';this.classList={add:n=>{this.className+=' '+n;}};}set textContent(v){this._text=String(v);this.children=[];}get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}append(...xs){this.children.push(...xs);}replaceChildren(...xs){this.children=xs;this._text='';}querySelector(q){return this.children.find(c=>c.className.split(' ').includes(q.slice(1)))||null;}}
const ids=new Map(),document={readyState:'loading',addEventListener(){},createElement:()=>new Element(),getElementById:id=>{if(!ids.has(id))ids.set(id,new Element());return ids.get(id);}};
const storage=new Map(),localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
vm.runInNewContext(script.replace('window.BassChordLibrary={','window.__test={renderOverview,summary,captionText,fits,currentSong,changes,putSaved,allSaved,setFilter:f=>filter=f};window.BassChordLibrary={'),{window,document,localStorage,setTimeout,clearTimeout});
const api=window.__test;api.setFilter('recent');assert.equal(data.songs.filter(api.fits).length,1000);api.setFilter('sourced');assert.ok(added.every(api.fits));api.setFilter('modern');assert.equal(added.filter(api.fits).length,dated);
const simple=added.find(s=>s.source.arrangementType==='simplified-practice'),letter=added.find(s=>!s.key&&s.source.arrangementType==='simplified-practice'),chart=added.find(s=>s.key&&s.source.arrangementType==='community-chart');
assert.match(api.captionText(simple),/^Simplified practice/);assert.match(api.captionText(letter),/key not confirmed/);assert.match(api.captionText(chart),/^Community chart/);
const previous=JSON.parse(fs.readFileSync(path.join(root,'song-reference/sources-rc281.json'),'utf8')),filled=byId.get(previous.filled[0].id),prior=JSON.parse(JSON.stringify(filled.previousReference));
api.changes.set(filled.id,{song:{...prior,id:filled.id},favourite:true,hidden:true});const updated=api.currentSong(filled.id);assert.equal(updated.sections[0].chords,filled.sections[0].chords);assert.equal(updated.favourite,true);assert.equal(updated.hidden,true);
api.changes.set(filled.id,{song:{...prior,id:filled.id,sections:[{part:'My chorus',chords:'1 4 2m 5'}]},referenceBase:prior,favourite:true});assert.equal(api.currentSong(filled.id).sections[0].chords,'1 4 2m 5');
for(const song of [letter,simple,chart,filled]){api.renderOverview(song);assert.equal(ids.get('bsRefOverviewSections').children.length,song.sections.length);assert.ok(ids.get('bsRefOverviewSections').textContent.includes(song.sections[0].chords));assert.ok(ids.get('bsRefOverviewSources').textContent.includes('Source'));}
for(const file of ['index.html','sw.js']){const contents=fs.readFileSync(path.join(root,file),'utf8');assert.ok(contents.includes('song-reference/data.js?v=rc282'));assert.ok(contents.includes('song-reference/chords.js?v=rc282'));}
console.log(JSON.stringify({result:'PASS',...m.counts,checks:'preservation, distinct titles, artist allowlist, source sequences, chord conversion, source labels, filters and saved edits'}));
