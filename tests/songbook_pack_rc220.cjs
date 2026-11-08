'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../song-reference/chords.js'),'utf8');
new Function(source);
assert.ok(source.includes('Import charts / backup')&&source.includes('Share backup')&&source.includes('My songbook'));
const code=source.replace('window.BassChordLibrary={','window.__test={validateSongbook,findSongForBook,importSongbookPack,currentSong,everySong,shareBackup};window.BassChordLibrary={');
const songs=[{id:1,title:'Above All',sections:[],notes:{lines:['Keep this reminder']},source:{}},{id:2,title:'Popular song',sections:[{part:'Chorus',chords:'1 5 6m 4',cue:'My memory words'}],notes:{lines:[]},source:{}}];
class E { constructor(){this.children=[];this.dataset={};this.attrs={};this.textContent='';this.hidden=false;}append(...x){this.children.push(...x)}replaceChildren(...x){this.children=x}setAttribute(k,v){this.attrs[k]=String(v)}getAttribute(k){return this.attrs[k]??null}focus(){} }
const elements=new Map(),document={readyState:'loading',addEventListener(){},createElement(){return new E()},getElementById(id){if(!elements.has(id))elements.set(id,new E());return elements.get(id)},body:new E()};
const window={BassSongReferenceData:{songs,version:'RC220'}},map=new Map(),localStorage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};
class FileStub{constructor(parts,name,opt){this.parts=parts;this.name=name;this.type=opt.type}}
let shared=0;const navigator={canShare:({files})=>files.length===1,share:async()=>{shared++}};
vm.createContext({window,document,localStorage,navigator,File:FileStub,Date,console,setTimeout,clearTimeout});
vm.runInNewContext(code,{window,document,localStorage,navigator,File:FileStub,Date,console,setTimeout,clearTimeout});
const api=window.__test;
const pack={format:'BassStemSongChordPack',schemaVersion:1,source:{documentFingerprint:'0123456789abcdef'.repeat(4)},songs:[
 {title:'Above All',referenceId:'book-a111111',sourcePage:4,sections:[{part:'Verse',chords:'1 4 5 1',sourcePage:4}]},
 {title:'Popular song',referenceId:'book-a222222',sourcePage:12,sections:[{part:'Chorus',chords:'6m 4',sourcePage:12},{part:'Bridge',chords:'6m 5 4 1',sourcePage:12}]},
 {title:'New hymn',referenceId:'book-a333333',sourcePage:71,sections:[{part:'Main progression',chords:'1 4 5 1',sourcePage:71}]}
]};
(async()=>{
 assert.equal(api.validateSongbook(pack).length,3);
 await api.importSongbookPack(pack);
 assert.equal(api.currentSong(1).sections[0].chords,'1 4 5 1');
 assert.equal(api.currentSong(1).notes.lines[0],'Keep this reminder');
 assert.equal(api.currentSong(2).sections[0].chords,'1 5 6m 4');
 assert.equal(api.currentSong(2).sections[0].cue,'My memory words');
 assert.equal(api.currentSong(2).sections[1].part,'Bridge');
 assert.equal(api.everySong().length,3);
 await api.importSongbookPack(pack);
 assert.equal(api.everySong().length,3);
 assert.equal(api.currentSong(2).sections.length,2);
 await api.shareBackup();
 assert.equal(shared,1);
 const bad=JSON.parse(JSON.stringify(pack));bad.songs[0].sections[0].chords='C G D';
 assert.throws(()=>api.validateSongbook(bad),/Invalid section/);
 console.log('RC220: local import, edit preservation and share checks passed');
})().catch(err=>{console.error(err);process.exitCode=1;});
