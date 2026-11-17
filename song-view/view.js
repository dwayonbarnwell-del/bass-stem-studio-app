window.BassSongView=(()=>{
 'use strict';
 const C=window.BassSongViewCore,$=id=>document.getElementById(id);
 let api,panel,scroller,model,cache={},chips=[],chipIndex,activeChips=new Set(),activeRow=-1,rowNodes=[],repeatButtons=[],repeatStamp='',follow=true,chooser,library=[],libraryToken=0,opening=false,prepared=false;
 const node=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls;if(text!==undefined)e.textContent=text;return e;};
 function setFollow(on){follow=!!on;$('songViewFollow').textContent='Follow '+(follow?'on':'off');$('songViewFollow').setAttribute('aria-pressed',String(follow));if(follow)draw();}
 function toggleRepeat(start,end){
  const s=api.get();if(!s.loaded||s.busy)return;
  setFollow(false);api.repeat(C.toggleRange(s.repeatRanges,start,end,s.duration));draw();
 }
 function repeatButton(button,owner,start,end,label){
  button.type='button';button.setAttribute('aria-pressed','false');button.setAttribute('aria-label','Repeat '+label);button.title='Tap to repeat; tap again to deselect';
  button.onclick=event=>{event.stopPropagation();toggleRepeat(start,end);};
  repeatButtons.push({button,owner,start,end});
 }
 function prepare(s){
  const sections=JSON.stringify(s.sections||{}),parts=JSON.stringify((s.parts||[]).map(p=>[p.label,p.coreStart,p.coreEnd])),stamp=[s.session,s.duration,s.transpose,s.noteFormat,sections,parts].join('|');
  if(cache.notes===s.notes&&cache.chords===s.chords&&cache.stamp===stamp)return;
  cache={notes:s.notes,chords:s.chords,stamp};model=C.build({...s,chords:s.chords.filter(api.validChord)});chips=[];activeChips.clear();rowNodes=[];repeatButtons=[];repeatStamp='';activeRow=-1;scroller.replaceChildren();
  for(const part of model.parts){const section=node('section','song-view-section'),head=node('h3','song-view-heading'),select=node('button','song-view-section-toggle',part.name+' · '+C.time(part.start)+'–'+C.time(part.end));repeatButton(select,section,part.start,part.end,part.name+' from '+C.time(part.start)+' to '+C.time(part.end));head.append(select);section.append(head);section.style.setProperty('--song-section-hue',String((210+part.id*137.508)%360));
   for(const row of part.rows){const container=node('div','song-view-row'),jump=node('button','song-view-time',C.time(row.start)),body=node('div','song-view-events'),chords=node('div','song-view-chords'),notes=node('div','song-view-notes'),rangeLabel=C.time(row.start)+' to '+C.time(row.end);repeatButton(jump,container,row.start,row.end,rangeLabel);container.onclick=()=>toggleRepeat(row.start,row.end);
    for(const [items,host,type]of [[row.chords,chords,'chord'],[row.notes,notes,'note']])for(const event of items){const label=type==='note'?api.noteLabel(event):api.chordLabel(event),b=node('button','song-view-chip song-view-'+type,label||'—');b.dataset.start=event.start;b.dataset.end=event.end;repeatButton(b,container,row.start,row.end,rangeLabel+' · '+label);b.title=label+' · '+C.time(event.start)+' · Tap to repeat this row'+(event.continued?' · continued':'')+(event.isFill?' · Suggested fill':'');if(event.isFill)b.classList.add('suggested');if(Number.isFinite(Number(event.confidence))&&Number(event.confidence)<.7)b.classList.add('review');if(type==='note')b.style.setProperty('--note-hue',String(((Number(event.midi)+Number(s.transpose||0))%12)*30));host.append(b);chips.push({start:event.start,end:event.end,element:b,type});}
    if(!row.chords.length)chords.append(node('span','song-view-gap','No chord data'));if(!row.notes.length)notes.append(node('span','song-view-gap','Rest / no bass notes'));body.append(chords,notes);container.append(jump,body);section.append(container);rowNodes.push(container);
   }scroller.append(section);
  }
  chips.sort((a,b)=>a.start-b.start);chipIndex=C.index(chips);
  if(!model.parts.length)scroller.append(node('p','song-view-empty','Choose a library song or open an analysed song.'));
  else if(!model.notes.length&&!model.chords.length)scroller.prepend(node('p','song-view-empty','This song has no saved note or chord analysis.'));
 }
 function draw(t){
  if(!api||panel.hidden)return;const s=api.get();prepare(s);const at=Number.isFinite(t)?t:s.time;
  $('songViewTitle').textContent=s.loaded?s.title:'Song view';$('songViewWhole').disabled=!s.loaded||s.busy;
  $('songViewPosition').textContent=C.time(at)+' / '+C.time(s.duration||0);
  const ranges=C.repeatRanges(s.repeatRanges,s.duration),stamp=JSON.stringify([ranges,s.busy]);
  if(stamp!==repeatStamp){repeatStamp=stamp;for(const {button,owner,start,end}of repeatButtons){const selected=C.rangeSelected(ranges,start,end);button.setAttribute('aria-pressed',String(selected));button.disabled=!!s.busy;owner.classList.toggle('repeat-selected',selected);}const duration=ranges.reduce((n,r)=>n+r.end-r.start,0);$('songViewRepeatStatus').textContent=s.busy?'Please wait':ranges.length?'Repeating '+C.time(duration)+' · tap again to deselect':'Tap a section or row to repeat';}
  const next=new Set(C.active(chipIndex,at));for(const i of activeChips)if(!next.has(i))chips[i].element.classList.remove('sounding');for(const i of next)if(!activeChips.has(i))chips[i].element.classList.add('sounding');activeChips=next;
  const chord=C.active(model.chordIndex,at).at(-1),note=C.active(model.noteIndex,at).at(-1);$('songViewCurrentChord').textContent=chord===undefined?'—':api.chordLabel(model.chords[chord]);$('songViewCurrentNote').textContent=note===undefined?'—':api.noteLabel(model.notes[note]);
  const row=C.active(model.rowIndex,at)[0]??-1;if(row!==activeRow){rowNodes[activeRow]?.classList.remove('current');rowNodes[row]?.classList.add('current');activeRow=row;}
  if(follow&&row>=0){const element=rowNodes[row],top=element.getBoundingClientRect().top-scroller.getBoundingClientRect().top+scroller.scrollTop;if(top<scroller.scrollTop+30||top+element.offsetHeight>scroller.scrollTop+scroller.clientHeight-10)scroller.scrollTop=Math.max(0,top-38);}
 }
 function renderLibrary(){const root=$('songViewChoices'),q=$('songViewSearch').value.trim().toLowerCase();root.replaceChildren();const matches=library.filter(s=>String(s.title||s.filename||'').toLowerCase().includes(q));for(const song of matches){const b=node('button','song-view-choice',song.title||song.filename||'Untitled song');b.type='button';b.disabled=opening;b.onclick=()=>void openSong(song);root.append(b);}if(!matches.length)root.append(node('p','song-view-empty',library.length?'No matching songs.':'No saved library songs found.'));}
 async function openSong(song){if(opening||api.busy())return;opening=true;renderLibrary();$('songViewLibraryStatus').textContent='Opening song';try{const opened=await api.openSong(song);if(!opened)throw Error('Song could not be opened.');chooser.close();api.show();follow=true;invalidate();setFollow(true);}catch(e){$('songViewLibraryStatus').textContent=e.message||'Could not open song';}finally{opening=false;renderLibrary();}}
 async function openLibrary(){if(api.busy())return;api.pause();if(!chooser.open)chooser.showModal();const token=++libraryToken;$('songViewLibraryStatus').textContent='Loading library';try{const result=await window.BassLibrary.practiceProjects();if(token!==libraryToken||!chooser.open)return;library=result.songs;$('songViewLibraryStatus').textContent=result.reconnect?'Reconnect your song folder in Library to see all saved songs.':library.length+' saved songs';renderLibrary();$('songViewSearch').focus();}catch(e){if(token===libraryToken)$('songViewLibraryStatus').textContent=e.message||'Library unavailable';}}
 function invalidate(){cache={};if(prepared)draw();}
 function init(hooks){api=hooks;panel=$('songViewPanel');panel.innerHTML='<div class="song-view-toolbar"><button id="songViewLibrary" type="button">Library songs</button><button id="songViewWhole" type="button">Whole song</button><button id="songViewFollow" type="button" aria-pressed="true">Follow on</button></div><div class="song-view-title" id="songViewTitle"></div><div class="song-view-readout"><strong id="songViewCurrentChord">—</strong><strong id="songViewCurrentNote">—</strong><span id="songViewPosition"></span></div><div id="songViewRepeatStatus" role="status"></div><div id="songViewSections" tabindex="0" aria-label="Full song notes and chord progression"></div>';
  scroller=$('songViewSections');$('songViewLibrary').onclick=()=>void openLibrary();$('songViewWhole').onclick=()=>{if(!api.get().busy){api.wholeSong();setFollow(true);}};$('songViewFollow').onclick=()=>setFollow(!follow);for(const event of ['wheel','touchstart','pointerdown'])scroller.addEventListener(event,()=>setFollow(false),{passive:true});
  chooser=node('dialog','song-view-library');chooser.id='songViewLibraryDialog';chooser.setAttribute('aria-labelledby','songViewLibraryTitle');chooser.innerHTML='<header><h2 id="songViewLibraryTitle">Library songs</h2><button id="songViewLibraryClose" type="button">Back</button></header><input id="songViewSearch" type="search" aria-label="Search library songs" placeholder="Search songs"><p id="songViewLibraryStatus" role="status"></p><div id="songViewChoices"></div>';document.getElementById('appRoot').append(chooser);$('songViewSearch').oninput=renderLibrary;$('songViewLibraryClose').onclick=()=>{if(!opening){libraryToken++;chooser.close();}};chooser.addEventListener('cancel',e=>{if(opening)e.preventDefault();else libraryToken++;});prepared=true;new ResizeObserver(()=>draw()).observe(panel);
 }
 return {init,draw,invalidate,openLibrary};
})();
