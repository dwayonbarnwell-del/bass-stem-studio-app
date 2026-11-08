'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../song-reference/chords.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../song-reference/chords.css'),'utf8');
let checks=0;
function yes(condition,label){assert.ok(condition,label);checks++;}
class El{
 constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.attrs={};this._text='';this.value='';this.hidden=false;this.open=false;this.className='';this.classList={add:(name)=>{this.className+=' '+name}};}
 set textContent(v){this._text=String(v);this.children=[];}
 get textContent(){return this._text+this.children.map(x=>x.textContent).join('');}
 append(...kids){for(const kid of kids){kid.parent=this;this.children.push(kid);}}
 replaceChildren(...kids){this._text='';this.children=[];this.append(...kids);}
 setAttribute(k,v){this.attrs[k]=String(v);}
 getAttribute(k){return this.attrs[k]??null;}
 querySelector(q){for(const child of this.children){if(q[0]==='.'&&child.className.split(' ').includes(q.slice(1)))return child;const data=/^\[data-(.*?)\]$/.exec(q);if(data&&data[1] in child.dataset)return child;const nested=child.querySelector(q);if(nested)return nested;}return null;}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(k=>k!==this);}
 focus(){}addEventListener(){}scrollIntoView(){}close(){this.open=false;}
}
const ids=new Map();
for(const id of 'bsRefOverviewTitle bsRefOverviewMeta bsRefOverviewStatus bsRefOverviewSections bsRefOverviewNotes bsRefOverviewNotesBody bsRefOverviewArrangement bsRefOverviewSources bsRefToolbar bsRefCount bsRefListPane bsRefDetailPane bsRefBottom bsRefOverview bsRefDetails bsRefEmpty bsRefClose bsRefSongs bsRefMore bsRefMatches bsRefStatus bsRefTitle bsRefArtist bsRefKey bsRefFavourite bsRefInfo bsRefSectionRows bsRefFind bsRefOriginal bsRefNotesHint bsRefSource bsRefLicence bsRefLicenceLink bsRefArrangementNotes bsRefChart bsRefDelete bsRefEarlier bsRefEarlierBody bsRefUpdated bsRefUpdatedBody bsRefAddUpdated bsRefAddUpdatedNotes'.split(' '))ids.set(id,new El('div'));
const base=[
 {id:1,title:'Test Worship',artist:'Choir',key:'G',notes:{lines:['Original reminder']},source:{url:'https://example.com/song'},sections:[
 {part:'Intro',chords:'1 4 5'},{part:'Verse',chords:'1 6m 4 5',cue:'My verse words'},{part:'Chorus',chords:'4 5 6m 1'},{part:'Bridge',chords:'6m 5 4 1'}]},
 {id:2,title:'Missing',notes:{lines:['Old words']},sections:[],source:{}}
];
const window={BassSongReferenceData:{songs:base,version:'RC216'}};
const document={readyState:'loading',getElementById:id=>ids.get(id)||null,createElement:tag=>new El(tag),addEventListener(){},body:new El('body')};
const storage=new Map(),localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
const instrumentation=source.replace('window.BassChordLibrary={','window.__test={selectSong,beginEditing,backFromSong,saveAndOverview,renderOverview,setView,getView:()=>view,setDialog:x=>{dialog=x;},currentSong,markUnsaved};window.BassChordLibrary={');
yes(instrumentation!==source,'test exports present');
const context={window,document,localStorage,confirm:()=>true,console,setTimeout,clearTimeout,Date,Blob,URL};
vm.createContext(context);vm.runInContext(instrumentation,context);
const api=window.__test,dialog=new El('dialog');dialog.open=true;api.setDialog(dialog);
async function run(){
 await api.selectSong(1);
 yes(api.getView()==='overview','song opens in overview');
 yes(ids.get('bsRefDetails').hidden,'form is hidden by default');
 yes(ids.get('bsRefOverviewSections').children.length===4,'all section labels preserved');
 yes(ids.get('bsRefOverviewSections').textContent.includes('1 6m 4 5'),'numbers preserved');
 yes(ids.get('bsRefOverviewSections').textContent.includes('My verse words'),'memory cue preserved');
 yes(ids.get('bsRefOverviewMeta').textContent.includes('Key: G'),'original key shown');
 yes(ids.get('bsRefOverviewNotes').hidden===false,'original notes accessible');
 yes(ids.get('bsRefOverviewSources').textContent.includes('Source'),'source link accessible');
 yes(ids.get('bsRefClose').textContent==='← All songs','back control is clear');
 api.beginEditing();
 yes(api.getView()==='edit'&&!ids.get('bsRefDetails').hidden,'edit is separate');
 const row=ids.get('bsRefSectionRows').children[1];
 row.querySelector('[data-chords]').value='1 6m 4 2';
 row.dataset.modified='true';api.markUnsaved();
 await api.backFromSong();
 yes(api.getView()==='overview','back returns to the overview');
 yes(api.currentSong(1).sections[1].chords==='1 6m 4 2','changed chord saved on leaving editor');
 yes(ids.get('bsRefOverviewSections').textContent.includes('1 6m 4 2'),'overview refreshed from saved value');
 await api.backFromSong();
 yes(api.getView()==='list'&&dialog.open,'back to list without closing');
 await api.selectSong(1);yes(api.getView()==='overview','same song can be reopened');
 await api.backFromSong();
 await api.selectSong(2);
 yes(ids.get('bsRefOverviewSections').textContent.includes('No numbered progression'),'no invented progression');
 yes(ids.get('bsRefOverviewNotes').open,'original notes open when no chart exists');
 api.beginEditing();await api.saveAndOverview();
 yes(api.getView()==='overview','save and view returns to chart');
 yes(css.includes('grid-template-columns:repeat(2,minmax(0,1fr))'),'compact chart columns in CSS');
 console.log('PASS '+checks+' Song chords overview and navigation checks');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
