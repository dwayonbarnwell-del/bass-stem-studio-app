'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const dir=path.join(__dirname,'..'),src=fs.readFileSync(path.join(dir,'song-reference/chords.js'),'utf8');
let passes=0;function ok(value,message){assert.ok(value,message);passes++;}
ok(src.includes('Removed songs')&&src.includes('Select all matching'),'bulk UI exists');
ok(src.includes('function permanentlyDeleteSelected'),'permanent action exists');
ok(fs.readFileSync(path.join(dir,'robots.txt'),'utf8').includes('sitemap.xml'),'robots contains sitemap');
ok(fs.readFileSync(path.join(dir,'sitemap.xml'),'utf8').includes('guide.html'),'guide in sitemap');
const main=fs.readFileSync(path.join(dir,'index.html'),'utf8');
ok(main.includes('property="og:title"')&&main.includes('rel="canonical"'),'search metadata');
ok(fs.readFileSync(path.join(dir,'guide.html'),'utf8').includes('Share app link'),'share page');
class E{
 constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.dataset={};this.className='';this._text='';this.value='';this.hidden=false;this.disabled=false;this.scrollTop=0;this.classList={add:x=>{this.className+=' '+x}}}
 set textContent(v){this._text=String(v);this.children=[]}
 get textContent(){return this._text+this.children.map(x=>x.textContent).join('')}
 append(...x){for(const v of x){v.parent=this;this.children.push(v)}}
 replaceChildren(...x){this._text='';this.children=[];this.append(...x)}
 setAttribute(k,v){this.attrs[k]=String(v)}getAttribute(k){return this.attrs[k]??null}
 focus(){}addEventListener(){}remove(){}click(){this.onclick?.()}
}
const ids=new Map(),lookup=id=>{if(!ids.has(id))ids.set(id,new E('div'));return ids.get(id)};
const document={readyState:'loading',getElementById:lookup,createElement:t=>new E(t),addEventListener(){},body:new E('body')};
const base=[
 {id:1,title:'Old worship',artist:'Choir',sections:[{part:'Verse',chords:'1 4 5',cue:'my own words'}],notes:{lines:['Do not remove my reminder']},source:{}},
 {id:2,title:'Second worship',sections:[{part:'Chorus',chords:'6m 5 4 1'}],notes:{lines:[]},source:{}}
];
const window={BassSongReferenceData:{version:'RC221',songs:base}},stored=new Map(),
localStorage={getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)};
const prompt=[];const confirm=m=>{prompt.push(m);return true};
const instrument=src.replace('window.BassChordLibrary={',
 'window.__qa={changes,bulkSelected,currentSong,everySong,songCandidates,listSorted,renderList,toggleBulkMode,allMatchingSelected,removeSelectedSongs,restoreSelectedSongs,permanentlyDeleteSelected,makeBackup,allSaved,setFilter:v=>{filter=v;}};window.BassChordLibrary={');
ok(instrument!==src,'test hooks');
const context={window,document,localStorage,confirm,console,Date,setTimeout,clearTimeout};
vm.createContext(context);vm.runInContext(instrument,context);
const api=window.__qa;
for(let n=0;n<125;n++){
 const id=1000+n, song={id,title:'Saved track '+String(n+1).padStart(3,'0'),category:'Saved project charts',artist:'Own music',sections:[{part:'Verse',chords:'1 5 6m 4',source:'saved-project'}],collections:['Saved project charts'],notes:{lines:[]},source:{}};
 api.changes.set(id,{id,song,modifiedAt:1,favourite:false});
}
(async()=>{
 ok(api.everySong().length===127,'all initial songs');
 api.setFilter('saved');api.renderList();
 ok(api.listSorted().length===125,'all saved songs filtered');
 ok(lookup('bsRefSongs').children.length===80,'list remains paged at 80');
 api.toggleBulkMode();api.allMatchingSelected();
 ok(api.bulkSelected.size===125,'select all includes unshown results');
 ok(lookup('bsRefBulkCount').textContent==='125 selected','count shown');
 await api.removeSelectedSongs();
 ok(api.everySong().length===2,'all 125 moved out of list');
 ok(api.songCandidates().filter(s=>s.hidden).length===125,'all 125 recoverable');
 ok(api.listSorted().length===0,'old filter has no saved songs');
 let backup=JSON.parse((await api.makeBackup()).text);
 ok(backup.changes.filter(s=>s.hidden).length===125,'backup includes removed charts');
 api.setFilter('removed');api.renderList();
 ok(api.listSorted().length===125,'removed filter shows hidden saved entries');
 for(let n=0;n<3;n++)api.bulkSelected.add(1000+n);
 await api.restoreSelectedSongs();
 ok(api.everySong().length===5,'three restored');
 ok(api.songCandidates().filter(s=>s.hidden).length===122,'122 still recoverable');
 api.bulkSelected.add(1003);await api.permanentlyDeleteSelected();
 ok(!api.changes.has(1003),'one permanently deleted');
 ok(api.songCandidates().length===126,'total count after permanent removal');
 api.setFilter('progressions');api.renderList();
 api.bulkSelected.add(1);await api.removeSelectedSongs();
 ok(api.currentSong(1).hidden,'built-in hidden');
 ok(api.currentSong(1).sections[0].cue==='my own words','original cue protected');
 api.setFilter('removed');api.renderList();api.bulkSelected.add(1);
 await api.permanentlyDeleteSelected();
 ok(api.currentSong(1).hidden,'built-in cannot be permanently deleted');
 ok(lookup('bsRefStatus').textContent.includes('cannot be erased'),'built-in safe message');
 await api.restoreSelectedSongs();
 ok(!api.currentSong(1).hidden,'built-in restored');
 ok(api.currentSong(1).notes.lines[0]==='Do not remove my reminder','original note intact');
 backup=JSON.parse((await api.makeBackup()).text);
 ok(backup.format==='BassStemSongReferences','backup format unchanged');
 ok(backup.changes.filter(s=>s.hidden).length===121,'hidden state backed up');
 ok(prompt.some(s=>s.startsWith('Remove 125')),'bulk removal confirmed');
 ok(prompt.some(s=>s.includes('Permanently delete 1')),'hard deletion confirmed');
 console.log('PASS '+passes+' RC221 bulk management and discoverability checks');
})().catch(e=>{console.error(e);process.exitCode=1;});
