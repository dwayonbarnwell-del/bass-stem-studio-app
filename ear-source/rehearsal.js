/* Rehearse a short recording with the band and a separate bass guide. */
window.BassRehearsal=(()=>{
 'use strict';
 const C=window.BassRehearsalCore;
 const fmt=time=>{const hundredths=Math.round(time*100);return Math.floor(hundredths/6000)+':'+(hundredths%6000/100).toFixed(2).padStart(5,'0');};
 const parseTime=value=>{
  const parts=value.trim().split(':');
  if(!parts.length||parts.length>2||parts.some(p=>!/^\d+(?:\.\d+)?$/.test(p)))return NaN;
  return parts.length===2?Number(parts[0])*60+Number(parts[1]):Number(parts[0]);
 };
 let host,api,song,clip,edited,ranked=[],ctx,band,clock,statusTimer,voices=[],playing,work=0,loading=false,importing=false,manualBpm=0,mixRevision=0,noBass=false;
 const $=id=>host.querySelector('#'+id);
 const state=text=>{$('rehearsalStatus').textContent=text;};
 const styleLabel=id=>C.styles.find(([key])=>key===id)?.[1]||'Roots';
 let featured=[];

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
     <button id="rehearsalMix" type="button" aria-pressed="false">Original bass on</button>
    </div>
    <label class="rehearsal-level">Guide bass <input id="rehearsalGain" type="range" min="0" max="100" value="100"><output id="rehearsalGainValue">100%</output></label>
    <div class="rehearsal-row"><button id="rehearsalPlay" type="button">Play loop</button><button id="rehearsalGuide" type="button" aria-pressed="true">Guide on</button></div>
    <div class="rehearsal-readout"><output id="rehearsalTime"></output><output id="rehearsalCue"></output></div>
    <p id="rehearsalNotes"></p>
    <details id="rehearsalScore" hidden>
     <summary>Bassline &amp; fill notes</summary>
     <div id="rehearsalBars"></div>
    </details>
   </div>
   <p id="rehearsalStatus" role="status"></p>`;
  C.styles.forEach(([id,caption])=>$('rehearsalStyle').add(new Option(caption,id)));
  $('rehearsalImport').onclick=()=>api.pickAudio($('rehearsalFile'),openFile);
  $('rehearsalFile').onchange=e=>{const file=e.target.files[0];e.target.value='';if(file)void openFile(file);};
  $('rehearsalLibrary').onclick=()=>{close();api.openLibrary();};
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
    if(id!=='rehearsalChords')updateBpm();
   };
  }
  $('rehearsalStyle').onchange=()=>{patterns();changePattern();};
  $('rehearsalPattern').onchange=changePattern;
  $('rehearsalFill').onchange=changePattern;
  $('rehearsalMix').onclick=()=>void toggleMix();
  $('rehearsalGain').oninput=()=>{$('rehearsalGainValue').value=$('rehearsalGain').value+'%';};
  $('rehearsalGuide').onclick=()=>{
   const button=$('rehearsalGuide'),off=button.getAttribute('aria-pressed')==='true';
   button.setAttribute('aria-pressed',String(!off));button.textContent=off?'Guide off':'Guide on';
   if(off)stopBass();
  };
  $('rehearsalPlay').onclick=()=>{if(playing||loading){stop();state('');}else void play();};
 }

 async function openFile(file){
  if(importing)return;
  stop();
  const id=work;
  importing=true;
  for(const button of ['rehearsalImport','rehearsalPlay','rehearsalLibrary'])$(button).disabled=true;
  state('Opening recording…');
  try{
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
  $('rehearsalEditor').hidden=!song?.buffer;
  $('rehearsalTitle').textContent=song?.buffer?song.title:'Choose a recording or a saved song.';
  if(!song?.buffer){state('');return;}
  const fromSection=(song.sections||[])
   .filter(s=>s.end-s.start>=4)
   .slice(0,12)
   .map(s=>({start:s.start,end:Math.min(s.end,s.start+24),name:s.name}));
  const suggestions=C.passages(song.buffer).map(p=>({...p,pulse:C.pulse(song.buffer,p.start,p.end)}));
  const best=[...suggestions].sort((a,b)=>(b.pulse?.confidence||0)-(a.pulse?.confidence||0)||b.score-a.score)[0];
  ranked=[...(best?[best]:[]),...fromSection,...suggestions.filter(p=>p!==best)];
  if(!ranked.length)ranked.push({start:0,end:Math.min(song.duration,16),name:'First passage'});
  const picker=$('rehearsalPassage');
  picker.replaceChildren(...ranked.map((p,i)=>new Option((p.name||'Passage')+' · '+fmt(p.start),i)));
  picker.add(new Option('Custom passage','custom'));
  picker.value='0';applyPassage(ranked[0]);
 }

 function applyPassage(p){
  if(!p)return;
  resetClip();
  $('rehearsalStart').value=fmt(p.start);$('rehearsalEnd').value=fmt(p.end);
  manualBpm=0;$('rehearsalChords').value='';updateBpm();patterns();state('');
 }

 function updateBpm(){
  const input=$('rehearsalBpm');
  const start=parseTime($('rehearsalStart').value),end=parseTime($('rehearsalEnd').value);
  const valid=song?.buffer&&start>=0&&end<=song.duration+.006&&end-start>=2&&end-start<=32;
  const picked=valid?C.beatGrid({...song,start,end,manualBpm}):null;
  input.value=manualBpm||Math.round(picked?.bpm||0)||'';
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
  clearInterval(clock);clearInterval(statusTimer);stopBass();
  if(band){try{band.node.stop();}catch{}band.node.disconnect();band.gain.disconnect();band=null;}
  playing=null;
  if(host){setCompact(false);$('rehearsalPlay').textContent='Play loop';$('rehearsalTime').value='';$('rehearsalCue').value='';}
 }

 function resetClip(){
  stop();clip=null;edited=null;
  $('rehearsalNotes').textContent='';
  $('rehearsalScore').hidden=true;
  $('rehearsalBars').replaceChildren();
 }

 function close(){stop();song=null;clip=null;edited=null;}

 function shapes(style){
  const P=window.BassPracticeCore,D=window.BassPracticeCatalogue,H=window.BassAccompaniment;
  const used=new Set(),rows=[];
  if(style!=='roots')for(const [i,line] of P.lines.entries()){
   if(!D.visible('basslines',line.id)||H.identify(line)!==style)continue;
   const shape=C.pattern(line,P,i),key=shape.map(n=>[n.beat,n.role,n.length].join(':')).join('|');
   if(!shape.length||used.has(key))continue;
   used.add(key);rows.push({id:line.id,shape});
   if(rows.length===12)break;
  }
  return rows;
 }

 function patterns(){
  const chosen=$('rehearsalStyle').value;
  const style=chosen==='auto'?clip?.suggested||'roots':chosen;
  const picker=$('rehearsalPattern'),previous=picker.dataset.style===style?picker.value:'';
  picker.dataset.style=style;
  featured=shapes(style);
  if(chosen==='auto'&&clip)featured.sort((a,b)=>C.patternScore(clip.grid,clip.rhythm,b.shape)-C.patternScore(clip.grid,clip.rhythm,a.shape));
  picker.replaceChildren(...featured.map((p,i)=>new Option('Pattern '+(i+1),p.id)));
  picker.add(new Option('Roots','roots'));
  if(chosen!=='auto'&&(previous==='roots'||featured.some(p=>p.id===previous)))picker.value=previous;
  else picker.selectedIndex=0;
 }

 function plan(){
  return C.fit({...clip,shape:featured.find(p=>p.id===$('rehearsalPattern').value)?.shape,
   fill:$('rehearsalFill').value});
 }

 function caption(notes){
  const lead=notes.find(n=>n.role==='fill'),tag=clip?.guideStatus||'';
  const fill=lead?' · Fill at '+fmt(lead.time):$('rehearsalFill').value==='off'?'':' · No clear fill spot';
  $('rehearsalNotes').textContent=tag+fill;
  showNotes(notes);
 }

 const noteName=note=>note.midi===null?'×':window.BassFillCore.note(note.midi);

 function showNotes(notes){
  const score=$('rehearsalScore'),bars=$('rehearsalBars');
  score.hidden=!notes.length;
  bars.replaceChildren();
  if(!notes.length)return;
  const {grid,start,end}=clip;
  const boundaries=grid?grid.points.filter((_,i)=>i%grid.meter===0):[start,end];
  for(let i=0;i<boundaries.length-1;i++){
   const from=boundaries[i],to=boundaries[i+1],row=notes.filter(n=>n.time>=from-.001&&n.time<to-.001);
   const section=document.createElement('section'),title=document.createElement('strong');
   title.textContent=(grid?'Bar '+(i+1)+' · ':'')+fmt(from);
   section.append(title);
   for(const [name,events] of [['Bassline',row.filter(n=>n.role!=='fill')],['Fill',row.filter(n=>n.role==='fill')]]){
    const line=document.createElement('p'),label=document.createElement('span'),pitches=document.createElement('b');
    label.textContent=name;pitches.textContent=events.map(noteName).join('  ·  ')||'—';
    line.append(label,pitches);section.append(line);
   }
   bars.append(section);
  }
  if(notes.some(n=>n.midi===null)){
   const legend=document.createElement('p');
   legend.textContent='× Muted note';
   bars.append(legend);
  }
 }

 function changePattern(){
  if(!clip)return;
  const notes=plan();
  if(playing){playing.pending=notes;state('Pattern changes on the next loop.');}
  else caption(notes);
 }

 function excerpt(source,start,end){
  const rate=source.sampleRate,a=Math.round(start*rate),z=Math.min(source.length,Math.round(end*rate));
  return {sampleRate:rate,duration:(z-a)/rate,length:z-a,numberOfChannels:source.numberOfChannels,
   getChannelData:index=>source.getChannelData(index).subarray(a,z)};
 }

 async function analyse(id){
  const current=api.get(),start=parseTime($('rehearsalStart').value),end=parseTime($('rehearsalEnd').value);
  const bpm=manualBpm;
  if(!current?.buffer||!(start>=0&&end<=current.duration+.006&&end-start>=2&&end-start<=32))
   throw Error('Choose 2 to 32 seconds within the recording.');
  if(bpm&&!(bpm>=40&&bpm<=220))throw Error('Enter a BPM between 40 and 220.');
  const validEnd=Math.min(end,current.duration);
  const rhythm=C.attacks(current.buffer,start,validEnd);
  const grid=C.beatGrid({...current,start,end:validEnd,manualBpm:bpm,rhythm});
  const a=grid?.points[0]??start,z=grid?.points.at(-1)??validEnd;
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
   const ranked=candidates.map(([name])=>({name,score:Math.max(-1,...shapes(name).map(
    row=>C.patternScore(grid,rhythm,row.shape)))+(name===preferred?.15:0)}));
   suggested=ranked.sort((a,b)=>b.score-a.score)[0]?.name||preferred;
  }
  const guideStatus=grid
   ?grid.source+' · '+Math.round(grid.bpm)+' BPM'+(roots.length||chords.some(c=>c.uncertain&&!c.manual)?' · Estimated notes':'')
   :chords.length?'Enter BPM for the full groove.':'Choose a passage with a clearer beat.';
  const quiet=C.quietRanges(current.buffer,a,z);
  return {start:a,end:z,grid,chords,roots,rhythm,quiet,guideStatus,suggested,source:current.buffer,session:current.session,manualBpm:bpm};
 }

 function labelMix(){
  const button=$('rehearsalMix');
  button.setAttribute('aria-pressed',String(noBass));
  button.textContent=noBass?'Original bass off':'Original bass on';
 }

 async function mix(id,revision,remove){
  const current=clip;
  if(!remove)return {source:current.source,offset:current.start,end:current.end};
  const cancelled=()=>id!==work||revision!==mixRevision||current.session!==api.session();
  if(!edited){
   state('Preparing the band without bass…');
   const audio=await api.band(current.start,current.end,value=>{
    if(!cancelled())state('Removing original bass '+value+'%');
   },cancelled);
   if(cancelled())return null;
   edited=audio;
  }
  return {source:edited,offset:0,end:Math.min(edited.duration,current.end-current.start)};
 }

 function startBand(tracks,when,phase=0,replace=false){
  const node=ctx.createBufferSource(),gain=ctx.createGain(),previous=band;
  node.buffer=tracks.source;node.loop=true;
  node.loopStart=tracks.offset;node.loopEnd=tracks.end;
  gain.gain.value=replace?0:.72;
  node.connect(gain).connect(ctx.destination);
  node.start(when,tracks.offset+phase%(tracks.end-tracks.offset));
  band={node,gain};
  if(!replace||!previous)return;
  gain.gain.setValueAtTime(0,when);
  gain.gain.linearRampToValueAtTime(.72,when+.018);
  previous.gain.gain.setValueAtTime(.72,when);
  previous.gain.gain.linearRampToValueAtTime(0,when+.018);
  previous.node.onended=()=>{previous.node.disconnect();previous.gain.disconnect();};
  previous.node.stop(when+.02);
 }

 async function toggleMix(){
  noBass=!noBass;labelMix();
  const revision=++mixRevision,id=work;
  if(!playing)return;
  try{
   const tracks=await mix(id,revision,noBass);
   if(!tracks||id!==work||revision!==mixRevision||!playing)return;
   const when=ctx.currentTime+.035;
   const phase=Math.max(0,when-playing.when)%playing.seconds;
   startBand(tracks,when,phase,true);
   state('');
  }catch{
   if(id!==work||revision!==mixRevision)return;
   noBass=false;labelMix();state('Original bass is still on.');
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
    clip=result;edited=null;patterns();
    $('rehearsalBpm').value=manualBpm||Math.round(clip.grid?.bpm||0)||'';
   }
   let tracks,originalFallback=false;
   try{tracks=await mix(id,mixRevision,noBass);}
   catch(error){
    if(id!==work||currentId!==api.session())return;
    if(!noBass)throw error;
    noBass=false;labelMix();originalFallback=true;
    tracks=await mix(id,mixRevision,false);
   }
   if(id!==work||!tracks||currentId!==api.session())return;
   // Warm all notes before starting so style changes can take effect on the next loop.
   await window.BassPracticeAudio.prepare('bass',ctx,{notes:Array.from({length:37},(_,i)=>({midi:23+i,velocity:85}))});
   if(id!==work||currentId!==api.session())return;
   const notes=plan(),when=ctx.currentTime+.06,seconds=tracks.end-tracks.offset;
   startBand(tracks,when);
   playing={when,seconds,notes,pending:null,cycle:0,index:0};
   setCompact(true);
   $('rehearsalPlay').textContent='Pause';
   state(originalFallback?'Original bass is still on.':$('rehearsalStyle').value==='auto'?'Suggested · '+styleLabel(clip.suggested):'');
   caption(notes);
   schedule();
   clock=setInterval(schedule,40);
   statusTimer=setInterval(display,90);
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
   if(s.index===0&&s.pending){s.notes=s.pending;s.pending=null;caption(s.notes);state('');}
   while(s.index<s.notes.length){
    const note=s.notes[s.index],beat=start+note.time-clip.start;
    if(beat>horizon)return;
    s.index++;
    if(beat<now-.03||$('rehearsalGuide').getAttribute('aria-pressed')!=='true')continue;
    const level=Number($('rehearsalGain').value)/100;
    if(!level)continue;
    const instrument=window.BassPracticeAudio,when=Math.max(now,beat);
    const velocity=(note.role==='root'?86:75)+Math.round(note.accent*15);
    voices.push(note.midi===null?instrument.muted(ctx,when,level):instrument.tone(ctx,note.midi,when,note.stop-note.time,'bass',0,velocity,level));
   }
   s.cycle++;s.index=0;
  }
  if(voices.length>160)voices=voices.slice(-80);
 }

 function display(){
  if(!playing)return;
  const position=clip.start+(Math.max(0,ctx.currentTime-playing.when)%playing.seconds);
  $('rehearsalTime').value=fmt(position)+' / '+fmt(clip.end);
  const current=playing.notes.filter(n=>n.stop>=position).slice(0,4);
  $('rehearsalCue').value=current.map(noteName).join(' · ');
 }

 return {init,refresh,close};
})();
