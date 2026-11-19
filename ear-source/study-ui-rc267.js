window.BassFillTrainer=(()=>{
 'use strict';
 const F=window.BassFillCore,P=window.BassPracticeCore,U=window.BassUploadedCore,D=window.BassPracticeCatalogue,C=window.BassCuratedStudies,G=window.BassStudyGroups,R=window.BassRegister,L=window.BassPracticeLoop,B=window.BassPracticeDrums,$=id=>document.getElementById(id);
 let api,ctx,voices=[],timers=[],token=0,playing=false,repeating=false,backing=false,plan,kind='fills',recordedAudio=null,recordedFrame=0,transport=null,rendered=null,drums=true,drumKit='vintage',drumGroove='pocket',drumVolume=.45;
 const drumKey='bass-practice-drums-v1';
 try{const s=JSON.parse(localStorage.getItem(drumKey)||'{}');if(typeof s.enabled==='boolean')drums=s.enabled;if(B.kits.some(([id])=>id===s.kit))drumKit=s.kit;if(B.grooves.some(([id])=>id===s.groove))drumGroove=s.groove;if(Number.isFinite(s.volume))drumVolume=Math.max(0,Math.min(1,s.volume));}catch{}
 const saveDrums=()=>{try{localStorage.setItem(drumKey,JSON.stringify({enabled:drums,kit:drumKit,groove:drumGroove,volume:drumVolume}));}catch{}};
 const remembered={fills:C?null:'0',runs:C?null:'0',basslines:'0'},rememberedClips={};
 const groupKey='bass-study-groups-v1',selectedGroups={fills:'gospel',runs:'gospel'};
 try{const saved=JSON.parse(localStorage.getItem(groupKey)||'null'),old=JSON.parse(localStorage.getItem('bass-curated-filters-v1')||'{}');for(const k of ['fills','runs'])selectedGroups[k]=G?.migrate(saved?.[k]||old[k]?.style)||'gospel';}catch{}
 const imported=()=>kind==='basslines'&&U.groups.slice(1).some(([id])=>id===$('fillCollection').value);
 function clipOptions(){
  const group=$('fillCollection').value;$('fillClip').replaceChildren();
  for(const c of U.items.filter(c=>(c.collection||c.group)===group&&D.visible('uploaded',c.id))){const o=document.createElement('option');o.value=c.id;o.textContent=c.title;$('fillClip').append(o);}
  if(rememberedClips[group])$('fillClip').value=rememberedClips[group];
  if(!$('fillClip').value&&$('fillClip').options.length)$('fillClip').selectedIndex=0;partOptions();
 }
 function partOptions(){
  const clip=U.items.find(c=>c.id===$('fillClip').value);$('fillExcerpt').replaceChildren();
  for(const [i,p] of (clip?.parts||[]).entries()){const o=document.createElement('option');o.value=i;o.textContent=(i===0?'Full clip':'Part '+i)+' · '+U.time(p.start)+'–'+U.time(p.end);$('fillExcerpt').append(o);}
  $('fillExcerpt').value=String(clip?.parts.length>1?1:0);
 }
 function clipControls(){
  const custom=imported();$('earFillStudy').dataset.imported=String(custom);
  $('fillCollection').hidden=kind!=='basslines';$('fillCustom').hidden=kind!=='basslines'||custom;
  for(const id of ['fillClip','fillExcerpt','fillClipSpeed','fillClipSound'])$(id).hidden=!custom;
  $('fillClipTranspose').hidden=!custom||$('fillClipSound').value!=='notes';
  for(const id of ['fillKey','fillTempo','fillIdea'])$(id).hidden=custom;
  $('fillFrom').hidden=kind==='basslines';$('fillTo').hidden=kind==='basslines';
  $('fillBacking').hidden=custom;$('fillDrums').hidden=custom;$('fillDrumOptions').hidden=custom;$('fillDrumNotice').hidden=!custom;$('fillNext').textContent=custom?'Next part':'Next idea';
  $('fillGroupRow').hidden=!G||kind==='basslines';$('fillCount').hidden=!G||kind==='basslines';$('fillRatingGuide').hidden=!G||kind==='basslines';
 }
 const collections=()=>kind==='runs'?P.runs:kind==='basslines'?P.lines.map(x=>[D.lineLabel(x),x.tip]):F.styles;
 function patternId(i){return kind==='basslines'?P.lines[i]?.id:collections()[i]?.id||String(i);}
 function loadGroup(){if(!G||kind==='basslines')return;$('fillGroup').value=selectedGroups[kind];}
 function ideaOptions(wanted=remembered[kind]){
  const select=$('fillIdea');select.replaceChildren();const rows=collections().map((s,i)=>({s,i,line:kind==='basslines'?P.lines[i]:null})).filter(({i,line})=>kind==='basslines'?D.visible(kind,patternId(i))&&D.inCollection(line,$('fillCollection').value):G?G.visible(kind,i)&&G.groupOf(kind,i)===selectedGroups[kind]:D.visible(kind,patternId(i)));
  rows.sort((a,b)=>C&&kind!=='basslines'?C.compare(kind,a.i,b.i):Number(!!a.line?.african)-Number(!!b.line?.african));let african;
  for(const {s,i,line} of rows){const o=document.createElement('option');o.value=i;o.textContent=s[0];if(line?.african){if(!african){african=document.createElement('optgroup');african.label='African basslines';select.append(african);}african.append(o);}else select.append(o);}
  if([...select.options].some(o=>o.value===String(wanted)))select.value=String(wanted);else if(select.options.length)select.selectedIndex=0;
  if(G&&kind!=='basslines')$('fillCount').textContent=rows.length+' of '+G.total(kind)+' '+(kind==='runs'?'runs':'fills')+' · Most amazing first';
 }
 function deletionKey(){return imported()?$('fillClip').value&&['uploaded',$('fillClip').value]:$('fillIdea').value!==''?[kind,patternId(Number($('fillIdea').value))]:null;}
 function refreshDeleted(){ideaOptions($('fillIdea').value);clipOptions();draw();}
 function later(fn,ms){timers.push(setTimeout(fn,ms));}
 function state(){ $('fillPlay').textContent=playing?'Stop':'Play';$('fillPlay').disabled=!plan;$('fillRepeat').disabled=!plan;$('fillNext').disabled=!plan;$('fillDelete').disabled=!deletionKey();$('fillRestore').disabled=!D.deletedCount;$('fillRestore').textContent='Restore deleted'+(D.deletedCount?' ('+D.deletedCount+')':'');$('fillRepeat').setAttribute('aria-pressed',String(repeating));$('fillBacking').textContent=backing?'Chords on':'Chords off';$('fillBacking').setAttribute('aria-pressed',String(backing));$('fillDrums').textContent=drums?'Drums on':'Drums off';$('fillDrums').setAttribute('aria-pressed',String(drums)); }
 function stop(){token++;transport?.stop();transport=null;cancelAnimationFrame(recordedFrame);recordedAudio?.pause();recordedAudio=null;playing=false;repeating=false;timers.forEach(clearTimeout);timers=[];voices.forEach(v=>{try{v.stop();}catch{}});voices=[];if($('fillPlay')){state();for(const e of $('fillNotes').children)e.classList.remove('sounding');}}
 function settings(){return {key:$('fillKey').value,mode:kind==='basslines'?(P.lines[Number($('fillIdea').value)]?.mode||'major'):'major',from:$('fillFrom').value,to:$('fillTo').value,idea:$('fillIdea').value,bpm:$('fillTempo').value};}
 function draw(){
  stop();clipControls();if(imported()){rememberedClips[$('fillCollection').value]=$('fillClip').value;showPlan(U.plan($('fillClip').value,$('fillExcerpt').value,$('fillClipSpeed').value,$('fillClipSound').value==='notes'?$('fillClipTranspose').value:0));return;}if($('fillIdea').value===''){showPlan(null);return;}if($('fillFrom').value===$('fillTo').value)$('fillTo').value=String(Number($('fillFrom').value)%7+1);
  for(const o of $('fillTo').options)o.disabled=o.value===$('fillFrom').value;
  remembered[kind]=$('fillIdea').value;showPlan(P.make(kind,settings()));
 }
 function showPlan(value){
  rendered=null;plan=value&&!(value.kind==='uploaded'&&$('fillClipSound').value==='recording')?R.plan(value):value;$('fillPlayer').hidden=!plan;$('fillEmpty').hidden=!!plan;state();if(!plan)return;
  $('fillHeading').textContent=G&&kind!=='basslines'?[G.label(kind,plan.idea),...G.aliases(kind,plan.idea)].join(' / '):(plan.heading||plan.title);$('fillHarmony').hidden=kind==='basslines';$('fillHarmony').textContent=kind!=='basslines'?(plan.heading||plan.from+' → '+plan.to+' · '+plan.fromChord+' → '+plan.toChord):'';
  $('fillRegister').textContent=plan.kind==='uploaded'&&$('fillClipSound').value==='recording'?'Original recorded pitch':'Bass: '+F.note(Math.min(...plan.bass.map(n=>n.midi)))+'–'+F.note(Math.max(...plan.bass.map(n=>n.midi)))+(plan.bassRevoiced?' · Octaves adjusted':'');
  $('fillStatus').textContent=plan.kind==='uploaded'?plan.status:kind==='basslines'?(plan.beats/4)+'-bar loop':'Two bars · land on beat 1';$('fillNotes').replaceChildren();
  $('fillTip').textContent=plan.tip||'';const source=plan.lesson||(typeof plan.source==='object'?plan.source:null);$('fillSource').hidden=!source;if(source){$('fillSource').textContent=source.label;$('fillSource').href=source.url;}
  $('fillRating').hidden=!C||kind==='basslines';if(C&&kind!=='basslines'){const m=C.metadata(kind,Number($('fillIdea').value));$('fillRating').textContent=C.tiers[m.tier]+' · '+(G?.groups.find(([id])=>id===G.groupOf(kind,Number($('fillIdea').value)))?.[1]||C.genres.find(([id])=>id===m.genre)?.[1]||'')+(m.original?' · '+m.notes.length+' phrase notes · Original study':'');}
  plan.bass.forEach((n,i)=>{const b=document.createElement('button');b.type='button';b.textContent=F.note(n.midi);b.title=F.note(n.midi)+(plan.kind==='uploaded'?' · '+U.time(n.sourceTime):' · beat '+(Math.round((n.beat%4+1)*100)/100));if(n.review){b.classList.add('needs-review');b.title+=' · Check note';}b.setAttribute('aria-label','Hear '+F.note(n.midi));b.dataset.index=i;if(n.role==='landing')b.classList.add('landing');b.onclick=()=>void preview(n);$('fillNotes').append(b);});state();
 }
 async function preview(n){
  stop();const mine=token;try{ctx??=new AudioContext();await ctx.resume();await window.BassPracticeAudio.prepare('bass',ctx,{notes:[n]});if(mine!==token)return;voices.push(window.BassPracticeAudio.tone(ctx,n.midi,ctx.currentTime,.65,'bass',0,85,.8));}catch{$('fillStatus').textContent='Sound unavailable';}
 }
 async function play(again=false){
  if(!plan)return;
  if(playing&&!again){stop();$('fillStatus').textContent='Stopped';return;}
  if(api?.busy?.()){$('fillStatus').textContent='Finish recording first';return;}
  const repeat=repeating;stop();repeating=repeat;playing=true;const mine=token;state();api?.pause?.();$('fillStatus').textContent='Loading sound';
  try{
   if(plan.kind==='uploaded'&&$('fillClipSound').value==='recording'){await playRecording(mine);return;}
   if(plan.kind==='uploaded'){await playUploadedNotes(mine);return;}
   ctx??=new AudioContext();await ctx.resume();const current=plan;
   if(!rendered)rendered=await L.render(ctx,current,{drums:current.kind!=='uploaded',kit:drumKit,groove:drumGroove,chords:true,cancelled:()=>mine!==token});
   if(mine!==token||!rendered||!$('earTrainerDialog').open)return;
   $('fillStatus').textContent=current.kind==='uploaded'?'Playing · '+current.status:'Playing · '+current.bpm+' BPM';
   transport=L.start(ctx,rendered,{repeat:repeating,drums:drums?drumVolume:0,chords:backing?1:0,onEnded:()=>{if(mine!==token)return;playing=false;repeating=false;transport=null;cancelAnimationFrame(recordedFrame);state();for(const e of $('fillNotes').children)e.classList.remove('sounding');$('fillStatus').textContent='Play it again';}});
   const delay=window.BassPlaybackTiming?.outputDelay(ctx)||0;
   const tick=()=>{if(mine!==token||!transport)return;const elapsed=transport.position()-delay,phase=repeating?((elapsed%rendered.seconds)+rendered.seconds)%rendered.seconds:elapsed,beat=phase*current.bpm/60;
    for(const [i,n] of current.bass.entries()){const e=$('fillNotes').children[i];if(!e)continue;const active=elapsed>=0&&beat>=n.beat&&beat<n.beat+n.length;e.classList.toggle('sounding',active);if(active){const list=$('fillNotes');if(e.offsetTop<list.scrollTop||e.offsetTop+e.offsetHeight>list.scrollTop+list.clientHeight)list.scrollTop=e.offsetTop;}}
    recordedFrame=requestAnimationFrame(tick);
   };recordedFrame=requestAnimationFrame(tick);
  }catch{if(mine===token){stop();$('fillStatus').textContent='Sound unavailable';}}
 }
 async function playUploadedNotes(mine){
  // Recorded lessons can exceed twenty minutes. Schedule their notes directly
  // instead of allocating a full uncompressed audio buffer on the phone.
  ctx??=new AudioContext();await ctx.resume();const current=plan,A=window.BassPracticeAudio;
  await A.prepare('bass',ctx,{notes:current.bass});if(mine!==token||!$('earTrainerDialog').open)return;
  const beat=60/current.bpm,duration=current.beats*beat,start=ctx.currentTime+.08,delay=window.BassPlaybackTiming?.outputDelay(ctx)||0;
  let scheduled=0,batches=[];
  function cycle(at){batches=batches.filter(b=>b.end>ctx.currentTime);batches.push({end:at+duration+.1,voices:current.bass.map(n=>A.tone(ctx,n.midi,at+n.beat*beat,n.length*beat,'bass',0,n.velocity,.72))});voices=batches.flatMap(b=>b.voices);}
  cycle(start);$('fillStatus').textContent='Playing · '+current.status;
  const tick=()=>{if(mine!==token)return;const now=ctx.currentTime,elapsed=now-start,next=start+(scheduled+1)*duration;
   if(repeating&&now>=next-.5){if(now>next-.02){stop();$('fillStatus').textContent='Playback paused. Tap Repeat to restart in time.';return;}cycle(next);scheduled++;}
   if(!repeating&&elapsed>=duration+delay){stop();$('fillStatus').textContent='Play it again';return;}
   const position=((Math.max(0,elapsed-delay)%duration)/beat);
   for(const [i,n] of current.bass.entries())$('fillNotes').children[i]?.classList.toggle('sounding',elapsed>=delay&&position>=n.beat&&position<n.beat+n.length);
   recordedFrame=requestAnimationFrame(tick);
  };recordedFrame=requestAnimationFrame(tick);
 }
 async function playRecording(mine){
  const current=plan,audio=new Audio();recordedAudio=audio;audio.preload='auto';audio.preservesPitch=true;audio.playbackRate=current.speed/100;
  await new Promise((resolve,reject)=>{audio.onloadedmetadata=resolve;audio.onerror=()=>reject(new Error('Recording unavailable'));audio.src=current.audio;audio.load();});
  if(mine!==token||!$('earTrainerDialog').open)return;audio.currentTime=current.sourceStart;await audio.play();
  if(mine!==token){audio.pause();return;}audio.onerror=()=>{if(mine===token){stop();$('fillStatus').textContent='Recording unavailable';}};$('fillStatus').textContent='Recorded bass · '+current.status;
  const tick=()=>{
   if(mine!==token||!$('earTrainerDialog').open){audio.pause();return;}
   const position=audio.currentTime-current.sourceStart;
   for(const [i,n] of current.bass.entries()){
    const e=$('fillNotes').children[i],active=position>=n.beat&&position<n.beat+n.length;if(!e)continue;e.classList.toggle('sounding',active);
    if(active){const list=$('fillNotes');if(e.offsetTop<list.scrollTop||e.offsetTop+e.offsetHeight>list.scrollTop+list.clientHeight)list.scrollTop=e.offsetTop;}
   }
   if(audio.ended||audio.currentTime>=current.sourceEnd-.02){audio.pause();playing=false;state();for(const e of $('fillNotes').children)e.classList.remove('sounding');$('fillStatus').textContent=current.status;if(repeating)void play(true);return;}
   recordedFrame=requestAnimationFrame(tick);
  };recordedFrame=requestAnimationFrame(tick);
 }
 function init(panel,hooks){
  api=hooks;panel.innerHTML=`<div id="fillGroupRow" class="fill-settings"><select id="fillGroup" aria-label="Run or fill group"></select></div><p id="fillCount" role="status"></p><div id="fillSettings" class="fill-settings">
  <select id="fillCollection" aria-label="Bassline collection" hidden></select>
  <select id="fillClip" aria-label="Uploaded bassline" hidden></select><select id="fillExcerpt" aria-label="Clip section" hidden></select>
  <select id="fillClipSpeed" aria-label="Clip speed" hidden><option value="25">25% speed</option><option value="50">50% speed</option><option value="75">75% speed</option><option value="100" selected>Original speed</option><option value="125">125% speed</option></select>
  <select id="fillClipSound" aria-label="Clip sound" hidden><option value="recording">Recorded bass</option><option value="notes">Note playback</option></select>
  <select id="fillClipTranspose" aria-label="Clip transpose" hidden></select>
  <select id="fillIdea" aria-label="Run or fill pattern"></select>
  <select id="fillFrom" aria-label="From degree"></select><select id="fillTo" aria-label="To degree"></select>
  <select id="fillKey" aria-label="Fill key"></select><select id="fillTempo" aria-label="Fill tempo"></select>
  </div>
  <div id="fillCustom" class="my-fill-actions" hidden><input id="fillProgression" aria-label="Your progression" placeholder="e.g. 6 5 4 5 3"><button id="fillAddProgression" type="button">Add progression</button></div><p id="fillEmpty" hidden>No patterns in this group. Choose another group or restore deleted patterns.</p><div id="fillPlayer"><div class="fill-actions"><button id="fillPlay" type="button">Play</button><button id="fillRepeat" type="button" aria-pressed="false">Repeat</button><button id="fillNext" type="button">Next idea</button><button id="fillBacking" type="button" aria-pressed="false">Chords off</button><button id="fillDrums" type="button" aria-pressed="true">Drums on</button></div><details id="fillDrumOptions"><summary>Drum sound and beat</summary><div class="fill-settings"><select id="fillDrumKit" aria-label="Drum sound"></select><select id="fillDrumGroove" aria-label="Drum beat"></select><label class="fill-drum-volume">Drum volume <input id="fillDrumVolume" type="range" min="0" max="100" step="1" value="45"><output id="fillDrumLevel">45%</output></label></div></details><p id="fillDrumNotice" hidden>Drums need a verified beat grid for recordings.</p><p id="fillRegister"></p><h3 id="fillHeading"></h3><p id="fillHarmony" hidden></p><p id="fillRating" hidden></p><p id="fillTip"></p><a id="fillSource" target="_blank" rel="noopener noreferrer" hidden></a>

  <div id="fillNotes" aria-label="Bass fill notes"></div><p id="fillStatus" role="status"></p><details id="fillRatingGuide"><summary>About these studies</summary><p>Original exercises informed by the linked lessons. Ratings reflect melodic interest, groove and resolution, not audience votes or artist endorsements. Note playback demonstrates pitches and rhythm; add your own touch and articulation.</p></details></div><div class="my-fill-actions"><button id="fillDelete" type="button">Delete pattern</button><button id="fillRestore" type="button">Restore deleted</button></div><p id="fillManageStatus" role="status"></p>`;
  function option(id,value,label){const o=document.createElement('option');o.value=value;o.textContent=label;$(id).append(o);}
  for(const [id,label] of B.kits)option('fillDrumKit',id,'Sound: '+label);for(const [id,label] of B.grooves)option('fillDrumGroove',id,'Beat: '+label);$('fillDrumKit').value=drumKit;$('fillDrumGroove').value=drumGroove;$('fillDrumVolume').value=Math.round(drumVolume*100);$('fillDrumLevel').textContent=Math.round(drumVolume*100)+'%';
  for(const id of ['fillDrumKit','fillDrumGroove'])$(id).onchange=()=>{drumKit=$('fillDrumKit').value;drumGroove=$('fillDrumGroove').value;saveDrums();stop();rendered=null;$('fillStatus').textContent='Ready · '+plan.bpm+' BPM';};
  $('fillDrumVolume').oninput=()=>{drumVolume=Number($('fillDrumVolume').value)/100;$('fillDrumLevel').textContent=Math.round(drumVolume*100)+'%';transport?.level('drums',drums?drumVolume:0);saveDrums();};
  $('fillDrums').onclick=()=>{drums=!drums;saveDrums();transport?.level('drums',drums?drumVolume:0);state();};
  if(G){for(const [id,label] of G.groups)option('fillGroup',id,label);loadGroup();$('fillGroup').onchange=()=>{selectedGroups[kind]=$('fillGroup').value;try{localStorage.setItem(groupKey,JSON.stringify(selectedGroups));}catch{}ideaOptions();draw();};}
  for(const [id,label] of [...D.groups,...U.groups.slice(1)])option('fillCollection',id,label);
  for(let i=-12;i<=12;i++)option('fillClipTranspose',i,i===0?'Original key':(i>0?'+':'')+i+' semitone'+(Math.abs(i)===1?'':'s'));$('fillClipTranspose').value='0';clipOptions();
  $('fillCollection').onchange=()=>{clipOptions();ideaOptions();draw();};$('fillClip').onchange=()=>{partOptions();draw();};
  for(const id of ['fillExcerpt','fillClipSpeed','fillClipTranspose','fillClipSound'])$(id).onchange=draw;
  for(let i=1;i<=7;i++){option('fillFrom',i,'From: '+i);option('fillTo',i,'To: '+i);} $('fillTo').value='4';
  F.names.forEach((n,i)=>option('fillKey',i,'Key: '+n));F.styles.forEach((s,i)=>option('fillIdea',i,(i+1)+'. '+s[0]));[40,50,60,70,80,90,100,110,120,140,160].forEach(n=>option('fillTempo',n,n+' BPM'));$('fillTempo').value='80';
  for(const id of ['fillFrom','fillTo','fillKey','fillIdea','fillTempo'])$(id).onchange=draw;
  $('fillPlay').onclick=()=>void play();$('fillRepeat').onclick=()=>{if(repeating){stop();$('fillStatus').textContent='Repeat stopped';}else{repeating=true;if(!playing)void play();else{transport?.setRepeat(true);state();}}};
  $('fillNext').onclick=()=>{if(imported()){$('fillExcerpt').selectedIndex=$('fillExcerpt').options.length>1?($('fillExcerpt').selectedIndex>=$('fillExcerpt').options.length-1?1:$('fillExcerpt').selectedIndex+1):0;draw();void play();return;}$('fillIdea').selectedIndex=($('fillIdea').selectedIndex+1)%$('fillIdea').options.length;draw();void play();};
  $('fillBacking').onclick=()=>{backing=!backing;transport?.level('chords',backing?1:0);state();};
  $('fillDelete').onclick=()=>{const id=deletionKey();if(!id)return;try{D.remove(...id);stop();refreshDeleted();$('fillManageStatus').textContent='Deleted from this device. Restore any time.';}catch{$('fillManageStatus').textContent='Could not save deletion.';}};
  $('fillRestore').onclick=()=>{try{D.restore();refreshDeleted();$('fillManageStatus').textContent='Patterns restored';}catch{$('fillManageStatus').textContent='Could not restore patterns.';}};
  $('fillAddProgression').onclick=()=>{try{const index=D.addProgression($('fillProgression').value,P.lines[Number($('fillIdea').value)]||P.lines[0]);$('fillCollection').value='studies';ideaOptions(index);draw();$('fillManageStatus').textContent='Progression added';}catch(e){$('fillManageStatus').textContent=e.message||'Could not save progression.';}};
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});window.addEventListener('pagehide',stop);ideaOptions();draw();
 }
 function setKind(next){
  stop();kind=['fills','runs','basslines'].includes(next)?next:'fills';$('fillSettings').hidden=false;$('fillNext').hidden=false;loadGroup();ideaOptions();draw();
 }
 return {init,stop,setKind};
})();
