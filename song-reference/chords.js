/* Bass Stem Studio RC221 · Safe bulk song removal and public sharing. */
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
let directEntry=false;
let selectedId=null,selected=null,dialog=null,debounce=null,visible=80,unsaved=false,busy=false,activeDb=null,ready=null,filter='progressions',sort='title',searchTerm='',view='list',chartImportBusy=false,bulkMode=false;
const bulkSelected=new Set();
function node(tag,cls,content){const el=document.createElement(tag);if(cls)el.className=cls;if(content!==undefined)el.textContent=text(content);return el;}
function button(label,id){const b=node('button','bs-ref-button',label);b.type='button';if(id)b.id=id;return b;}
function field(label,control){const wrap=node('label','bs-ref-field');wrap.append(node('span','',label),control);return wrap;}
function status(message,kind=''){const el=$('bsRefStatus');if(el){el.textContent=message;el.dataset.kind=kind;}}
function openDb(){return new Promise((resolve,reject)=>{if(!window.indexedDB)return reject(Error('IndexedDB unavailable'));const req=indexedDB.open(DB,1);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('songs'))db.createObjectStore('songs',{keyPath:'id'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||Error('Database unavailable'));});}
function dbRequest(method,write,callback){return new Promise((resolve,reject)=>{const tx=activeDb.transaction('songs',write?'readwrite':'readonly'),store=tx.objectStore('songs');let request;try{request=callback(store);}catch(err){reject(err);return;}tx.oncomplete=()=>resolve(request?.result);tx.onerror=()=>reject(tx.error||Error('Storage unavailable'));tx.onabort=()=>reject(tx.error||Error('Storage cancelled'));});}
async function allSaved(){if(activeDb)return(await dbRequest('read',false,store=>store.getAll()))||[];return JSON.parse(localStorage.getItem(KEY)||'[]');}
async function putSaved(item){if(activeDb)return dbRequest('write',true,store=>store.put(item));const list=JSON.parse(localStorage.getItem(KEY)||'[]');const idx=list.findIndex(s=>s.id===item.id);if(idx<0)list.push(item);else list[idx]=item;localStorage.setItem(KEY,JSON.stringify(list));}
async function dropSaved(id){if(activeDb)return dbRequest('write',true,store=>store.delete(id));const list=JSON.parse(localStorage.getItem(KEY)||'[]').filter(s=>s.id!==id);localStorage.setItem(KEY,JSON.stringify(list));}
function stableValue(value){if(Array.isArray(value))return value.map(stableValue);if(value&&typeof value==='object'){const result={};for(const key of Object.keys(value).sort())result[key]=stableValue(value[key]);return result;}return value;}
function sameValue(a,b){return JSON.stringify(stableValue(a))===JSON.stringify(stableValue(b));}
function effectiveKey(song){return text(song?.key||song?.source?.key||'');}
function sectionSnapshot(song){
 const rows=(Array.isArray(song?.sections)?song.sections:[]).map(row=>{
  let chords=text(row?.chords).trim(),letters=text(row?.letterChords).trim();
  if(!letters){const converted=recognisedChordNumbers(chords,row?.sourceKey||effectiveKey(song),row?.part);if(converted){letters=chords;chords=converted;}}
  return {part:text(row?.part).trim(),chords,cue:text(row?.cue).trim(),letterChords:letters,sourceKey:text(row?.sourceKey).trim()};
 });
 // RC215 rendered an empty Verse when a song had no sections. Saving only a
 // favourite stored that placeholder; it is not a correction to the music.
 if(rows.length===1&&rows[0].part==='Verse'&&!rows[0].chords&&!rows[0].cue&&!rows[0].letterChords&&!rows[0].sourceKey)return [];
 return rows;
}
function referenceField(song,key){
 if(key==='sections')return sectionSnapshot(song);
 if(key==='notes'){const lines=(Array.isArray(song?.notes?.lines)?song.notes.lines:[]).map(text);return lines.some(line=>line.trim())?lines:[];}
 if(key==='key')return effectiveKey(song);
 if(key==='source')return song?.source||{};
 return text(song?.[key]);
}
function referenceSnapshot(song){return {version:window.BassSongReferenceData?.version,title:text(song?.title),artist:text(song?.artist),key:effectiveKey(song),sections:sectionSnapshot(song),notes:{lines:referenceField(song,'notes')},source:clone(song?.source||{})};}
function pendingUpdates(song,base,prior,previousPending){
 const pending={};
 if(!base||!prior)return pending;
 for(const field of ['sections','notes']){
  const own=referenceField(song,field),latest=referenceField(base,field),before=referenceField(prior,field);
  if(!sameValue(own,latest)&&(!sameValue(latest,before)||previousPending?.[field]))pending[field]=true;
 }
 return pending;
}
function currentSong(id){
 const base=original.get(id),override=changes.get(id);
 if(!base){if(!override?.song)return null;const local=clone(override.song);local.hidden=!!override.hidden;return local;}
 const song=clone(base),saved=override?.song;
 if(saved){
  Object.assign(song,clone(saved));
  const prior=override.referenceBase||base.previousReference||base.previousImport||null;
  for(const field of ['title','artist','key','sections','notes','source']){
   const unchanged=prior&&sameValue(referenceField(saved,field),referenceField(prior,field));
   if(unchanged||!(field in saved)){
    if(field==='key')song.key=effectiveKey(base);
    else if(field in base)song[field]=clone(base[field]);
    else delete song[field];
   }
  }
  // History and catalogue provenance always come from the current release.
  // These fields are not editable in the song form.
  for(const field of ['previousReference','previousImport','documentImport','catalogue_sources','otherSources','year','collections']){
   if(field in base)song[field]=clone(base[field]);else delete song[field];
  }
  song._referenceUpdate=pendingUpdates(song,base,prior,override.referencePending);
 }
 song.id=id;
 song.favourite=!!override?.favourite;
  song.hidden=!!override?.hidden;
 return song;
}
/* RC218: hide unsourced regional chart-list imports, never remove a personal edit. */
function archiveUnchartedChartOnly(song){
 const regional=(
  (song.category==='Nigerian praise & worship'||song.category==='Ghanaian praise & worship')
  &&(song.collections||[]).some(name=>name==='Nigerian gospel chart'||name==='Ghanaian gospel chart')
 );
 if(!regional||hasSections(song))return false;
 if(changes.has(song.id)||song.favourite)return false;
 if(song.notes?.lines?.some(line=>text(line).trim()))return false;
 return true;
}
function songCandidates(){return [...new Set([...original.keys(),...changes.keys()])].map(currentSong).filter(Boolean).filter(song=>!archiveUnchartedChartOnly(song));}
function everySong(){return songCandidates().filter(song=>!song.hidden);}
function hasSections(song){return Array.isArray(song?.sections)&&song.sections.some(r=>text(r.chords).trim());}
function summary(song){const user=Array.isArray(song.notes?.lines)&&song.notes.lines.some(v=>text(v).trim());const arr=Array.isArray(song.sections)?song.sections:[];const publisher=arr.some(r=>['publisher','public-domain'].includes(r.source));const blog=arr.some(r=>r.source==='blog');const open=arr.some(r=>['open','cc0'].includes(r.source));return {user,publisher,blog,open,source:publisher||blog||open,has:hasSections(song)};}
function savedChart(song){return (song.sections||[]).some(s=>s.source==='saved-project');}
function bookChart(song){return (song.sections||[]).some(s=>s.source==='user-supplied-book');}
function captionText(song){const v=summary(song);return !v.has?(v.user?'Original notes · needs progression':'Needs progression'):v.open?'Openly licensed reference · check version':v.publisher?'Publisher or hymn reference · check version':v.blog?'Blog progression · check recording':savedChart(song)?'Draft from saved analysis · check chords':bookChart(song)?'Songbook numbers · check recording':'My progression · not checked';}
function fits(song){const q=normalize(searchTerm);if(q&&!normalize([song.title,song.artist,song.category,song.notes?.heading,(song.aliases||[]).join(' '),(song.collections||[]).join(' ')].join(' ')).includes(q))return false;if(filter==='removed')return !!song.hidden;if(song.hidden)return false;const meta=summary(song);if(filter==='favourites'&&!song.favourite)return false;if(filter==='saved'&&!song.collections?.includes('Saved project charts'))return false;if(filter==='songbook'&&!song.collections?.includes('My songbook'))return false;if(filter==='progressions'&&!meta.has)return false;if(filter==='notes'&&!meta.user)return false;if(filter==='missing'&&meta.has)return false;if(filter==='sourced'&&!meta.source)return false;if(filter==='ccli'&&!song.collections?.includes('CCLI Top 100 worship'))return false;if(filter==='nigerian'&&!song.collections?.includes('Nigerian worship essentials')&&!song.collections?.includes('Additional Nigerian worship')&&!String(song.category).startsWith('Nigerian'))return false;if(filter==='recent'&&!song.collections?.includes('Added RC255'))return false;if(filter==='modern'&&!song.collections?.some(c=>['Modern Christian songs 2000–2026','Modern Christian songs 2002–2026'].includes(c)))return false;if(filter==='classics'&&!song.collections?.includes('Worship classics'))return false;if(filter==='hymns'&&song.category!=='Public-domain hymn'&&!song.collections?.includes('Public-domain hymns'))return false;return true;}
function listSorted(){return (filter==='removed'?songCandidates():everySong()).filter(fits).sort((a,b)=>sort==='artist'?(text(a.artist).localeCompare(text(b.artist),'en')||text(a.title).localeCompare(text(b.title),'en')):text(a.title).localeCompare(text(b.title),'en'));}
function updateCount(){const c=$('bsRefCount');if(!c)return;const songs=everySong(),p=songs.filter(hasSections).length,removed=songCandidates().filter(s=>s.hidden).length;c.textContent=songs.length+' songs · '+p+' with progressions · '+(songs.length-p)+' need progressions'+(removed?' · '+removed+' removed':'')+' · Offline';}

function updateBulkControls(){
 const bar=$('bsRefBulkActions'),button=$('bsRefToggleBulk'),counter=$('bsRefBulkCount');
 if(!bar||!button)return;
 button.textContent=bulkMode?'Done selecting':'Select songs';
 bar.hidden=!bulkMode||view!=='list';
 button.setAttribute('aria-pressed',String(bulkMode));
 const count=bulkSelected.size;
 counter.textContent=count+' selected';
 const restore=filter==='removed';
 for(const id of ['bsRefRemoveSelected','bsRefRestoreSelected','bsRefPurgeSelected'])$(id).disabled=!count;
 $('bsRefRemoveSelected').hidden=restore;
 $('bsRefRestoreSelected').hidden=!restore;
 $('bsRefPurgeSelected').hidden=!restore;
}
function renderList(){
 const found=listSorted(),root=$('bsRefSongs'),offset=root.scrollTop||0;
 root.replaceChildren();
 root.dataset.selecting=String(bulkMode);
 for(const song of found.slice(0,visible)){
  const b=button('');b.className='bs-ref-item';b.dataset.songId=String(song.id);
  b.dataset.current=String(song.id===selectedId);
  const chosen=bulkSelected.has(song.id);
  b.dataset.chosen=String(chosen);
  const name=node('strong','',song.title||'Untitled song');
  const desc=node('small','',text(song.artist)+' · '+captionText(song));
  if(bulkMode){
   b.append(node('span','bs-ref-select-icon',chosen?'☑':'☐'));
   b.setAttribute('aria-pressed',String(chosen));
   b.setAttribute('aria-label',(chosen?'Deselect ':'Select ')+(song.title||'Untitled song'));
   b.onclick=()=>{
    if(bulkSelected.has(song.id))bulkSelected.delete(song.id);else bulkSelected.add(song.id);
    renderList();
   };
  }else b.onclick=()=>void selectSong(song.id);
  b.append(name,desc);
  const section=(song.sections||[]).find(r=>text(r.chords).trim());
  if(section){const preview=node('small','bs-ref-preview',text(section.part)+': '+text(section.chords).replace(/\s+/g,' ').slice(0,70));b.append(preview);}
  if(song.favourite)b.append(node('span','bs-ref-heart','♥'));
  root.append(b);
 }
 if(root.scrollTop!==undefined)root.scrollTop=offset;
 const more=$('bsRefMore');more.hidden=found.length<=visible;
 more.textContent='Show more ('+Math.min(80,found.length-visible)+' of '+(found.length-visible)+' remaining)';
 const count=$('bsRefMatches');count.textContent=found.length+' matching songs'+(found.length>visible?' · showing first '+visible:'');
 updateCount();updateBulkControls();
}
function toggleBulkMode(){bulkMode=!bulkMode;bulkSelected.clear();renderList();}
function allMatchingSelected(){for(const song of listSorted())bulkSelected.add(song.id);renderList();}
function clearBulkSelection(){bulkSelected.clear();renderList();}
async function removeSelectedSongs(){
 if(!bulkSelected.size||chartImportBusy)return;
 if(!await saveSelected(true))return;
 const targets=[...bulkSelected].map(currentSong).filter(s=>s&&!s.hidden);
 if(!targets.length){bulkSelected.clear();renderList();return;}
 if(!confirm('Remove '+targets.length+' selected songs from the list? They will move to Removed songs and can be restored. Your charts and backups will not be deleted.'))return;
 let done=0;
 try{
  for(const song of targets){
   const earlier=changes.get(song.id),base=original.get(song.id);
   const record=earlier?clone(earlier):{id:song.id,song:clone(song),favourite:!!song.favourite,
     referenceBase:base?referenceSnapshot(base):undefined,baselineVersion:window.BassSongReferenceData?.version};
   record.hidden=true;record.modifiedAt=Date.now();
   await putSaved(record);changes.set(song.id,record);done++;
  }
  bulkSelected.clear();renderList();
  status(done+' songs moved to Removed songs. They can be restored and remain in your exported backup.','success');
 }catch(e){bulkSelected.clear();renderList();status(done+' songs removed before storage stopped: '+text(e?.message||e),'error');}
}
async function restoreSelectedSongs(){
 if(!bulkSelected.size||chartImportBusy)return;
 if(!await saveSelected(true))return;
 let done=0;
 try{
  for(const id of bulkSelected){
   const record=changes.get(id);if(!record?.hidden)continue;
   const copy=clone(record);copy.hidden=false;copy.modifiedAt=Date.now();
   await putSaved(copy);changes.set(id,copy);done++;
  }
  bulkSelected.clear();renderList();
  status(done+' songs restored to Song Chords.','success');
 }catch(e){bulkSelected.clear();renderList();status(done+' restored before storage stopped: '+text(e?.message||e),'error');}
}
async function permanentlyDeleteSelected(){
 if(!bulkSelected.size||chartImportBusy||filter!=='removed')return;
 if(!await saveSelected(true))return;
 const owned=[...bulkSelected].filter(id=>!original.has(id)&&changes.get(id)?.hidden);
 const builtIns=bulkSelected.size-owned.length;
 if(!owned.length){status('Built-in songs cannot be erased. You can leave them in Removed songs or restore them.','error');return;}
 if(!confirm('Permanently delete '+owned.length+' of your own saved songs from this device?'+
  (builtIns?' '+builtIns+' built-in songs will remain hidden.':'')+
  ' This cannot be undone without an earlier exported backup.'))return;
 let done=0;
 try{
  for(const id of owned){await dropSaved(id);changes.delete(id);done++;}
  bulkSelected.clear();renderList();
  status(done+' locally saved songs permanently deleted.'+(builtIns?' Built-in songs remain hidden.':'')+' Export a new backup when ready.','success');
 }catch(e){bulkSelected.clear();renderList();status(done+' deleted before storage stopped: '+text(e?.message||e),'error');}
}

function markUnsaved(){unsaved=true;status('Changes not saved yet.');}
function collect(){if(!selected)return;selected.title=$('bsRefTitle').value.trim()||'Untitled song';selected.artist=$('bsRefArtist').value.trim()||'Not confirmed';selected.key=$('bsRefKey').value.trim();selected.favourite=$('bsRefFavourite').getAttribute('aria-pressed')==='true';selected.sections=[...$('bsRefSectionRows').children].map(row=>{const previous=row._reference||{},edited=row.dataset.modified==='true',chords=row.querySelector('[data-chords]')?.value.trim()||'';return {...previous,part:row.querySelector('[data-part]')?.value.trim()||'Part',chords,cue:row.querySelector('[data-cue]')?.value||'',letterChords:row.dataset.letterChords||previous.letterChords||'',source:edited?'edited':previous.source||'edited',confidence:edited?'Edited by you':previous.confidence||'Edited by you'};}).filter(row=>row.chords||row.part);
 const raw=$('bsRefOriginal').value;
 selected.notes={...(selected.notes||{}),heading:selected.notes?.heading||selected.title,lines:raw.split('\n'),type:'Editable original notes'};
}
async function saveSelected(quiet=false){if(!selected||!unsaved)return true;collect();const id=selected.id;const savedSong=clone(selected),base=original.get(id),pending=clone(selected._referenceUpdate||{});for(const field of ['sections','notes'])if(base&&sameValue(referenceField(selected,field),referenceField(base,field)))delete pending[field];for(const field of ['_referenceUpdate','previousReference','previousImport','documentImport'])delete savedSong[field];const edited={id,modifiedAt:Date.now(),song:savedSong,favourite:!!selected.favourite,hidden:!!changes.get(id)?.hidden};if(base){edited.referenceBase=referenceSnapshot(base);edited.baselineVersion=window.BassSongReferenceData?.version;edited.referencePending=pending;}try{await putSaved(edited);changes.set(id,edited);unsaved=false;renderList();window.dispatchEvent(new Event('bass-stem:chord-reference-changed'));if(!quiet)status('Saved on this device. Export a backup when you have made several changes.','success');return true;}catch(e){status('Could not save changes: '+text(e.message||e),'error');return false;}}
function newSection(part='',chords='',letterChords='',originalData=null){
 const row=node('div','bs-ref-part-row');row._reference=originalData?clone(originalData):null;row.dataset.letterChords=text(letterChords);
 const partInput=node('input','');partInput.type='text';partInput.value=part;partInput.placeholder='Verse, Chorus, Bridge…';partInput.dataset.part='yes';partInput.maxLength=Math.max(120,text(part).length+60);
 const chordArea=node('textarea','');chordArea.value=chords;chordArea.dataset.chords='yes';chordArea.rows=2;chordArea.maxLength=Math.max(2000,text(chords).length+1000);chordArea.placeholder='Numbers: 1 4 5 6 or 6m 4 1 5';
 const cueArea=node('textarea','');cueArea.value=text(originalData?.cue);cueArea.dataset.cue='yes';cueArea.rows=1;cueArea.maxLength=Math.max(4000,cueArea.value.length+1000);cueArea.placeholder='Words that help you remember this part';
 const cueField=field('Reminder words (optional)',cueArea);cueField.classList.add('bs-ref-cue');
 const rem=button('Remove');rem.className='bs-ref-tiny';rem.onclick=()=>{row.remove();markUnsaved();};
 const touch=()=>{row.dataset.modified='true';markUnsaved();};for(const control of [partInput,chordArea,cueArea])control.addEventListener('input',touch);
 row.append(field('Section',partInput),field('Numbers',chordArea),rem,cueField);
 if(letterChords){const key=text(originalData?.sourceKey),label='Original chord names'+(key?' (key '+key+')':'')+': ';row.append(node('small','bs-ref-letter-reference',label+letterChords));}
 return row;
}
function readOnlyReference(parent,reference){
 for(const section of reference.sections||[]){const box=node('div','bs-ref-reference-part');box.append(node('strong','',section.part||'Progression'));if(section.cue)box.append(node('p','bs-ref-muted',section.cue));box.append(node('p','bs-ref-reference-text',section.chords||''));if(section.letterChords)box.append(node('small','',section.letterChords));parent.append(box);}
}
function renderEarlierImports(song){
 const panel=$('bsRefEarlier'),body=$('bsRefEarlierBody');body.replaceChildren();panel.open=false;
 let old=song.previousImport,count=0;
 while(old&&count++<20){
  body.append(node('p','bs-ref-muted',old.reason||'Earlier imported notes kept for reference.'));
  if(old.notes?.lines?.length)body.append(node('p','bs-ref-reference-text',old.notes.lines.join('\n')));
  if(old.sections?.length)readOnlyReference(body,old);
  old=old.previousImport;
 }
 panel.hidden=!body.children.length;
}
function renderReferenceUpdate(){
 const panel=$('bsRefUpdated'),body=$('bsRefUpdatedBody'),base=original.get(selected?.id),pending=selected?._referenceUpdate||{};
 body.replaceChildren();panel.open=false;panel.hidden=!base||(!pending.sections&&!pending.notes);
 $('bsRefAddUpdated').hidden=!pending.sections;$('bsRefAddUpdatedNotes').hidden=!pending.notes;
 if(panel.hidden)return;
 if(pending.sections)readOnlyReference(body,base);
 if(pending.notes&&base.notes?.lines?.length){body.append(node('strong','','Latest original notes'));body.append(node('p','bs-ref-reference-text',base.notes.lines.join('\n')));}
}
function addUpdatedSections(){
 const base=original.get(selected?.id);if(!base)return;
 collect();const current=sectionSnapshot(selected);let added=0;
 for(const section of base.sections||[]){
  const semantic=sectionSnapshot({sections:[section],key:effectiveKey(base)})[0];
  if(!semantic||current.some(value=>sameValue(value,semantic)))continue;
  $('bsRefSectionRows').append(newSection(section.part,section.chords,section.letterChords,section));current.push(semantic);added++;
 }
 if(selected._referenceUpdate)delete selected._referenceUpdate.sections;
 markUnsaved();renderReferenceUpdate();status(added?added+' reference sections added. Your edits are kept. Save changes when ready.':'These reference sections are already present. Save changes when ready.');
}
function addUpdatedNotes(){
 const base=original.get(selected?.id),area=$('bsRefOriginal');if(!base)return;
 const latest=(base.notes?.lines||[]).join('\n');
 if(latest&&!area.value.includes(latest))area.value+=(area.value?'\n\n':'')+'Latest reference notes\n'+latest;
 area.maxLength=Math.max(18000,area.value.length+4000);
 if(selected._referenceUpdate)delete selected._referenceUpdate.notes;
 markUnsaved();renderReferenceUpdate();status('Latest reference notes added. Your notes are kept. Save changes when ready.');
}
function keepSavedReference(){if(!selected)return;selected._referenceUpdate={};markUnsaved();renderReferenceUpdate();status('Your version is kept. Save changes when ready.');}
function setFavourite(fav){const el=$('bsRefFavourite');el.setAttribute('aria-pressed',String(!!fav));el.textContent=fav?'♥ Favourite':'♡ Add to favourites';}
function recognisedChordNumbers(chords,keyValue,partName=''){const raw=text(keyValue),split=raw.match(/^\s*([A-G][#b]?)\s*\/\s*([A-G][#b]?)(?=\s|$)/),single=raw.match(/^\s*([A-G][#b]?)(?=\s|$|\()/);if(/\bminor\b/i.test(raw))return null;const tonicName=split?(/\b(?:Verse|Chorus)\s*2\b|Bridge/i.test(partName)?split[2]:split[1]):single?.[1];const semis={C:0,D:2,E:4,F:5,G:7,A:9,B:11},scale={0:'1',1:'b2',2:'2',3:'b3',4:'3',5:'4',6:'#4',7:'5',8:'b6',9:'6',10:'b7',11:'7'};const pc=name=>{const m=/^([A-G])([#b]?)$/.exec(name||'');return m?(semis[m[1]]+(m[2]==='#'?1:m[2]==='b'?-1:0)+12)%12:null;};const tonic=pc(tonicName);if(tonic===null)return null;let hits=0;const tokens=text(chords).split(/(\s+|[|,·])/).map(token=>{if(!token.trim()||/^[|,·]$/.test(token))return token;const m=/^([A-G][#b]?)(m7sus|m7b5|maj13|maj11|maj9|maj7|m13|m11|m9|m7|m6|m|sus2|sus4|sus|add2|add9|dim7|dim|aug|7|9|11|13|6|2|5|M7|)?(?:\/([A-G][#b]?))?$/.exec(token);if(!m)return null;const root=pc(m[1]),bass=m[3]?pc(m[3]):null;if(root===null||(m[3]&&bass===null))return null;hits++;const suffix={7:'(7)',2:'(2)',5:'(5)',6:'(6)',9:'(9)',11:'(11)',13:'(13)',M7:'maj7'}[m[2]]||m[2]||'';return scale[(root-tonic+12)%12]+suffix+(bass===null?'':'/'+scale[(bass-tonic+12)%12]);});return !hits||tokens.includes(null)?null:tokens.join('');}

/* RC217: viewing a progression is separate from editing it. */
function renderOverview(song){
 const heading=$('bsRefOverviewTitle');heading.textContent=text(song.title||'Untitled song');
 const key=effectiveKey(song),artist=text(song.artist).trim(),year=Number(song.year);
 $('bsRefOverviewMeta').textContent=[artist,key?'Key: '+key:'',Number.isInteger(year)&&year>=1900&&year<=2100?String(year):''].filter(Boolean).join(' · ');
 $('bsRefOverviewStatus').textContent=captionText(song);
 const grid=$('bsRefOverviewSections');grid.replaceChildren();
 for(const part of (Array.isArray(song.sections)?song.sections:[])){
  const cue=text(part.cue).trim(),raw=text(part.chords).trim();
  if(!cue&&!raw)continue;
  const box=node('article','bs-ref-sheet-section');
  const name=text(part.part).trim()||'Unlabelled section';
  let numbers=raw;
  if(raw&&!text(part.letterChords).trim()){
   const converted=recognisedChordNumbers(raw,part.sourceKey||key,name);
   if(converted)numbers=converted;
  }
  box.append(node('h4','bs-ref-sheet-part',name));
  if(cue)box.append(node('p','bs-ref-sheet-cue',cue));
  box.append(node('p','bs-ref-sheet-numbers'+(numbers?'':' bs-ref-sheet-missing'),numbers||'Numbers not yet added'));
  const partKey=text(part.sourceKey).trim();
  if(partKey&&partKey!==key)box.append(node('small','bs-ref-sheet-key','Key: '+partKey));
  if(numbers.length>32||cue.length>62||name.length>32||numbers.includes('\n'))box.classList.add('bs-ref-sheet-wide');
  grid.append(box);
 }
 if(!grid.children.length)grid.append(node('p','bs-ref-sheet-empty','No numbered progression has been added yet. Choose Edit progression to add your own.'));
 const notes=(Array.isArray(song.notes?.lines)?song.notes.lines:[]).map(text).join('\n');
 const notesPanel=$('bsRefOverviewNotes');notesPanel.hidden=!notes.trim();notesPanel.open=!grid.querySelector('.bs-ref-sheet-section')&&!!notes.trim();
 $('bsRefOverviewNotesBody').textContent=notes;
 const arrangement=$('bsRefOverviewArrangement');arrangement.textContent=text(song.source?.sectionNote).trim();arrangement.hidden=!arrangement.textContent;
 const sources=$('bsRefOverviewSources');sources.replaceChildren();
 function link(label,url){const href=safeUrl(url);if(!href)return;const a=node('a','bs-ref-sheet-link',label);a.href=href;a.target='_blank';a.rel='noopener noreferrer';sources.append(a);}
 link('Source',song.source?.url);
 if(song.source?.chartUrl!==song.source?.url)link('Original chart',song.source?.chartUrl);
 link('Licence',song.source?.licenceUrl);
 sources.hidden=!sources.children.length;
}
function setView(next){
 const previous=view;view=next;dialog.dataset.view=next;
 const listing=next==='list';
 $('bsRefToolbar').hidden=!listing;$('bsRefManageBar').hidden=!listing;
 $('bsRefCount').hidden=!listing;
 $('bsRefListPane').hidden=!listing;
 $('bsRefDetailPane').hidden=listing;
 $('bsRefBottom').hidden=!listing;
 $('bsRefOverview').hidden=next!=='overview';
 $('bsRefDetails').hidden=next!=='edit';
 $('bsRefEmpty').hidden=true;
 $('bsRefClose').textContent=listing?'Close':next==='edit'?'← Overview':directEntry?'← Back':'← All songs';
 dialog.scrollTop=0;updateBulkControls();
 if(listing&&previous!=='list'){
  const row=[...$('bsRefSongs').children].find(item=>item.dataset.songId===String(selectedId));
  if(row)row.focus({preventScroll:true});
 }
 if(next==='overview')$('bsRefOverviewTitle').focus({preventScroll:true});
}
async function backFromSong(){
 if(view==='edit'){
  if(!await saveSelected(true))return;
  const song=currentSong(selectedId);
  if(song)renderOverview(song);
  setView('overview');status('Saved on this device.','success');
 }else if(view==='overview'){if(directEntry){await close();return;}setView('list');status('');}
 else await close();
}
async function saveAndOverview(){
 if(!await saveSelected(true))return;
 const song=currentSong(selectedId);
 if(song)renderOverview(song);
 setView('overview');status('Saved on this device.','success');
}
function beginEditing(){
 const song=currentSong(selectedId);
 if(!song)return;
 renderDetail(song);setView('edit');
}

function renderDetail(song){selected=clone(song);const wrap=$('bsRefDetails');wrap.hidden=false;$('bsRefEmpty').hidden=true;$('bsRefTitle').value=text(song.title);$('bsRefArtist').value=text(song.artist);$('bsRefKey').value=text(song.key||song.source?.key||'');setFavourite(song.favourite);const info=$('bsRefInfo');info.textContent=captionText(song)+' · '+text(song.category||'Worship')+(song.collections?.length?' · '+song.collections.join(', '):'');const root=$('bsRefSectionRows');root.replaceChildren();for(const section of song.sections||[]){let numbers=text(section.chords),letters=text(section.letterChords);if(!letters){const calculated=recognisedChordNumbers(numbers,section.sourceKey||song.key||song.source?.key,section.part);if(calculated){letters=numbers;numbers=calculated;}}root.append(newSection(section.part,numbers,letters,section));}if(!root.children.length)root.append(newSection('Verse',''));const find=$('bsRefFind');if(find)find.href='https://www.google.com/search?q='+encodeURIComponent([song.title,song.artist,'chord progression numbers solfa verse chorus'].filter(Boolean).join(' '));
 const originalText=song.notes?.lines?.join('\n')||'';$('bsRefOriginal').value=originalText;$('bsRefOriginal').maxLength=Math.max(18000,originalText.length+4000);
 const hint=$('bsRefNotesHint');hint.textContent=originalText?'Imported from your earlier song notes. Some headings or progressions may need correction.':'Add your own number progressions, reminders or section notes here.';
 const link=$('bsRefSource');const href=safeUrl(song.source?.url);link.hidden=!href;if(href){link.href=href;link.textContent='View '+text(song.source?.name||'source')+' chart';}const licence=$('bsRefLicence');licence.textContent=href?[song.source?.licence,song.source?.note||'Check the arrangement and any usage conditions on the source website.'].filter(Boolean).join(' · '):'No external song chart added.';const licenceLink=$('bsRefLicenceLink'),licenceUrl=safeUrl(song.source?.licenceUrl);licenceLink.hidden=!licenceUrl;if(licenceUrl){licenceLink.href=licenceUrl;licenceLink.textContent='View '+text(song.source?.licence||'licence')+' terms';}const chartLink=$('bsRefChart'),chartUrl=safeUrl(song.source?.chartUrl);chartLink.hidden=!chartUrl||chartUrl===href;if(!chartLink.hidden){chartLink.href=chartUrl;chartLink.textContent='Open the original chord chart';}const arrangement=$('bsRefArrangementNotes');arrangement.textContent=text(song.source?.sectionNote);arrangement.hidden=!arrangement.textContent;renderEarlierImports(song);renderReferenceUpdate();
 $('bsRefDelete').hidden=!!original.has(song.id);unsaved=false;status('');}
async function selectSong(id){if(selectedId===id&&view==='overview')return;if(!await saveSelected(true))return;const song=currentSong(id);if(!song)return;selectedId=id;renderOverview(song);renderList();setView('overview');}
async function createSong(){if(!await saveSelected(true))return;let id=Date.now();while(original.has(id)||changes.has(id))id++;const song={id,title:'New worship song',artist:'',category:'My added songs',key:'',sections:[{part:'Verse',chords:'',source:'edited'}],notes:{lines:[]},source:{}};changes.set(id,{id,song,modifiedAt:Date.now(),favourite:false});selectedId=id;renderDetail(song);markUnsaved();renderList();setView('edit');$('bsRefTitle').focus();}
async function resetSong(){if(!selected)return;const id=selected.id;if(!original.has(id)){status('Your added song can be deleted using Delete song.');return;}if(!confirm('Restore the original reference for this song? Your edits will be lost.'))return;try{await dropSaved(id);changes.delete(id);renderDetail(currentSong(id));renderList();status('Original reference restored.','success');}catch(e){status('Could not restore original: '+text(e.message),'error');}}
async function deleteSong(){if(!selected||original.has(selected.id))return;if(!confirm('Delete this added song from your library?'))return;try{await dropSaved(selected.id);changes.delete(selected.id);selected=null;selectedId=null;selected=null;renderList();setView('list');status('Added song deleted.','success');}catch(e){status('Could not delete song: '+text(e.message),'error');}}
function backupName(){return 'BassStem_SongChords_'+new Date().toISOString().slice(0,10)+'.json';}

async function makeBackup(){
 if(!await saveSelected(true))return null;
 const entries=await allSaved();
 const payload={format:'BassStemSongReferences',version:1,exportedAt:new Date().toISOString(),sourceVersion:window.BassSongReferenceData?.version,changes:entries};
 return {filename:backupName(),text:JSON.stringify(payload,null,2)};
}
async function exportBackup(){
 const pack=await makeBackup();if(!pack)return;
 const blob=new Blob([pack.text],{type:'application/json'}),url=URL.createObjectURL(blob),a=node('a');
 a.href=url;a.download=pack.filename;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),30000);
 status('Downloaded '+pack.filename+'. On your phone, open My Files > Downloads or Chrome > Downloads. Keep a second copy outside this browser.','success');
}
async function shareBackup(){
 const pack=await makeBackup();if(!pack)return;
 const file=new File([pack.text],pack.filename,{type:'application/json'});
 let shareable=false;
 try{shareable=typeof navigator.share==='function'&&typeof navigator.canShare==='function'&&navigator.canShare({files:[file]});}catch{}
 if(!shareable){
   status('Your browser cannot share backup files directly. Use Export backup, then open Downloads and move the JSON file to your chosen folder.','error');
   return;
 }
 try{
   await navigator.share({files:[file],title:'Bass Stem Song Chords backup'});
   status('Backup shared. Keep it in a folder or cloud drive you control.','success');
 }catch(e){if(e?.name!=='AbortError')status('Sharing did not finish: '+text(e?.message||e),'error');}
}


/* RC219: no audio re-analysis: convert saved stable chord spans into short draft number charts. */
function nameFromProject(v){return text(v).replace(/\.(bassstudio|bssproject|json|mp3|m4a|wav)$/i,'').trim();}
function keyForProject(project){
 const scale=project?.analysis?.baseScale||{},name=text(scale.scaleText||project.analysis?.scale).trim();
 const match=/^([A-G])([#b]?)\s*(?:major|maj|minor|min|m)?\b/i.exec(name);
 const pc={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
 const found=match?(pc[match[1].toUpperCase()]+(match[2]==='#'?1:match[2]==='b'?-1:0)+12)%12:null;
 const supplied=Number(scale.rootPc);
 const root=Number.isInteger(supplied)&&supplied>=0&&supplied<12?supplied:found;
 if(root===null)return null;
 const minor=/^(minor|min|m)$/i.test(text(scale.mode))||/\b(?:minor|min)\b/i.test(name);
 return {root:(root+(minor?3:0))%12, original:name||'detected key',minor};
}
function simpleChord(c,key){
 const pc=Number(c.rootPc);
 if(!Number.isInteger(pc)||pc<0||pc>11)return null;
 const degree=['1','b2','2','b3','3','4','#4','5','b6','6','b7','7'][(pc-key.root+12)%12];
 const quality=text(c.quality).toLowerCase();
 return degree+(/^(?:min|m(?!aj))/.test(quality)?'m':/dim/.test(quality)?'dim':/aug/.test(quality)?'aug':'');
}
function sectionLabel(segment){
 const raw=text(segment?.name||segment?.label).trim();
 if(/^(?:intro|instrumental intro)\b/i.test(raw))return 'Intro';
 if(/^verse\b/i.test(raw))return 'Verse';
 if(/^pre[- ]?chorus\b/i.test(raw))return 'Pre-chorus';
 if(/^chorus\b/i.test(raw))return 'Chorus';
 if(/^bridge\b/i.test(raw))return 'Bridge';
 if(/^refrain\b/i.test(raw))return 'Refrain';
 if(/^interlude\b/i.test(raw))return 'Interlude';
 if(/^tag\b/i.test(raw))return 'Tag';
 if(/^(?:outro|ending)\b/i.test(raw))return 'Ending';
 return '';
}
function collapseCycle(sequence){
 const unique=sequence.filter((n,i)=>!i||n!==sequence[i-1]);
 if(unique.length<=8)return unique;
 let best=null,bestScore=0;
 for(let n=3;n<=Math.min(8,Math.floor(unique.length/2));n++){
  for(let start=0;start+n<=unique.length;start++){
   const needle=unique.slice(start,start+n).join(' ');let count=0;
   for(let j=0;j+n<=unique.length;){
    if(unique.slice(j,j+n).join(' ')===needle){count++;j+=n;}else j++;
   }
   const score=count>=2&&count*n>=unique.length*.55?count*n:0;
   if(score>bestScore){best=unique.slice(start,start+n);bestScore=score;}
  }
 }
 return best||(unique.length>16?[]:unique.slice(0,8));
}
function chartFromProject(project){
 if(project?.format!=='Bass Stem Studio Project'||!Array.isArray(project.analysis?.chords)||!project.analysis.chords.length)
  throw Error('No compatible saved chord analysis.');
 const key=keyForProject(project);
 if(!key)throw Error('No reliable song key was saved.');
 const chords=project.analysis.chords.slice(0,10000).filter(c=>Number.isFinite(Number(c.start))&&Number.isFinite(Number(c.end))&&
  Number(c.end)>Number(c.start)&&Number(c.confidence)>=0.60&&Number.isInteger(Number(c.rootPc))&&
  Number(c.rootPc)>=0&&Number(c.rootPc)<12).sort((a,b)=>a.start-b.start);
 if(chords.length<4)throw Error('No sufficiently reliable basic chords found.');
 const structure=project.analysis.structure||{},segments=Array.isArray(structure.segments)?structure.segments:[];
 const fallback=project.settings?.sections||{};
 const parts=(segments.length?segments:Object.entries(fallback).map(([name,t])=>({name,start:t.start,end:t.end}))).slice(0,300);
 const downbeats=(structure.downbeats||[]).slice(0,12000).map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
 const bpm=Number(project.analysis.tempoBpm),bar=Math.max(1,Math.min(5,Number.isFinite(bpm)&&bpm>40&&bpm<240?240/bpm:2));
 const entries=[],counts=new Map();
 for(const part of parts){
  const label=sectionLabel(part),begin=Number(part.start),end=Number(part.end);
  if(!label||!Number.isFinite(begin)||!Number.isFinite(end)||end-begin<3||part.uncertain===true)continue;
  const bars=downbeats.filter(t=>t>begin+0.04&&t<end-0.04);
  const cuts=bars.length>1?[begin,...bars,end]:Array.from({length:Math.floor((end-begin)/bar)+1},(_,i)=>begin+i*bar).concat([end]);
  const samples=[];
  // Half-bar windows keep the main changes while suppressing fleeting chords and inversions.
  for(let i=0;i<cuts.length-1;i++){
   const start=cuts[i],stop=Math.min(end,cuts[i+1]);
   if(stop-start<.35)continue;
   for(const [a,b] of [[start,(start+stop)/2],[(start+stop)/2,stop]]){
    if(b-a<.3)continue;
    const weights=new Map();let coverage=0;
    for(const c of chords){
     if(c.end<=a)continue;if(c.start>=b)break;
     const duration=Math.max(0,Math.min(b,c.end)-Math.max(a,c.start));
     if(duration<.12)continue;
     const token=simpleChord(c,key);if(!token)continue;
     const weight=duration*Math.min(1,Number(c.confidence))*(c.manual?1.3:c.uncertain?.75:1);
     coverage+=weight;weights.set(token,(weights.get(token)||0)+weight);
    }
    const vote=[...weights].sort((x,y)=>y[1]-x[1])[0];
    if(!vote||vote[1]<(b-a)*.22||vote[1]<coverage*.4)continue;
    samples.push(vote[0]);
   }
  }
  if(samples.length<2)continue;
  const pattern=collapseCycle(samples);
  if(pattern.length<2||new Set(pattern).size<2)continue;
  const name=label;
  const numeric=pattern.join(' '),other=entries.filter(p=>p.part===name);
  if(other.some(p=>p.chords===numeric)||other.length>=2)continue;
  const nextName=other.length?name+' (alternative) ':name;
  entries.push({part:nextName.trim(),chords:numeric,cue:'',source:'saved-project',
   confidence:'Draft from saved audio analysis; not recording-verified'});
  if(entries.length>=16)break;
 }
 if(!entries.length)throw Error('The saved analysis has no reliable named section progression.');
 const file=nameFromProject(project.projectName||project.source?.name);
 if(!file)throw Error('Saved project has no song title.');
 return {title:file,artist:text(project.library?.artist),key:'',sections:entries,
  source:{name:'Saved Bass Stem analysis',note:'Simple number chart from your saved recording analysis. Draft only: check the key and section changes against the recording. Original audio was not copied.'}};
}
function matchChart(chart){
 const normal=v=>normalize(v).replace(/\bhonour\b/g,'honor');
 const title=normal(chart.title),base=normal(nameFromProject(chart.title).split(/\s+[-–]\s+/)[0]);
 const choices=songCandidates().filter(song=>{
  const exact=normal(song.title),withoutPerformer=normal(text(song.title).replace(/\s+\([^)]{2,80}\)\s*$/,''));
  const artist=normal(song.artist);
  return exact===title||(withoutPerformer===base&&(title===base||!!artist&&title===base+' '+artist));
 });
 return choices.length===1?choices[0]:null; // never guess between equally named recordings
}
function projectFingerprint(info){return [text(info.filename).toLowerCase(),Number(info.size)||0,Number(info.modified)||0].join('|');}
async function storeChart(chart,info){
 const fingerprint=projectFingerprint(info);
 if(songCandidates().some(s=>s.projectImport?.fingerprint===fingerprint))return 'already';
 const match=matchChart(chart);
 if(match&&hasSections(match))return 'already'; // handwritten progression wins
 if(match&&changes.has(match.id)){
  const overridden=changes.get(match.id)?.song,base=original.get(match.id);
  if(overridden&&base&&!sameValue(sectionSnapshot(overridden),sectionSnapshot(base)))return 'already'; // protect deliberate edits
 }
 let song,record,id;
 if(match){
  song=clone(match);id=song.id;
  for(const incoming of chart.sections){
   const existing=(song.sections||[]).find(s=>normalize(s.part)===normalize(incoming.part));
   if(existing){if(!text(existing.chords).trim())Object.assign(existing,{...incoming,cue:existing.cue||''});}
   else song.sections.push(clone(incoming));
  }
  if(!hasSections(song))return 'unsupported';
  song.collections=[...new Set([...(song.collections||[]),'Saved project charts'])];
 }else{
  id=Date.now();while(original.has(id)||changes.has(id))id++;
  const phrase=chart.title.split(/\s+[-–]\s+/);
  const title=phrase[0]||chart.title;
  song={id,title,artist:chart.artist||phrase.slice(1).join(' - ')||'Not confirmed',category:'Saved project charts',
   key:'',sections:clone(chart.sections),collections:['Saved project charts'],
   notes:{heading:title,lines:[]},source:clone(chart.source)};
 }
 song.projectImport={fingerprint,filename:text(info.filename),date:Date.now(),
  note:'Automatically simplified from saved chord analysis; unverified'};
 record={id,song,modifiedAt:Date.now(),favourite:!!song.favourite};
 const base=original.get(id);
 if(base){record.referenceBase=referenceSnapshot(base);record.baselineVersion=window.BassSongReferenceData?.version;}
 await putSaved(record);changes.set(id,record);
 return match?'filled':'added';
}
async function importSavedCharts(files,isFileList=false){
 if(chartImportBusy)return;
 if(!files?.length){status('No saved projects found. Check Library or choose files.');return;}
 if(!await saveSelected(true))return;
 chartImportBusy=true;
 for(const control of ['bsRefFromSaved','bsRefPickProjects'])$(control).disabled=true;
 const result={added:0,filled:0,already:0,unsupported:0,error:0};
 try{
  for(let i=0;i<files.length;i++){
   const f=files[i],info={filename:f.filename||f.name,size:f.size,modified:f.modified||f.lastModified};
   try{
    if(songCandidates().some(s=>s.projectImport?.fingerprint===projectFingerprint(info))){result.already++;continue;}
    const known=f.title?matchChart({title:f.title}):null;
    if(known&&hasSections(known)){result.already++;continue;} // skip opening large file
    status('Reading '+(i+1)+' of '+files.length+' saved song projects…');
    if(info.size>120*1024*1024)throw Error('File too large');
    const project=isFileList?JSON.parse(await f.text()):await window.BassLibrary.chartProject(f.id);
    const draft=chartFromProject(project);
    const r=await storeChart(draft,info);
    result[r]=(result[r]||0)+1;
   }catch(e){if(/key|analysis|section progression|basic chords/i.test(text(e?.message)))result.unsupported++;else result.error++;}
   if(i%3===2)await new Promise(resolve=>setTimeout(resolve,0));
  }
  renderList();
  status((result.added+result.filled)+' draft charts added ('+result.filled+
   ' existing songs filled). '+result.already+' already covered; '+
   (result.unsupported+result.error)+' without a suitable saved progression. Review charts before use.','success');
 }finally{chartImportBusy=false;for(const control of ['bsRefFromSaved','bsRefPickProjects'])$(control).disabled=false;}
}
async function importSavedLibrary(){
 if(!window.BassLibrary?.chartProjects){status('Saved Library is not available. Choose files instead.','error');return;}
 try{status('Checking your local saved-song library…');const files=await window.BassLibrary.chartProjects();await importSavedCharts(files,false);}
 catch(e){status(text(e.message||e),'error');}
}


/* RC220: personal chart pack import. Converts an already-prepared private JSON pack
   into local saved references without publishing third-party arrangements. */
const cleanBookTitle=value=>normalize(text(value).replace(/&/g,' and ').replace(/[’']/g,''));
function findSongForBook(title){
 const key=cleanBookTitle(title),songs=songCandidates();
 const exact=songs.filter(s=>cleanBookTitle(s.title)===key);
 if(exact.length>1)return {match:null,ambiguous:true};
 if(exact.length===1)return {match:exact[0],ambiguous:false};
 const suffix=songs.filter(s=>cleanBookTitle(text(s.title).replace(/\s+\([^)]{2,70}\)\s*$/,''))===key);
 return {match:suffix.length===1?suffix[0]:null,ambiguous:suffix.length>1};
}
const bookChordLine=/^(?:[b#]?[1-7](?:m|dim)?)(?:\s+[b#]?[1-7](?:m|dim)?)*$/;
function validateSongbook(data){
 if(!data||data.format!=='BassStemSongChordPack'||data.schemaVersion!==1||!Array.isArray(data.songs))
  throw Error('This is not a supported Bass Stem numbered songbook.');
 if(data.songs.length>600)throw Error('The songbook has more than 600 songs.');
 if(!/^[a-f0-9]{64}$/i.test(text(data.source?.documentFingerprint)))
  throw Error('The songbook source identifier is missing.');
 const entries=[],seen=new Set();
 for(const incoming of data.songs){
  if(typeof incoming.title!=='string'||!incoming.title.trim()||incoming.title.length>200||
   !/^[a-z0-9-]{7,50}$/i.test(text(incoming.referenceId))||
   !Number.isInteger(incoming.sourcePage)||incoming.sourcePage<1||incoming.sourcePage>500||
   !Array.isArray(incoming.sections)||incoming.sections.length<1||incoming.sections.length>25)
   throw Error('The songbook contains an invalid song entry.');
  if(seen.has(incoming.referenceId))throw Error('Duplicate songbook identifier.');
  seen.add(incoming.referenceId);
  const sections=[];
  for(const p of incoming.sections){
   if(typeof p.part!=='string'||!p.part.trim()||p.part.length>80||
    typeof p.chords!=='string'||p.chords.length>400||!bookChordLine.test(p.chords.trim())||
    p.sourcePage!==incoming.sourcePage)throw Error('Invalid section in the songbook.');
   sections.push({part:p.part.trim(),chords:p.chords.trim(),cue:'',
    source:'user-supplied-book',sourcePage:incoming.sourcePage,
    confidence:'Converted from your supplied book; check the actual recording'});
  }
  entries.push({title:incoming.title.trim(),sourcePage:incoming.sourcePage,
   referenceId:incoming.referenceId,sections});
 }
 return entries;
}
async function importSongbookPack(data){
 if(chartImportBusy)throw Error('Finish the current local chart import first.');
 const entries=validateSongbook(data);
 if(!await saveSelected(true))return;
 chartImportBusy=true;
 const counts={created:0,completed:0,extra:0,already:0,ambiguous:0};
 const fingerprint=text(data.source.documentFingerprint);
 try{
  for(let i=0;i<entries.length;i++){
   const entry=entries[i],ref=entry.referenceId,found=findSongForBook(entry.title);
   if(found.ambiguous){counts.ambiguous++;continue;}
   const existing=found.match,bookId=fingerprint+'|'+ref;
   if(existing?.bookImportIds?.includes(bookId)){counts.already++;continue;}
   let song,changed=0,newPart=false;
   if(existing){
    song=clone(existing);
    const current=Array.isArray(song.sections)?song.sections:[];
    for(const incoming of entry.sections){
     const same=current.find(p=>cleanBookTitle(p.part)===cleanBookTitle(incoming.part));
     if(same){
      if(!text(same.chords).trim()){same.chords=incoming.chords;same.source=incoming.source;
       same.sourcePage=incoming.sourcePage;same.confidence=incoming.confidence;changed++;}
      // Never overwrite a user-entered section or a previous analysed chart.
     }else{
      current.push(clone(incoming));changed++;newPart=true;
     }
    }
    if(!changed){counts.already++;continue;}
    song.sections=current;
    song.collections=[...new Set([...(song.collections||[]),'My songbook'])];
   }else{
    const title=entry.title;
    song={id:null,title,artist:'Not confirmed',category:'My songbook',key:'',
     sections:clone(entry.sections),collections:['My songbook'],
     notes:{heading:title,lines:[]},
     source:{name:'Your uploaded Praise and Worship songbook',
      note:'Numbers converted from your personal PDF, page '+entry.sourcePage+'. Check the version you play.'}};
    changed=entry.sections.length;
   }
   let id;
   if(existing){id=existing.id;if(!hasSections(existing))counts.completed++;else if(newPart)counts.extra++;else counts.completed++;}
   else{id=Date.now()+i;while(original.has(id)||changes.has(id))id++;song.id=id;counts.created++;}
   song.bookImportIds=[...new Set([...(song.bookImportIds||[]),bookId])];
   song.bookImport={fingerprint,page:entry.sourcePage};
   const record={id,song,modifiedAt:Date.now(),favourite:!!song.favourite};
   const base=original.get(id);
   if(base){record.referenceBase=referenceSnapshot(base);record.baselineVersion=window.BassSongReferenceData?.version;}
   await putSaved(record);changes.set(id,record);
   if(i%20===19)await new Promise(resolve=>setTimeout(resolve,0));
  }
  visible=80;renderList();
  if(view==='overview'&&selectedId!==null){const updated=currentSong(selectedId);if(updated)renderOverview(updated);}
  status('Songbook imported: '+counts.created+' new songs, '+counts.completed+
    ' previously empty songs filled, '+counts.extra+' songs given missing sections. '+
    counts.already+' already covered'+(counts.ambiguous?', '+counts.ambiguous+' ambiguous titles skipped':'')+
    '. Saved on this device. Export or share a backup.','success');
 }finally{chartImportBusy=false;}
}

async function importBackup(file){if(!file)return;try{if(file.size>10*1024*1024)throw Error('Backup exceeds 10 MB.');const data=JSON.parse(await file.text());if(data?.format==='BassStemSongChordPack'){await importSongbookPack(data);return;}if(data?.format!=='BassStemSongReferences'||!Array.isArray(data.changes))throw Error('This is not a Bass Stem song chords backup.');if(data.changes.length>5000)throw Error('Too many records in backup.');const valid=data.changes.filter(row=>Number.isInteger(row?.id)&&row?.song&&row.song.id===row.id&&typeof row.song.title==='string'&&row.song.title.length<300&&Array.isArray(row.song.sections)&&row.song.sections.length<=100);if(valid.length!==data.changes.length)throw Error('The backup has unsupported song data.');if(!confirm('Restore '+valid.length+' saved edits? Entries with the same song will be replaced. The original built-in catalogue will remain available.'))return;for(const row of valid){await putSaved(row);changes.set(row.id,row);}renderList();if(selectedId!==null){const item=currentSong(selectedId);if(item){if(view==='edit')renderDetail(item);else if(view==='overview')renderOverview(item);}}status(valid.length+' saved edits restored.','success');}catch(e){status('Backup import failed: '+text(e.message||e),'error');}}
function html(){return `<div class="bs-ref-header"><div><h2 id="bsRefHeading">Song Chords</h2><p>Search song progressions without loading audio</p></div><button class="bs-ref-button" id="bsRefClose" type="button">Close</button></div>
<div id="bsRefToolbar" class="bs-ref-toolbar"><label class="bs-ref-field"><span>Search songs or artists</span><input type="search" id="bsRefSearch" autocomplete="off" placeholder="e.g. Sinach, Way Maker, Dunsin"></label><label class="bs-ref-field"><span>Show</span><select id="bsRefFilter"><option value="progressions">With progressions</option><option value="all">All songs</option><option value="recent">New additions</option><option value="saved">Saved project charts</option><option value="songbook">My songbook</option><option value="removed">Removed songs</option><option value="missing">Needs progression</option><option value="ccli">CCLI Top 100</option><option value="nigerian">Nigerian worship</option><option value="modern">Modern songs 2000 to 2026</option><option value="classics">Worship classics</option><option value="hymns">Traditional hymns</option><option value="notes">My original notes</option><option value="sourced">Sourced progressions</option><option value="favourites">Favourites</option></select></label><label class="bs-ref-field"><span>Order</span><select id="bsRefSort"><option value="title">Song title (A to Z)</option><option value="artist">Artist (A to Z)</option></select></label></div>
<p class="bs-ref-muted" id="bsRefCount"></p><div id="bsRefManageBar" class="bs-ref-manage-bar"><button class="bs-ref-button" type="button" id="bsRefToggleBulk" aria-pressed="false">Select songs</button><span id="bsRefBulkCount" class="bs-ref-muted" role="status">0 selected</span></div>
<div id="bsRefBulkActions" class="bs-ref-bulk-actions" hidden><button class="bs-ref-button" id="bsRefSelectMatching" type="button">Select all matching</button><button class="bs-ref-button" id="bsRefClearSelected" type="button">Clear selection</button><button class="bs-ref-button bs-ref-remove" id="bsRefRemoveSelected" type="button">Remove selected</button><button class="bs-ref-button" id="bsRefRestoreSelected" type="button" hidden>Restore selected</button><button class="bs-ref-button bs-ref-delete" id="bsRefPurgeSelected" type="button" hidden>Delete permanently</button></div>
<div class="bs-ref-layout"><section id="bsRefListPane" class="bs-ref-list-pane" aria-label="Search results"><p class="bs-ref-muted" id="bsRefMatches"></p><div id="bsRefSongs"></div><button class="bs-ref-button" type="button" id="bsRefMore" hidden>Show more</button></section>
<section id="bsRefDetailPane" class="bs-ref-detail-pane" hidden><p id="bsRefEmpty" class="bs-ref-muted" hidden>Choose a song to see its progressions.</p>
<div id="bsRefOverview" hidden>
<div class="bs-ref-sheet-head"><div><h3 id="bsRefOverviewTitle" tabindex="-1"></h3><p id="bsRefOverviewMeta" class="bs-ref-sheet-meta"></p></div><button type="button" class="bs-ref-button bs-ref-sheet-edit" id="bsRefOverviewEdit">Edit progression</button></div>
<p id="bsRefOverviewStatus" class="bs-ref-sheet-status"></p>
<div id="bsRefOverviewSections" class="bs-ref-sheet-grid" aria-label="Song progression overview"></div>
<p id="bsRefOverviewArrangement" class="bs-ref-sheet-arrangement" hidden></p>
<details id="bsRefOverviewNotes" class="bs-ref-reference-panel" hidden><summary>My original notes</summary><p id="bsRefOverviewNotesBody" class="bs-ref-reference-text"></p></details>
<div id="bsRefOverviewSources" class="bs-ref-sheet-sources" hidden></div>
</div>
<div id="bsRefDetails" hidden><div class="bs-ref-detail-head"><h3>Edit song reference</h3><button type="button" class="bs-ref-button" id="bsRefFavourite" aria-pressed="false">♡ Add to favourites</button></div><p id="bsRefInfo" class="bs-ref-muted"></p>
<div class="bs-ref-meta"><label class="bs-ref-field"><span>Song</span><input id="bsRefTitle" maxlength="180"></label><label class="bs-ref-field"><span>Artist</span><input id="bsRefArtist" maxlength="180"></label><label class="bs-ref-field"><span>Key (optional)</span><input id="bsRefKey" maxlength="60" placeholder="e.g. D or F#"></label></div>
<details id="bsRefUpdated" class="bs-ref-reference-panel" hidden><summary>Updated reference available</summary><p class="bs-ref-muted">Your saved changes are kept. Compare the latest reference below.</p><div id="bsRefUpdatedBody"></div><div class="bs-ref-reference-actions"><button class="bs-ref-button" id="bsRefAddUpdated" type="button">Add new sections</button><button class="bs-ref-button" id="bsRefAddUpdatedNotes" type="button">Add latest notes</button><button class="bs-ref-button" id="bsRefKeepUpdated" type="button">Keep my version</button></div></details><h4>Number progressions: intro, verse, chorus, bridge and ending</h4><p class="bs-ref-muted">Enter progressions in numbers as in your original notes. 6m means a minor chord; 1/3 shows the bass note. Your original chord names and notes are retained.</p><div id="bsRefSectionRows"></div><div class="bs-ref-add-actions"><button class="bs-ref-button" id="bsRefAddPart" type="button">+ Add section</button><a class="bs-ref-button" id="bsRefFind" target="_blank" rel="noopener noreferrer" href="https://www.google.com/">Find progression online</a></div>
<h4>My original notes</h4><p id="bsRefNotesHint" class="bs-ref-muted"></p><textarea id="bsRefOriginal" rows="7" maxlength="18000" aria-label="Editable original song notes"></textarea>
<details id="bsRefEarlier" class="bs-ref-reference-panel" hidden><summary>Earlier imported notes</summary><div id="bsRefEarlierBody"></div></details><p class="bs-ref-source"><a id="bsRefSource" target="_blank" rel="noopener noreferrer" hidden>Source</a><a id="bsRefChart" target="_blank" rel="noopener noreferrer" hidden>Original chart</a><small id="bsRefLicence"></small><small id="bsRefArrangementNotes" hidden></small><a id="bsRefLicenceLink" target="_blank" rel="noopener noreferrer" hidden>Licence</a></p><div class="bs-ref-edit-actions"><button class="bs-ref-button bs-ref-save" id="bsRefSave" type="button">Save and view</button><button class="bs-ref-button" id="bsRefReset" type="button">Restore original</button><button class="bs-ref-button bs-ref-delete" id="bsRefDelete" type="button" hidden>Delete song</button></div></div></section></div>
<div id="bsRefImportActions" class="bs-ref-import-actions"><button class="bs-ref-button" id="bsRefFromSaved" type="button">Add charts from saved library</button><button class="bs-ref-button" id="bsRefPickProjects" type="button">Choose .bassstudio / JSON files</button><input id="bsRefProjectFiles" type="file" accept=".bassstudio,.bssproject,.json,application/json" multiple hidden></div>
<div id="bsRefBottom" class="bs-ref-bottom"><button class="bs-ref-button" id="bsRefAdd" type="button">+ Add my song</button><button class="bs-ref-button" id="bsRefExport" type="button">Export backup</button><button class="bs-ref-button" id="bsRefImport" type="button">Import charts / backup</button><button class="bs-ref-button" id="bsRefShare" type="button">Share backup</button><input id="bsRefImportFile" type="file" accept=".json,application/json" hidden></div><p role="status" id="bsRefStatus" aria-live="polite"></p>`;}
function setup(){if(dialog)return;dialog=node('dialog','bs-ref-dialog');dialog.id='bsChordLibraryDialog';dialog.setAttribute('aria-labelledby','bsRefHeading');dialog.innerHTML=html();document.body.append(dialog);
 const search=$('bsRefSearch');search.addEventListener('input',()=>{searchTerm=search.value;visible=80;bulkSelected.clear();renderList();});$('bsRefFilter').onchange=e=>{filter=e.target.value;visible=80;bulkSelected.clear();renderList();};$('bsRefSort').onchange=e=>{sort=e.target.value;renderList();};$('bsRefMore').onclick=()=>{visible+=80;renderList();};$('bsRefToggleBulk').onclick=toggleBulkMode;$('bsRefSelectMatching').onclick=allMatchingSelected;$('bsRefClearSelected').onclick=clearBulkSelection;$('bsRefRemoveSelected').onclick=()=>void removeSelectedSongs();$('bsRefRestoreSelected').onclick=()=>void restoreSelectedSongs();$('bsRefPurgeSelected').onclick=()=>void permanentlyDeleteSelected();$('bsRefClose').onclick=()=>void backFromSong();dialog.addEventListener('cancel',e=>{e.preventDefault();void backFromSong();});$('bsRefOverviewEdit').onclick=beginEditing;
 for(const id of ['bsRefTitle','bsRefArtist','bsRefKey','bsRefOriginal'])$(id).addEventListener('input',markUnsaved);
 $('bsRefFavourite').onclick=()=>{const fav=$('bsRefFavourite').getAttribute('aria-pressed')!=='true';setFavourite(fav);markUnsaved();};
 $('bsRefAddPart').onclick=()=>{$('bsRefSectionRows').append(newSection('',''));markUnsaved();};$('bsRefSave').onclick=()=>void saveAndOverview();$('bsRefAddUpdated').onclick=addUpdatedSections;$('bsRefAddUpdatedNotes').onclick=addUpdatedNotes;$('bsRefKeepUpdated').onclick=keepSavedReference;$('bsRefReset').onclick=()=>void resetSong();$('bsRefDelete').onclick=()=>void deleteSong();$('bsRefFromSaved').onclick=()=>void importSavedLibrary();$('bsRefPickProjects').onclick=()=>{$('bsRefProjectFiles').value='';$('bsRefProjectFiles').click();};$('bsRefProjectFiles').onchange=e=>{const files=Array.from(e.target.files||[]);e.target.value='';void importSavedCharts(files,true);};$('bsRefAdd').onclick=()=>void createSong();$('bsRefExport').onclick=()=>void exportBackup();$('bsRefShare').onclick=()=>void shareBackup();$('bsRefImport').onclick=()=>{$('bsRefImportFile').value='';$('bsRefImportFile').click();};$('bsRefImportFile').onchange=e=>void importBackup(e.target.files?.[0]);
}
async function init(){try{activeDb=await openDb();}catch(err){activeDb=null;}try{const saved=await allSaved();for(const item of saved){if(Number.isInteger(item?.id)&&item.song)changes.set(item.id,item);}}catch(e){status('Saved edits could not be read. Do not clear your browser storage.','error');}renderList();}
async function show(){directEntry=false;setup();if(!dialog.open)dialog.showModal();if(!ready)ready=init();await ready;bulkMode=false;bulkSelected.clear();renderList();setView('list');$('bsRefSearch').focus();}
async function close(){if(!(await saveSelected(true)))return;if(dialog?.open)dialog.close();}
function installLibraryShortcut(){
 const library=$('libraryBatch');
 if(!library||$('librarySongChords'))return;
 const b=button('Song chords','librarySongChords');
 b.setAttribute('title','Search saved chord progressions without audio');
 b.onclick=()=>{void show();};
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
 if(more&&!$('bassHelpShare')){
  const b=button('Help & share','bassHelpShare');
  b.setAttribute('title','Getting started guide and share link for Bass Stem Studio');
  b.onclick=()=>window.open(new URL('./guide.html',window.location.href).href,'_blank','noopener,noreferrer');
  more.prepend(b);
 }
 if(more&&!$('openSongChords')){
  const b=button('Song chords','openSongChords');
  b.setAttribute('title','Search your worship chord progressions offline');
  b.onclick=()=>void show();more.prepend(b);
 }
 // Keep the approved four practice cards unchanged.
}
async function missingProgressions(){
 setup();if(!ready)ready=init();await ready;
 return everySong().filter(song=>!hasSections(song)).map(song=>({
  id:song.id,title:text(song.title),artist:text(song.artist),
  notes:!!song.notes?.lines?.some(line=>text(line).trim())
 })).sort((a,b)=>a.title.localeCompare(b.title,'en'));
}
async function openSongById(id){
 await show();
 const song=currentSong(Number(id));
 if(!song||song.hidden)return false;
 directEntry=true;await selectSong(Number(id));return true;
}
async function playlistSongs(){setup();if(!ready)ready=init();await ready;return everySong().map(s=>({title:s.title,artist:s.artist,aliases:s.aliases||[]}));}
window.BassChordLibrary={open:show,missingProgressions,openSongById,playlistSongs,statistics:()=>{const songs=everySong();return {total:songs.length,withProgressions:songs.filter(hasSections).length,needsProgression:songs.filter(s=>!hasSections(s)).length,archivedChartOnly:initial.filter(archiveUnchartedChartOnly).length,withNigerian:songs.filter(s=>s.collections?.includes('Nigerian worship essentials')&&hasSections(s)).length,withCCLI:songs.filter(s=>s.collections?.includes('CCLI Top 100 worship')&&hasSections(s)).length};}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
