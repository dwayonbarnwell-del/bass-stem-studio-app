window.BassFillTrainer=(()=>{
 'use strict';
 const F=window.BassFillCore,P=window.BassPracticeCore,U=window.BassUploadedCore,D=window.BassPracticeCatalogue,C=window.BassCuratedStudies,G=window.BassStudyGroups,R=window.BassRegister,L=window.BassPracticeLoop,B=window.BassSuppliedDrums,N=window.BassStudyDisplay,H=window.BassAccompaniment,$=id=>document.getElementById(id);
 let api,ctx,voices=[],timers=[],token=0,playing=false,repeating=false,backing=true,plan,kind='fills',recordedAudio=null,recordedFrame=0,transport=null,rendered=null,drums=true,drumKit='auto',drumGroove='auto',keyStyle='auto',keySound='auto',drumVolume=.45,keyVolume=.8,tempoIdentity='',nativeTempo=null,harmony=[],revision=0,sessions=[];
 let sounding=[],clearStreamBand=null,streamMedia=null,streamPlan=null,tempoTimer=0,harmonyPage=-1;
 const drumKey='bass-practice-accompaniment-v3';
 // New supplied recordings start in Auto, retaining the previous mixer choices.
 try{const s=JSON.parse(localStorage.getItem(drumKey)||'{}'),old=JSON.parse(localStorage.getItem('bass-practice-accompaniment-v2')||localStorage.getItem('bass-practice-drums-v1')||'{}');if(typeof s.enabled==='boolean')drums=s.enabled;else if(typeof old.enabled==='boolean')drums=old.enabled;if(typeof (s.chords??old.chords)==='boolean')backing=s.chords??old.chords;if(B.genres.some(([id])=>id===s.kit))drumKit=s.kit;if(B.loops.some(x=>x.id===s.groove))drumGroove=s.groove;if(H.profiles[s.style])keyStyle=s.style;if(['piano','electric','organ'].includes(s.sound))keySound=s.sound;if(Number.isFinite(s.volume??old.volume))drumVolume=Math.max(0,Math.min(1,s.volume??old.volume));if(Number.isFinite(s.keyVolume??old.keyVolume))keyVolume=Math.max(0,Math.min(1,s.keyVolume??old.keyVolume));}catch{}
 const saveDrums=()=>{try{localStorage.setItem(drumKey,JSON.stringify({enabled:drums,chords:backing,kit:drumKit,groove:drumGroove,style:keyStyle,sound:keySound,volume:drumVolume,keyVolume}));}catch{}};
 const accompaniment=()=>H.resolve(plan,{kit:drumKit,groove:drumGroove,style:keyStyle,sound:keySound});
 function drumOptions(){const select=$('fillDrumGroove');select.replaceChildren(new Option('Auto · match genre','auto'));for(const row of B.loops.filter(x=>drumKit==='auto'||x.genre===drumKit||(drumKit==='worship'&&['soul','funk'].includes(x.genre))))select.add(new Option(row.title+' · '+Number(row.bpm.toFixed(2))+' BPM'+(row.tempoSource==='estimated'?' ~':''),row.id));select.value=drumGroove;if(!select.value){drumGroove='auto';select.value='auto';}}
 function soundSettings(){if(!plan){$('fillAccompaniment').textContent='';return;}const a=accompaniment(),auto=H.resolve(plan),names={piano:'Grand piano',electric:'Wurlitzer electric piano',organ:'Drawbar organ'};
  for(const [id,text] of [['fillDrumKit',B.genres.find(x=>x[0]===auto.loop.genre)?.[1]||auto.loop.genre],['fillDrumGroove',(drumKit==='auto'?auto.loop:B.choose(auto.id,drumKit)).title],['fillKeyStyle',H.profiles[auto.style].label],['fillKeySound',names[auto.sound]]])$(id).options[0].textContent='Auto · '+text;
  $('fillAccompaniment').textContent='';
 }
 function highlightChord(beat){
  const active=N.active(harmony,beat),list=$('fillHarmony');
  const page=plan?.kind==='uploaded'?Math.max(0,Math.floor(active/4)*4):0;
  if(page!==harmonyPage){
   harmonyPage=page;list.replaceChildren();
   const shown=plan?.kind==='uploaded'?harmony.slice(page,page+4):harmony;
   for(const segment of shown){
    const chip=document.createElement('span');chip.className='fill-chord';chip.textContent=segment.label;
    chip.setAttribute('aria-label','Chord '+segment.label);list.append(chip);
   }
  }
  for(const [i,chip] of [...list.children].entries())chip.setAttribute('aria-current',String(page+i===active));
 }
 function harmonyChips(){
  harmony=N.segments(plan);harmonyPage=-1;$('fillHarmony').hidden=!harmony.length;
  $('fillHarmony').title=plan?.kind==='uploaded'?'Suggested chords from the recorded bass':'';
  highlightChord(0);
 }

 const remembered={fills:C?null:'0',runs:C?null:'0',basslines:'0'},rememberedClips={};
 const groupKey='bass-study-groups-v1',selectedGroups={fills:'gospel',runs:'gospel'};
 try{const saved=JSON.parse(localStorage.getItem(groupKey)||'null'),old=JSON.parse(localStorage.getItem('bass-curated-filters-v1')||'{}');for(const k of ['fills','runs'])selectedGroups[k]=G?.migrate(saved?.[k]||old[k]?.style)||'gospel';}catch{}
 const imported=()=>kind==='basslines'&&$('fillIdea').value.startsWith('clip:');
 const matchesGenre=(c,genre)=>H.category(c,true)===genre;
 function clipOptions(){
  const group=$('fillCollection').value;$('fillClip').replaceChildren();
  for(const c of U.items.filter(c=>matchesGenre(c,group)&&D.visible('uploaded',c.id))){const o=document.createElement('option');o.value=c.id;o.textContent=N.clip(c);o.title=c.title;$('fillClip').append(o);}
  if(rememberedClips[group])$('fillClip').value=rememberedClips[group];
  if(!$('fillClip').value&&$('fillClip').options.length)$('fillClip').selectedIndex=0;partOptions();
 }
 function partOptions(){
  const clip=U.items.find(c=>c.id===$('fillClip').value);$('fillExcerpt').replaceChildren();
  for(const [i,p] of (clip?.parts||[]).entries()){const o=document.createElement('option');o.value=i;o.textContent=(i===0?'Full song':'Part '+i)+' · '+U.time(p.start)+'–'+U.time(p.end);$('fillExcerpt').append(o);}
  const loop=U.loop(clip?.id);
  if(loop)$('fillExcerpt').add(new Option('Beat loop · '+U.time(loop.start)+'–'+U.time(loop.end),'beat'),1);
  $('fillExcerpt').value='0';
 }
 function clipControls(){
  const custom=imported();$('earFillStudy').dataset.imported=String(custom);
  $('fillCollection').hidden=kind!=='basslines';
  $('fillClip').hidden=true;$('fillExcerpt').hidden=!custom;
  $('fillKey').hidden=custom;$('fillRecordedKey').hidden=!custom;
  $('fillFrom').hidden=kind==='basslines';$('fillTo').hidden=kind==='basslines';
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
 function stop(){clearStreamBand?.();token++;revision++;for(const session of sessions)session.transport.stop();sessions=[];transport?.stop();transport=null;cancelAnimationFrame(recordedFrame);recordedAudio?.pause();recordedAudio=null;playing=false;repeating=false;timers.forEach(clearTimeout);timers=[];voices.forEach(v=>{try{v.stop();}catch{}});voices=[];if($('fillPlay')){state();highlightNotes([],0,false);}}
 function highlightNotes(notes,beat,audible){
  const list=$('fillNotes');
  const active=[];
  if(audible){
   for(const [i,n] of notes.entries()){
    if(beat>=n.beat&&beat<n.beat+n.length&&list.children[i])active.push(list.children[i]);
   }
  }
  for(const button of sounding)if(!active.includes(button))button.classList.remove('sounding');
  for(const button of active)if(!sounding.includes(button))button.classList.add('sounding');
  sounding=active;
  const current=active.at(-1);
  if(current&&list.scrollHeight>list.clientHeight){
   const top=current.offsetTop,bottom=top+current.offsetHeight;
   if(top<list.scrollTop||bottom>list.scrollTop+list.clientHeight)list.scrollTop=top;
  }
 }
 function level(part,value){for(const session of sessions)session.transport.level(part,value);}

 function settings(){return {key:$('fillKey').value,mode:kind==='basslines'?(P.lines[Number($('fillIdea').value)]?.mode||'major'):'major',from:$('fillFrom').value,to:$('fillTo').value,idea:$('fillIdea').value,bpm:nativeTempo??$('fillTempo').value};}
 function draw(){
  if(imported()){
   const id=$('fillIdea').value.slice(5);
   if($('fillClip').value!==id){$('fillClip').value=id;partOptions();}
   clipControls();
   remembered[kind]=$('fillIdea').value;rememberedClips[$('fillCollection').value]=id;
   const identity='recording:'+id+':'+$('fillExcerpt').value;
   const value=U.practicePlan(id,$('fillExcerpt').value,identity===tempoIdentity?Number($('fillTempo').value):null);
   tempoIdentity=identity;nativeTempo=null;$('fillTempo').value=Number(value.bpm.toFixed(2));
   $('fillRecordedKey').textContent='Key: '+F.names[value.tonic]+(value.minor?' minor':' major')+' (est.)';
   const selected=$('fillIdea').selectedOptions[0];
   const progression=value.degrees.slice(0,4).join('–')+(value.degrees.length>4?'…':'');
   selected.textContent=N.clip(U.items.find(c=>c.id===id))+' '+progression;
   showPlan(value);
   return;
  }
  clipControls();if($('fillIdea').value===''){showPlan(null);return;}if($('fillFrom').value===$('fillTo').value)$('fillTo').value=String(Number($('fillFrom').value)%7+1);
  for(const o of $('fillTo').options)o.disabled=o.value===$('fillFrom').value;
  remembered[kind]=$('fillIdea').value;const draft=P.make(kind,settings()),choice=H.resolve(draft,{kit:drumKit,groove:drumGroove}),identity=kind+':'+$('fillIdea').value+':'+choice.loop.id;if(identity!==tempoIdentity){nativeTempo=choice.id==='reggae'&&drumKit==='auto'&&drumGroove==='auto'?77:choice.loop.bpm;$('fillTempo').value=Number(nativeTempo.toFixed(2));tempoIdentity=identity;}$('fillTempo').value=Math.max(40,Math.min(220,Number($('fillTempo').value)||choice.loop.bpm));showPlan(P.make(kind,settings()));
 }
 function showPlan(value){
  rendered=null;plan=value&&value.kind!=='uploaded'?R.plan(value):value;$('fillPlayer').hidden=!plan;$('fillEmpty').hidden=!!plan;state();soundSettings();if(!plan){stop();return;}
  const row=kind==='basslines'?(plan.kind==='uploaded'?U.items.find(c=>c.id===plan.clipId):P.lines[plan.idea]):collections()[plan.idea];$('fillHeading').textContent=plan.kind==='uploaded'?N.clip(row||U.items.find(c=>c.id===$('fillClip').value)):N.label(kind,row);harmonyChips();
  $('fillStatus').textContent=plan.kind==='uploaded'?('Suggested chords'):'';$('fillNotes').replaceChildren();
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
  const mine=token,request=++revision,current=plan,choices=accompaniment();
  $('fillStatus').textContent=transport?'Changing…':'Loading…';
  try{
   if(current.kind==='uploaded'&&!current.recording){
    await playRecording(mine,request,current,choices);return;
   }
   ctx??=new AudioContext();await ctx.resume();
   let audio;
   try{audio=rendered||await L.render(ctx,current,{...choices,recorded:!!current.recording,cancelled:()=>mine!==token||request!==revision});}
   catch(error){if(!current.recording)throw error;if(mine===token&&request===revision)await playRecording(mine,request,current,choices);return;}
   if(mine!==token||request!==revision||!audio||!$('earTrainerDialog').open)return;
   const previous=transport,oldPlan=sessions.at(-1)?.plan;
   const same=oldPlan&&oldPlan.kind===current.kind&&oldPlan.idea===current.idea&&oldPlan.clipId===current.clipId&&oldPlan.part===current.part;
   const tempoChanged=same&&oldPlan.bpm!==current.bpm;
   const quantum=tempoChanged?1:4;
   const priorOffset=previous?.offsetBeats||0;
   const nextBeat=previous?Math.ceil((priorOffset+Math.max(0,ctx.currentTime+.12-previous.when)/previous.beatSeconds)/quantum)*quantum:0;
   const when=previous?previous.when+(nextBeat-priorOffset)*previous.beatSeconds:ctx.currentTime+.08;
   rendered=audio;
   const offsetBeats=previous&&same?nextBeat:0;
   const next=L.start(ctx,audio,{when,offsetBeats,drumPhase:current.recording?current.phase:0,repeat:true,fadeIn:previous?.006:0,drums:drums?drumVolume:0,chords:backing?keyVolume:0});
   previous?.stopAt(when,.006);transport=next;
   sessions.push({transport:next,plan:current,rendered:audio});
   clearStreamBand?.();const previousRecording=recordedAudio;if(previousRecording){previousRecording.pause();recordedAudio=null;}
   for(const voice of voices)try{voice.stop();}catch{}voices=[];
   cancelAnimationFrame(recordedFrame);
   const tick=()=>{
    if(mine!==token||!playing)return;
    const active=sessions.filter(s=>s.transport.when<=ctx.currentTime).at(-1);
    if(active){
     sessions=sessions.filter(s=>s===active||s.transport.when>ctx.currentTime);
     const elapsed=active.transport.position()-(window.BassPlaybackTiming?.outputDelay(ctx)||0);
     const beat=(((elapsed%active.rendered.seconds)+active.rendered.seconds)%active.rendered.seconds)/active.rendered.beatSeconds;
     if(active.plan===plan){highlightChord(beat);$('fillStatus').textContent=plan.kind==='uploaded'?(plan.recording?'Suggested chords · '+Number(active.plan.bpm.toFixed(2))+' BPM':'Note playback'):'Playing · '+Number(active.plan.bpm.toFixed(2))+' BPM';
      highlightNotes(active.plan.bass,beat,elapsed>=0);
     }else highlightNotes([],0,false);
    }
    recordedFrame=requestAnimationFrame(tick);
   };recordedFrame=requestAnimationFrame(tick);
  }catch(error){if(mine===token&&request===revision){if(!transport&&!recordedAudio)stop();$('fillStatus').textContent=transport||recordedAudio?'Change unavailable. Loop continues.':'Sound unavailable';}}
 }

 async function playRecording(mine,request,current,choices){
  ctx??=new AudioContext();await ctx.resume();
  const stale=()=>mine!==token||request!==revision||!$('earTrainerDialog').open;
  const continuing=recordedAudio&&streamPlan?.clipId===current.clipId&&streamPlan?.part===current.part;
  const audio=continuing?recordedAudio:new Audio(),beat=60/current.bpm,keys=H.arrange(current,choices.style);
  const K=window.BassPracticeKeys;
  let metadata,media=continuing?streamMedia:null,drumBuffer;
  if(!continuing){
   audio.preload='auto';audio.preservesPitch=true;
   metadata=new Promise((resolve,reject)=>{
    audio.onloadedmetadata=resolve;audio.onerror=()=>reject(Error('Recording unavailable'));
    audio.src=current.audio;audio.load();
   });
  }
  try{
   [drumBuffer]=await Promise.all([B.render(ctx,choices.loop,Math.round(ctx.sampleRate*beat),stale),metadata,keys.length?K.prepare(ctx,choices.sound,keys):null]);
   if(stale()||!drumBuffer){if(!continuing)audio.pause();return;}
   // load() resets playbackRate. Apply both rates after loading and keep the
   // original playhead when changing speed, keyboard or drums during a passage.
   audio.defaultPlaybackRate=current.speed/100;audio.playbackRate=current.speed/100;
   if(!continuing){
    audio.currentTime=current.sourceStart;audio.muted=true;
    media=ctx.createMediaElementSource(audio);media.connect(ctx.destination);
    await audio.play();
   }
  }catch(error){if(!continuing){audio.pause();media?.disconnect();}throw error;}
  if(stale()){if(!continuing){audio.pause();media?.disconnect();}return;}
  if(!continuing)recordedAudio?.pause();
  for(const s of sessions)s.transport.stop();sessions=[];transport=null;clearStreamBand?.(!!continuing);
  streamMedia=media;audio.muted=false;
  recordedAudio=audio;streamPlan=current;cancelAnimationFrame(recordedFrame);
  const gain=ctx.createGain();gain.connect(ctx.destination);
  let source=null,origin=0,keyIndex=0,liveKeys=[];
  const drumBeat=drumBuffer.duration/choices.loop.beats;
  const spans=current.pulseSpans;
  function stopBand(){
   if(source){source.stop();source.disconnect();source=null;}
   liveKeys.forEach(v=>v.voice.stop());liveKeys=[];
  }
  function sync(pos,now){
   stopBand();origin=now-pos*beat;
   const idx=spans.findIndex(s=>s.end>pos);
   if(idx<0)return;
   const span=spans[idx],pulse=span.pulse+(pos-span.start)/span.scale;
   source=ctx.createBufferSource();source.buffer=drumBuffer;source.loop=true;source.connect(gain);
   // One continuously running drum voice. The audio clock changes rate at
   // each measured boundary without cutting a cymbal or restarting bar one.
   source.playbackRate.setValueAtTime(drumBeat/(beat*span.scale),now);
   for(let i=idx+1;i<spans.length;i++){
    source.playbackRate.setValueAtTime(drumBeat/(beat*spans[i].scale),origin+spans[i].start*beat);
   }
   const offset=((pulse%choices.loop.beats)+choices.loop.beats)%choices.loop.beats;
   source.start(now,offset*drumBeat);
   keyIndex=keys.findIndex(n=>origin+n.beat*beat>=now-.012);if(keyIndex<0)keyIndex=keys.length;
  }
  function schedule(){
   if(recordedAudio!==audio||mine!==token)return;
   if(audio.ended||(!audio.seeking&&audio.currentTime>=current.sourceEnd)){
    stopBand();audio.currentTime=current.sourceStart;
    void audio.play().catch(()=>{if(recordedAudio===audio)stop();});return;
   }
   if(audio.seeking||audio.paused||audio.readyState<3)return;
   const pos=(audio.currentTime-current.sourceStart)/current.step,now=ctx.currentTime;
   if(pos<-.001)return;
   if(!source||Math.abs(now-origin-pos*beat)>.055)sync(pos,now);
   gain.gain.setTargetAtTime(drums?drumVolume:0,now,.01);
   liveKeys=liveKeys.filter(v=>v.end>now);
   if(!backing&&liveKeys.length){liveKeys.forEach(v=>v.voice.stop());liveKeys=[];}
   while(source&&keyIndex<keys.length){
    const n=keys[keyIndex],at=origin+n.beat*beat;
    if(at>now+.16)break;
    keyIndex++;
    if(backing&&at>=now-.012){
     const when=Math.max(now,at),length=Math.min(n.length*beat,origin+current.beats*beat-when);
     if(length>0)liveKeys.push({voice:K.tone(ctx,n,when,length,choices.sound,.22*keyVolume),end:when+length+.25});
    }
   }
  }
  audio.onwaiting=audio.onseeking=stopBand;audio.onplaying=schedule;
  audio.onerror=()=>{if(recordedAudio===audio){stop();$('fillStatus').textContent='Recording unavailable';}};
  const timer=setInterval(schedule,25);
  clearStreamBand=(keepMedia=false)=>{clearInterval(timer);audio.onplaying=audio.onwaiting=audio.onseeking=audio.onerror=null;stopBand();gain.disconnect();if(!keepMedia){media.disconnect();streamMedia=null;}clearStreamBand=null;};
  const tick=()=>{
   if(recordedAudio!==audio||mine!==token)return;
   const pos=(audio.currentTime-current.sourceStart)/current.step;
   if(current===plan){highlightChord(pos);highlightNotes(current.bass,pos,!audio.paused&&!audio.seeking);}
   recordedFrame=requestAnimationFrame(tick);
  };
  gain.gain.value=drums?drumVolume:0;schedule();
  $('fillStatus').textContent='Suggested chords · '+Number(current.bpm.toFixed(2))+' BPM';
  recordedFrame=requestAnimationFrame(tick);
 }
 function init(panel,hooks){
  api=hooks;panel.innerHTML=`<div id="fillGroupRow" class="fill-settings"><select id="fillGroup" aria-label="Run or fill group"></select></div><p id="fillCount" role="status"></p><div id="fillSettings" class="fill-settings">
  <select id="fillCollection" aria-label="Bassline genre" hidden></select>
  <select id="fillClip" aria-label="Uploaded bassline" hidden></select>
  <select id="fillIdea" aria-label="Run or fill pattern"></select>
  <select id="fillFrom" aria-label="From degree"></select><select id="fillTo" aria-label="To degree"></select>
  <output id="fillRecordedKey" hidden></output><select id="fillKey" aria-label="Fill key"></select><label id="fillTempoWrap" class="fill-tempo">BPM<input id="fillTempo" aria-label="Practice tempo BPM" type="number" min="40" max="220" step="0.01"><button id="fillTempoReset" type="button" title="Use the original drum loop tempo">Reset</button></label>
  </div>
  <p id="fillEmpty" hidden>No patterns in this group. Choose another group or restore deleted patterns.</p><div id="fillPlayer"><div class="fill-actions"><button id="fillPlay" type="button">Play</button><button id="fillRepeat" type="button" aria-pressed="false">Repeat</button><button id="fillNext" type="button">Next</button><button id="fillBacking" type="button" aria-pressed="true">Chords on</button><button id="fillDrums" type="button" aria-pressed="true">Drums on</button></div><p id="fillAccompaniment"></p><details id="fillDrumOptions"><summary>Band</summary><div class="fill-settings"><select id="fillExcerpt" aria-label="Clip section" hidden></select><label class="fill-band-choice">Drum genre<select id="fillDrumKit" aria-label="Drum genre"></select></label><label class="fill-band-choice">Drum loop<select id="fillDrumGroove" aria-label="Drum loop"></select></label><label class="fill-band-choice">Keyboard style<select id="fillKeyStyle" aria-label="Keyboard style"></select></label><label class="fill-band-choice">Keyboard sound<select id="fillKeySound" aria-label="Keyboard sound"></select></label><label class="fill-drum-volume">Drum volume <input id="fillDrumVolume" type="range" min="0" max="100" step="1" value="45"><output id="fillDrumLevel">45%</output></label><label class="fill-drum-volume">Keys volume <input id="fillKeyVolume" type="range" min="0" max="100" step="1" value="80"><output id="fillKeyLevel">80%</output></label><button id="fillGenreReset" type="button">Reset band</button></div></details><h3 id="fillHeading"></h3><p id="fillHarmony" hidden></p>

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
  option('fillCollection','recordings','Other recordings');
  clipOptions();
  $('fillCollection').onchange=()=>{clipOptions();ideaOptions();draw();};$('fillClip').onchange=()=>{partOptions();draw();};
  $('fillExcerpt').onchange=draw;
  for(let i=1;i<=7;i++){option('fillFrom',i,'From: '+i);option('fillTo',i,'To: '+i);} $('fillTo').value='4';
  F.names.forEach((n,i)=>option('fillKey',i,'Key: '+n));F.styles.forEach((s,i)=>option('fillIdea',i,(i+1)+'. '+s[0]));$('fillTempo').value='80';
  for(const id of ['fillFrom','fillTo','fillKey','fillIdea'])$(id).onchange=draw;
  let editedIdea='';
  function applyTempo(){
   clearTimeout(tempoTimer);
   const bpm=$('fillTempo').valueAsNumber;
   if(editedIdea!==tempoIdentity||!Number.isFinite(bpm)||bpm<40||bpm>220)return;
   if(plan&&Math.abs(plan.bpm-bpm)<.005)return;
   nativeTempo=null;draw();
  }
  $('fillTempo').oninput=()=>{editedIdea=tempoIdentity;clearTimeout(tempoTimer);tempoTimer=setTimeout(applyTempo,350);};
  $('fillTempo').onchange=()=>{editedIdea=tempoIdentity;applyTempo();};
  $('fillTempo').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();editedIdea=tempoIdentity;applyTempo();}};

  $('fillPlay').onclick=()=>void play();$('fillRepeat').onclick=()=>{if(playing){stop();$('fillStatus').textContent='Stopped';}else void play();};
  $('fillNext').onclick=()=>{const active=playing;$('fillIdea').selectedIndex=($('fillIdea').selectedIndex+1)%$('fillIdea').options.length;draw();if(!active)void play();};

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
