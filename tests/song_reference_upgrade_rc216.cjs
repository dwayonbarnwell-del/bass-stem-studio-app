'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const path=require('node:path');
const candidate=fs.readFileSync(path.join(__dirname,'../song-reference/chords.js'),'utf8');
const copy=x=>JSON.parse(JSON.stringify(x));
let checks=0;
function ok(name,fn){fn();checks++;console.log('PASS '+name);}

function harness(songs,version='RC216'){
 const ids=new Map(),storage=new Map();
 class Element{
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.value='';this._text='';this.attrs={};this.hidden=false;this.events={};this.className='';this.classList={add:(...names)=>{this.className+=' '+names.join(' ');}};}
  set id(value){this._id=value;ids.set(value,this);}get id(){return this._id;}
  set textContent(value){this._text=String(value);this.children=[];}get textContent(){return this._text+this.children.map(n=>n.textContent).join('');}
  append(...children){for(const child of children){child.parentElement=this;this.children.push(child);}}
  replaceChildren(...children){this.children=[];this.append(...children);}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(n=>n!==this);}
  setAttribute(name,value){this.attrs[name]=String(value);}getAttribute(name){return this.attrs[name]??null;}
  addEventListener(type,fn){this.events[type]=fn;}
  querySelector(query){const match=/^\[data-(.+)\]$/.exec(query);for(const n of this.children){if(match&&match[1] in n.dataset)return n;const next=n.querySelector(query);if(next)return next;}return null;}
  focus(){}scrollIntoView(){}click(){if(this.onclick)this.onclick();}
 }
 const document={readyState:'loading',getElementById:id=>ids.get(id)||null,createElement:tag=>new Element(tag),addEventListener(){},body:new Element('body')};
 for(const id of ['bsRefStatus','bsRefCount','bsRefSongs','bsRefMore','bsRefMatches','bsRefDetails','bsRefEmpty','bsRefTitle','bsRefArtist','bsRefKey','bsRefFavourite','bsRefInfo','bsRefSectionRows','bsRefFind','bsRefOriginal','bsRefNotesHint','bsRefSource','bsRefLicence','bsRefLicenceLink','bsRefArrangementNotes','bsRefChart','bsRefDelete','bsRefEarlier','bsRefEarlierBody','bsRefUpdated','bsRefUpdatedBody','bsRefAddUpdated','bsRefAddUpdatedNotes']){const el=new Element('div');el.id=id;}
 const window={BassSongReferenceData:{version,songs:copy(songs)},matchMedia:()=>({matches:false})};
 const localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)};
 const context={window,document,localStorage,console,setTimeout,clearTimeout,Date,Blob,URL,confirm:()=>true};
 vm.createContext(context);
 const instrumented=candidate.replace('window.BassChordLibrary={', 'window.__tests={currentSong,changes,original,referenceSnapshot,sectionSnapshot,referenceField,summary,renderDetail,collect,saveSelected,newSection,addUpdatedSections,addUpdatedNotes,keepSavedReference,renderEarlierImports,importBackup,everySong,fits,setFilter:value=>{filter=value;},getSelected:()=>selected};window.BassChordLibrary={');
 vm.runInContext(instrumented,context);
 return {api:window.__tests,ids,storage,context,Element};
}

const old={id:1,title:'Test song',artist:'Original artist',category:'My worship list',sections:[],source:{},notes:{heading:'Test song',lines:[]}};
const section={part:'Chorus',chords:'1 4 5 1',cue:'My reminder',source:'user',confidence:'Not verified'};
const latest={...copy(old),sections:[section],notes:{heading:'Test song',lines:['Ch. My reminder','1 4 5 1']},previousReference:copy(old),previousImport:{version:'RC215',reason:'Preserved before reconciliation.',notes:{lines:['Old notes']},sections:[{part:'Earlier verse',chords:'6 4 1 5'}]}};
function saved(song,favourite=true,extra={}){return {id:song.id,song:copy(song),favourite,modifiedAt:1,...extra};}

ok('favourite-only blank song receives new progression',()=>{
 const h=harness([latest]);const snapshot=copy(old);snapshot.key='';snapshot.sections=[{part:'Verse',chords:'',source:'edited',confidence:'Edited by you',letterChords:''}];snapshot.notes.type='Editable original notes';snapshot.notes.lines=[''];
 h.api.changes.set(1,saved(snapshot));const song=h.api.currentSong(1);
 assert.equal(song.sections[0].chords,'1 4 5 1');assert.equal(song.favourite,true);assert.deepEqual(copy(song.notes.lines),latest.notes.lines);assert.deepEqual(Object.keys(song._referenceUpdate),[]);
});

ok('all-blank legacy notes refresh but deliberately cleared notes remain empty',()=>{
 const h=harness([latest]);h.api.changes.set(1,saved({...copy(old),notes:{lines:['','  ']}}));
 assert.deepEqual(copy(h.api.currentSong(1).notes.lines),latest.notes.lines);assert.equal(h.api.currentSong(1)._referenceUpdate.notes,undefined);
 const before={...copy(old),notes:{lines:['My earlier reminder']}};const changed={...copy(latest),previousReference:before};const cleared=harness([changed]);
 cleared.api.changes.set(1,saved({...copy(before),notes:{lines:[''],type:'Editable original notes'}}));const song=cleared.api.currentSong(1);
 assert.deepEqual(copy(song.notes.lines),['']);assert.equal(song._referenceUpdate.notes,true);
});

ok('real edited blank song is not overwritten',()=>{
 const before={...copy(old),sections:[{part:'Verse',chords:'1 5'}]};const base={...copy(latest),previousReference:before};const h=harness([base]);
 h.api.changes.set(1,saved({...copy(before),sections:[{part:'Verse',chords:'',source:'edited'}]}));const song=h.api.currentSong(1);
 assert.equal(song.sections[0].chords,'');assert.equal(song._referenceUpdate.sections,true);
});

ok('edited progressions remain and new reference is offered',()=>{
 const h=harness([latest]);h.api.changes.set(1,saved({...copy(old),sections:[{part:'Chorus',chords:'1 6m 4 5',source:'edited'}]}));const song=h.api.currentSong(1);
 assert.equal(song.sections[0].chords,'1 6m 4 5');assert.equal(song._referenceUpdate.sections,true);
 h.api.renderDetail(song);assert.equal(h.ids.get('bsRefUpdated').hidden,false);assert.ok(h.ids.get('bsRefUpdatedBody').textContent.includes('1 4 5 1'));
});

ok('title artist and key corrections survive the upgrade',()=>{
 const h=harness([latest]);h.api.changes.set(1,saved({...copy(old),title:'My title',artist:'My artist',key:'D'}));const song=h.api.currentSong(1);
 assert.equal(song.title,'My title');assert.equal(song.artist,'My artist');assert.equal(song.key,'D');assert.equal(song.sections[0].chords,'1 4 5 1');
});

ok('original notes corrections survive and updated notes are offered',()=>{
 const h=harness([latest]);h.api.changes.set(1,saved({...copy(old),notes:{lines:['Keep my words exactly']}}));const song=h.api.currentSong(1);
 assert.deepEqual(copy(song.notes.lines),['Keep my words exactly']);assert.equal(song._referenceUpdate.notes,true);
 h.api.renderDetail(song);h.api.addUpdatedNotes();const text=h.ids.get('bsRefOriginal').value;
 assert.ok(text.startsWith('Keep my words exactly'));assert.ok(text.includes('1 4 5 1'));assert.equal(song.notes.lines[0],'Keep my words exactly');
});

ok('same progression already matching the new reference has no conflict',()=>{
 const h=harness([latest]);h.api.changes.set(1,saved({...copy(old),sections:copy(latest.sections)}));
 assert.equal(h.api.currentSong(1)._referenceUpdate.sections,undefined);
});

ok('automatic letter-to-number display is not mistaken for an edit',()=>{
 const before={...copy(old),source:{key:'G'},sections:[{part:'Verse',chords:'G C D G'}]};
 const after={...copy(latest),previousReference:before};const snapshot={...copy(before),key:'G',sections:[{part:'Verse',chords:'1 4 5 1',letterChords:'G C D G'}]};
 const h=harness([after]);h.api.changes.set(1,saved(snapshot));const song=h.api.currentSong(1);
 assert.equal(song.sections[0].part,'Chorus');assert.equal(song._referenceUpdate.sections,undefined);
});

ok('open sources are correctly labelled and licence links displayed',()=>{
 const base={...copy(latest),sections:[{...section,source:'open',letterChords:'E A B E',sourceKey:'E'}],source:{url:'https://example.com/song',name:'Songwriter',licence:'CC0 1.0',licenceUrl:'https://creativecommons.org/publicdomain/zero/1.0/',chartUrl:'https://example.com/score.pdf',note:'From the songwriter’s score',sectionNote:'Keep the chorus pickup from the previous section.'}};
 const h=harness([base]);assert.equal(h.api.summary(base).open,true);assert.equal(h.api.summary(base).source,true);h.api.renderDetail(base);
 assert.ok(h.ids.get('bsRefInfo').textContent.startsWith('Openly licensed reference'));assert.equal(h.ids.get('bsRefLicenceLink').hidden,false);assert.equal(h.ids.get('bsRefChart').href,'https://example.com/score.pdf');
 assert.ok(h.ids.get('bsRefSectionRows').textContent.includes('(key E)'));
 assert.ok(h.ids.get('bsRefArrangementNotes').textContent.includes('chorus pickup'));assert.equal(h.ids.get('bsRefArrangementNotes').hidden,false);
});

ok('new reference sections append without deleting existing edits or duplicating',()=>{
 const h=harness([latest]);h.api.changes.set(1,saved({...copy(old),sections:[{part:'Chorus',chords:'1 6m 4 5',source:'edited'}]}));h.api.renderDetail(h.api.currentSong(1));
 h.api.addUpdatedSections();h.api.collect();let song=h.api.getSelected();assert.equal(song.sections.length,2);assert.equal(song.sections[0].chords,'1 6m 4 5');assert.equal(song.sections[1].chords,'1 4 5 1');
 h.api.addUpdatedSections();h.api.collect();song=h.api.getSelected();assert.equal(song.sections.length,2);assert.equal(song._referenceUpdate.sections,undefined);
});

ok('earlier imports remain readable and collapsed',()=>{
 const h=harness([latest]);h.api.renderDetail(latest);assert.equal(h.ids.get('bsRefEarlier').hidden,false);assert.equal(h.ids.get('bsRefEarlier').open,false);
 assert.ok(h.ids.get('bsRefEarlierBody').textContent.includes('Old notes'));assert.ok(h.ids.get('bsRefEarlierBody').textContent.includes('6 4 1 5'));
});

ok('modern songs collection is selectable without hiding other catalogue entries',()=>{
 const modern={...copy(latest),id:2,collections:['Modern Christian songs 2002–2026']};const h=harness([latest,modern]);
 h.api.setFilter('modern');assert.equal(h.api.fits(latest),false);assert.equal(h.api.fits(modern),true);h.api.setFilter('all');assert.equal(h.api.fits(latest),true);assert.equal(h.api.everySong().length,2);
});

ok('long reminders progressions and notes are preserved without fixed input caps',()=>{
 const long={...copy(latest),sections:[{...section,part:'P'.repeat(160),chords:'1 4 5 '.repeat(450),cue:'Reminder words\n'.repeat(400)}],notes:{lines:['notes '.repeat(4000)]}};
 const h=harness([long]);h.api.renderDetail(long);const row=h.ids.get('bsRefSectionRows').children[0];
 for(const key of ['chords','cue','part']){const control=row.querySelector('[data-'+key+']');assert.equal(control.value,long.sections[0][key]);assert.ok(control.maxLength>control.value.length);}
 assert.equal(h.ids.get('bsRefOriginal').value,long.notes.lines[0]);assert.ok(h.ids.get('bsRefOriginal').maxLength>long.notes.lines[0].length);
 h.api.collect();assert.equal(h.api.getSelected().sections[0].cue,long.sections[0].cue);assert.equal(h.api.getSelected().notes.lines[0],long.notes.lines[0]);
});

(async()=>{
 const h=harness([latest]);h.api.changes.set(1,saved({...copy(old),sections:[{part:'Chorus',chords:'1 6m 4 5',source:'edited'}]}));h.api.renderDetail(h.api.currentSong(1));
 h.ids.get('bsRefTitle').value='My version';h.ids.get('bsRefTitle').events.input?.();
 // markUnsaved through the real row input listener without replacing its content.
 h.ids.get('bsRefSectionRows').children[0].querySelector('[data-chords]').events.input();
 assert.equal(await h.api.saveSelected(true),true);const record=h.api.changes.get(1);
 ok('new saves retain a baseline and unresolved update notice',()=>{
  assert.equal(record.baselineVersion,'RC216');assert.equal(record.referencePending.sections,true);assert.equal(record.song.previousReference,undefined);assert.equal(record.song.previousImport,undefined);assert.equal(record.referenceBase.sections[0].chords,'1 4 5 1');assert.equal(h.api.currentSong(1)._referenceUpdate.sections,true);
 });
 h.api.renderDetail(h.api.currentSong(1));h.api.keepSavedReference();await h.api.saveSelected(true);
 ok('explicitly keeping a version acknowledges the current update',()=>{
  assert.equal(h.api.currentSong(1)._referenceUpdate.sections,undefined);assert.equal(h.api.currentSong(1).sections[0].chords,'1 6m 4 5');
 });
 const malformed={format:'BassStemSongReferences',changes:[{id:10,song:{id:11,title:'Wrong ID',sections:[]}}]};
 await h.api.importBackup({size:100,text:async()=>JSON.stringify(malformed)});
 ok('backup mismatched IDs are rejected before a write',()=>{
  assert.equal(h.api.changes.has(10),false);assert.ok(h.ids.get('bsRefStatus').textContent.includes('unsupported song data'));
 });
 const exportRows=copy([...h.api.changes.values()]);const restore=harness([latest]);
 await restore.api.importBackup({size:JSON.stringify(exportRows).length,text:async()=>JSON.stringify({format:'BassStemSongReferences',changes:exportRows})});
 ok('backup restore preserves cues source metadata edits and update baselines',()=>{
  assert.equal(restore.api.currentSong(1).sections[0].chords,'1 6m 4 5');assert.equal(restore.api.changes.get(1).baselineVersion,'RC216');assert.equal(restore.api.currentSong(1).title,'My version');
 });
 console.log(JSON.stringify({checks,result:'pass',scope:'Node VM and DOM harness; no real browser or audio run'}));
})().catch(e=>{console.error(e);process.exitCode=1;});
