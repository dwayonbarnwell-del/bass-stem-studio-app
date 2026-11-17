window.BassFillTrainer=(()=>{
 'use strict';
 const F=window.BassFillCore,P=window.BassPracticeCore,U=window.BassUploadedCore,D=window.BassPracticeCatalogue,C=window.BassCuratedStudies,$=id=>document.getElementById(id);
 let api,ctx,voices=[],timers=[],token=0,playing=false,repeating=false,backing=true,plan,kind='fills',recordedAudio=null,recordedFrame=0;
 const remembered={fills:C?null:'0',runs:C?null:'0',basslines:'0'},rememberedClips={};
 const filterKey='bass-curated-filters-v1',filters={fills:{style:'all',quality:'all',pack:'all'},runs:{style:'all',quality:'all',pack:'all'}};
 try{const saved=JSON.parse(localStorage.getItem(filterKey)||'{}');for(const k of ['fills','runs'])for(const name of ['style','quality','pack'])if(typeof saved[k]?.[name]==='string')filters[k][name]=saved[k][name];}catch{}
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
  $('fillBacking').hidden=custom;$('fillNext').textContent=custom?'Next part':'Next idea';
  $('fillFilterPanel').hidden=!C||kind==='basslines';$('fillFilters').hidden=!C||kind==='basslines';$('fillCount').hidden=!C||kind==='basslines';
 }
 const collections=()=>kind==='runs'?P.runs:kind==='basslines'?P.lines.map(x=>[D.lineLabel(x),x.tip]):F.styles;
 function patternId(i){return kind==='basslines'?P.lines[i]?.id:collections()[i]?.id||String(i);}
 function loadFilters(){if(!C||kind==='basslines')return;for(const [id,name] of [['fillStyle','style'],['fillQuality','quality'],['fillPack','pack']]){const el=$(id);el.value=filters[kind][name];if(!el.value)el.value='all';filters[kind][name]=el.value;}}
 function ideaOptions(wanted=remembered[kind]){
  const select=$('fillIdea');select.replaceChildren();const rows=collections().map((s,i)=>({s,i,line:kind==='basslines'?P.lines[i]:null})).filter(({i,line})=>{if(!D.visible(kind,patternId(i))||line&&!D.inCollection(line,$('fillCollection').value))return false;if(!C||kind==='basslines')return true;const m=C.metadata(kind,i),f=filters[kind];return(f.style==='all'||m.genre===f.style)&&(f.quality==='all'||m.tier===Number(f.quality))&&(f.pack==='all'||(f.pack==='new')===m.original);});
  rows.sort((a,b)=>C&&kind!=='basslines'?C.compare(kind,a.i,b.i):Number(!!a.line?.african)-Number(!!b.line?.african));let african;
  for(const {s,i,line} of rows){const o=document.createElement('option');o.value=i;o.textContent=(C&&kind!=='basslines'?C.tiers[C.metadata(kind,i).tier]+' · ':'')+s[0];if(line?.african){if(!african){african=document.createElement('optgroup');african.label='African basslines';select.append(african);}african.append(o);}else select.append(o);}
  if([...select.options].some(o=>o.value===String(wanted)))select.value=String(wanted);else if(select.options.length)select.selectedIndex=0;
  if(C&&kind!=='basslines')$('fillCount').textContent=rows.length+' '+(kind==='runs'?'runs':'fills')+' · Most amazing to good';
 }
 function deletionKey(){return imported()?$('fillClip').value&&['uploaded',$('fillClip').value]:$('fillIdea').value!==''?[kind,patternId(Number($('fillIdea').value))]:null;}
 function refreshDeleted(){ideaOptions($('fillIdea').value);clipOptions();draw();}
 function later(fn,ms){timers.push(setTimeout(fn,ms));}
 function state(){ $('fillPlay').textContent=playing?'Stop':'Play';$('fillPlay').disabled=!plan;$('fillRepeat').disabled=!plan;$('fillNext').disabled=!plan;$('fillDelete').disabled=!deletionKey();$('fillRestore').disabled=!D.deletedCount;$('fillRestore').textContent='Restore deleted'+(D.deletedCount?' ('+D.deletedCount+')':'');$('fillRepeat').setAttribute('aria-pressed',String(repeating));$('fillBacking').textContent=backing?'Chords on':'Bass only';$('fillBacking').setAttribute('aria-pressed',String(backing)); }
 function stop(){token++;cancelAnimationFrame(recordedFrame);recordedAudio?.pause();recordedAudio=null;playing=false;repeating=false;timers.forEach(clearTimeout);timers=[];voices.forEach(v=>{try{v.stop();}catch{}});voices=[];if($('fillPlay')){state();for(const e of $('fillNotes').children)e.classList.remove('sounding');}}
 function settings(){return {key:$('fillKey').value,mode:kind==='basslines'?(P.lines[Number($('fillIdea').value)]?.mode||'major'):'major',from:$('fillFrom').value,to:$('fillTo').value,idea:$('fillIdea').value,bpm:$('fillTempo').value};}
 function draw(){
  stop();clipControls();if(imported()){rememberedClips[$('fillCollection').value]=$('fillClip').value;showPlan(U.plan($('fillClip').value,$('fillExcerpt').value,$('fillClipSpeed').value,$('fillClipSound').value==='notes'?$('fillClipTranspose').value:0));return;}if($('fillIdea').value===''){showPlan(null);return;}if($('fillFrom').value===$('fillTo').value)$('fillTo').value=String(Number($('fillFrom').value)%7+1);
  for(const o of $('fillTo').options)o.disabled=o.value===$('fillFrom').value;
  remembered[kind]=$('fillIdea').value;showPlan(P.make(kind,settings()));
 }
 function showPlan(value){
  plan=value;$('fillPlayer').hidden=!plan;$('fillEmpty').hidden=!!plan;state();if(!plan)return;
  $('fillHeading').textContent=plan.curated?plan.title:(plan.heading||plan.from+' → '+plan.to+' · '+plan.fromChord+' → '+plan.toChord);$('fillHarmony').hidden=!plan.curated;$('fillHarmony').textContent=plan.curated?plan.heading:'';
  $('fillStatus').textContent=plan.kind==='uploaded'?plan.status:kind==='basslines'?(plan.beats/4)+'-bar loop':'Two bars · land on beat 1';$('fillNotes').replaceChildren();
  $('fillTip').textContent=plan.tip||'';const source=plan.lesson||(typeof plan.source==='object'?plan.source:null);$('fillSource').hidden=!source;if(source){$('fillSource').textContent=source.label;$('fillSource').href=source.url;}
  $('fillRating').hidden=!C||kind==='basslines';if(C&&kind!=='basslines'){const m=C.metadata(kind,Number($('fillIdea').value));$('fillRating').textContent=C.tiers[m.tier]+' · '+(C.genres.find(([id])=>id===m.genre)?.[1]||'Other styles')+(m.original?' · '+m.notes.length+' phrase notes · Original study':'');}
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
   plan.bass.forEach((n,i)=>{const e=$('fillNotes').children[i];later(()=>{e.classList.add('sounding');{const list=$('fillNotes');if(e.offsetTop<list.scrollTop||e.offsetTop+e.offsetHeight>list.scrollTop+list.clientHeight)list.scrollTop=e.offsetTop;}},(.08+n.beat*beat+delay)*1000);later(()=>e.classList.remove('sounding'),(.08+(n.beat+n.length)*beat+delay)*1000);});
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
  api=hooks;panel.innerHTML=`<details id="fillFilterPanel" hidden><summary>Filter styles and ratings</summary><div id="fillFilters" class="fill-settings" hidden><select id="fillStyle" aria-label="Run or fill style"><option value="all">All styles</option></select><select id="fillQuality" aria-label="Run or fill rating"><option value="all">All ratings</option></select><select id="fillPack" aria-label="Run or fill collection"><option value="all">All patterns</option><option value="new">New 110 collection</option><option value="previous">Previous patterns</option></select><details id="fillRatingGuide"><summary>About the ratings</summary><p>Editorial choices based on melodic interest, groove, contrast and resolution. Taste is personal; a higher rating does not mean harder. The new collection contains original studies informed by the linked lessons, not artist transcriptions.</p></details></div></details><p id="fillCount" role="status" hidden></p><div id="fillSettings" class="fill-settings">
  <select id="fillCollection" aria-label="Bassline collection" hidden></select>
  <select id="fillClip" aria-label="Uploaded bassline" hidden></select><select id="fillExcerpt" aria-label="Clip section" hidden></select>
  <select id="fillClipSpeed" aria-label="Clip speed" hidden><option value="25">25% speed</option><option value="50">50% speed</option><option value="75">75% speed</option><option value="100" selected>Original speed</option><option value="125">125% speed</option></select>
  <select id="fillClipSound" aria-label="Clip sound" hidden><option value="recording">Recorded bass</option><option value="notes">Note playback</option></select>
  <select id="fillClipTranspose" aria-label="Clip transpose" hidden></select>
  <select id="fillFrom" aria-label="From degree"></select><select id="fillTo" aria-label="To degree"></select>
  <select id="fillKey" aria-label="Fill key"></select><select id="fillTempo" aria-label="Fill tempo"></select>
  <select id="fillIdea" aria-label="Fill idea"></select></div>
  <div id="fillCustom" class="my-fill-actions" hidden><input id="fillProgression" aria-label="Your progression" placeholder="e.g. 6 5 4 5 3"><button id="fillAddProgression" type="button">Add progression</button></div><p id="fillEmpty" hidden>No matching patterns. Change the filters or restore deleted patterns.</p><div class="my-fill-actions"><button id="fillDelete" type="button">Delete pattern</button><button id="fillRestore" type="button">Restore deleted</button></div><p id="fillManageStatus" role="status"></p><div id="fillPlayer"><h3 id="fillHeading"></h3><p id="fillHarmony" hidden></p><p id="fillRating" hidden></p><p id="fillTip"></p><a id="fillSource" target="_blank" rel="noopener noreferrer" hidden></a>
  <div class="fill-actions"><button id="fillPlay" type="button">Play</button><button id="fillRepeat" type="button" aria-pressed="false">Repeat</button><button id="fillNext" type="button">Next idea</button><button id="fillBacking" type="button" aria-pressed="true">Chords on</button></div>
  <div id="fillNotes" aria-label="Bass fill notes"></div><p id="fillStatus" role="status"></p></div>`;
  function option(id,value,label){const o=document.createElement('option');o.value=value;o.textContent=label;$(id).append(o);}
  if(C){for(const [id,label] of [...C.genres,['other','Other styles']])option('fillStyle',id,label);C.tiers.forEach((label,i)=>option('fillQuality',i,label));loadFilters();for(const id of ['fillStyle','fillQuality','fillPack'])$(id).onchange=()=>{filters[kind]={style:$('fillStyle').value,quality:$('fillQuality').value,pack:$('fillPack').value};try{localStorage.setItem(filterKey,JSON.stringify(filters));}catch{}ideaOptions($('fillIdea').value);draw();};}
  for(const [id,label] of [...D.groups,...U.groups.slice(1)])option('fillCollection',id,label);
  for(let i=-12;i<=12;i++)option('fillClipTranspose',i,i===0?'Original key':(i>0?'+':'')+i+' semitone'+(Math.abs(i)===1?'':'s'));$('fillClipTranspose').value='0';clipOptions();
  $('fillCollection').onchange=()=>{clipOptions();ideaOptions();draw();};$('fillClip').onchange=()=>{partOptions();draw();};
  for(const id of ['fillExcerpt','fillClipSpeed','fillClipTranspose','fillClipSound'])$(id).onchange=draw;
  for(let i=1;i<=7;i++){option('fillFrom',i,'From: '+i);option('fillTo',i,'To: '+i);} $('fillTo').value='4';
  F.names.forEach((n,i)=>option('fillKey',i,'Key: '+n));F.styles.forEach((s,i)=>option('fillIdea',i,(i+1)+'. '+s[0]));[40,50,60,70,80,90,100,110,120,140,160].forEach(n=>option('fillTempo',n,n+' BPM'));$('fillTempo').value='80';
  for(const id of ['fillFrom','fillTo','fillKey','fillIdea','fillTempo'])$(id).onchange=draw;
  $('fillPlay').onclick=()=>void play();$('fillRepeat').onclick=()=>{if(repeating){stop();$('fillStatus').textContent='Repeat stopped';}else{repeating=true;if(!playing)void play();else state();}};
  $('fillNext').onclick=()=>{if(imported()){$('fillExcerpt').selectedIndex=$('fillExcerpt').options.length>1?($('fillExcerpt').selectedIndex>=$('fillExcerpt').options.length-1?1:$('fillExcerpt').selectedIndex+1):0;draw();void play();return;}$('fillIdea').selectedIndex=($('fillIdea').selectedIndex+1)%$('fillIdea').options.length;draw();void play();};
  $('fillBacking').onclick=()=>{backing=!backing;const resume=playing;stop();state();if(resume)void play();};
  $('fillDelete').onclick=()=>{const id=deletionKey();if(!id)return;try{D.remove(...id);stop();refreshDeleted();$('fillManageStatus').textContent='Deleted from this device. Restore any time.';}catch{$('fillManageStatus').textContent='Could not save deletion.';}};
  $('fillRestore').onclick=()=>{try{D.restore();refreshDeleted();$('fillManageStatus').textContent='Patterns restored';}catch{$('fillManageStatus').textContent='Could not restore patterns.';}};
  $('fillAddProgression').onclick=()=>{try{const index=D.addProgression($('fillProgression').value,P.lines[Number($('fillIdea').value)]||P.lines[0]);$('fillCollection').value='studies';ideaOptions(index);draw();$('fillManageStatus').textContent='Progression added';}catch(e){$('fillManageStatus').textContent=e.message||'Could not save progression.';}};
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});window.addEventListener('pagehide',stop);ideaOptions();draw();
 }
 function setKind(next){
  stop();kind=['fills','runs','basslines'].includes(next)?next:'fills';$('fillSettings').hidden=false;$('fillNext').hidden=false;loadFilters();ideaOptions();draw();
 }
 return {init,stop,setKind};
})();
