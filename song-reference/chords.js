/* Bass Stem Studio RC214 · Chords-only library, clear access and independent offline references. */
(()=>{
'use strict';
const initial=(window.BassSongReferenceData&&Array.isArray(window.BassSongReferenceData.songs))?window.BassSongReferenceData.songs:[];
const KEY='bassStemSongReferencesRC212';
const DB='BassStemSongReferenceV1';
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const text=(value)=>String(value==null?'':value);
const clone=(object)=>JSON.parse(JSON.stringify(object));
const $=id=>document.getElementById(id);
const normalize=v=>text(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase().replace(/[^a-z0-9#]+/g,' ').trim();
const safeUrl=url=>/^https:\/\/[^\s<>"']+$/i.test(text(url))?url:'';
const original=new Map(initial.map(song=>[song.id,song]));
const changes=new Map();
let selectedId=null,selected=null,dialog=null,debounce=null,visible=80,unsaved=false,busy=false,activeDb=null,ready=null,filter='all',sort='title',searchTerm='';
function node(tag,cls,content){const el=document.createElement(tag);if(cls)el.className=cls;if(content!==undefined)el.textContent=text(content);return el;}
function button(label,id){const b=node('button','bs-ref-button',label);b.type='button';if(id)b.id=id;return b;}
function field(label,control){const wrap=node('label','bs-ref-field');wrap.append(node('span','',label),control);return wrap;}
function status(message,kind=''){const el=$('bsRefStatus');if(el){el.textContent=message;el.dataset.kind=kind;}}
function openDb(){return new Promise((resolve,reject)=>{if(!window.indexedDB)return reject(Error('IndexedDB unavailable'));const req=indexedDB.open(DB,1);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('songs'))db.createObjectStore('songs',{keyPath:'id'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||Error('Database unavailable'));});}
function dbRequest(method,write,callback){return new Promise((resolve,reject)=>{const tx=activeDb.transaction('songs',write?'readwrite':'readonly'),store=tx.objectStore('songs');let request;try{request=callback(store);}catch(err){reject(err);return;}tx.oncomplete=()=>resolve(request?.result);tx.onerror=()=>reject(tx.error||Error('Storage unavailable'));tx.onabort=()=>reject(tx.error||Error('Storage cancelled'));});}
async function allSaved(){if(activeDb)return(await dbRequest('read',false,store=>store.getAll()))||[];return JSON.parse(localStorage.getItem(KEY)||'[]');}
async function putSaved(item){if(activeDb)return dbRequest('write',true,store=>store.put(item));const list=JSON.parse(localStorage.getItem(KEY)||'[]');const idx=list.findIndex(s=>s.id===item.id);if(idx<0)list.push(item);else list[idx]=item;localStorage.setItem(KEY,JSON.stringify(list));}
async function dropSaved(id){if(activeDb)return dbRequest('write',true,store=>store.delete(id));const list=JSON.parse(localStorage.getItem(KEY)||'[]').filter(s=>s.id!==id);localStorage.setItem(KEY,JSON.stringify(list));}
function currentSong(id){const base=original.get(id);const override=changes.get(id);if(!base)return override?.song?clone(override.song):null;const s=clone(base);if(override?.song){Object.assign(s,clone(override.song));}if(override?.favourite)s.favourite=true;else s.favourite=false;return s;}
function everySong(){return [...new Set([...original.keys(),...changes.keys()])].map(currentSong).filter(Boolean);}
function hasSections(song){return Array.isArray(song?.sections)&&song.sections.some(r=>text(r.chords).trim());}
function summary(song){const user=!!song.notes?.lines?.length;const source=Array.isArray(song.sections)&&song.sections.some(r=>['publisher','public-domain'].includes(r.source));return {user,source,has:hasSections(song)};}
function captionText(song){const v=summary(song);return v.source?'Checked chord reference':(song.sections||[]).some(r=>r.source==='blog')?'Free blog progression (check version)':v.has?'My progression (not checked)':v.user?'Original notes (check)':'Chord progression';}
function fits(song){const q=normalize(searchTerm);if(q&&!normalize([song.title,song.artist,song.category,song.notes?.heading,(song.collections||[]).join(' ')].join(' ')).includes(q))return false;const meta=summary(song);if(!meta.has)return false;if(filter==='favourites'&&!song.favourite)return false;if(filter==='progressions'&&!meta.has)return false;if(filter==='notes'&&!meta.user)return false;if(filter==='missing'&&meta.has)return false;if(filter==='sourced'&&!meta.source)return false;if(filter==='ccli'&&!song.collections?.includes('CCLI Top 100 worship'))return false;if(filter==='nigerian'&&!song.collections?.includes('Nigerian worship essentials'))return false;if(filter==='classics'&&!song.collections?.includes('Worship classics'))return false;if(filter==='hymns'&&song.category!=='Public-domain hymn'&&!song.collections?.includes('Public-domain hymns'))return false;return true;}
function listSorted(){return everySong().filter(fits).sort((a,b)=>sort==='artist'?(text(a.artist).localeCompare(text(b.artist),'en')||text(a.title).localeCompare(text(b.title),'en')):text(a.title).localeCompare(text(b.title),'en'));}
function updateCount(){const c=$('bsRefCount');if(!c)return;const songs=everySong();const p=songs.filter(hasSections).length;c.textContent=p+' songs with progressions · Offline reference';}
function renderList(){const found=listSorted();const root=$('bsRefSongs');root.replaceChildren();for(const song of found.slice(0,visible)){const b=button('');b.className='bs-ref-item';b.dataset.current=String(song.id===selectedId);const name=node('strong','',song.title||'Untitled song');const desc=node('small','',text(song.artist)+' · '+captionText(song));b.append(name,desc);if(song.favourite)b.append(node('span','bs-ref-heart','♥'));b.onclick=()=>void selectSong(song.id);root.append(b);}const more=$('bsRefMore');more.hidden=found.length<=visible;more.textContent='Show more ('+Math.min(80,found.length-visible)+' of '+(found.length-visible)+' remaining)';const foundEl=$('bsRefMatches');foundEl.textContent=found.length+' matching songs'+(found.length>visible?' · showing first '+visible:'');updateCount();}
function markUnsaved(){unsaved=true;status('Changes not saved yet.');}
function collect(){if(!selected)return;selected.title=$('bsRefTitle').value.trim()||'Untitled song';selected.artist=$('bsRefArtist').value.trim()||'Not confirmed';selected.key=$('bsRefKey').value.trim();selected.favourite=$('bsRefFavourite').getAttribute('aria-pressed')==='true';selected.sections=[...$('bsRefSectionRows').children].map(row=>({part:row.querySelector('[data-part]')?.value.trim()||'Part',chords:row.querySelector('[data-chords]')?.value.trim()||'',source:'edited',confidence:'Edited by you'})).filter(row=>row.chords||row.part);
 const raw=$('bsRefOriginal').value;
 selected.notes={...(selected.notes||{}),heading:selected.notes?.heading||selected.title,lines:raw.split('\n'),type:'Editable original notes'};
}
async function saveSelected(quiet=false){if(!selected||!unsaved)return true;collect();const id=selected.id;const edited={id,modifiedAt:Date.now(),song:clone(selected),favourite:!!selected.favourite};try{await putSaved(edited);changes.set(id,edited);unsaved=false;renderList();if(!quiet)status('Saved on this device. Export a backup when you have made several changes.','success');return true;}catch(e){status('Could not save changes: '+text(e.message||e),'error');return false;}}
function newSection(part='',chords=''){const row=node('div','bs-ref-part-row');const partInput=node('input','');partInput.type='text';partInput.value=part;partInput.placeholder='Verse, Chorus, Bridge…';partInput.dataset.part='yes';partInput.maxLength=60;const chordArea=node('textarea','');chordArea.value=chords;chordArea.dataset.chords='yes';chordArea.rows=2;chordArea.maxLength=2000;chordArea.placeholder='E · B · F# · G#m, or 4 · 1 · 5 · 6';const rem=button('Remove');rem.className='bs-ref-tiny';rem.onclick=()=>{row.remove();markUnsaved();};partInput.addEventListener('input',markUnsaved);chordArea.addEventListener('input',markUnsaved);row.append(field('Section',partInput),field('Progression',chordArea),rem);return row;}
function setFavourite(fav){const el=$('bsRefFavourite');el.setAttribute('aria-pressed',String(!!fav));el.textContent=fav?'♥ Favourite':'♡ Add to favourites';}
function renderDetail(song){selected=clone(song);const wrap=$('bsRefDetails');wrap.hidden=false;$('bsRefEmpty').hidden=true;$('bsRefTitle').value=text(song.title);$('bsRefArtist').value=text(song.artist);$('bsRefKey').value=text(song.key||song.source?.key||'');setFavourite(song.favourite);const info=$('bsRefInfo');info.textContent=captionText(song)+' · '+text(song.category||'Worship')+(song.collections?.length?' · '+song.collections.join(', '):'');const root=$('bsRefSectionRows');root.replaceChildren();for(const section of song.sections||[])root.append(newSection(section.part,section.chords));if(!root.children.length)root.append(newSection('',''));
 const originalText=song.notes?.lines?.join('\n')||'';$('bsRefOriginal').value=originalText;
 const hint=$('bsRefNotesHint');hint.textContent=originalText?'Imported from your earlier song notes. Some headings or progressions may need correction.':'Add your own number progressions, reminders or section notes here.';
 const link=$('bsRefSource');const href=safeUrl(song.source?.url);link.hidden=!href;if(href){link.href=href;link.textContent='View '+text(song.source?.name||'source')+' chart';}const licence=$('bsRefLicence');licence.textContent=href?text(song.source?.note||'Check the arrangement and any usage conditions on the source website.'):'No external song chart added.';
 $('bsRefDelete').hidden=!!original.has(song.id);unsaved=false;status('');}
async function selectSong(id){if(selectedId===id)return;const ok=await saveSelected(true);if(!ok)return;const s=currentSong(id);if(!s)return;selectedId=id;renderDetail(s);renderList();const pane=$('bsRefDetailPane');if(window.matchMedia('(max-width:700px)').matches)pane.scrollIntoView({block:'nearest',behavior:'auto'});}
async function createSong(){if(!await saveSelected(true))return;let id=Date.now();while(original.has(id)||changes.has(id))id++;const song={id,title:'New worship song',artist:'',category:'My added songs',key:'',sections:[{part:'Verse',chords:'',source:'edited'}],notes:{lines:[]},source:{}};changes.set(id,{id,song,modifiedAt:Date.now(),favourite:false});selectedId=id;renderDetail(song);markUnsaved();renderList();$('bsRefTitle').focus();}
async function resetSong(){if(!selected)return;const id=selected.id;if(!original.has(id)){status('Your added song can be deleted using Delete song.');return;}if(!confirm('Restore the original reference for this song? Your edits will be lost.'))return;try{await dropSaved(id);changes.delete(id);renderDetail(currentSong(id));renderList();status('Original reference restored.','success');}catch(e){status('Could not restore original: '+text(e.message),'error');}}
async function deleteSong(){if(!selected||original.has(selected.id))return;if(!confirm('Delete this added song from your library?'))return;try{await dropSaved(selected.id);changes.delete(selected.id);selected=null;selectedId=null;$('bsRefDetails').hidden=true;$('bsRefEmpty').hidden=false;renderList();status('Added song deleted.','success');}catch(e){status('Could not delete song: '+text(e.message),'error');}}
function backupName(){return 'BassStem_SongChords_'+new Date().toISOString().slice(0,10)+'.json';}
async function exportBackup(){if(!await saveSelected(true))return;const changesList=await allSaved();const payload={format:'BassStemSongReferences',version:1,exportedAt:new Date().toISOString(),sourceVersion:window.BassSongReferenceData?.version,changes:changesList};const data=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(data),a=node('a');a.href=url;a.download=backupName();document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);status('Backup downloaded. Keep a copy outside this browser.','success');}
async function importBackup(file){if(!file)return;try{if(file.size>10*1024*1024)throw Error('Backup exceeds 10 MB.');const data=JSON.parse(await file.text());if(data?.format!=='BassStemSongReferences'||!Array.isArray(data.changes))throw Error('This is not a Bass Stem song chords backup.');if(data.changes.length>5000)throw Error('Too many records in backup.');const valid=data.changes.filter(row=>Number.isInteger(row?.id)&&row?.song&&typeof row.song.title==='string'&&row.song.title.length<300&&Array.isArray(row.song.sections)&&row.song.sections.length<=100);if(valid.length!==data.changes.length)throw Error('The backup has unsupported song data.');if(!confirm('Restore '+valid.length+' saved edits? Entries with the same song will be replaced. The original built-in catalogue will remain available.'))return;for(const row of valid){await putSaved(row);changes.set(row.id,row);}renderList();if(selectedId!==null){const item=currentSong(selectedId);if(item)renderDetail(item);}status(valid.length+' saved edits restored.','success');}catch(e){status('Backup import failed: '+text(e.message||e),'error');}}
function html(){return `<div class="bs-ref-header"><div><h2 id="bsRefHeading">Song Chords</h2><p>Search song progressions without loading audio</p></div><button class="bs-ref-button" id="bsRefClose" type="button">Close</button></div>
<div class="bs-ref-toolbar"><label class="bs-ref-field"><span>Search songs or artists</span><input type="search" id="bsRefSearch" autocomplete="off" placeholder="e.g. Sinach, Way Maker, Dunsin"></label><label class="bs-ref-field"><span>Show</span><select id="bsRefFilter"><option value="all">All progressions</option><option value="ccli">CCLI Top 100 (with chords)</option><option value="nigerian">Nigerian worship (with chords)</option><option value="classics">Worship classics</option><option value="hymns">Traditional hymns</option><option value="notes">My original notes</option><option value="sourced">Sourced progressions</option><option value="favourites">Favourites</option></select></label><label class="bs-ref-field"><span>Order</span><select id="bsRefSort"><option value="title">Song title (A to Z)</option><option value="artist">Artist (A to Z)</option></select></label></div>
<p class="bs-ref-muted" id="bsRefCount"></p>
<div class="bs-ref-layout"><section class="bs-ref-list-pane" aria-label="Search results"><p class="bs-ref-muted" id="bsRefMatches"></p><div id="bsRefSongs"></div><button class="bs-ref-button" type="button" id="bsRefMore" hidden>Show more</button></section>
<section id="bsRefDetailPane" class="bs-ref-detail-pane"><p id="bsRefEmpty" class="bs-ref-muted">Choose a song to see its progressions and edit your notes.</p>
<div id="bsRefDetails" hidden><div class="bs-ref-detail-head"><h3>Edit song reference</h3><button type="button" class="bs-ref-button" id="bsRefFavourite" aria-pressed="false">♡ Add to favourites</button></div><p id="bsRefInfo" class="bs-ref-muted"></p>
<div class="bs-ref-meta"><label class="bs-ref-field"><span>Song</span><input id="bsRefTitle" maxlength="180"></label><label class="bs-ref-field"><span>Artist</span><input id="bsRefArtist" maxlength="180"></label><label class="bs-ref-field"><span>Key (optional)</span><input id="bsRefKey" maxlength="60" placeholder="e.g. D or F#"></label></div>
<h4>Intro, verse, chorus, bridge and ending</h4><p class="bs-ref-muted">Edit chord names or Nashville numbers. Only checked hymn or publisher excerpts are marked as sourced. Personal notes may need correcting.</p><div id="bsRefSectionRows"></div><button class="bs-ref-button" id="bsRefAddPart" type="button">+ Add section</button>
<h4>My original notes</h4><p id="bsRefNotesHint" class="bs-ref-muted"></p><textarea id="bsRefOriginal" rows="7" maxlength="18000" aria-label="Editable original song notes"></textarea>
<p class="bs-ref-source"><a id="bsRefSource" target="_blank" rel="noopener noreferrer" hidden>Source</a><small id="bsRefLicence"></small></p><div class="bs-ref-edit-actions"><button class="bs-ref-button bs-ref-save" id="bsRefSave" type="button">Save changes</button><button class="bs-ref-button" id="bsRefReset" type="button">Restore original</button><button class="bs-ref-button bs-ref-delete" id="bsRefDelete" type="button" hidden>Delete song</button></div></div></section></div>
<div class="bs-ref-bottom"><button class="bs-ref-button" id="bsRefAdd" type="button">+ Add my song</button><button class="bs-ref-button" id="bsRefExport" type="button">Export backup</button><button class="bs-ref-button" id="bsRefImport" type="button">Import backup</button><input id="bsRefImportFile" type="file" accept=".json,application/json" hidden></div><p role="status" id="bsRefStatus" aria-live="polite"></p>`;}
function setup(){if(dialog)return;dialog=node('dialog','bs-ref-dialog');dialog.id='bsChordLibraryDialog';dialog.setAttribute('aria-labelledby','bsRefHeading');dialog.innerHTML=html();document.body.append(dialog);
 const search=$('bsRefSearch');search.addEventListener('input',()=>{searchTerm=search.value;visible=80;renderList();});$('bsRefFilter').onchange=e=>{filter=e.target.value;visible=80;renderList();};$('bsRefSort').onchange=e=>{sort=e.target.value;renderList();};$('bsRefMore').onclick=()=>{visible+=80;renderList();};$('bsRefClose').onclick=()=>void close();dialog.addEventListener('cancel',e=>{e.preventDefault();void close();});
 for(const id of ['bsRefTitle','bsRefArtist','bsRefKey','bsRefOriginal'])$(id).addEventListener('input',markUnsaved);
 $('bsRefFavourite').onclick=()=>{const fav=$('bsRefFavourite').getAttribute('aria-pressed')!=='true';setFavourite(fav);markUnsaved();};
 $('bsRefAddPart').onclick=()=>{$('bsRefSectionRows').append(newSection('',''));markUnsaved();};$('bsRefSave').onclick=()=>void saveSelected();$('bsRefReset').onclick=()=>void resetSong();$('bsRefDelete').onclick=()=>void deleteSong();$('bsRefAdd').onclick=()=>void createSong();$('bsRefExport').onclick=()=>void exportBackup();$('bsRefImport').onclick=()=>{$('bsRefImportFile').value='';$('bsRefImportFile').click();};$('bsRefImportFile').onchange=e=>void importBackup(e.target.files?.[0]);
}
async function init(){try{activeDb=await openDb();}catch(err){activeDb=null;}try{const saved=await allSaved();for(const item of saved){if(Number.isInteger(item?.id)&&item.song)changes.set(item.id,item);}}catch(e){status('Saved edits could not be read. Do not clear your browser storage.','error');}renderList();}
async function show(){setup();if(!dialog.open)dialog.showModal();if(!ready)ready=init();await ready;renderList();$('bsRefSearch').focus();}
async function close(){if(!(await saveSelected(true)))return;if(dialog?.open)dialog.close();}
function installLibraryShortcut(){
 const library=$('libraryBatch');
 if(!library||$('librarySongChords'))return;
 const b=button('Song chords','librarySongChords');
 b.setAttribute('title','Search saved chord progressions without audio');
 b.onclick=()=>{const d=$('bassLibraryDialog');if(d?.open)d.close();void show();};
 library.after(b);
}
function install(){
 if(!initial.length)return;
 // The audio Library is built only when first opened. Attach its button THEN,
 // not on page load when that dialogue and its toolbar do not yet exist.
 const library=window.BassLibrary;
 if(library?.show&&!library.__chordButtonHooked){
  const openLibrary=library.show;
  library.show=function(...args){const result=openLibrary.apply(this,args);installLibraryShortcut();return result;};
  library.__chordButtonHooked=true;
 }
 installLibraryShortcut();
 const more=$('extraTools');
 if(more&&!$('openSongChords')){
  const b=button('Song chords','openSongChords');
  b.setAttribute('title','Search your worship chord progressions offline');
  b.onclick=()=>void show();more.prepend(b);
 }
 // Keep the approved four practice cards unchanged.
}
window.BassChordLibrary={open:show,statistics:()=>({total:initial.length,withProgressions:initial.filter(hasSections).length,withNigerian:initial.filter(s=>s.collections?.includes('Nigerian worship essentials')&&hasSections(s)).length,withCCLI:initial.filter(s=>s.collections?.includes('CCLI Top 100 worship')&&hasSections(s)).length})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();