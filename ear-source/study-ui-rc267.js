window.BassFillTrainer=(()=>{
 'use strict';
 const F=window.BassFillCore,P=window.BassPracticeCore,U=window.BassUploadedCore,$=id=>document.getElementById(id);
 let api,ctx,voices=[],timers=[],token=0,playing=false,repeating=false,backing=true,plan,kind='fills',selected=null,recordedAudio=null,recordedFrame=0;
 const remembered={fills:'0',runs:'0',basslines:'0'},rememberedClips={};
 const imported=()=>kind==='basslines'&&$('fillCollection').value!=='studies';
 function clipOptions(){
  const group=$('fillCollection').value;$('fillClip').replaceChildren();
  for(const c of U.items.filter(c=>c.group===group)){const o=document.createElement('option');o.value=c.id;o.textContent=c.title;$('fillClip').append(o);}
  if(rememberedClips[group])$('fillClip').value=rememberedClips[group];
  if(!$('fillClip').value&&$('fillClip').options.length)$('fillClip').selectedIndex=0;partOptions();
 }
 function partOptions(){
  const clip=U.items.find(c=>c.id===$('fillClip').value);$('fillExcerpt').replaceChildren();
  for(const [i,p] of (clip?.parts||[]).entries()){const o=document.createElement('option');o.value=i;o.textContent=(i===0?'Full clip':'Part '+i)+' · '+U.time(p.start)+'–'+U.time(p.end);$('fillExcerpt').append(o);}
  $('fillExcerpt').value=String(clip?.parts.length>1?1:0);
 }
 function clipControls(){
  const custom=imported(),saved=kind==='library';$('earFillStudy').dataset.imported=String(custom);
  $('fillCollection').hidden=kind!=='basslines';
  for(const id of ['fillClip','fillExcerpt','fillClipSpeed','fillClipSound'])$(id).hidden=!custom;
  $('fillClipTranspose').hidden=!custom||$('fillClipSound').value!=='notes';
  for(const id of ['fillKey','fillTempo','fillIdea'])$(id).hidden=custom;
  $('fillFrom').hidden=kind==='basslines';$('fillTo').hidden=kind==='basslines';
  $('fillBacking').hidden=saved||custom;$('fillNext').textContent=custom?'Next part':'Next idea';
 }
 const collections=()=>kind==='runs'?P.runs:kind==='basslines'?P.lines.map(x=>[x.name,x.tip]):F.styles;
 function later(fn,ms){timers.push(setTimeout(fn,ms));}
 function state(){ $('fillPlay').textContent=playing?'Stop':'Play';$('fillPlay').disabled=!plan;$('fillRepeat').disabled=!plan;$('fillRepeat').setAttribute('aria-pressed',String(repeating));$('fillBacking').textContent=backing?'Chords on':'Bass only';$('fillBacking').setAttribute('aria-pressed',String(backing)); }
 function stop(){token++;cancelAnimationFrame(recordedFrame);recordedAudio?.pause();recordedAudio=null;playing=false;repeating=false;timers.forEach(clearTimeout);timers=[];voices.forEach(v=>{try{v.stop();}catch{}});voices=[];if($('fillPlay')){state();for(const e of $('fillNotes').children)e.classList.remove('sounding');}}
 function settings(){return {key:$('fillKey').value,mode:kind==='basslines'?(P.lines[Number($('fillIdea').value)]?.mode||'major'):'major',from:$('fillFrom').value,to:$('fillTo').value,idea:$('fillIdea').value,bpm:$('fillTempo').value};}
 function draw(){
  stop();clipControls();if(imported()){rememberedClips[$('fillCollection').value]=$('fillClip').value;showPlan(U.plan($('fillClip').value,$('fillExcerpt').value,$('fillClipSpeed').value,$('fillClipSound').value==='notes'?$('fillClipTranspose').value:0));return;}if(kind==='library'){if(selected)showPlan(window.BassTransitionCore.plan(selected,Number($('fillSpeed').value)));return;}if($('fillFrom').value===$('fillTo').value)$('fillTo').value=String(Number($('fillFrom').value)%7+1);
  for(const o of $('fillTo').options)o.disabled=o.value===$('fillFrom').value;
  remembered[kind]=$('fillIdea').value;showPlan(P.make(kind,settings()));
 }
 function showPlan(value){
  plan=value;$('fillPlayer').hidden=!plan;if(!plan)return;
  $('fillHeading').textContent=plan.heading||plan.from+' → '+plan.to+' · '+plan.fromChord+' → '+plan.toChord;
  $('fillStatus').textContent=plan.kind==='uploaded'?plan.status:kind==='library'?'Selected: '+selected.title+' · '+window.BassLibraryFills.time(selected.change):kind==='basslines'?'Four-bar loop':'Two bars · land on beat 1';$('fillNotes').replaceChildren();
  plan.bass.forEach((n,i)=>{const b=document.createElement('button');b.type='button';b.textContent=F.note(n.midi);b.title=F.note(n.midi)+(plan.kind==='uploaded'?' · '+U.time(n.sourceTime):' · beat '+(Math.round((n.beat%4+1)*100)/100));if(n.review){b.classList.add('needs-review');b.title+=' · Check note';}b.setAttribute('aria-label','Hear '+F.note(n.midi));b.dataset.index=i;if(n.role==='landing')b.classList.add('landing');b.onclick=()=>void preview(n);$('fillNotes').append(b);});state();
 }
 async function preview(n){
  stop();const mine=token;try{ctx??=new AudioContext();await ctx.resume();await window.BassPianoAudio.prepare('bass',ctx,{notes:[n]});if(mine!==token)return;voices.push(window.BassPianoAudio.tone(ctx,n.midi,ctx.currentTime,.65,'bass',0,85,.8));}catch{$('fillStatus').textContent='Sound unavailable';}
 }
 async function play(again=false){
  if(!plan)return;
  if(playing&&!again){stop();$('fillStatus').textContent='Stopped';return;}
  if(api?.busy?.()){$('fillStatus').textContent='Finish recording first';return;}
  const repeat=repeating;stop();repeating=repeat;playing=true;const mine=token;state();api?.pause?.();$('fillStatus').textContent='Loading sound';
  try{
   if(plan.kind==='uploaded'&&$('fillClipSound').value==='recording'){await playRecording(mine);return;}
   ctx??=new AudioContext();await ctx.resume();const A=window.BassPianoAudio;
   await A.prepare('bass',ctx,{notes:plan.bass});if(backing&&plan.chords.length)await A.prepare('piano',ctx,{notes:plan.chords});
   if(mine!==token||!$('earTrainerDialog').open)return;
   const start=ctx.currentTime+.08,beat=60/plan.bpm,delay=window.BassPlaybackTiming?.outputDelay(ctx)||0;
   $('fillStatus').textContent=plan.kind==='uploaded'?'Playing · '+plan.status:'Listen to the landing';
   for(const n of [...plan.bass,...(backing?plan.chords:[])])voices.push(A.tone(ctx,n.midi,start+n.beat*beat,n.length*beat,n.role==='chord'?'piano':'bass',0,n.velocity,n.role==='chord'?.24:.8));
   plan.bass.forEach((n,i)=>{const e=$('fillNotes').children[i];later(()=>{e.classList.add('sounding');if(plan.kind==='uploaded'){const list=$('fillNotes');if(e.offsetTop<list.scrollTop||e.offsetTop+e.offsetHeight>list.scrollTop+list.clientHeight)list.scrollTop=e.offsetTop;}},(.08+n.beat*beat+delay)*1000);later(()=>e.classList.remove('sounding'),(.08+(n.beat+n.length)*beat+delay)*1000);});
   later(()=>{if(mine!==token)return;playing=false;state();$('fillStatus').textContent=plan.kind==='uploaded'?plan.status:'Play it again';if(repeating)void play(true);},(.08+plan.beats*beat+delay)*1000);
  }catch{if(mine===token){stop();$('fillStatus').textContent='Sound unavailable';}}
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
  api=hooks;panel.innerHTML=`<div id="fillLibrary" hidden></div><div id="fillSettings" class="fill-settings">
  <select id="fillCollection" aria-label="Bassline collection" hidden></select>
  <select id="fillClip" aria-label="Uploaded bassline" hidden></select><select id="fillExcerpt" aria-label="Clip section" hidden></select>
  <select id="fillClipSpeed" aria-label="Clip speed" hidden><option value="25">25% speed</option><option value="50">50% speed</option><option value="75">75% speed</option><option value="100" selected>Original speed</option><option value="125">125% speed</option></select>
  <select id="fillClipSound" aria-label="Clip sound" hidden><option value="recording">Recorded bass</option><option value="notes">Note playback</option></select>
  <select id="fillClipTranspose" aria-label="Clip transpose" hidden></select>
  <select id="fillFrom" aria-label="From degree"></select><select id="fillTo" aria-label="To degree"></select>
  <select id="fillKey" aria-label="Fill key"></select><select id="fillTempo" aria-label="Fill tempo"></select>
  <select id="fillIdea" aria-label="Fill idea"></select></div>
  <div id="fillPlayer"><h3 id="fillHeading"></h3>
  <div class="fill-actions"><button id="fillPlay" type="button">Play</button><button id="fillRepeat" type="button" aria-pressed="false">Repeat</button><button id="fillNext" type="button">Next idea</button><button id="fillBacking" type="button" aria-pressed="true">Chords on</button></div>
  <div id="fillNotes" aria-label="Bass fill notes"></div><div id="fillSavedActions" class="my-fill-actions" hidden><select id="fillSpeed" aria-label="Saved fill speed"><option value="50">50% speed</option><option value="75">75% speed</option><option value="100" selected>Original speed</option></select><button id="fillOriginal" type="button">Open song part</button></div><p id="fillStatus" role="status"></p></div>`;
  function option(id,value,label){const o=document.createElement('option');o.value=value;o.textContent=label;$(id).append(o);}
  for(const [id,label] of U.groups)option('fillCollection',id,label);
  for(let i=-12;i<=12;i++)option('fillClipTranspose',i,i===0?'Original key':(i>0?'+':'')+i+' semitone'+(Math.abs(i)===1?'':'s'));$('fillClipTranspose').value='0';clipOptions();
  $('fillCollection').onchange=()=>{clipOptions();draw();};$('fillClip').onchange=()=>{partOptions();draw();};
  for(const id of ['fillExcerpt','fillClipSpeed','fillClipTranspose','fillClipSound'])$(id).onchange=draw;
  for(let i=1;i<=7;i++){option('fillFrom',i,'From: '+i);option('fillTo',i,'To: '+i);} $('fillTo').value='4';
  F.names.forEach((n,i)=>option('fillKey',i,'Key: '+n));F.styles.forEach((s,i)=>option('fillIdea',i,(i+1)+'. '+s[0]));[40,50,60,70,80,90,100,110,120,140,160].forEach(n=>option('fillTempo',n,n+' BPM'));$('fillTempo').value='80';
  for(const id of ['fillFrom','fillTo','fillKey','fillIdea','fillTempo'])$(id).onchange=draw;
  $('fillPlay').onclick=()=>void play();$('fillRepeat').onclick=()=>{if(repeating){stop();$('fillStatus').textContent='Repeat stopped';}else{repeating=true;if(!playing)void play();else state();}};
  $('fillNext').onclick=()=>{if(imported()){$('fillExcerpt').selectedIndex=$('fillExcerpt').options.length>1?($('fillExcerpt').selectedIndex>=$('fillExcerpt').options.length-1?1:$('fillExcerpt').selectedIndex+1):0;draw();void play();return;}$('fillIdea').value=String((Number($('fillIdea').value)+1)%collections().length);draw();void play();};
  $('fillBacking').onclick=()=>{backing=!backing;const resume=playing;stop();state();if(resume)void play();};
  $('fillSpeed').onchange=draw;
  $('fillOriginal').onclick=async()=>{if(!selected)return;stop();$('fillOriginal').disabled=true;try{await api.openPart(selected); }catch(e){$('fillStatus').textContent=e.message||'Could not open song';}finally{$('fillOriginal').disabled=false;}};
  window.BassLibraryFills.init($('fillLibrary'),{select:item=>{selected=item;draw();$('fillPlayer').scrollIntoView({block:'nearest'});}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});window.addEventListener('pagehide',stop);draw();
 }
 function setKind(next){
  stop();kind=next;const saved=kind==='library';$('fillLibrary').hidden=!saved;$('fillSettings').hidden=saved;$('fillSavedActions').hidden=!saved;$('fillNext').hidden=saved;$('fillBacking').hidden=saved;
  $('fillFrom').hidden=kind==='basslines';$('fillTo').hidden=kind==='basslines';
  $('fillIdea').replaceChildren();collections().forEach((s,i)=>{const o=document.createElement('option');o.value=i;o.textContent=(i+1)+'. '+s[0];$('fillIdea').append(o);});$('fillIdea').value=remembered[kind]||'0';
  if(saved){plan=null;$('fillPlayer').hidden=!selected;state();void window.BassLibraryFills.show();}draw();
 }
 return {init,stop,setKind};
})();
