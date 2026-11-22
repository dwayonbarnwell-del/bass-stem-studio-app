window.BassFillTrainer=(()=>{
 'use strict';
 const F=window.BassFillCore,P=window.BassPracticeCore,U=window.BassUploadedCore,D=window.BassPracticeCatalogue,C=window.BassCuratedStudies,G=window.BassStudyGroups,R=window.BassRegister,L=window.BassPracticeLoop,B=window.BassSuppliedDrums,N=window.BassStudyDisplay,H=window.BassAccompaniment,$=id=>document.getElementById(id);
 let api,ctx,voices=[],timers=[],token=0,playing=false,repeating=false,backing=true,plan,kind='fills',recordedAudio=null,recordedFrame=0,transport=null,rendered=null,drums=true,drumKit='auto',drumGroove='auto',keyStyle='auto',keySound='auto',drumVolume=.45,keyVolume=.8,tempoIdentity='',nativeTempo=null,harmony=[],revision=0,sessions=[];
 const drumKey='bass-practice-accompaniment-v3';
 // New supplied recordings start in Auto, retaining the previous mixer choices.
 try{const s=JSON.parse(localStorage.getItem(drumKey)||'{}'),old=JSON.parse(localStorage.getItem('bass-practice-accompaniment-v2')||localStorage.getItem('bass-practice-drums-v1')||'{}');if(typeof s.enabled==='boolean')drums=s.enabled;else if(typeof old.enabled==='boolean')drums=old.enabled;if(typeof (s.chords??old.chords)==='boolean')backing=s.chords??old.chords;if(B.genres.some(([id])=>id===s.kit))drumKit=s.kit;if(B.loops.some(x=>x.id===s.groove))drumGroove=s.groove;if(H.profiles[s.style])keyStyle=s.style;if(['piano','electric','organ'].includes(s.sound))keySound=s.sound;if(Number.isFinite(s.volume??old.volume))drumVolume=Math.max(0,Math.min(1,s.volume??old.volume));if(Number.isFinite(s.keyVolume??old.keyVolume))keyVolume=Math.max(0,Math.min(1,s.keyVolume??old.keyVolume));}catch{}
 const saveDrums=()=>{try{localStorage.setItem(drumKey,JSON.stringify({enabled:drums,chords:backing,kit:drumKit,groove:drumGroove,style:keyStyle,sound:keySound,volume:drumVolume,keyVolume}));}catch{}};
 const accompaniment=()=>H.resolve(plan,{kit:drumKit,groove:drumGroove,style:keyStyle,sound:keySound});
 function drumOptions(){const select=$('fillDrumGroove');select.replaceChildren(new Option('Auto · match genre','auto'));for(const row of B.loops.filter(x=>drumKit==='auto'||x.genre===drumKit||(drumKit==='worship'&&['soul','funk'].includes(x.genre))))select.add(new Option(row.title+' · '+Number(row.bpm.toFixed(2))+' BPM'+(row.tempoSource==='estimated'?' ~':''),row.id));select.value=drumGroove;if(!select.value){drumGroove='auto';select.value='auto';}}
 function soundSettings(){if(!plan||plan.kind==='uploaded'&&!plan.recording){$('fillAccompaniment').textContent='';return;}const a=accompaniment(),auto=H.resolve(plan),names={piano:'Grand piano',electric:'Wurlitzer electric piano',organ:'Drawbar organ'};
  for(const [id,text] of [['fillDrumKit',B.genres.find(x=>x[0]===auto.loop.genre)?.[1]||auto.loop.genre],['fillDrumGroove',B.choose(auto.id,drumKit).title],['fillKeyStyle',H.profiles[auto.style].label],['fillKeySound',names[auto.sound]]])$(id).options[0].textContent='Auto · '+text;
  $('fillAccompaniment').textContent='';
 }
 function highlightChord(beat){const active=N.active(harmony,beat);for(const [i,chip] of [...$('fillHarmony').children].entries())chip.setAttribute('aria-current',String(i===active));}
 function harmonyChips(){harmony=N.segments(plan);$('fillHarmony').replaceChildren();$('fillHarmony').hidden=!harmony.length;for(const segment of harmony){const chip=document.createElement('span');chip.className='fill-chord';chip.textContent=segment.label;chip.setAttribute('aria-label','Chord '+segment.label);$('fillHarmony').append(chip);}highlightChord(0);}

 const remembered={fills:C?null:'0',runs:C?null:'0',basslines:'0'},rememberedClips={};
 const groupKey='bass-study-groups-v1',selectedGroups={fills:'gospel',runs:'gospel'};
 try{const saved=JSON.parse(localStorage.getItem(groupKey)||'null'),old=JSON.parse(localStorage.getItem('bass-curated-filters-v1')||'{}');for(const k of ['fills','runs'])selectedGroups[k]=G?.migrate(saved?.[k]||old[k]?.style)||'gospel';}catch{}
 const imported=()=>kind==='basslines'&&$('fillIdea').value.startsWith('clip:');
 const matchesGenre=(c,genre)=>genre==='recordings'||H.category(c,true)===genre;
 function clipOptions(){
  const group=$('fillCollection').value;$('fillClip').replaceChildren();
  for(const c of U.items.filter(c=>matchesGenre(c,group)&&D.visible('uploaded',c.id))){const o=document.createElement('option');o.value=c.id;o.textContent=N.clip(c);o.title=c.title;$('fillClip').append(o);}
  if(rememberedClips[group])$('fillClip').value=rememberedClips[group];
  if(!$('fillClip').value&&$('fillClip').options.length)$('fillClip').selectedIndex=0;partOptions();
 }
 function partOptions(){
  const clip=U.items.find(c=>c.id===$('fillClip').value);$('fillExcerpt').replaceChildren();
  for(const [i,p] of (clip?.parts||[]).entries()){const o=document.createElement('option');o.value=i;o.textContent=(i===0?'Full clip':'Part '+i)+' · '+U.time(p.start)+'–'+U.time(p.end);$('fillExcerpt').append(o);}
  const loop=U.loop(clip?.id);
  if(loop)$('fillExcerpt').add(new Option('Beat loop · '+U.time(loop.start)+'–'+U.time(loop.end),'beat'),1);
  $('fillExcerpt').value=loop?'beat':String(clip?.parts.length>1?1:0);
 }
 function clipControls(){
  const custom=imported();$('earFillStudy').dataset.imported=String(custom);
  $('fillCollection').hidden=kind!=='basslines';
  $('fillClip').hidden=true;for(const id of ['fillExcerpt','fillClipSpeed','fillClipSound'])$(id).hidden=!custom;
  $('fillClipTranspose').hidden=!custom||$('fillClipSound').value!=='notes';
  for(const id of ['fillKey','fillTempoWrap'])$(id).hidden=custom;$('fillIdea').hidden=false;
  $('fillFrom').hidden=kind==='basslines';$('fillTo').hidden=kind==='basslines';
  const hasBeat=custom&&$('fillExcerpt').value==='beat';
  $('fillBacking').hidden=custom;$('fillDrums').hidden=custom&&!hasBeat;$('fillDrumOptions').hidden=custom&&!hasBeat;
  for(const id of ['fillKeyStyle','fillKeySound','fillKeyVolume'])$(id).closest('label').hidden=custom;
  $('fillGroupRow').hidden=!G||kind==='basslines';$('fillCount').hidden=!G||kind==='basslines';
 }
 const collections=()=>kind==='runs'?P.runs:kind==='basslines'?P.lines.map(x=>[D.lineLabel(x),x.tip]):F.styles;
 function patternId(i){return kind==='basslines'?P.lines[i]?.id:collections()[i]?.id||String(i);}
 function loadGroup(){if(!G||kind==='basslines')return;$('fillGroup').value=selectedGroups[kind];}
 function ideaOptions(wanted=remembered[kind]){
  const select=$('fillIdea');select.replaceChildren();const rows=collections().map((s,i)=>({s,i,line:kind==='basslines'?P.lines[i]:null})).filter(({i,line})=>kind==='basslines'?D.visible(kind,patternId(i))&&H.category(line)===$('fillCollection').value:G?G.visible(kind,i)&&G.groupOf(kind,i)===selectedGroups[kind]:D.visible(kind,patternId(i)));
  rows.sort((a,b)=>C&&kind!=='basslines'?C.compare(kind,a.i,b.i):0);let studies;if(kind==='basslines'&&rows.length){studies=document.createElement('optgroup');studies.label='Practice patterns';select.append(studies);}
  for(const {s,i} of rows){const o=document.createElement('option');o.value=i;o.textContent=N.label(kind,kind==='basslines'?P.lines[i]:s);o.title=s[0];(studies||select).append(o);}
  if(kind==='basslines'){const clips=U.items.filter(c=>matchesGenre(c,$('fillCollection').value)&&D.visible('uploaded',c.id));if(clips.length){const group=document.createElement('optgroup');group.label='Recordings';select.append(group);for(const c of clips){const o=document.createElement('option');o.value='clip:'+c.id;o.textContent=N.clip(c);o.title=c.title;group.append(o);}}}
  if([...select.options].some(o=>o.value===String(wanted)))select.value=String(wanted);else if(select.options.length)select.selectedIndex=0;
  if(G&&kind!=='basslines')$('fillCount').textContent=rows.length+' '+(kind==='runs'?'runs':'fills');
 }
 function deletionKey(){return imported()?$('fillClip').value&&['uploaded',$('fillClip').value]:$('fillIdea').value!==''?[kind,patternId(Number($('fillIdea').value))]:null;}
 function refreshDeleted(){ideaOptions($('fillIdea').value);clipOptions();draw();}
 function later(fn,ms){timers.push(setTimeout(fn,ms));}
 function playbackLayout(){
  const study=$('earFillStudy'),value=String(playing);
  if(study.dataset.playing===value)return;
  study.dataset.playing=value;
  if(playing)$('earTrainerDialog').scrollTop=0;
 }
 function state(){ playbackLayout();$('fillPlay').textContent=playing?'Stop':'Play';$('fillPlay').disabled=!plan;$('fillRepeat').disabled=!plan;$('fillNext').disabled=!plan;$('fillDelete').disabled=!deletionKey();$('fillRestore').disabled=!D.deletedCount;$('fillRestore').textContent='Restore deleted'+(D.deletedCount?' ('+D.deletedCount+')':'');$('fillRepeat').setAttribute('aria-pressed',String(repeating));$('fillBacking').textContent=backing?'Chords on':'Chords off';$('fillBacking').setAttribute('aria-pressed',String(backing));$('fillDrums').textContent=drums?'Drums on':'Drums off';$('fillDrums').setAttribute('aria-pressed',String(drums)); }
 function stop(){token++;revision++;for(const session of sessions)session.transport.stop();sessions=[];transport?.stop();transport=null;cancelAnimationFrame(recordedFrame);recordedAudio?.pause();recordedAudio=null;playing=false;repeating=false;timers.forEach(clearTimeout);timers=[];voices.forEach(v=>{try{v.stop();}catch{}});voices=[];if($('fillPlay')){state();for(const e of $('fillNotes').children)e.classList.remove('sounding');}}
 function level(part,value){for(const session of sessions)session.transport.level(part,value);}

 function settings(){return {key:$('fillKey').value,mode:kind==='basslines'?(P.lines[Number($('fillIdea').value)]?.mode||'major'):'major',from:$('fillFrom').value,to:$('fillTo').value,idea:$('fillIdea').value,bpm:nativeTempo??$('fillTempo').value};}
 function draw(){
  if(imported()){
   const id=$('fillIdea').value.slice(5);
   if($('fillClip').value!==id){$('fillClip').value=id;partOptions();}
   clipControls();
   remembered[kind]=$('fillIdea').value;rememberedClips[$('fillCollection').value]=id;
   showPlan(U.plan(id,$('fillExcerpt').value,$('fillClipSpeed').value,$('fillClipSound').value==='notes'?$('fillClipTranspose').value:0));
   return;
  }
  clipControls();if($('fillIdea').value===''){showPlan(null);return;}if($('fillFrom').value===$('fillTo').value)$('fillTo').value=String(Number($('fillFrom').value)%7+1);
  for(const o of $('fillTo').options)o.disabled=o.value===$('fillFrom').value;
  remembered[kind]=$('fillIdea').value;const draft=P.make(kind,settings()),choice=H.resolve(draft,{kit:drumKit,groove:drumGroove}),identity=kind+':'+$('fillIdea').value+':'+choice.loop.id;if(identity!==tempoIdentity){nativeTempo=choice.loop.bpm;$('fillTempo').value=Number(nativeTempo.toFixed(2));tempoIdentity=identity;}$('fillTempo').value=Math.max(40,Math.min(220,Number($('fillTempo').value)||choice.loop.bpm));showPlan(P.make(kind,settings()));
 }
 function showPlan(value){
  rendered=null;plan=value&&!(value.kind==='uploaded'&&$('fillClipSound').value==='recording')?R.plan(value):value;$('fillPlayer').hidden=!plan;$('fillEmpty').hidden=!!plan;state();soundSettings();if(!plan){stop();return;}
  const row=kind==='basslines'?(plan.kind==='uploaded'?U.items.find(c=>c.id===plan.id):P.lines[plan.idea]):collections()[plan.idea];$('fillHeading').textContent=plan.kind==='uploaded'?N.clip(row||U.items.find(c=>c.id===$('fillClip').value)):N.label(kind,row);harmonyChips();
  $('fillStatus').textContent=plan.kind==='uploaded'?(plan.recording?'':plan.check?'Check notes':'Recorded bass'):'';$('fillNotes').replaceChildren();
  plan.bass.forEach((n,i)=>{const b=document.createElement('button');b.type='button';b.textContent=F.note(n.midi);b.title=F.note(n.midi)+(plan.kind==='uploaded'?' · '+U.time(n.sourceTime):' · beat '+(Math.round((n.beat%4+1)*100)/100));if(n.review){b.classList.add('needs-review');b.title+=' · Check note';}b.setAttribute('aria-label','Hear '+F.note(n.midi));b.dataset.index=i;const chord=harmony[N.active(harmony,n.beat)];if(n.role==='landing'||(chord&&(n.midi%12+12)%12===chord.rootPc))b.classList.add('landing');b.onclick=()=>void preview(n);$('fillNotes').append(b);});state();if(playing)void updatePlayback();
 }
 async function preview(n){
  const mine=token;try{ctx??=new AudioContext();await ctx.resume();await window.BassPracticeAudio.prepare('bass',ctx,{notes:[n]});if(mine!==token)return;voices.push(window.BassPracticeAudio.tone(ctx,n.midi,ctx.currentTime,.65,'bass',0,85,.8));}catch{$('fillStatus').textContent='Sound unavailable';}
 }
 async function play(){
  if(!plan)return;if(playing){stop();$('fillStatus').textContent='Stopped';return;}
  if(api?.busy?.()){$('fillStatus').textContent='Finish recording first';return;}
  playing=true;repeating=true;state();api?.pause?.();await updatePlayback();
 }
 async function updatePlayback(){
  if(!playing||!plan)return;
  const mine=token,request=++revision,current=plan,choices=accompaniment(),recorded=$('fillClipSound').value==='recording';
  $('fillStatus').textContent=transport?'Changing…':'Loading…';
  try{
   if(current.kind==='uploaded'&&!current.recording&&(recorded||current.beats*60/current.bpm>240)){
    // Preserve streamed long lessons without adding an unverified drum grid.
    if(recorded){await playRecording(mine,request,current);return;}
    await playUploadedNotes(mine,request,current);return;
   }
   ctx??=new AudioContext();await ctx.resume();
   const audio=await L.render(ctx,current,{drums:current.kind!=='uploaded'||!!current.recording,...choices,chords:current.kind!=='uploaded',recorded:recorded&&!!current.recording,cancelled:()=>mine!==token||request!==revision});
   if(mine!==token||request!==revision||!audio||!$('earTrainerDialog').open)return;
   const previous=transport,bar=previous?previous.beatSeconds*4:0;
   const when=previous?previous.when+Math.max(1,Math.ceil((ctx.currentTime+.12-previous.when)/bar))*bar:ctx.currentTime+.08;
   rendered=audio;
   const next=L.start(ctx,audio,{when,repeat:true,fadeIn:previous?.006:0,drums:drums?drumVolume:0,chords:backing?keyVolume:0});
   previous?.stopAt(when,.006);transport=next;
   sessions.push({transport:next,plan:current,rendered:audio});
   const previousRecording=recordedAudio;if(previousRecording){previousRecording.pause();recordedAudio=null;}
   for(const voice of voices)try{voice.stop();}catch{}voices=[];
   cancelAnimationFrame(recordedFrame);
   const tick=()=>{
    if(mine!==token||!playing)return;
    const active=sessions.filter(s=>s.transport.when<=ctx.currentTime).at(-1);
    if(active){
     sessions=sessions.filter(s=>s===active||s.transport.when>ctx.currentTime);
     const elapsed=active.transport.position()-(window.BassPlaybackTiming?.outputDelay(ctx)||0);
     const beat=(((elapsed%active.rendered.seconds)+active.rendered.seconds)%active.rendered.seconds)/active.rendered.beatSeconds;
     if(active.plan===plan){highlightChord(beat);$('fillStatus').textContent=plan.kind==='uploaded'?(plan.recording?'Beat loop · '+Number(active.plan.bpm.toFixed(1))+' BPM':'Note playback'):'Playing · '+Number(active.plan.bpm.toFixed(2))+' BPM';
      for(const [i,n] of active.plan.bass.entries())$('fillNotes').children[i]?.classList.toggle('sounding',elapsed>=0&&beat>=n.beat&&beat<n.beat+n.length);
     }else for(const e of $('fillNotes').children)e.classList.remove('sounding');
    }
    recordedFrame=requestAnimationFrame(tick);
   };recordedFrame=requestAnimationFrame(tick);
  }catch(error){if(mine===token&&request===revision){if(!transport&&!recordedAudio)stop();$('fillStatus').textContent=transport||recordedAudio?'Change unavailable. Loop continues.':current.recording&&recorded?'Beat loop unavailable. Try Note playback.':'Sound unavailable';}}
 }

 async function playUploadedNotes(mine,request,current){
  // Recorded lessons can exceed twenty minutes. Schedule their notes directly
  // instead of allocating a full uncompressed audio buffer on the phone.
  ctx??=new AudioContext();await ctx.resume();const A=window.BassPracticeAudio;
  await A.prepare('bass',ctx,{notes:current.bass});if(mine!==token||request!==revision||!$('earTrainerDialog').open)return;for(const s of sessions)s.transport.stop();sessions=[];transport=null;recordedAudio?.pause();recordedAudio=null;voices.forEach(v=>{try{v.stop();}catch{}});voices=[];cancelAnimationFrame(recordedFrame);
  const beat=60/current.bpm,duration=current.beats*beat,start=ctx.currentTime+.08,delay=window.BassPlaybackTiming?.outputDelay(ctx)||0;
  let scheduled=0,batches=[];
  function cycle(at,skip=0){batches=batches.filter(b=>b.end>ctx.currentTime);batches.push({end:at+duration+.1,voices:current.bass.filter(n=>(n.beat+n.length)*beat>skip).map(n=>A.tone(ctx,n.midi,at+Math.max(n.beat*beat,skip),n.length*beat,'bass',Math.max(0,skip-n.beat*beat),n.velocity,.72))});voices=batches.flatMap(b=>b.voices);}
  cycle(start);$('fillStatus').textContent='Playing · '+current.status;
  const tick=()=>{if(mine!==token)return;const now=ctx.currentTime,elapsed=now-start,next=start+(scheduled+1)*duration;
   if(repeating&&now>=next-.5){if(now>next-.02){scheduled=Math.floor(elapsed/duration);cycle(start+scheduled*duration,elapsed-scheduled*duration);}else{cycle(next);scheduled++;}}
   if(!repeating&&elapsed>=duration+delay){stop();$('fillStatus').textContent='Play it again';return;}
   const position=((Math.max(0,elapsed-delay)%duration)/beat);
   for(const [i,n] of current.bass.entries())$('fillNotes').children[i]?.classList.toggle('sounding',elapsed>=delay&&position>=n.beat&&position<n.beat+n.length);
   recordedFrame=requestAnimationFrame(tick);
  };recordedFrame=requestAnimationFrame(tick);
 }
 async function playRecording(mine,request,current){
  const previous=recordedAudio,audio=new Audio();audio.preload='auto';audio.preservesPitch=true;audio.playbackRate=current.speed/100;
  await new Promise((resolve,reject)=>{audio.onloadedmetadata=resolve;audio.onerror=()=>reject(new Error('Recording unavailable'));audio.src=current.audio;audio.load();});
  if(mine!==token||request!==revision||!$('earTrainerDialog').open)return;audio.currentTime=current.sourceStart;await audio.play();
  if(mine!==token||request!==revision){audio.pause();return;}previous?.pause();recordedAudio=audio;for(const s of sessions)s.transport.stop();sessions=[];transport=null;voices.forEach(v=>{try{v.stop();}catch{}});voices=[];cancelAnimationFrame(recordedFrame);audio.onerror=()=>{if(mine===token){stop();$('fillStatus').textContent='Recording unavailable';}};$('fillStatus').textContent='Recorded bass · '+current.status;
  const tick=()=>{
   if(mine!==token||!$('earTrainerDialog').open){audio.pause();return;}
   const position=audio.currentTime-current.sourceStart;
   for(const [i,n] of current.bass.entries()){
    const e=$('fillNotes').children[i],active=position>=n.beat&&position<n.beat+n.length;if(!e)continue;e.classList.toggle('sounding',active);
    if(active){const list=$('fillNotes');if(e.offsetTop<list.scrollTop||e.offsetTop+e.offsetHeight>list.scrollTop+list.clientHeight)list.scrollTop=e.offsetTop;}
   }
   if(audio.ended||audio.currentTime>=current.sourceEnd-.012){audio.currentTime=current.sourceStart;void audio.play().catch(()=>{if(mine===token){stop();$('fillStatus').textContent='Tap Play';}});}
   recordedFrame=requestAnimationFrame(tick);
  };recordedFrame=requestAnimationFrame(tick);
 }
 function init(panel,hooks){
  api=hooks;panel.innerHTML=`<div id="fillGroupRow" class="fill-settings"><select id="fillGroup" aria-label="Run or fill group"></select></div><p id="fillCount" role="status"></p><div id="fillSettings" class="fill-settings">
  <select id="fillCollection" aria-label="Bassline genre" hidden></select>
  <select id="fillClip" aria-label="Uploaded bassline" hidden></select><select id="fillExcerpt" aria-label="Clip section" hidden></select>
  <select id="fillClipSpeed" aria-label="Clip speed" hidden><option value="25">25% speed</option><option value="50">50% speed</option><option value="75">75% speed</option><option value="100" selected>Original speed</option><option value="125">125% speed</option></select>
  <select id="fillClipSound" aria-label="Clip sound" hidden><option value="recording">Recorded bass</option><option value="notes">Note playback</option></select>
  <select id="fillClipTranspose" aria-label="Clip transpose" hidden></select>
  <select id="fillIdea" aria-label="Run or fill pattern"></select>
  <select id="fillFrom" aria-label="From degree"></select><select id="fillTo" aria-label="To degree"></select>
  <select id="fillKey" aria-label="Fill key"></select><label id="fillTempoWrap" class="fill-tempo">BPM<input id="fillTempo" aria-label="Practice tempo BPM" type="number" min="40" max="220" step="0.01"><button id="fillTempoReset" type="button" title="Use the original drum loop tempo">Reset</button></label>
  </div>
  <p id="fillEmpty" hidden>No patterns in this group. Choose another group or restore deleted patterns.</p><div id="fillPlayer"><div class="fill-actions"><button id="fillPlay" type="button">Play</button><button id="fillRepeat" type="button" aria-pressed="false">Repeat</button><button id="fillNext" type="button">Next</button><button id="fillBacking" type="button" aria-pressed="true">Chords on</button><button id="fillDrums" type="button" aria-pressed="true">Drums on</button></div><p id="fillAccompaniment"></p><details id="fillDrumOptions"><summary>Band</summary><div class="fill-settings"><label class="fill-band-choice">Drum genre<select id="fillDrumKit" aria-label="Drum genre"></select></label><label class="fill-band-choice">Drum loop<select id="fillDrumGroove" aria-label="Drum loop"></select></label><label class="fill-band-choice">Keyboard style<select id="fillKeyStyle" aria-label="Keyboard style"></select></label><label class="fill-band-choice">Keyboard sound<select id="fillKeySound" aria-label="Keyboard sound"></select></label><label class="fill-drum-volume">Drum volume <input id="fillDrumVolume" type="range" min="0" max="100" step="1" value="45"><output id="fillDrumLevel">45%</output></label><label class="fill-drum-volume">Keys volume <input id="fillKeyVolume" type="range" min="0" max="100" step="1" value="80"><output id="fillKeyLevel">80%</output></label><button id="fillGenreReset" type="button">Reset band</button></div></details><h3 id="fillHeading"></h3><p id="fillHarmony" hidden></p>

  <div id="fillNotes" aria-label="Bass fill notes"></div><p id="fillStatus" role="status"></p></div><div class="my-fill-actions"><button id="fillDelete" type="button">Delete pattern</button><button id="fillRestore" type="button">Restore deleted</button></div><p id="fillManageStatus" role="status"></p>`;
  function option(id,value,label){const o=document.createElement('option');o.value=value;o.textContent=label;$(id).append(o);}
  for(const id of ['fillDrumKit','fillDrumGroove','fillKeyStyle','fillKeySound'])option(id,'auto','Auto · match genre');
  for(const [id,label] of B.genres)option('fillDrumKit',id,label);drumOptions();for(const [id,p] of Object.entries(H.profiles))option('fillKeyStyle',id,'Keys: '+p.label);for(const [id,label] of [['piano','Grand piano'],['electric','Wurlitzer electric piano'],['organ','Drawbar organ']])option('fillKeySound',id,label);
  $('fillDrumKit').value=drumKit;$('fillDrumGroove').value=drumGroove;$('fillKeyStyle').value=keyStyle;$('fillKeySound').value=keySound;$('fillDrumVolume').value=Math.round(drumVolume*100);$('fillDrumLevel').textContent=Math.round(drumVolume*100)+'%';$('fillKeyVolume').value=Math.round(keyVolume*100);$('fillKeyLevel').textContent=Math.round(keyVolume*100)+'%';
  const changeSound=event=>{drumKit=$('fillDrumKit').value;if(event?.target.id==='fillDrumKit'){drumGroove='auto';drumOptions();}else drumGroove=$('fillDrumGroove').value;keyStyle=$('fillKeyStyle').value;keySound=$('fillKeySound').value;saveDrums();draw();};
  for(const id of ['fillDrumKit','fillDrumGroove','fillKeyStyle','fillKeySound'])$(id).onchange=changeSound;
  $('fillGenreReset').onclick=()=>{drumKit=drumGroove=keyStyle=keySound='auto';for(const id of ['fillDrumKit','fillKeyStyle','fillKeySound'])$(id).value='auto';drumOptions();tempoIdentity='';changeSound();};
  $('fillTempoReset').onclick=()=>{tempoIdentity='';draw();};
  $('fillKeyVolume').oninput=()=>{keyVolume=Number($('fillKeyVolume').value)/100;$('fillKeyLevel').textContent=Math.round(keyVolume*100)+'%';level('chords',backing?keyVolume:0);saveDrums();};
  $('fillDrumVolume').oninput=()=>{drumVolume=Number($('fillDrumVolume').value)/100;$('fillDrumLevel').textContent=Math.round(drumVolume*100)+'%';level('drums',drums?drumVolume:0);saveDrums();};
  $('fillDrums').onclick=()=>{drums=!drums;saveDrums();level('drums',drums?drumVolume:0);state();};
  if(G){for(const [id,label] of G.groups)option('fillGroup',id,label);loadGroup();$('fillGroup').onchange=()=>{selectedGroups[kind]=$('fillGroup').value;try{localStorage.setItem(groupKey,JSON.stringify(selectedGroups));}catch{}ideaOptions();draw();};}
  for(const [id,label] of H.groups)option('fillCollection',id,label);
  option('fillCollection','recordings','All recordings');
  for(let i=-12;i<=12;i++)option('fillClipTranspose',i,i===0?'Original key':(i>0?'+':'')+i+' semitone'+(Math.abs(i)===1?'':'s'));$('fillClipTranspose').value='0';clipOptions();
  $('fillCollection').onchange=()=>{clipOptions();ideaOptions();draw();};$('fillClip').onchange=()=>{partOptions();draw();};
  for(const id of ['fillExcerpt','fillClipSpeed','fillClipTranspose','fillClipSound'])$(id).onchange=draw;
  for(let i=1;i<=7;i++){option('fillFrom',i,'From: '+i);option('fillTo',i,'To: '+i);} $('fillTo').value='4';
  F.names.forEach((n,i)=>option('fillKey',i,'Key: '+n));F.styles.forEach((s,i)=>option('fillIdea',i,(i+1)+'. '+s[0]));$('fillTempo').value='80';
  for(const id of ['fillFrom','fillTo','fillKey','fillIdea'])$(id).onchange=draw;$('fillTempo').onchange=()=>{nativeTempo=null;draw();};
  $('fillPlay').onclick=()=>void play();$('fillRepeat').onclick=()=>{if(playing){stop();$('fillStatus').textContent='Stopped';}else void play();};
  $('fillNext').onclick=()=>{const active=playing;if(imported()){$('fillExcerpt').selectedIndex=$('fillExcerpt').options.length>1?($('fillExcerpt').selectedIndex>=$('fillExcerpt').options.length-1?1:$('fillExcerpt').selectedIndex+1):0;}else $('fillIdea').selectedIndex=($('fillIdea').selectedIndex+1)%$('fillIdea').options.length;draw();if(!active)void play();};

  $('fillBacking').onclick=()=>{backing=!backing;saveDrums();level('chords',backing?keyVolume:0);state();};
  $('fillDelete').onclick=()=>{const id=deletionKey();if(!id)return;try{D.remove(...id);refreshDeleted();$('fillManageStatus').textContent='Pattern deleted';}catch{$('fillManageStatus').textContent='Could not save deletion.';}};
  $('fillRestore').onclick=()=>{try{D.restore();refreshDeleted();$('fillManageStatus').textContent='Patterns restored';}catch{$('fillManageStatus').textContent='Could not restore patterns.';}};
  window.addEventListener('pagehide',stop);ideaOptions();draw();
 }
 function setKind(next){
  kind=['fills','runs','basslines'].includes(next)?next:'fills';if(kind==='basslines')clipOptions();$('fillSettings').hidden=false;$('fillNext').hidden=false;loadGroup();ideaOptions();draw();
 }
 return {init,stop,setKind};
})();
