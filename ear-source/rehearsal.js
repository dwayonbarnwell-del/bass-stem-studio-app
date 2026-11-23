/* Rehearse a short recording with the band and a separate bass guide. */
window.BassRehearsal=(()=>{
 'use strict';
 const C=window.BassRehearsalCore;
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
 let phraseRepeat=null,phrases,phraseEvents=[];
 let featured=[],viewNotes=[],viewPosition=0,fretView,fretNotes=[],notePage=-1,markers=[],audible=false;

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
    <div class="rehearsal-row rehearsal-setup">
     <select id="rehearsalPassage" aria-label="Passage"></select>
     <button id="rehearsalAdjust" type="button" aria-expanded="false" aria-controls="rehearsalCorrections">Timing &amp; chords</button>
    </div>
    <div class="rehearsal-row rehearsal-times rehearsal-setup">
     <label><span>Start</span><input id="rehearsalStart" type="text" inputmode="decimal"></label>
     <label><span>End</span><input id="rehearsalEnd" type="text" inputmode="decimal"></label>
     <label><span>BPM</span><input id="rehearsalBpm" type="number" inputmode="numeric" min="40" max="220" placeholder="—"></label>
    </div>
    <div id="rehearsalCorrections" class="rehearsal-setup" hidden>
     <label>Chords per bar <input id="rehearsalChords" type="text" placeholder="C G Am F" autocomplete="off"></label>
    </div>
    <div class="rehearsal-row">
     <select id="rehearsalStyle" aria-label="Style"></select>
     <select id="rehearsalPattern" aria-label="Pattern"></select>
    </div>
    <div class="rehearsal-row">
     <select id="rehearsalFill" aria-label="Fills"><option value="bar">Fill every bar</option><option value="ends">Fill on changes</option><option value="off">Fills off</option></select>
     <button id="rehearsalMix" type="button" aria-pressed="true">Original bass off</button>
    </div>
    <label class="rehearsal-level">Music <input id="rehearsalMusic" type="range" min="0" max="100" value="30"><output id="rehearsalMusicValue">30%</output></label>
    <label class="rehearsal-level">Guide bass <input id="rehearsalGain" type="range" min="0" max="100" value="100"><output id="rehearsalGainValue">100%</output></label>
    <div class="rehearsal-row"><button id="rehearsalPlay" type="button">Play loop</button><button id="rehearsalGuide" type="button" aria-pressed="true">Guide on</button></div>
    <div class="rehearsal-readout"><output id="rehearsalTime"></output><output id="rehearsalCue"></output></div>
    <select id="rehearsalView" aria-label="Rehearsal view"><option value="notes">Note View</option><option value="phrase">Phrase View</option><option value="fret">Fret View</option><option value="fret2">Fret View 2</option></select>
    <div id="rehearsalVisual" hidden>
     <div class="bass-phrase" id="rehearsalPhrases" hidden></div>
     <div id="rehearsalTimeline" aria-label="Rehearsal note timeline"></div>
     <div id="rehearsalFret" hidden></div>
    </div>
   </div>
   <p id="rehearsalStatus" role="status"></p>`;
  C.styles.forEach(([id,caption])=>$('rehearsalStyle').add(new Option(caption,id)));
  $('rehearsalImport').onclick=()=>api.pickAudio($('rehearsalFile'),openFile);
  $('rehearsalFile').onchange=e=>{const file=e.target.files[0];e.target.value='';if(file)void openFile(file);};
  $('rehearsalLibrary').onclick=async()=>{await close();api.openLibrary();};
  $('rehearsalPassage').onchange=()=>applyPassage(ranked[Number($('rehearsalPassage').value)]);
  $('rehearsalAdjust').onclick=()=>{
   const corrections=$('rehearsalCorrections');
   corrections.hidden=!corrections.hidden;
   $('rehearsalAdjust').setAttribute('aria-expanded',String(!corrections.hidden));
  };
  for(const id of ['rehearsalStart','rehearsalEnd','rehearsalBpm','rehearsalChords']){
   $(id).onchange=()=>{
    if(id==='rehearsalBpm')manualBpm=Number($(id).value);
    resetClip();$('rehearsalPassage').value='custom';
    updateBpm();
   };
  }
  $('rehearsalStyle').onchange=()=>{patterns();changePattern();};
  $('rehearsalPattern').onchange=changePattern;
  $('rehearsalFill').onchange=changePattern;
  $('rehearsalMix').onclick=()=>void toggleMix();
  $('rehearsalView').onchange=()=>{notePage=-1;drawView();};
  $('rehearsalMusic').oninput=()=>{
   const level=Number($('rehearsalMusic').value)/100;
   $('rehearsalMusicValue').value=Math.round(level*100)+'%';
   if(band)band.gain.gain.setTargetAtTime(level,ctx.currentTime,.015);
  };
  $('rehearsalGain').oninput=()=>{$('rehearsalGainValue').value=$('rehearsalGain').value+'%';};
  $('rehearsalGuide').onclick=()=>{
   const button=$('rehearsalGuide'),off=button.getAttribute('aria-pressed')==='true';
   button.setAttribute('aria-pressed',String(!off));button.textContent=off?'Guide off':'Guide on';
   if(off)stopBass();
  };
  $('rehearsalPlay').onclick=()=>{
   if(loading){discardPreparation();void api.cancelBand?.();}
   if(playing||loading){stop();state('');}else void play();
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
  const next=api.get(),changed=song?.session!==next?.session||song?.buffer!==next?.buffer;
  song=next;
  if(!changed)return;
  resetClip();
  noBass=true;mixFailed=false;labelMix();
  $('rehearsalStyle').value='auto';
  $('rehearsalMusic').value=30;$('rehearsalMusicValue').value='30%';
  $('rehearsalGain').value=100;$('rehearsalGainValue').value='100%';
  $('rehearsalEditor').hidden=!song?.buffer;
  $('rehearsalTitle').textContent=song?.buffer?song.title:'Choose a recording or a saved song.';
  if(!song?.buffer){state('');return;}
  const fromSection=(song.sections||[])
   .filter(s=>s.end-s.start>=4)
   .map(s=>({start:s.start,end:Math.min(s.end,song.duration),name:s.name}));
  const suggestions=C.passages(song.buffer).map(p=>({...p,pulse:C.pulse(song.buffer,p.start,p.end)}));
  const best=[...suggestions].sort((a,b)=>(b.pulse?.confidence||0)-(a.pulse?.confidence||0)||b.score-a.score)[0];
  const passages=[...fromSection,...(best?[best]:[]),...suggestions.filter(p=>p!==best)];
  if(!passages.length&&song.duration>16)passages.push({start:0,end:16,name:'First passage'});
  const phrases=[],seen=new Set();
  for(const passage of [...passages,{start:0,end:song.duration,name:'Bass phrase'}]){
   const grid=C.beatGrid({...song,start:passage.start,end:passage.end,pulseEstimate:passage.pulse});
   if(!grid)continue;
   const size=grid.meter*2;
   for(let at=0;at+grid.meter<grid.points.length;at+=size){
    const points=grid.points.slice(at,at+size+1);
    const start=points[0],end=points.at(-1);
    const key=[Math.round(start*10),Math.round(end*10)].join('/');
    if(seen.has(key))continue;
    seen.add(key);phrases.push({start,end,name:passage.name||'Phrase',grid:{...grid,points}});
   }
  }
  ranked=[{start:0,end:song.duration,name:'Full song'},...phrases];
  const picker=$('rehearsalPassage');
  picker.replaceChildren(...ranked.map((p,i)=>new Option(p.name==='Full song'?p.name:(p.name||'Passage')+' · '+fmt(p.start),i)));
  picker.add(new Option('Custom passage','custom'));
  picker.value='0';applyPassage(ranked[0]);
 }

 function selectedGrid(){
  return ranked[Number($('rehearsalPassage').value)]?.grid;
 }
 function applyPassage(p){
  if(!p)return;
  resetClip();
  $('rehearsalStart').value=fmt(p.start);$('rehearsalEnd').value=fmt(p.end);
  manualBpm=0;$('rehearsalChords').value='';state('');updateBpm();patterns();
 }

 function updateBpm(){
  const input=$('rehearsalBpm');
  const start=parseTime($('rehearsalStart').value),end=parseTime($('rehearsalEnd').value);
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
  const navigation=host.closest?.('#earTrainerDialog')?.querySelector('#earSections');
  if(navigation)navigation.hidden=compact;
 }

 function stopBass(){
  for(const voice of voices){try{voice.stop();}catch{}}
  voices=[];
 }

 function stop(){
  work++;mixRevision++;loading=false;
  if(host)$('rehearsalMix').disabled=false;
  clearInterval(clock);cancelAnimationFrame(visualFrame);stopBass();
  if(band){try{band.node.stop();}catch{}band.node.disconnect();band.gain.disconnect();band=null;}
  playing=null;audible=false;
  if(host){setCompact(false);$('rehearsalPlay').textContent='Play loop';$('rehearsalTime').value='';$('rehearsalCue').value='';drawView();}
 }

 function discardPreparation(){
  clearTimeout(prepareTimer);prepared=null;
 }

 function resetClip(){
  phraseRepeat=null;stop();discardPreparation();clip=null;
  if(mixFailed){noBass=true;mixFailed=false;labelMix();}
  setNotes([]);
 }

 function close(){resetClip();song=null;return api.cancelBand?.();}

 const recordingShapes=new Map();
 function shapes(style,grid,rhythm,automatic=false){
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
    recordings.push({id:'clip:'+item.id,label:window.BassStudyDisplay.clip(item)+' · adapted',shape,recorded:true,score});
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

 function patterns(){
  const chosen=$('rehearsalStyle').value;
  const style=chosen==='auto'?clip?.suggested||'roots':chosen;
  const picker=$('rehearsalPattern'),previous=picker.dataset.style===style?picker.value:'';
  picker.dataset.style=style;
  featured=shapes(style,clip?.grid,clip?.rhythm,chosen==='auto');
  if(chosen==='auto'&&clip)featured.sort((a,b)=>C.patternScore(clip.grid,clip.rhythm,b.shape)-C.patternScore(clip.grid,clip.rhythm,a.shape));
  let number=0;
  const choices=featured.map(p=>new Option(p.label||'Pattern '+(++number),p.id));
  if(chosen==='auto'&&clip?.bassNotes?.length){
   const original=new Option('Song bassline','song-bass');
   choices.unshift(original);
  }
  picker.replaceChildren(...choices);picker.add(new Option('Roots','roots'));
  if(chosen!=='auto'&&(previous==='roots'||featured.some(p=>p.id===previous)))picker.value=previous;
  else picker.selectedIndex=0;
 }

 function plan(){
  if($('rehearsalPattern').value==='song-bass')return clip.bassNotes;
  const pattern=featured.find(p=>p.id===$('rehearsalPattern').value);
  return C.fit({...clip,shape:pattern?.shape,recorded:pattern?.recorded,
   fill:$('rehearsalFill').value});
 }

 const noteName=note=>note.midi===null?'×':window.BassFillCore.note(note.midi);

 function setNotes(notes){
  viewNotes=notes;
  phraseEvents=notes.map(n=>({...n,start:n.time,end:n.stop}));
  setNotes.index=window.BassPlaybackTiming?.index?.(notes,n=>n.time,n=>n.stop);
  fretNotes=notes.filter(n=>n.midi!==null).map(n=>({midi:n.midi,start:n.time,end:n.stop,isFill:n.role==='fill'}));
  notePage=-1;
  $('rehearsalVisual').hidden=!notes.length;
  drawView();
 }

 function drawView(){
  if(!clip||!viewNotes.length)return;
  const mode=$('rehearsalView').value,board=$('rehearsalFret'),timeline=$('rehearsalTimeline');
  const phraseHost=$('rehearsalPhrases');
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
  const first=startSecond+4*Math.floor((currentSecond-startSecond)/4);
  if(first!==notePage){
   notePage=first;markers=[];
   const columns=[];
   for(let i=first;i<Math.min(endSecond,first+4);i++){
    const cell=document.createElement('div'),time=document.createElement('time');
    time.textContent=minutesSeconds(i);cell.append(time);
    for(const note of viewNotes){
     const start=Math.max(note.time,first);
     if(note.stop<=first||start<i||start>=i+1)continue;
     const chip=document.createElement('span');
     chip.className=note.role==='fill'?'rehearsal-fill-note':'rehearsal-bass-note';
     chip.textContent=noteName(note);
     chip.title=note.midi===null?'Muted note':note.role==='fill'?'Fill note':'Bass note';
     cell.append(chip);markers.push({note,chip});
    }
    columns.push(cell);
   }
   timeline.style.gridTemplateColumns='repeat('+columns.length+', minmax(0, 1fr))';
   timeline.replaceChildren(...columns);
  }
  for(const {note,chip} of markers)chip.classList.toggle('active',audible&&note.time<=viewPosition&&viewPosition<note.stop);
 }

 function changePattern(){
  if(!clip)return;
  const notes=plan();
  if(playing)playing.pending=notes;
  else setNotes(notes);
 }

 function bandRange(start,end,grid){
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
  const current=api.get(),start=parseTime($('rehearsalStart').value),end=parseTime($('rehearsalEnd').value);
  const bpm=manualBpm;
  if(!current?.buffer||!(start>=0&&end<=current.duration+.006&&end-start>=(selectedGrid()? .5:2)))
   throw Error('Choose at least 2 seconds within the recording.');
  if(bpm&&!(bpm>=40&&bpm<=220))throw Error('Enter a BPM between 40 and 220.');
  const validEnd=Math.min(end,current.duration);
  const rhythm=C.attacks(current.buffer,start,validEnd);
  const grid=selectedGrid()||C.beatGrid({...current,start,end:validEnd,manualBpm:bpm,rhythm});
  const range=bandRange(start,validEnd,grid),a=range.start,z=range.end;
  const saved=current.chords.filter(c=>c.end>a&&c.start<z);
  const manual=C.barChords($('rehearsalChords').value,grid);
  let chords=manual.length?manual:saved,roots=[];
  const coverage=saved.reduce((sum,c)=>sum+Math.min(z,c.end)-Math.max(a,c.start),0);
  if(!manual.length&&coverage<(z-a)*.95){
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
  if(grid){
   const candidates=C.styles.filter(([name])=>name!=='auto'&&name!=='roots');
   const ranked=candidates.map(([name])=>({name,score:Math.max(-1,...shapes(name,grid,rhythm,true).map(
    row=>C.patternScore(grid,rhythm,row.shape)))+(name===preferred?.15:0)}));
   suggested=ranked.sort((a,b)=>b.score-a.score)[0]?.name||preferred;
  }
  const detected=current.notes?.length?current.notes:await api.readBass?.(current.session,()=>id!==work);
  const bassNotes=(detected||[]).filter(n=>Number.isInteger(n.midi)&&Number.isFinite(n.start+n.end)&&n.end>n.start&&n.start<z&&n.end>a)
   .map(n=>({midi:n.midi,time:Math.max(a,n.start),stop:Math.min(z,n.end),role:'transcribed',accent:.6})).sort((u,v)=>u.time-v.time);
  const quiet=C.quietRanges(current.buffer,a,z);
  return {start:a,end:z,grid,chords,roots,rhythm,quiet,bassNotes,suggested,source:current.buffer,session:current.session,manualBpm:bpm};
 }

 function labelMix(){
  const button=$('rehearsalMix');
  button.setAttribute('aria-pressed',String(noBass));
  button.textContent=noBass?'Original bass off':'Original bass on';
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

 function startBand(tracks,when,phase=0,replace=false){
  const node=ctx.createBufferSource(),gain=ctx.createGain(),previous=band;
  node.buffer=tracks.source;node.loop=true;
  const offset=tracks.offset+(phraseRepeat?phraseRepeat.start-clip.start:0);
  const end=phraseRepeat?Math.min(tracks.end,tracks.offset+phraseRepeat.end-clip.start):tracks.end;
  node.loopStart=offset;node.loopEnd=end;
  const level=Number($('rehearsalMusic').value)/100;
  gain.gain.value=replace?0:level;
  node.connect(gain).connect(ctx.destination);
  node.start(when,offset+phase%(end-offset));
  band={node,gain,tracks};
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
  phraseRepeat=remove?null:row;
  if(!playing){if(!remove)void play();return;}
  const when=ctx.currentTime+.025,start=phraseRepeat?.start??clip.start;
  const phase=remove?Math.max(0,viewPosition-start):0;
  stopBass();
  startBand(band.tracks,when,phase,true);
  playing.when=when-phase;playing.seconds=band.node.loopEnd-band.node.loopStart;
  playing.cycle=0;playing.index=0;schedule();
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
   const when=ctx.currentTime+.035;
   const phase=Math.max(0,when-playing.when)%playing.seconds;
   startBand(tracks,when,phase,true);
   state('');
  }catch{
   if(id!==work||revision!==mixRevision)return;
   noBass=false;mixFailed=true;labelMix();state('Original bass is still on.');
  }
 }

 async function play(){
  if(!song?.buffer)return;
  const id=++work;
  loading=true;$('rehearsalMix').disabled=true;$('rehearsalPlay').textContent='Cancel';
  state('Checking chords and timing…');
  try{
   ctx??=new AudioContext();
   await ctx.resume();
   const currentId=song.session;
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
   const notes=plan(),when=ctx.currentTime+.06,seconds=tracks.end-tracks.offset;
   startBand(tracks,when);
   playing={when,seconds:band.node.loopEnd-band.node.loopStart,notes,pending:null,cycle:0,index:0};
   setCompact(true);
   $('rehearsalPlay').textContent='Pause';
   state([originalFallback?'Original bass is still on.':'',!clip.bassNotes.length?'No bass notes detected here. Playing a suggested line.':''].filter(Boolean).join(' '));
   viewPosition=clip.start;setNotes(notes);
   schedule();
   clock=setInterval(schedule,40);
   visualFrame=requestAnimationFrame(display);
  }catch(error){
   if(id===work){stop();state(error.message||'Could not play this passage.');}
  }finally{
   if(id===work){loading=false;$('rehearsalMix').disabled=false;if(!playing)$('rehearsalPlay').textContent='Play loop';}
  }
 }

 function schedule(){
  const s=playing;
  if(!s)return;
  if(clip.session!==api.session()){refresh();return;}
  const now=ctx.currentTime,horizon=now+.14,cycle=Math.max(0,Math.floor((now-s.when)/s.seconds));
  if(s.cycle<cycle){s.cycle=cycle;s.index=0;}
  while(s.when+s.cycle*s.seconds<=horizon){
   const start=s.when+s.cycle*s.seconds;
   if(s.index===0&&s.pending){s.notes=s.pending;s.pending=null;s.viewChange={at:start,notes:s.notes};}
   while(s.index<s.notes.length){
    const note=s.notes[s.index],beat=start+note.time-(phraseRepeat?.start??clip.start);
    if(phraseRepeat&&(note.time<phraseRepeat.start||note.time>=phraseRepeat.end)){s.index++;continue;}
    if(beat>horizon)return;
    s.index++;
    if(beat<now-.03||$('rehearsalGuide').getAttribute('aria-pressed')!=='true')continue;
    const level=Number($('rehearsalGain').value)/100;
    if(!level)continue;
    const instrument=window.BassPracticeAudio,when=Math.max(now,beat);
    const velocity=(note.role==='root'?86:75)+Math.round(note.accent*15);
    voices.push(note.midi===null?instrument.muted(ctx,when,level):instrument.tone(ctx,note.midi,when,Math.min(note.stop,phraseRepeat?.end??clip.end)-note.time,'bass',0,velocity,level));
   }
   s.cycle++;s.index=0;
  }
  if(voices.length>160)voices=voices.slice(-80);
 }

 function display(){
  if(!playing)return;
  const now=ctx.currentTime-(window.BassPlaybackTiming?.outputDelay(ctx)||0);
  audible=now>=playing.when;
  viewPosition=(phraseRepeat?.start??clip.start)+(Math.max(0,now-playing.when)%playing.seconds);
  if(playing.viewChange&&now>=playing.viewChange.at){
   setNotes(playing.viewChange.notes);playing.viewChange=null;
  }
  const format=['phrase','notes'].includes($('rehearsalView').value)?minutesSeconds:fmt;
  $('rehearsalTime').value=format(viewPosition)+' / '+format(clip.end);
  const current=audible&&(setNotes.index?setNotes.index.at(viewPosition):viewNotes.find(n=>n.time<=viewPosition&&viewPosition<n.stop));
  $('rehearsalCue').value=current?noteName(current):'';
  drawView();
  visualFrame=requestAnimationFrame(display);
 }

 return {init,refresh,close,isActive:()=>!!playing||loading};
})();
