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
 let host,api,song,clip,edited,ranked=[],ctx,band,clock,statusTimer,voices=[],playing,work=0,loading=false,importing=false,taps=[];
 const $=id=>host.querySelector('#'+id);
 const state=text=>{$('rehearsalStatus').textContent=text;};
 const styleLabel=id=>C.styles.find(([key])=>key===id)?.[1]||'Roots';
 let featured=[];

 function init(panel,hooks){
  host=panel;api=hooks;
  host.innerHTML=`
   <div class="rehearsal-row">
    <button id="rehearsalImport" type="button">Import audio</button>
    <button id="rehearsalLibrary" type="button">Library</button>
   </div>
   <input id="rehearsalFile" type="file" accept="audio/*,.m4a,.mp3,.wav,.flac,.ogg,.aac,.caf" hidden>
   <p id="rehearsalTitle"></p>
   <div id="rehearsalEditor" hidden>
    <label>Passage <select id="rehearsalPassage"></select></label>
    <div class="rehearsal-row rehearsal-times">
     <label>Start <input id="rehearsalStart" type="text" inputmode="decimal"></label>
     <label>End <input id="rehearsalEnd" type="text" inputmode="decimal"></label>
     <label>BPM <input id="rehearsalBpm" type="number" inputmode="numeric" min="40" max="220" placeholder="Auto"></label>
    </div>
    <details class="rehearsal-corrections">
     <summary>Adjust timing or chords</summary>
     <button id="rehearsalTap" type="button">Tap BPM</button>
     <label>Chords · one per bar <input id="rehearsalChords" type="text" placeholder="C G Am F" autocomplete="off"></label>
    </details>
    <div class="rehearsal-row">
     <label>Style <select id="rehearsalStyle"></select></label>
     <label>Pattern <select id="rehearsalPattern"></select></label>
    </div>
    <div class="rehearsal-row">
     <label>Fills <select id="rehearsalFill"><option value="ends">Turnarounds</option><option value="off">Off</option><option value="more">More often</option></select></label>
     <label>Band <select id="rehearsalMix"><option value="full">Original mix</option><option value="noBass">Remove original bass</option></select></label>
    </div>
    <label class="rehearsal-level">Guide bass <input id="rehearsalGain" type="range" min="0" max="100" value="70"><output id="rehearsalGainValue">70%</output></label>
    <div class="rehearsal-row"><button id="rehearsalPlay" type="button">Play loop</button><button id="rehearsalGuide" type="button" aria-pressed="true">Guide on</button></div>
    <output id="rehearsalTime"></output>
    <output id="rehearsalCue"></output>
    <p id="rehearsalNotes"></p>
   </div>
   <p id="rehearsalStatus" role="status"></p>`;
  C.styles.forEach(([id,caption])=>$('rehearsalStyle').add(new Option(caption,id)));
  $('rehearsalImport').onclick=()=>api.pickAudio($('rehearsalFile'),openFile);
  $('rehearsalFile').onchange=e=>{const file=e.target.files[0];e.target.value='';if(file)void openFile(file);};
  $('rehearsalLibrary').onclick=()=>{close();api.openLibrary();};
  $('rehearsalPassage').onchange=()=>applyPassage(ranked[Number($('rehearsalPassage').value)]);
  for(const id of ['rehearsalStart','rehearsalEnd','rehearsalBpm','rehearsalChords']){
   $(id).onchange=()=>{resetClip();$('rehearsalPassage').value='custom';state('Play to check this passage.');};
  }
  $('rehearsalTap').onclick=()=>{
   const now=performance.now();
   if(now-(taps.at(-1)??0)>1800)taps=[];
   taps.push(now);taps=taps.slice(-6);
   if(taps.length<4){state('Tap along to four beats.');return;}
   const bpm=Math.round(60000*(taps.length-1)/(taps.at(-1)-taps[0]));
   if(bpm<40||bpm>220){state('Tap between 40 and 220 BPM.');return;}
   $('rehearsalBpm').value=String(bpm);
   if(playing)state(bpm+' BPM · applies when you play the loop again.');
   else {resetClip();state(bpm+' BPM · set Start on the first beat.');}
  };
  $('rehearsalStyle').onchange=()=>{patterns();changePattern();};
  $('rehearsalPattern').onchange=changePattern;
  $('rehearsalFill').onchange=changePattern;
  $('rehearsalMix').onchange=()=>{stop();state('');};
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
  const best=[...suggestions].sort((a,b)=>Number(!!b.pulse)-Number(!!a.pulse)||b.score-a.score)[0];
  ranked=[...(best?[best]:[]),...fromSection,...suggestions.filter(p=>p!==best)];
  if(!ranked.length)ranked.push({start:0,end:Math.min(song.duration,16),name:'First passage'});
  const picker=$('rehearsalPassage');
  picker.replaceChildren(...ranked.map((p,i)=>new Option((p.name||(i===0?'Suggested passage':'Passage'))+' · '+fmt(p.start),i)));
  picker.add(new Option('Custom','custom'));
  picker.value='0';applyPassage(ranked[0]);
 }

 function applyPassage(p){
  if(!p)return;
  resetClip();
  $('rehearsalStart').value=fmt(p.start);$('rehearsalEnd').value=fmt(p.end);
  $('rehearsalBpm').value='';$('rehearsalChords').value='';taps=[];patterns();state('');
 }

 function stopBass(){
  for(const voice of voices){try{voice.stop();}catch{}}
  voices=[];
 }

 function stop(){
  work++;loading=false;
  clearInterval(clock);clearInterval(statusTimer);stopBass();
  if(band){try{band.stop();}catch{}band.disconnect();band=null;}
  playing=null;
  if(host){$('rehearsalPlay').textContent='Play loop';$('rehearsalTime').value='';$('rehearsalCue').value='';}
 }

 function resetClip(){
  stop();clip=null;edited=null;
  $('rehearsalNotes').textContent='';
 }

 function close(){stop();song=null;clip=null;edited=null;}

 function patterns(){
  const chosen=$('rehearsalStyle').value;
  const style=chosen==='auto'?clip?.suggested||'roots':chosen;
  const P=window.BassPracticeCore,D=window.BassPracticeCatalogue,H=window.BassAccompaniment;
  const picker=$('rehearsalPattern'),previous=picker.dataset.style===style?picker.value:'',used=new Set();
  picker.dataset.style=style;
  featured=[];
  if(style!=='roots')for(const [i,line] of P.lines.entries()){
   if(!D.visible('basslines',line.id)||H.identify(line)!==style)continue;
   const shape=C.pattern(line,P,i),key=shape.map(n=>[n.beat,n.role,n.length].join(':')).join('|');
   if(!shape.length||used.has(key))continue;
   used.add(key);featured.push({id:line.id,name:line.name,shape});
   if(featured.length===12)break;
  }
  picker.replaceChildren(...featured.map((p,i)=>new Option('Pattern '+(i+1),p.id)));
  picker.add(new Option('Roots','roots'));
  if(previous==='roots'||featured.some(p=>p.id===previous))picker.value=previous;
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
  const bpm=Number($('rehearsalBpm').value);
  if(!current?.buffer||!(start>=0&&end<=current.duration+.006&&end-start>=2&&end-start<=32))
   throw Error('Choose 2 to 32 seconds within the recording.');
  if(bpm&&!(bpm>=40&&bpm<=220))throw Error('Enter a BPM between 40 and 220.');
  const validEnd=Math.min(end,current.duration);
  const grid=C.beatGrid({...current,start,end:validEnd,manualBpm:bpm});
  const a=grid?.points[0]??start,z=grid?.points.at(-1)??validEnd;
  const saved=current.chords.filter(c=>c.end>a&&c.start<z);
  const manual=C.barChords($('rehearsalChords').value,grid);
  let chords=manual.length?manual:saved;
  const coverage=saved.reduce((sum,c)=>sum+Math.min(z,c.end)-Math.max(a,c.start),0);
  if(!manual.length&&coverage<(z-a)*.95){
   const local=await window.BassChordRecovery.scan(excerpt(current.buffer,a,z),{
    existing:saved.map(c=>({...c,start:Math.max(0,c.start-a),end:Math.min(z-a,c.end-a)})),
    stillCurrent:()=>id===work&&current.session===api.session()
   });
   chords=saved.concat(local.added.map(c=>({...c,start:c.start+a,end:c.end+a})));
  }
  const suggested=C.suggest(chords,grid);
  const approximate=chords.some(c=>c.uncertain&&!c.manual);
  const guideStatus=!chords.length?'No clear chords here. Try another passage.':!grid?
   'Chord roots only · set BPM and mark the first beat for grooves.':
   (grid.source+' · '+Math.round(grid.bpm)+' BPM'+(approximate?' · Check estimated chords':''));
  const quiet=C.quietRanges(current.buffer,a,z);
  return {start:a,end:z,grid,chords,quiet,guideStatus,suggested,source:current.buffer,session:current.session,manualBpm:bpm};
 }

 async function mix(id){
  if($('rehearsalMix').value==='full')return {source:clip.source,offset:clip.start,end:clip.end};
  if(!edited){
   const current=clip;
   state('Preparing the band without bass…');
   const audio=await api.band(current.start,current.end,value=>{
    if(id===work)state('Removing original bass '+value+'%');
   },()=>id!==work||current.session!==api.session());
   if(id!==work)return null;
   edited=audio;
  }
  return {source:edited,offset:0,end:Math.min(edited.duration,clip.end-clip.start)};
 }

 async function play(){
  if(!song?.buffer)return;
  const id=++work;
  loading=true;$('rehearsalPlay').textContent='Cancel';
  state('Checking chords and timing…');
  try{
   ctx??=new AudioContext();
   await ctx.resume();
   const currentId=song.session;
   if(!clip||Number($('rehearsalBpm').value)!==clip.manualBpm){
    const result=await analyse(id);
    if(id!==work||currentId!==api.session())return;
    clip=result;edited=null;patterns();
   }
   const tracks=await mix(id);
   if(id!==work||!tracks||currentId!==api.session())return;
   // Warm all notes before starting so style changes can take effect on the next loop.
   await window.BassPracticeAudio.prepare('bass',ctx,{notes:Array.from({length:37},(_,i)=>({midi:23+i,velocity:85}))});
   if(id!==work||currentId!==api.session())return;
   const notes=plan(),when=ctx.currentTime+.06,seconds=tracks.end-tracks.offset;
   band=ctx.createBufferSource();band.buffer=tracks.source;band.loop=true;
   band.loopStart=tracks.offset;band.loopEnd=tracks.end;
   const gain=ctx.createGain();gain.gain.value=.72;band.connect(gain).connect(ctx.destination);
   band.start(when,tracks.offset);
   playing={when,seconds,notes,pending:null,cycle:0,index:0};
   $('rehearsalPlay').textContent='Pause';
   state($('rehearsalStyle').value==='auto'?'Suggested style · '+styleLabel(clip.suggested):'');
   caption(notes);
   schedule();
   clock=setInterval(schedule,40);
   statusTimer=setInterval(display,90);
  }catch(error){
   if(id===work){stop();state(($('rehearsalMix').value==='noBass'?'Could not remove the bass. Choose Original mix. ': '')+(error.message||'Could not play this passage.'));}
  }finally{
   if(id===work){loading=false;if(!playing)$('rehearsalPlay').textContent='Play loop';}
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
    if(level)voices.push(window.BassPracticeAudio.tone(ctx,note.midi,Math.max(now,beat),note.stop-note.time,'bass',0,note.role==='root'?92:80,level));
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
  $('rehearsalCue').value=current.map(n=>window.BassFillCore.note(n.midi)).join(' · ');
 }

 return {init,refresh,close};
})();
