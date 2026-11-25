/* Rehearse a short recording with the band and a separate bass guide. */
window.BassRehearsal=(()=>{
 'use strict';
 const C=window.BassRehearsalCore;
 const H=window.BassRehearsalHarmony;
 const R=C.repeat;
 const fmt=time=>{const hundredths=Math.round(time*100);return Math.floor(hundredths/6000)+':'+(hundredths%6000/100).toFixed(2).padStart(5,'0');};
 const minutesSeconds=time=>Math.floor(time/60)+':'+String(Math.floor(time)%60).padStart(2,'0');
 const parseTime=value=>{
  const parts=value.trim().split(':');
  if(!parts.length||parts.length>2||parts.some(p=>!/^\d+(?:\.\d+)?$/.test(p)))return NaN;
  return parts.length===2?Number(parts[0])*60+Number(parts[1]):Number(parts[0]);
 };
 let host,api,song,clip,prepared,prepareTimer,ranked=[],ctx,band,clock,visualFrame,voices=[],playing,work=0,loading=false,importing=false,manualBpm=0,mixRevision=0,noBass=true,mixFailed=false;
 const $=id=>host.querySelector('#'+id);
 const state=text=>{$('rehearsalStatus').textContent=text;};
 const harmonyRevision=value=>JSON.stringify([value?.keyRoot,value?.keyMode,value?.root,value?.mode,value?.numbering,value?.tempo,value?.phase,value?.confidence,value?.meter,value?.beats,value?.chords?.map(c=>[c.start,c.end,c.rootPc,c.quality,c.bassPc,c.uncertain,c.manual,c.rootOnly]),value?.notes?.map(n=>[n.start,n.end,n.midi])]);
 let phraseRepeat=null,phrases,phraseEvents=[],previewClip=null,passageRevision='';
 const selectedSeconds=new Set();let pageOverride=null,pausedPosition=null;
 let timelineResize;
 let featured=[],viewNotes=[],viewPosition=0,fretView,fretNotes=[],notePage=-1,markers=[],changeMarkers=[],audible=false;

 function init(panel,hooks){
  host=panel;api=hooks;
  host.innerHTML=`
   <div class="rehearsal-row rehearsal-setup">
    <button id="rehearsalImport" type="button">Import audio</button>
    <button id="rehearsalLibrary" type="button">Library</button>
   </div>
   <input id="rehearsalFile" type="file" accept="audio/*,.m4a,.mp3,.wav,.flac,.ogg,.aac,.caf" hidden>
   <p id="rehearsalTitle"></p>
   <div id="rehearsalEditor" hidden>
    <div class="rehearsal-setup">
     <select id="rehearsalPassage" aria-label="Passage"></select>
    </div>
    <div class="rehearsal-row rehearsal-times rehearsal-setup">
     <label><span>Start</span><input id="rehearsalStart" type="text" inputmode="decimal"></label>
     <label><span>End</span><input id="rehearsalEnd" type="text" inputmode="decimal"></label>
     <label><span>BPM</span><input id="rehearsalBpm" type="number" inputmode="numeric" min="40" max="220" placeholder="—"></label>
    </div>
    <div class="rehearsal-row">
     <select id="rehearsalStyle" aria-label="Style"></select>
     <select id="rehearsalPattern" aria-label="Pattern"></select>
    </div>
    <p id="rehearsalSource" aria-live="polite"></p>
    <label class="rehearsal-level rehearsal-setup">Music <input id="rehearsalMusic" type="range" min="0" max="100" value="21"><output id="rehearsalMusicValue">21%</output></label>
    <label class="rehearsal-level rehearsal-setup">Guide bass <input id="rehearsalGain" type="range" min="0" max="100" value="100"><output id="rehearsalGainValue">100%</output></label>
    <div class="rehearsal-transport" role="group" aria-label="Rehearsal playback">
     <select id="rehearsalFill" aria-label="Fill and run placement" title="Place fills and runs on chord changes"><option value="ends">Changes</option><option value="bar">Each bar</option><option value="off">No fills</option></select>
     <button id="rehearsalMix" type="button" aria-pressed="true" aria-label="Original bass muted. Unmute original bass" title="Original bass muted. Unmute original bass">Orig 🔇</button>
     <button id="rehearsalPlay" type="button" aria-label="Play loop" title="Play loop">▶</button>
     <button id="rehearsalGuide" type="button" aria-pressed="true" aria-label="Guide bass on. Mute guide bass" title="Guide bass on. Mute guide bass">Guide 🔊</button>
    </div>
    <div class="rehearsal-readout"><output id="rehearsalTime"></output><output id="rehearsalCue" aria-label="Song key"></output></div>
    <div class="rehearsal-view-row">
     <select id="rehearsalView" aria-label="Rehearsal view"><option value="notes">Note View</option><option value="phrase">Phrase View</option><option value="fret">Fret View</option><option value="fret2">Fret View 2</option></select>
     <button id="rehearsalControls" type="button" aria-label="Hide controls" title="Hide controls" aria-expanded="true">⚙</button>
     <button id="rehearsalPrev" type="button" aria-label="Previous timeline seconds" title="Previous timeline seconds" hidden>‹</button>
     <button id="rehearsalFollow" type="button" aria-label="Follow current playback" title="Follow current playback" hidden>◎</button>
     <button id="rehearsalNext" type="button" aria-label="Next timeline seconds" title="Next timeline seconds" hidden>›</button>
     <button id="rehearsalClear" type="button" aria-label="Clear selected timeline sections" title="Clear selected timeline sections" hidden>✕</button>
    </div>
    <div id="rehearsalVisual" hidden>
     <div id="rehearsalNoteKey" aria-label="Note colours"><span class="rehearsal-key-main" title="Main bass pitch of the current chord, including its slash bass">Main</span><span class="rehearsal-key-chord">Chord</span><span class="rehearsal-key-fill">Fill/run</span><span class="rehearsal-key-passing" title="Passing pitch outside the current chord; this does not mean the chord has changed">Passing</span></div>
     <div class="bass-phrase" id="rehearsalPhrases" hidden></div>
     <div id="rehearsalTimeline" aria-label="Rehearsal note timeline"></div>
     <div id="rehearsalFret" hidden></div>
    </div>
   </div>
   <p id="rehearsalStatus" role="status"></p>`;
  timelineResize?.disconnect();
  if(typeof ResizeObserver!=='undefined'){timelineResize=new ResizeObserver(fitTimeline);timelineResize.observe($('rehearsalTimeline'));}
  (window.BassRehearsalIdeas?.availableStyles()||C.styles).forEach(([id,caption])=>{const option=new Option(window.BassStudyDisplay?.menu(caption)||caption,id);option.title=caption;$('rehearsalStyle').add(option);});
  $('rehearsalImport').onclick=()=>api.pickAudio($('rehearsalFile'),openFile);
  $('rehearsalFile').onchange=e=>{const file=e.target.files[0];e.target.value='';if(file)void openFile(file);};
  $('rehearsalLibrary').onclick=async()=>{await close();api.openLibrary();};
  $('rehearsalPassage').onchange=()=>applyPassage(ranked[Number($('rehearsalPassage').value)]);
  for(const id of ['rehearsalStart','rehearsalEnd','rehearsalBpm']){
   $(id).onchange=()=>{
    if(id==='rehearsalBpm')manualBpm=Number($(id).value);
    resetClip();
    const picker=$('rehearsalPassage');
    if(![...picker.options].some(o=>o.value==='custom'))picker.add(new Option('Custom passage','custom'));
    picker.value='custom';
    updateBpm();patterns();
   };
  }
  $('rehearsalStyle').onchange=()=>{patterns(true);changePattern();};
  $('rehearsalPattern').onchange=changePattern;
  $('rehearsalFill').onchange=changePattern;
  $('rehearsalMix').onclick=()=>void toggleMix();
  $('rehearsalView').onchange=()=>{notePage=-1;drawView();};
  $('rehearsalControls').onclick=()=>setCompact(host.dataset.playing!=='true');
  $('rehearsalPrev').onclick=()=>pageTimeline(-1);
  $('rehearsalNext').onclick=()=>pageTimeline(1);
  $('rehearsalFollow').onclick=()=>{pageOverride=null;notePage=-1;drawView();};
  $('rehearsalClear').onclick=()=>{selectedSeconds.clear();phraseRepeat=null;pageOverride=null;restartRepeat();};
  $('rehearsalMusic').oninput=()=>{
   const level=Number($('rehearsalMusic').value)/100;
   $('rehearsalMusicValue').value=Math.round(level*100)+'%';
   if(band)band.gain.gain.setTargetAtTime(level,ctx.currentTime,.015);
  };
  $('rehearsalGain').oninput=()=>{$('rehearsalGainValue').value=$('rehearsalGain').value+'%';};
  $('rehearsalGuide').onclick=()=>{
   const button=$('rehearsalGuide'),off=button.getAttribute('aria-pressed')==='true';
   button.setAttribute('aria-pressed',String(!off));button.textContent=off?'Guide 🔇':'Guide 🔊';
   button.setAttribute('aria-label',off?'Guide bass muted. Unmute guide bass':'Guide bass on. Mute guide bass');button.title=button.getAttribute('aria-label');
   if(off)stopBass();
  };
  $('rehearsalPlay').onclick=()=>{
   if(loading){discardPreparation();void api.cancelBand?.();}
   if(playing||loading){stop({pause:!!playing});state('');}else void play();
  };
 }

 async function openFile(file){
  if(importing)return;
  stop();discardPreparation();
  const id=work;
  importing=true;
  for(const button of ['rehearsalImport','rehearsalPlay','rehearsalLibrary'])$(button).disabled=true;
  state('Opening recording…');
  try{
   await api.cancelBand?.();
   if(id!==work)return;
   const success=await api.importAudio(file);
   if(id!==work||host.hidden)return;
   refresh();
   if(!success)state('Choose an audio file or a saved song.');
  }catch(error){if(id===work)state(error.message||'Could not open this recording.');}
  finally{
   importing=false;
   for(const button of ['rehearsalImport','rehearsalPlay','rehearsalLibrary'])$(button).disabled=false;
  }
 }

 function refresh(){
  if(!host||host.hidden)return;
  const next=api.get(),revision=next?.buffer?C.phraseSignature(next):'';
  const newSong=song?.session!==next?.session||song?.buffer!==next?.buffer;
  const changed=newSong||passageRevision!==revision;
  const previous=ranked[Number($('rehearsalPassage').value)];
  const custom=$('rehearsalPassage').value==='custom';
  song=next;
  if(!changed)return;
  passageRevision=revision;
  resetClip();
  if(newSong){
   noBass=true;mixFailed=false;
   $('rehearsalStyle').value='auto';
   $('rehearsalMusic').value=21;$('rehearsalMusicValue').value='21%';
   $('rehearsalGain').value=100;$('rehearsalGainValue').value='100%';
  }
  labelMix();
  $('rehearsalEditor').hidden=!song?.buffer;
  $('rehearsalTitle').textContent=song?.buffer?String(song.title).replace(/Y2Mate\.is\s*-\s*/gi,''):'Choose a recording or a saved song.';
  if(!song?.buffer){state('');return;}
  const plan=C.phrasePlan(song);
  const ranges=(plan?.phrases||[]).map((p,i)=>({...p,name:'Phrase '+(i+1),timeline:true,grid:C.phraseGrid(plan,p)}));
  ranked=[{start:0,end:song.duration,name:'Full song'},...ranges];
  const picker=$('rehearsalPassage');
  picker.replaceChildren(...ranked.map((p,i)=>{
   const option=new Option(i?String(i).padStart(2,'0')+' · '+minutesSeconds(p.start)+'–'+minutesSeconds(p.end):'Full song',i);
   if(i)option.title=(p.section?p.section+' · ':'')+fmt(p.start)+'–'+fmt(p.end)+' · Estimated phrase';
   return option;
  }));
  if(!newSong&&custom){
   picker.add(new Option('Custom passage','custom'));picker.value='custom';updateBpm();patterns();
  }else{
   const selected=!newSong&&previous?.timeline?Math.max(1,ranked.findIndex(p=>p.timeline&&p.start<=previous.start+.01&&p.end>previous.start+.01)):0;
   picker.value=String(selected);applyPassage(ranked[selected]);
  }
  if(plan&&plan!==song.rehearsalPhrases)void Promise.resolve(api.savePhrases?.(plan,song.session)).catch(()=>{state('Phrase times could not be saved.');});
 }

 function selectedGrid(){
  return ranked[Number($('rehearsalPassage').value)]?.grid;
 }
 function passageRange(){
  const p=ranked[Number($('rehearsalPassage').value)];
  return p?{start:p.start,end:p.end}:{start:parseTime($('rehearsalStart').value),end:parseTime($('rehearsalEnd').value)};
 }
 function applyPassage(p){
  if(!p)return;
  resetClip();
  $('rehearsalStart').value=fmt(p.start);$('rehearsalEnd').value=fmt(p.end);
  manualBpm=0;state('');updateBpm();patterns();
 }

 function updateBpm(){
  const input=$('rehearsalBpm');
  const {start,end}=passageRange();
  const valid=song?.buffer&&start>=0&&end<=song.duration+.006&&end-start>=(selectedGrid()? .5:2);
  const validEnd=valid?Math.min(end,song.duration):end;
  const picked=valid?selectedGrid()||C.beatGrid({...song,start,end:validEnd,manualBpm}):null;
  input.value=manualBpm||Math.round(picked?.bpm||0)||'';
  if(valid&&noBass&&validEnd-start<=32){
   const range=bandRange(start,validEnd,picked);
   prepareTimer=setTimeout(()=>{void prepareBand(range.start,range.end).catch(()=>{});},180);
  }
 }

 function setCompact(compact){
  host.dataset.playing=String(compact);
  $('rehearsalControls').setAttribute('aria-expanded',String(!compact));
  $('rehearsalControls').setAttribute('aria-label',compact?'Show controls':'Hide controls');
  $('rehearsalControls').title=compact?'Show controls':'Hide controls';
  const navigation=host.closest?.('#earTrainerDialog')?.querySelector('#earSections');
  if(navigation)navigation.hidden=compact;
 }

 function stopBass(){
  for(const voice of voices){try{voice.stop();}catch{}}
  voices=[];
 }

 function playLabel(mode){
  const button=$('rehearsalPlay'),label=mode==='pause'?'Pause rehearsal':mode==='cancel'?'Cancel preparation':pausedPosition===null?'Play loop':'Resume loop';
  button.textContent=mode==='pause'?'⏸':mode==='cancel'?'✕':'▶';button.setAttribute('aria-label',label);button.title=label;
 }

 function timeReadout(){
  const format=['phrase','notes'].includes($('rehearsalView').value)?minutesSeconds:fmt;
  $('rehearsalTime').value=format(viewPosition)+' / '+format(clip.end);
 }

 function stop({pause=false}={}){
  if(pause&&playing){viewPosition=R.position(playing.loop,Math.max(0,ctx.currentTime-playing.when-(window.BassPlaybackTiming?.outputDelay(ctx)||0)));pausedPosition=viewPosition;}
  else pausedPosition=null;
  work++;mixRevision++;loading=false;
  if(host)$('rehearsalMix').disabled=false;
  clearInterval(clock);cancelAnimationFrame(visualFrame);stopBass();
  if(band){try{band.node.stop();}catch{}band.node.disconnect();band.gain.disconnect();band=null;}
  playing=null;audible=false;
  if(host){setCompact(pause);playLabel();if(pause&&clip)timeReadout();else $('rehearsalTime').value='';keyReadout();drawView();}
 }

 function discardPreparation(){
  clearTimeout(prepareTimer);prepared=null;
 }

 function resetClip(){
  phraseRepeat=null;selectedSeconds.clear();pageOverride=null;stop();discardPreparation();clip=null;previewClip=null;
  if(mixFailed){noBass=true;mixFailed=false;labelMix();}
  setNotes([]);
 }

 function close(){resetClip();song=null;return api.cancelBand?.();}

 const recordingShapes=new Map();
 function shapes(style,grid,rhythm,automatic=false){
  if(window.BassRehearsalIdeas)return window.BassRehearsalIdeas.bank(style,grid,rhythm,automatic,clip||previewClip,'all');
  const P=window.BassPracticeCore,D=window.BassPracticeCatalogue,H=window.BassAccompaniment,U=window.BassUploadedCore;
  const used=new Set(),rows=[];
  if(grid?.meter===4&&U){
   const recordings=[];
   for(const item of U.items){
    if(!D.visible('uploaded',item.id)||H.recordedStyle(item)!==style)continue;
    const excerpt=U.loop(item.id);
    if(!excerpt||Math.abs(Math.log(grid.bpm*excerpt.step/60))>.24)continue;
    if(!recordingShapes.has(item.id))recordingShapes.set(item.id,U.rehearsalShape(item.id));
    const shape=recordingShapes.get(item.id),score=C.patternScore(grid,rhythm,shape);
    if(!shape.length||automatic&&score<.05)continue;
    recordings.push({id:'clip:'+item.id,label:window.BassStudyDisplay.clip(item),shape,recorded:true,score});
   }
   rows.push(...recordings.sort((a,b)=>b.score-a.score).slice(0,4));
  }
  let generated=0;
  if(style!=='roots')for(const [i,line] of P.lines.entries()){
   if(!D.visible('basslines',line.id)||H.identify(line)!==style)continue;
   const shape=C.pattern(line,P,i),key=shape.map(n=>[n.beat,n.role,n.length].join(':')).join('|');
   if(!shape.length||used.has(key))continue;
   used.add(key);rows.push({id:line.id,shape});
   if(++generated===12)break;
  }
  return rows;
 }

 function preview(){
  if(clip)return clip;if(previewClip)return previewClip;if(!song?.buffer)return null;
  const start=parseTime($('rehearsalStart').value),end=Math.min(song.duration,parseTime($('rehearsalEnd').value));
  if(!Number.isFinite(start+end)||end<=start)return null;
  const grid=selectedGrid()||C.beatGrid({...song,start,end,manualBpm}),chords=song.chords||[];
  return previewClip={...song,start,end,grid,chords,transpose:0,quiet:[]};
 }
 function patterns(preferBest=false){
  const context=preview();
  const chosen=$('rehearsalStyle').value;
  const style=chosen==='auto'?clip?.suggested||'roots':chosen;
  const picker=$('rehearsalPattern'),previous=!preferBest&&picker.dataset.style===style?picker.value:'';
  const previousKind=featured.find(row=>row.id===picker.value)?.kind;
  picker.dataset.style=style;
  featured=shapes(style,context?.grid,context?.rhythm,chosen==='auto');
  let number=0;
  const choices=[];
  if(window.BassRehearsalIdeas){
   for(const [kind,label]of [['basslines','Basslines'],['runs','Runs'],['fills','Fills']]){
    const group=document.createElement('optgroup');group.label=label;
    for(const row of featured.filter(r=>r.kind===kind)){
     const option=new Option(row.label,row.id),info=window.BassRehearsalIdeas.describe(row);
     option.dataset.source=info.source;option.dataset.genre=info.genre;option.title=info.detail+(info.original?' · '+info.original:'');group.append(option);
    }
    if(group.children.length)choices.push(group);
   }
  }else choices.push(...featured.map(p=>new Option(p.label||'Pattern '+(++number),p.id)));
  if(chosen==='auto'&&clip?.bassNotes?.length){
   const original=new Option('Song bass','song-bass');original.title='Original song bassline';
   choices.unshift(original);
  }
  picker.replaceChildren(...choices);picker.add(new Option('Roots','roots'));
  if(chosen!=='auto'&&(previous==='roots'||featured.some(p=>p.id===previous)))picker.value=previous;
  else if(preferBest&&previousKind&&featured.some(row=>row.kind===previousKind))picker.value=featured.find(row=>row.kind===previousKind).id;
  else picker.selectedIndex=0;
  sourceDetails();
 }

 function sourceDetails(){
  const output=$('rehearsalSource');if(!output)return;
  const value=$('rehearsalPattern').value,row=featured.find(r=>r.id===value);
  const info=row&&window.BassRehearsalIdeas?.describe(row);
  output.textContent=info?info.source+' · Adapted':value==='song-bass'?'Original':value==='roots'?'Song chords':row?.recorded?'Adapted':'';
  output.title=info?info.detail+(info.original?' · '+info.original:''):value==='song-bass'?'Original song bassline':'';
 }

 function plan(){
  if($('rehearsalPattern').value==='song-bass')return clip.bassNotes;
  const pattern=featured.find(p=>p.id===$('rehearsalPattern').value);
  if(window.BassRehearsalIdeas)return window.BassRehearsalIdeas.fit(clip,pattern,$('rehearsalFill').value,'all',featured);
  return C.fit({...clip,shape:pattern?.shape,recorded:pattern?.recorded,
   fill:$('rehearsalFill').value});
 }

 const noteName=note=>note.midi===null?'×':window.BassFillCore.note(note.midi);

 function keyReadout(){
  if(!host)return;
  const current=clip||song;let key=current&&H?.keyOf(current);
  if(!key&&current){
   const tonic=current.keyRoot??current.root,mode=current.keyMode||current.mode||'major';
   if(Number.isInteger(tonic)&&window.BassFillCore.scales[mode])key={tonic:(tonic%12+12)%12,mode};
  }
  const value=key?'Key · '+window.BassFillCore.names[key.tonic]+' '+key.mode:'Key unknown';
  if($('rehearsalCue').value!==value)$('rehearsalCue').value=value;
 }

 function setNotes(notes){
  viewNotes=notes;
  phraseEvents=notes.map(n=>({...n,start:n.time,end:n.stop}));
  setNotes.index=window.BassPlaybackTiming?.index?.(notes,n=>n.time,n=>n.stop);
  fretNotes=notes.filter(n=>n.midi!==null).map(n=>({midi:n.midi,start:n.time,end:n.stop,isFill:n.role==='fill'||n.role==='run'}));
  notePage=-1;
  $('rehearsalVisual').hidden=!clip;
  keyReadout();
  drawView();
 }

 function drawView(){
  const ready=!!clip,notesMode=ready&&$('rehearsalView').value==='notes';
  for(const id of ['rehearsalPrev','rehearsalNext'])$(id).hidden=!notesMode;
  $('rehearsalFollow').hidden=!notesMode||pageOverride===null;
  $('rehearsalClear').hidden=!notesMode||!selectedSeconds.size&&!phraseRepeat;
  if(!ready)return;
  const mode=$('rehearsalView').value,board=$('rehearsalFret'),timeline=$('rehearsalTimeline');
  const phraseHost=$('rehearsalPhrases');
  $('rehearsalNoteKey').hidden=mode!=='notes';
  phraseHost.hidden=mode!=='phrase';board.hidden=mode==='notes'||mode==='phrase';timeline.hidden=mode!=='notes';
  if(mode==='phrase'){
   phrases??=window.BassPhraseView.create(phraseHost,togglePhrase,()=>phraseRepeat);
   phrases.set(phraseEvents,clip.grid?.bpm,clip.grid?.meter,clip.start,clip.end,api.phraseLabel);
   phrases.draw(viewPosition,audible);
   return;
  }
  if(!board.hidden){
   board.classList.toggle('ff-single-board',mode==='fret2');
   if(!fretView){
    fretView=window.BassFretFlow.create();
    fretView.init({get:()=>({notes:fretNotes,strings:song?.strings||5,session:clip?.session,time:viewPosition,loaded:!!clip,highlight:audible,title:'',speed:100})},board);
   }
   fretView.draw(viewPosition);
   return;
  }
  const startSecond=Math.floor(clip.start),endSecond=Math.ceil(clip.end);
  const currentSecond=Math.min(endSecond-1,Math.max(startSecond,Math.floor(viewPosition)));
  const first=pageOverride??startSecond+4*Math.floor((currentSecond-startSecond)/4);
  $('rehearsalPrev').disabled=first<=startSecond;
  $('rehearsalNext').disabled=first+4>=endSecond;
  if(first!==notePage){
   notePage=first;markers=[];changeMarkers=[];
   const columns=[];
   const changes=H?H.prepare(clip).transitions:[];
   function changeLabel(cell,head,change,start,end,chord=change.to){
    const label=document.createElement('strong');label.className='rehearsal-change-label';label.textContent=H.chordLabel(chord);label.title=(change.names?'Chord change · '+change.names+' · ':'')+'Current chord · '+chord.name;head.append(label);changeMarkers.push({label,start,end,cell,change,chord});
   }
   for(let i=first;i<Math.min(endSecond,first+4);i++){
    const cell=document.createElement('div'),time=document.createElement('time'),head=document.createElement('div');
    head.className='rehearsal-column-head';
    cell.dataset.second=String(i);time.textContent=minutesSeconds(i);head.append(time);cell.append(head);
    const a=Math.max(clip.start,i),z=Math.min(clip.end,i+1);
    cell.tabIndex=0;cell.setAttribute('role','button');cell.setAttribute('aria-label','Repeat '+fmt(a)+' to '+fmt(z));
    cell.onclick=()=>toggleSecond(i);
    cell.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggleSecond(i);}};
    if(H&&i===first){
     const chord=H.at(clip,Math.max(first,clip.start)+.0001);
     if(chord&&chord.start<first-.01){const previous=changes.find(change=>change.to===chord);changeLabel(cell,head,previous||{},chord.start,chord.end,chord);}
    }
    for(const change of changes){
     const at=change.loop?clip.start:change.at;if(at<i||at>=i+1)continue;
     changeLabel(cell,head,change,at,change.to.end);
    }
    for(const note of viewNotes){
     const start=Math.max(note.time,first);
     if(note.stop<=first||start<i||start>=i+1)continue;
     const chip=document.createElement('span');
     const info=H?.noteKind(clip,note)||{kind:['fill','run'].includes(note.role)?note.role:'unknown'},kind=info.kind;
     chip.className=kind==='main'?'rehearsal-main-note':kind==='fill'||kind==='run'?'rehearsal-fill-note':kind==='passing'?'rehearsal-passing-note':'rehearsal-bass-note';
     chip.dataset.noteKind=kind;chip.dataset.mark=info.phrase==='run'?'R':info.phrase==='fill'?'F':'';
     chip.textContent=noteName(note);
     const caption=({main:'Main bass note',chord:'Chord note',fill:'Fill note',run:'Run note',passing:'Passing note',muted:'Muted note',unknown:'Transcribed bass note'})[kind];
     chip.title=caption+' · '+noteName(note)+(info.chord?' · '+info.chord.number+' · '+info.chord.name:'')+(info.phrase?' · '+info.phrase:'');
     cell.append(chip);markers.push({note,chip});
    }
    columns.push(cell);
   }
   timeline.style.gridTemplateColumns='repeat('+columns.length+', minmax(0, 1fr))';
   timeline.replaceChildren(...columns);
   fitTimeline();
  }
  for(const {note,chip} of markers)chip.classList.toggle('active',audible&&note.time<=viewPosition&&viewPosition<note.stop);
  for(const cell of timeline.children){
   const second=Number(cell.dataset.second),selected=selectedSeconds.has(second);
   cell.classList.toggle('current-time',audible&&second===currentSecond);
   cell.classList.toggle('repeat-selected',selected);cell.setAttribute('aria-pressed',String(selected));
  }
  const next=changeMarkers.filter(marker=>marker.start>viewPosition+.001).sort((a,b)=>a.start-b.start)[0],lead=60/(clip.grid?.bpm||100);
  for(const cell of timeline.children){
   const rows=changeMarkers.filter(marker=>marker.cell===cell),second=Number(cell.dataset.second),at=Math.min(viewPosition,second+1-.000001);
   const selected=rows.includes(next)&&next.start-viewPosition<=lead?next:rows.filter(marker=>marker.start<=at).at(-1)||rows[0];
   for(const marker of rows)marker.label.hidden=marker!==selected;
  }
  for(const marker of changeMarkers){
   const active=audible&&marker.start<=viewPosition&&viewPosition<marker.end;
   const upcoming=audible&&marker===next&&marker.start-viewPosition<=lead;
   marker.label.textContent=upcoming&&marker.change.from?.number!==marker.change.to?.number?marker.change.label:H.chordLabel(marker.chord);
   marker.label.classList.toggle('change-current',active);marker.label.classList.toggle('change-next',upcoming);marker.label.setAttribute('aria-current',active?'step':'false');
  }
 }

 function fitTimeline(){
  if(!host||$('rehearsalTimeline').hidden)return;
  const timeline=$('rehearsalTimeline'),cells=Array.from(timeline.children);
  if(!cells.length)return;
  const count=Math.max(1,...cells.map(cell=>Array.from(cell.children).filter(n=>n.tagName==='SPAN'||/rehearsal-(?:bass|fill|landing)-note/.test(n.className||'')).length));
  const width=(timeline.clientWidth||304)/cells.length-8,height=Math.max(30,(timeline.clientHeight||250)-42);
  const lanes=count>Math.floor(height/30)&&width>=54?2:1,rows=Math.ceil(count/lanes);
  const size=Math.max(10,Math.min(40,(width-(lanes-1)*3)/lanes,(height-rows*3)/rows));
  const gap=Math.max(2,Math.min(8,(height-rows*size)/rows));
  for(const [name,value]of Object.entries({'--rehearsal-lanes':lanes,'--rehearsal-rows':rows,'--rehearsal-chip':size+'px','--rehearsal-note-gap':gap+'px','--rehearsal-note-font':Math.max(12,Math.min(16,size*.46))+'px'}))timeline.style.setProperty?.(name,String(value));
 }

 function pageTimeline(direction){
  if(!clip)return;
  const start=Math.floor(clip.start),last=start+4*Math.floor((Math.ceil(clip.end)-1-start)/4);
  pageOverride=Math.max(start,Math.min(last,(notePage>=0?notePage:start)+direction*4));
  notePage=-1;drawView();
 }

 function toggleSecond(second){
  if(loading||!clip)return;
  phraseRepeat=null;
  if(selectedSeconds.has(second))selectedSeconds.delete(second);else selectedSeconds.add(second);
  restartRepeat();
 }

 function changePattern(){
  sourceDetails();
  if(!clip)return;
  const notes=plan();
  if(playing){
   stopBass();playing.notes=notes;playing.pending=null;playing.viewChange=null;
   playing.scheduled=R.notes(notes,playing.loop);playing.cycle=Math.max(0,Math.floor((ctx.currentTime-playing.when)/playing.seconds));
   playing.index=0;playing.resumeActive=true;setNotes(notes);schedule();
  }else setNotes(notes);
  if(!notes.length)state('No fitting guide for this passage.');
  else if($('rehearsalStatus').textContent==='No fitting guide for this passage.')state('');
 }

 function bandRange(start,end,grid){
  if(ranked[Number($('rehearsalPassage').value)]?.timeline)return {start,end};
  // Long and whole-song loops keep their exact endpoints, including any rests.
  if(end-start>32||start===0&&Math.abs(end-song.duration)<.006)return {start,end};
  return {start:grid?.points[0]??start,end:grid?.points.at(-1)??end};
 }

 function excerpt(source,start,end){
  const rate=source.sampleRate,a=Math.round(start*rate),z=Math.min(source.length,Math.round(end*rate));
  return {sampleRate:rate,duration:(z-a)/rate,length:z-a,numberOfChannels:source.numberOfChannels,
   getChannelData:index=>source.getChannelData(index).subarray(a,z)};
 }

 async function analyse(id){
  const current=api.get(),{start,end}=passageRange();
  const bpm=manualBpm;
  if(!current?.buffer||!(start>=0&&end<=current.duration+.006&&end-start>=(selectedGrid()? .5:2)))
   throw Error('Choose at least 2 seconds within the recording.');
  if(bpm&&!(bpm>=40&&bpm<=220))throw Error('Enter a BPM between 40 and 220.');
  const validEnd=Math.min(end,current.duration);
  const rhythm=C.attacks(current.buffer,start,validEnd);
  const grid=selectedGrid()||C.beatGrid({...current,start,end:validEnd,manualBpm:bpm,rhythm});
  const range=bandRange(start,validEnd,grid),a=range.start,z=range.end;
  const saved=current.chords.filter(c=>c.end>a&&c.start<z);
  let chords=saved,roots=[];
  const coverage=saved.reduce((sum,c)=>sum+Math.min(z,c.end)-Math.max(a,c.start),0);
  if(coverage<(z-a)*.95){
   const rootWindows=grid?.points.slice(0,-1).map((t,i)=>({start:t-a,end:grid.points[i+1]-a}))||[];
   const local=await window.BassChordRecovery.scan(excerpt(current.buffer,a,z),{
    existing:saved.map(c=>({...c,start:Math.max(0,c.start-a),end:Math.min(z-a,c.end-a)})),
    rootWindows,stillCurrent:()=>id===work&&current.session===api.session()
   });
   chords=saved.concat(local.added.map(c=>({...c,start:c.start+a,end:c.end+a})));
   roots=(local.roots||[]).map(c=>({...c,start:c.start+a,end:c.end+a}));
  }
  const preferred=C.suggest(chords,grid);
  let suggested=preferred;
  if(grid&&window.BassRehearsalIdeas)suggested=window.BassRehearsalIdeas.strongestStyle(chords,grid,rhythm,current.title);
  else if(grid){
   const candidates=C.styles.filter(([name])=>name!=='auto'&&name!=='roots');
   const ranked=candidates.map(([name])=>({name,score:Math.max(-1,...shapes(name,grid,rhythm,true).map(
    row=>C.patternScore(grid,rhythm,row.shape)))+(name===preferred?.15:0)}));
   suggested=ranked.sort((a,b)=>b.score-a.score)[0]?.name||preferred;
  }
  const detected=current.notes?.length?current.notes:await api.readBass?.(current.session,()=>id!==work);
  const bassNotes=(detected||[]).filter(n=>Number.isInteger(n.midi)&&Number.isFinite(n.start+n.end)&&n.end>n.start&&n.start<z&&n.end>a)
   .map(n=>({midi:n.midi,time:Math.max(a,n.start),stop:Math.min(z,n.end),role:'transcribed',accent:.6})).sort((u,v)=>u.time-v.time);
  const quiet=C.quietRanges(current.buffer,a,z);
  return {start:a,end:z,grid,chords,roots,rhythm,quiet,bassNotes,suggested,source:current.buffer,session:current.session,manualBpm:bpm,keyRoot:current.keyRoot??current.root,keyMode:current.keyMode||current.mode,key:current.key,numbering:current.numbering,harmonyRevision:harmonyRevision(current)};
 }

 function labelMix(){
  const button=$('rehearsalMix');
  button.setAttribute('aria-pressed',String(noBass));
  button.textContent=noBass?'Orig 🔇':'Orig 🔊';
  button.setAttribute('aria-label',noBass?'Original bass muted. Unmute original bass':'Original bass on. Mute original bass');button.title=button.getAttribute('aria-label');
 }

 function prepareBand(start,end){
  if(prepared?.session===song.session&&prepared.start===start&&prepared.end===end)return prepared.result;
  const request={start,end,session:song.session};
  prepared=request;
  const cancelled=()=>prepared!==request||request.session!==api.session();
  request.result=api.band(start,end,percent=>{
   if(!cancelled()&&(loading||playing)&&noBass)state('Removing original bass '+percent+'%');
  },cancelled).then(audio=>{request.ready=true;return audio;}).catch(error=>{
   if(prepared===request)prepared=null;
   throw error;
  });
  return request.result;
 }

 async function mix(id,revision,remove){
  const current=clip;
  if(!remove)return {source:current.source,offset:current.start,end:current.end};
  state('Preparing the band without bass…');
  const audio=await prepareBand(current.start,current.end);
  if(id!==work||revision!==mixRevision||current.session!==api.session())return null;
  return {source:audio,offset:0,end:Math.min(audio.duration,current.end-current.start)};
 }

 function repeatLoop(tracks){return R.pack(ctx,tracks,clip,R.ranges(clip,selectedSeconds,phraseRepeat));}

 function startBand(tracks,when,phase=0,replace=false,loop=repeatLoop(tracks)){
  const node=ctx.createBufferSource(),gain=ctx.createGain(),previous=band;
  node.buffer=loop.source;node.loop=true;
  node.loopStart=loop.start;node.loopEnd=loop.end;
  const level=Number($('rehearsalMusic').value)/100;
  gain.gain.value=replace?0:level;
  node.connect(gain).connect(ctx.destination);
  node.start(when,loop.start+phase%loop.seconds);
  band={node,gain,tracks,loop};
  if(!replace||!previous)return;
  gain.gain.setValueAtTime(0,when);
  gain.gain.linearRampToValueAtTime(level,when+.018);
  previous.gain.gain.setValueAtTime(level,when);
  previous.gain.gain.linearRampToValueAtTime(0,when+.018);
  previous.node.onended=()=>{previous.node.disconnect();previous.gain.disconnect();};
  previous.node.stop(when+.02);
 }

 function togglePhrase(row){
  if(loading)return;
  const remove=phraseRepeat?.start===row.start&&phraseRepeat?.end===row.end;
  selectedSeconds.clear();
  phraseRepeat=remove?null:row;
  if(!playing){if(!remove)void play();return;}
  restartRepeat();
 }

 function restartRepeat(){
  if(!playing){drawView();return;}
  const position=R.position(playing.loop,Math.max(0,ctx.currentTime-playing.when));
  const loop=repeatLoop(band.tracks),when=ctx.currentTime+.025,phase=R.phase(loop,position);
  stopBass();
  startBand(band.tracks,when,phase,true,loop);
  const changed=!!playing.pending;
  playing.notes=playing.pending||playing.notes;playing.pending=null;
  playing.loop=loop;playing.scheduled=R.notes(playing.notes,loop);
  playing.when=when-phase;playing.startedAt=when;playing.seconds=loop.seconds;
  viewPosition=R.position(loop,phase);
  playing.viewChange=null;if(changed)setNotes(playing.notes);
  playing.cycle=0;playing.index=0;schedule();
  drawView();
 }

 async function toggleMix(){
  noBass=!noBass;mixFailed=false;labelMix();
  const revision=++mixRevision,id=work;
  if(!playing){
   if(!prepared?.ready)discardPreparation();
   state('');
   if(noBass)updateBpm();
   return;
  }
  if(!noBass&&!prepared?.ready)discardPreparation();
  try{
   const tracks=await mix(id,revision,noBass);
   if(!tracks||id!==work||revision!==mixRevision||!playing)return;
   const loop=repeatLoop(tracks),when=ctx.currentTime+.035,elapsed=Math.max(0,when-playing.when),cycle=Math.floor(elapsed/playing.seconds);
   const phase=R.phase(loop,R.position(playing.loop,elapsed));
   startBand(tracks,when,phase,true,loop);
   playing.when=when-cycle*loop.seconds-phase;playing.seconds=loop.seconds;
   playing.loop=loop;playing.scheduled=R.notes(playing.notes,loop);
   state('');
  }catch{
   if(id!==work||revision!==mixRevision)return;
   noBass=false;mixFailed=true;labelMix();state('Original bass is still on.');
  }
 }

 async function play(){
  if(!song?.buffer)return;
  const id=++work;
  loading=true;$('rehearsalMix').disabled=true;playLabel('cancel');
  setCompact(true);
  state('Checking chords and timing…');
  try{
   ctx??=new AudioContext();
   await ctx.resume();
   const currentId=song.session;
   if(clip&&clip.harmonyRevision!==harmonyRevision(api.get())){clip=null;previewClip=null;}
   if(!clip||manualBpm!==clip.manualBpm){
    const result=await analyse(id);
    if(id!==work||currentId!==api.session())return;
    clip=result;patterns();
    $('rehearsalBpm').value=manualBpm||Math.round(clip.grid?.bpm||0)||'';
   }
   let tracks,originalFallback=false;
   try{tracks=await mix(id,mixRevision,noBass);}
   catch(error){
    if(id!==work||currentId!==api.session())return;
    if(!noBass)throw error;
    noBass=false;mixFailed=true;labelMix();originalFallback=true;
    tracks=await mix(id,mixRevision,false);
   }
   if(id!==work||!tracks||currentId!==api.session())return;
   // Warm all notes before starting so style changes can take effect on the next loop.
   await window.BassPracticeAudio.prepare('bass',ctx,{notes:Array.from({length:37},(_,i)=>({midi:23+i,velocity:85}))});
   if(id!==work||currentId!==api.session())return;
   const notes=plan(),loop=repeatLoop(tracks),when=ctx.currentTime+.06,resuming=pausedPosition!==null,phase=resuming?R.phase(loop,pausedPosition):0;
   startBand(tracks,when,phase,false,loop);
   playing={when:when-phase,startedAt:when,seconds:loop.seconds,loop,notes,scheduled:R.notes(notes,loop),pending:null,cycle:0,index:0,resumeActive:resuming};
   setCompact(true);
   playLabel('pause');
   state([originalFallback?'Original bass is still on.':'',!clip.bassNotes.length?'No bass notes detected here. Playing a suggested line.':''].filter(Boolean).join(' '));
   if(!resuming)pageOverride=null;pausedPosition=null;viewPosition=R.position(loop,phase);setNotes(notes);
   schedule();
   clock=setInterval(schedule,40);
   visualFrame=requestAnimationFrame(display);
  }catch(error){
   if(id===work){stop();state(error.message||'Could not play this passage.');}
  }finally{
   if(id===work){loading=false;$('rehearsalMix').disabled=false;if(!playing)playLabel();}
  }
 }

 function schedule(){
  const s=playing;
  if(!s)return;
  if(clip.session!==api.session()){refresh();return;}
  const now=Math.max(ctx.currentTime,s.startedAt??0),horizon=now+.14,cycle=Math.max(0,Math.floor((now-s.when)/s.seconds));
  if(s.cycle<cycle){s.cycle=cycle;s.index=0;}
  while(s.when+s.cycle*s.seconds<=horizon){
   const start=s.when+s.cycle*s.seconds;
   if(s.index===0&&s.pending){s.notes=s.pending;s.pending=null;s.scheduled=R.notes(s.notes,s.loop);s.viewChange={at:start,notes:s.notes};}
   while(s.index<s.scheduled.length){
    const note=s.scheduled[s.index],beat=start+note.time;
    if(beat>horizon){s.resumeActive=false;return;}
    s.index++;
    const age=Math.max(0,now-beat),resume=s.resumeActive&&start+note.stop>now;
    if(beat<now-.03&&!resume||$('rehearsalGuide').getAttribute('aria-pressed')!=='true')continue;
    const level=Number($('rehearsalGain').value)/100;
    if(!level)continue;
    const instrument=window.BassPracticeAudio,when=Math.max(now,beat);
    const velocity=(['root','landing'].includes(note.role)?86:75)+Math.round(note.accent*15);
    const duration=note.stop-note.time-Math.max(0,now-beat);
    if(duration>0)voices.push(note.midi===null?instrument.muted(ctx,when,level):instrument.tone(ctx,note.midi,when,duration,'bass',age,velocity,level));
   }
   s.cycle++;s.index=0;
  }
  s.resumeActive=false;
  if(voices.length>160)voices=voices.slice(-80);
 }

 function display(){
  if(!playing)return;
  const now=ctx.currentTime-(window.BassPlaybackTiming?.outputDelay(ctx)||0);
  audible=now>=(playing.startedAt??playing.when);
  viewPosition=R.position(playing.loop,Math.max(0,now-playing.when));
  if(playing.viewChange&&now>=playing.viewChange.at){
   setNotes(playing.viewChange.notes);playing.viewChange=null;
  }
  timeReadout();
  keyReadout();
  drawView();
  visualFrame=requestAnimationFrame(display);
 }

 return {init,refresh,close,isActive:()=>!!playing||loading};
})();
