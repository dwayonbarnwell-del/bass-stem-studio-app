window.BassFillTrainer=(()=>{
 'use strict';
 const F=window.BassFillCore,P=window.BassPracticeCore,U=window.BassUploadedCore,D=window.BassPracticeCatalogue,C=window.BassCuratedStudies,G=window.BassStudyGroups,R=window.BassRegister,L=window.BassPracticeLoop,B=window.BassSuppliedDrums,N=window.BassStudyDisplay,H=window.BassAccompaniment,$=id=>document.getElementById(id);
 let api,ctx,voices=[],timers=[],token=0,playing=false,repeating=false,backing=true,plan,kind='fills',recordedAudio=null,recordedFrame=0,transport=null,rendered=null,drums=true,drumKit='auto',drumGroove='auto',keyStyle='auto',keySound='auto',drumVolume=.21,keyVolume=.07,bassVolume=1,voiceVolume=.21,voice=true,voiceReady=null,tempoIdentity='',tempoGroup='',practiceTempo=null,harmony=[],revision=0,sessions=[];
 let sounding=[],clearStreamBand=null,streamMedia=null,streamBassGain=null,streamPlan=null,streamRoute=null,streamKeyGain=null,tempoTimer=0,harmonyPage=-1;
 let notePage=0;const notePageSize=25;
 const E=window.BassEarAudio,recordingKeys=new Map();
 let isolateVoice=false;
 const drumKey='bass-practice-accompaniment-v5';
 // Adopt the requested four-part mix once; retain sound choices and later edits.
 try{
  const saved=JSON.parse(localStorage.getItem(drumKey)||'{}'),old=JSON.parse(localStorage.getItem('bass-practice-accompaniment-v4')||localStorage.getItem('bass-practice-accompaniment-v3')||localStorage.getItem('bass-practice-accompaniment-v2')||localStorage.getItem('bass-practice-drums-v1')||'{}'),s={...old,...saved};
  if(typeof saved.enabled==='boolean')drums=saved.enabled;if(typeof saved.chords==='boolean')backing=saved.chords;if(typeof saved.voice==='boolean')voice=saved.voice;
  if(B.genres.some(([id])=>id===s.kit))drumKit=s.kit;if(B.available.some(x=>x.id===s.groove))drumGroove=s.groove;if(H.profiles[s.style])keyStyle=s.style;if(['piano','electric','organ'].includes(s.sound))keySound=s.sound;
  if(Number.isFinite(saved.volume))drumVolume=Math.max(0,Math.min(1,saved.volume));if(Number.isFinite(saved.keyVolume))keyVolume=Math.max(0,Math.min(1,saved.keyVolume));if(Number.isFinite(saved.bassVolume))bassVolume=Math.max(0,Math.min(1,saved.bassVolume));if(Number.isFinite(saved.voiceVolume))voiceVolume=Math.max(0,Math.min(1,saved.voiceVolume));
 }catch{}
 const recordingMixKey='bass-practice-recording-mix-v2';
 const mixValues=()=>({bassVolume,drumVolume,keyVolume,voiceVolume,voice,drums,backing});
 let bandMix=mixValues(),usingRecordingMix=false;
 const naturalMix={bassVolume:1,drumVolume:.21,keyVolume:.07,voiceVolume:.21,voice:true,drums:true,backing:true};
 let recordingMix={...naturalMix};
 try{
  const current=localStorage.getItem(recordingMixKey);
  const saved=JSON.parse(current??localStorage.getItem('bass-practice-recording-mix-v1'));
  for(const [part,value] of Object.entries(saved||{})){
   if(typeof naturalMix[part]==='boolean'&&typeof value==='boolean')recordingMix[part]=value;
   if(typeof naturalMix[part]==='number'&&Number.isFinite(value)&&(current!==null||value!==1))recordingMix[part]=Math.max(0,Math.min(1,value));
  }
 }catch{}
 function displayMix(){
  for(const [name,value] of [['Bass',bassVolume],['Drum',drumVolume],['Key',keyVolume],['Voice',voiceVolume]]){
   const percent=Math.round(value*100);
   $('fill'+name+'Volume').value=percent;$('fill'+name+'Level').textContent=percent+'%';
  }
 }
 function selectMix(recording){
  if(recording===usingRecordingMix)return;
  if(usingRecordingMix)recordingMix=mixValues();else bandMix=mixValues();
  usingRecordingMix=recording;
  ({bassVolume,drumVolume,keyVolume,voiceVolume,voice,drums,backing}=recording?recordingMix:bandMix);
  displayMix();
 }
 const saveDrums=()=>{try{if(usingRecordingMix){recordingMix=mixValues();localStorage.setItem(recordingMixKey,JSON.stringify(recordingMix));return;}localStorage.setItem(drumKey,JSON.stringify({enabled:drums,chords:backing,kit:drumKit,groove:drumGroove,style:keyStyle,sound:keySound,volume:drumVolume,keyVolume,bassVolume,voiceVolume,voice}));}catch{}};
 function selectedBeatStyle(){
  return drumKit==='auto'?(kind==='basslines'?$('fillCollection').value:$('fillGroup').value):drumKit;
 }
 function bandFor(value){
  const band=H.resolve(value,{kit:drumKit,groove:drumGroove,style:keyStyle,sound:keySound});
  const pool=B.byStyle(selectedBeatStyle());
  if(drumKit!=='auto'&&drumGroove==='auto'&&pool.length&&!pool.some(loop=>loop.id===band.loop.id))band.loop=pool[0];
  return band;
 }
 const accompaniment=()=>({...bandFor(plan),originalDrums:drumKit==='auto'&&drumGroove==='auto',originalKeys:keyStyle==='auto'&&keySound==='auto'});
 function drumOptions(){
  const select=$('fillDrumGroove'),pool=B.byStyle(selectedBeatStyle()),names=N.names(pool,row=>row.title);
  select.replaceChildren(new Option('Auto','auto'));
  for(const row of pool){
   const option=new Option(names.get(row),row.id);option.title=row.title+' · '+Number(row.bpm.toFixed(2))+' BPM';select.add(option);
  }
  N.sortMenu(select);select.value=drumGroove;
  if(!select.value){drumGroove='auto';select.value='auto';}
 }
 function soundSettings(){if(!plan){$('fillAccompaniment').textContent='';return;}const a=accompaniment(),auto=a,names={piano:'Grand piano',electric:'Wurlitzer electric piano',organ:'Drawbar organ'};
  for(const [id,text] of [['fillDrumKit',B.genres.find(x=>x[0]===auto.loop.genre)?.[1]||auto.loop.genre],['fillDrumGroove',auto.loop.title],['fillKeyStyle',H.profiles[auto.style].label],['fillKeySound',names[auto.sound]]]){$(id).options[0].textContent='Auto';$(id).options[0].title='Auto · '+text;}
  if(plan.recording?.pack){
   if(plan.recording.hasDrums)$('fillDrumGroove').options[0].title='Auto · recorded beat';
   $('fillKeyStyle').options[0].title='Auto · recorded backing';
   $('fillKeySound').options[0].title='Auto · recorded backing';
  }
  const mixed=!!plan.recording?.originalMix;
  for(const id of ['fillBacking','fillDrums','fillDrumOptions'])$(id).hidden=false;
  $('earFillStudy').dataset.mixed=String(mixed);
  for(const field of $('fillDrumOptions').querySelectorAll('.fill-band-choice'))field.hidden=mixed;
  $('fillGenreReset').hidden=false;$('fillGenreReset').textContent=mixed?'Reset mix':'Reset band';$('fillDrumOptions').querySelector('summary').textContent=mixed?'Mix':'Band';
  $('fillKeyLabel').textContent='Others';$('fillMixNotice').hidden=!mixed;
  $('fillDrumOptions').title=mixed?'Estimated instrument separation. Some sound may remain in another part.':'';
  $('fillAccompaniment').textContent=plan.recreated?'Recreated drums · sampled bass':'';
 }
 function cycleLength(values){
  for(let n=1;n<=values.length/2;n++)if(values.length%n===0&&values.every((v,i)=>v===values[i%n]))return n;
  return values.length;
 }
 function progressionText(degrees){
  const changes=degrees.filter((d,i,all)=>!i||d!==all[i-1]);
  return changes.slice(0,cycleLength(changes)).join('–');
 }
 function highlightChord(beat){
  const cycle=plan?.recording?.pack?cycleLength(harmony.map(s=>s.label)):harmony.length;
  const active=N.active(harmony,beat)%Math.max(1,cycle),list=$('fillHarmony');
  const page=plan?.kind==='uploaded'?Math.max(0,Math.floor(active/4)*4):0;
  if(page!==harmonyPage){
   harmonyPage=page;list.replaceChildren();
   const shown=plan?.kind==='uploaded'?harmony.slice(page,Math.min(cycle,page+4)):harmony;
   for(const segment of shown){
    const chip=document.createElement('span');chip.className='fill-chord';chip.textContent=segment.label;
    chip.setAttribute('aria-label','Chord '+segment.label);list.append(chip);
   }
  }
  for(const [i,chip] of [...list.children].entries())chip.setAttribute('aria-current',String(page+i===active));
 }
 function harmonyChips(){
  harmony=N.segments(plan);
  if(plan?.recording?.pack){
   const changes=[];for(const segment of harmony){
    if(changes.at(-1)?.label===segment.label)changes.at(-1).end=segment.end;
    else changes.push(segment);
   }
   harmony=changes;
  }
  harmonyPage=-1;$('fillHarmony').hidden=!harmony.length;
  $('fillHarmony').title=plan?.kind==='uploaded'?'Suggested chords from the recorded bass':'';
  highlightChord(0);
 }

 const remembered={fills:C?null:'0',runs:C?null:'0',basslines:'0'},rememberedClips={};
 const groupKey='bass-study-groups-v1',selectedGroups={fills:'gospel',runs:'gospel'};
 try{const saved=JSON.parse(localStorage.getItem(groupKey)||'null'),old=JSON.parse(localStorage.getItem('bass-curated-filters-v1')||'{}');for(const k of ['fills','runs'])selectedGroups[k]=(['bass-lady','bassmatics','world-method'].includes(saved?.[k])?saved[k]:(saved?.[k]==='african-praise'?'praise':G?.migrate(saved?.[k]||old[k]?.style)))||'gospel';}catch{}
 const imported=()=>kind==='basslines'&&$('fillIdea').value.startsWith('clip:');
 const combinedGenre=id=>id==='african-praise'?'praise':id;
 const artistGroup=family=>({'Bass Lady':'bass-lady',Bassmatics:'bassmatics','World Methods':'world-method'})[family];
 function matchesGenre(clip,genre){
  return H.recordingGroup(clip)===genre;
 }
 function studyGroup(kind,i){
  const entry=C.get(kind,i);
  return artistGroup(entry?.recordedStudy?.family)||combinedGenre(G.groupOf(kind,i));
 }
 const menuIndices=(kind,id)=>collections().map((_,i)=>i).filter(i=>G.visible(kind,i)&&studyGroup(kind,i)===id);
 function clipOptions(){
  const group=$('fillCollection').value;$('fillClip').replaceChildren();
  for(const c of U.items.filter(c=>matchesGenre(c,group)&&D.visible('uploaded',c.id))){const o=document.createElement('option');o.value=c.id;o.textContent=N.clip(c);o.title=N.clip(c);$('fillClip').append(o);}
  N.sortMenu($('fillClip'));
  if(rememberedClips[group])$('fillClip').value=rememberedClips[group];
  if(!$('fillClip').value&&$('fillClip').options.length)$('fillClip').selectedIndex=0;partOptions();
 }
 function partOptions(){
  const clip=U.items.find(c=>c.id===$('fillClip').value);$('fillExcerpt').replaceChildren();
  for(const [i,row] of (window.BassRecordedPhrases?.[clip?.id]||[]).entries()){
   if(!D.visible('uploaded',clip.id+'/'+i))continue;
   const bars=row[2]/4;
   const section=clip.sections?.[i];
   const option=new Option(N.fitName(section?.label||'Phrase '+(i+1)),'phrase-'+i);option.title=bars+(bars===1?' bar':' bars')+(section?.structuralEstimate?' · Estimated':'');$('fillExcerpt').add(option);
  }
  $('fillExcerpt').selectedIndex=0;
 }
 function clipControls(){
  const custom=imported();$('earFillStudy').dataset.imported=String(custom);
  $('fillCollection').hidden=kind!=='basslines';
  $('fillTempoReset').textContent=custom?'Original':'Reset';
  $('fillTempoReset').title=custom?'Play at the recorded bass tempo':'Use the original drum tempo';
  const sections=custom&&U.items.find(c=>c.id===$('fillClip').value)?.sections;
  $('earFillStudy').dataset.sections=String(!!sections);
  $('fillClip').hidden=true;$('fillExcerpt').hidden=!sections;
  $('fillKey').hidden=false;
  $('fillFrom').hidden=kind==='basslines';$('fillTo').hidden=kind==='basslines';
  $('fillGroup').hidden=!G||kind==='basslines';$('fillCount').hidden=!G||kind==='basslines';
 }
 const collections=()=>kind==='runs'?P.runs:kind==='basslines'?P.lines.map(x=>[D.lineLabel(x),x.tip]):F.styles;
 function patternId(i){return kind==='basslines'?P.lines[i]?.id:collections()[i]?.id||String(i);}
 function loadGroup(){if(!G||kind==='basslines')return;$('fillGroup').value=selectedGroups[kind];}
 function groupOptions(){
  if(!G||kind==='basslines')return;
  const present=new Set(collections().flatMap((_,i)=>G.visible(kind,i)?[studyGroup(kind,i)]:[]));
  const groups=[...G.groups,['bass-lady','Bass Lady'],['bassmatics','Bassmatics'],['world-method','World Methods']].filter(([id])=>present.has(id)),select=$('fillGroup');select.replaceChildren();
  for(const [id,label] of groups){const option=new Option(N.menu(label),id);option.title=label;select.add(option);}
  N.sortMenu(select);
  if(!groups.some(([id])=>id===selectedGroups[kind]))selectedGroups[kind]=groups[0]?.[0]||'gospel';
  loadGroup();
 }
 function transitionOptions(){
  if(!G||kind==='basslines')return;
  const indices=menuIndices(kind,selectedGroups[kind]),supported=(from,to)=>indices.some(i=>G.supports(kind,i,from,to));
  for(const option of $('fillFrom').options)option.disabled=![1,2,3,4,5,6,7].some(to=>to!==Number(option.value)&&supported(option.value,to));
  if($('fillFrom').selectedOptions[0]?.disabled)$('fillFrom').value=[...$('fillFrom').options].find(o=>!o.disabled)?.value||'1';
  const from=Number($('fillFrom').value);
  for(const option of $('fillTo').options)option.disabled=Number(option.value)===from||!supported(from,option.value);
  if($('fillTo').selectedOptions[0]?.disabled)$('fillTo').value=[4,5,1,2,6,3,7].map(n=>[...$('fillTo').options].find(o=>Number(o.value)===n&&!o.disabled)).find(Boolean)?.value||'4';
 }
 function ideaOptions(wanted=remembered[kind]){
  const select=$('fillIdea');select.replaceChildren();const rows=collections().map((s,i)=>({s,i,line:kind==='basslines'?P.lines[i]:null})).filter(({i,line})=>kind==='basslines'?D.visible(kind,patternId(i))&&combinedGenre(H.category(line))===$('fillCollection').value:G?G.visible(kind,i)&&studyGroup(kind,i)===selectedGroups[kind]&&G.supports(kind,i,$('fillFrom').value,$('fillTo').value):D.visible(kind,patternId(i)));
  const sourcePriority=i=>{const entry=C?.get(kind,i);return entry?.recordedStudy?(window.BassCulturalStudies.nativeMatch(entry,$('fillFrom').value,$('fillTo').value)?0:1):2;};
  rows.sort((a,b)=>kind==='basslines'?(a.line.rank??0)-(b.line.rank??0):C?sourcePriority(a.i)-sourcePriority(b.i)||C.compare(kind,a.i,b.i):0);let studies;if(kind==='basslines'&&rows.length){studies=document.createElement('optgroup');studies.label='Practice patterns';select.append(studies);}
  for(const {s,i,line} of rows){
   const parts=line?P.phrases(line.degrees):[null];
   for(const [part,degrees] of parts.entries()){
    if(line&&!D.visible(kind,patternId(i)+'/'+part))continue;
    const o=document.createElement('option');
    o.value=part?i+'/'+part:String(i);
    const series=window.BassPracticeSeries;
    const originalGroup=line?H.category(line):G.groupOf(kind,i);
    const family=!line&&artistGroup(C.get(kind,i)?.recordedStudy?.family);
    o.textContent=family?N.label(kind,s):series.menuLabel(kind,i,part,originalGroup)||N.label(kind,line||s);
    o.title=(line?.name||s[0])+(degrees?' · '+degrees.join('–'):'');(studies||select).append(o);
   }
  }
  if(kind==='basslines'){
   const group=document.createElement('optgroup');group.label='Recordings';
   for(const clip of U.items.filter(c=>matchesGenre(c,$('fillCollection').value)&&D.visible('uploaded',c.id))){
    const phrases=window.BassRecordedPhrases?.[clip.id]||[];
    if(clip.sections){
     const visible=phrases.map((_,i)=>i).filter(i=>D.visible('uploaded',clip.id+'/'+i));
     if(!visible.length)continue;
     const wantedClip=String(wanted||'').replace(/^clip:/,'').split('/');
     const part=wantedClip[0]===clip.id&&visible.includes(Number(wantedClip[1]||0))?Number(wantedClip[1]||0):visible[0];
     const option=new Option(N.clip(clip),'clip:'+clip.id+(part?'/'+part:''));
     option.dataset.name=N.clip(clip);option.title=clip.originalTitle||clip.title;group.append(option);continue;
    }
    for(const [i] of phrases.entries()){
     const phraseId=clip.id+'/'+i;
     if(!D.visible('uploaded',phraseId))continue;
     const option=document.createElement('option');
     option.value='clip:'+clip.id+(i?'/'+i:'');
     option.dataset.name=N.phrase(clip,i,phrases.length);
     option.title=clip.originalTitle||clip.title;
     option.textContent=option.dataset.name;
     group.append(option);
    }
   }
   if(group.children.length)select.append(group);
  }
  N.sortMenu(select);
  if([...select.options].some(o=>o.value===String(wanted)))select.value=String(wanted);else if(select.options.length)select.selectedIndex=0;
  if(G&&kind!=='basslines')$('fillCount').textContent=rows.length+' '+(kind==='runs'?'runs':'fills');
 }
 function deletionKey(){
  if(kind==='basslines'&&!imported()&&$('fillIdea').value!==''){
   const [idea,part='0']=$('fillIdea').value.split('/');
   const id=patternId(Number(idea));return [kind,P.phrases(P.lines[Number(idea)].degrees).length>1?id+'/'+part:id];
  }
  return imported()?$('fillClip').value&&['uploaded',window.BassRecordedPhrases[$('fillClip').value].length>1?$('fillClip').value+'/'+$('fillExcerpt').value.slice(7):$('fillClip').value]:$('fillIdea').value!==''?[kind,patternId(Number($('fillIdea').value))]:null;}
 function collectionOptions(){
  const select=$('fillCollection'),current=select.value;select.replaceChildren();
  for(const [id,label] of H.availableGroups().filter(([id])=>id!=='african-praise')){const option=new Option(N.menu(label),id);option.title=label;select.add(option);}
  N.sortMenu(select);
  if([...select.options].some(o=>o.value===current))select.value=current;
 }
 function deletedItems(){
  const list=$('fillDeletedList');list.replaceChildren();
  const names={basslines:'Bassline',runs:'Run',fills:'Fill',uploaded:'Recording',library:'Saved fill'};
  for(const row of window.BassCatalogueReview.removed()){
   const item=document.createElement('li'),label=document.createElement('span'),button=document.createElement('button');
   const source=U.find(row.id?.split('/')[0]),line=row.kind==='basslines'&&P.lines.find(x=>x.id===row.id?.split('/')[0]);
   label.textContent=source?N.clip(source):line?N.label('basslines',line):N.fitName(row.title);label.title=row.title;const detail=document.createElement('small');detail.textContent=(names[row.kind]||row.kind)+' · '+row.reason;label.append(detail);
   button.type='button';button.textContent='Restore';button.setAttribute('aria-label','Restore '+row.title);
   if(row.available===false){button.disabled=true;button.textContent='Needs review';}
   button.onclick=()=>{try{
    window.BassCatalogueReview.restore(row);refreshDeleted();window.BassLibraryFills?.refresh();$('fillManageStatus').textContent='Restored '+row.title;
   }catch{$('fillManageStatus').textContent='Could not restore this item.';}};
   item.append(label,button);list.append(item);
  }
  list.append(...[...list.children].sort((a,b)=>a.firstChild.firstChild.textContent.localeCompare(b.firstChild.firstChild.textContent,'en-GB',{numeric:true})));
  $('fillDeletedEmpty').hidden=!!list.children.length;
  $('fillEmptyDeleted').disabled=!list.children.length;
 }
 function refreshDeleted(){collectionOptions();groupOptions();transitionOptions();ideaOptions($('fillIdea').value);clipOptions();draw();deletedItems();}
 function later(fn,ms){timers.push(setTimeout(fn,ms));}
 let pausedBeat=null;
 function playbackLayout(){
  const study=$('earFillStudy'),value=String(playing||pausedBeat!==null);
  if(study.dataset.playing===value)return;
  study.dataset.playing=value;
  if(playing)($('earContent')||$('earTrainerDialog')).scrollTop=0;
 }
 function muteLabel(id,label,on,available=true){
  const button=$(id);button.textContent=available?label:plan?.recording?.originalMix?'Voice n/a':'No vocals';button.dataset.icon=on&&available?'🔊':'🔇';button.setAttribute('aria-pressed',String(on&&available));button.disabled=!available;
  button.title=available?(on?'Mute ':'Unmute ')+label.toLowerCase():plan?.recording?.originalMix?'Voice separation unavailable. Play again to retry.':'No vocals in this pattern';button.setAttribute('aria-label',button.title);
 }
 function state(){
  const deleted=window.BassCatalogueReview.removed().length;playbackLayout();$('fillPlay').textContent=playing?'Pause':pausedBeat!==null?'Resume':'Play';$('fillPlay').disabled=!plan;$('fillRepeat').disabled=!plan;$('fillNext').disabled=!plan;$('fillDelete').disabled=!deletionKey();$('fillRestore').disabled=!deleted;$('fillRestore').textContent='Deleted'+(deleted?' ('+deleted+')':'');const home=!playing&&pausedBeat!==null,button=$('fillRepeat');
  button.textContent=home?'Home':'Repeat';
  button.setAttribute('aria-label',home?'Ear training home':'Repeat');
  if(home)button.removeAttribute('aria-pressed');
  else button.setAttribute('aria-pressed',String(repeating));
  muteLabel('fillBacking','Others',backing);muteLabel('fillDrums','Drums 🥁',drums);muteLabel('fillVoice','Voice 🎙',voice,!!plan?.recording?.originalMix&&voiceReady!==false);
  $('fillVoiceVolume').disabled=!plan?.recording?.originalMix||voiceReady===false;
  $('fillVoiceVolume').parentElement.hidden=$('fillVoiceVolume').disabled;
 }

 function pause(){
  const active=sessions.filter(s=>s.plan===plan&&s.transport.when<=ctx.currentTime).at(-1);
  let beat=pausedBeat??0,visibleBeat=beat;
  if(recordedAudio&&streamPlan===plan){
   beat=Math.max(0,(recordedAudio.currentTime-plan.sourceStart)/plan.step)%plan.beats;
   visibleBeat=beat;
  }else if(active){
   const elapsed=active.transport.position()-(window.BassPlaybackTiming?.outputDelay(ctx)||0)-(active.transport.latency||0);
   beat=Math.max(0,elapsed)/active.rendered.beatSeconds;
   visibleBeat=(Math.max(0,elapsed)%active.rendered.seconds)/active.rendered.beatSeconds;
  }
  endPlayback(beat);
  highlightChord(visibleBeat);highlightNotes(plan.bass,visibleBeat,true);
  $('fillStatus').textContent='Paused';
 }
 function stop(){endPlayback(null);}
 function endPlayback(beat){
  pausedBeat=beat;
  if(rendered?.voiceUnavailable)rendered=null;
  clearStreamBand?.();
  token++;revision++;
  for(const session of sessions){
   if(session.transport.when>ctx.currentTime)session.transport.cancelPending();
   else session.transport.stop();
  }
  sessions=[];transport=null;
  cancelAnimationFrame(recordedFrame);recordedAudio?.pause();recordedAudio=null;
  playing=false;repeating=false;
  timers.forEach(clearTimeout);timers=[];
  for(const voice of voices)try{voice.stop();}catch{}
  voices=[];
  if($('fillPlay')){state();if(beat===null)highlightNotes([],0,false);}
 }
 function highlightNotes(notes,beat,audible){
  const list=$('fillNotes');
  if(audible&&plan?.kind==='uploaded'&&notes.length>35){const next=notes.findIndex(n=>n.beat+n.length>beat),page=Math.floor((next<0?notes.length-1:next)/notePageSize);if(page!==notePage)notePages(page);}
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
 function notePages(page=notePage){
  const list=$('fillNotes'),cards=[...list.children],paged=plan?.kind==='uploaded'&&cards.length>35;
  const pages=paged?Math.ceil(cards.length/notePageSize):1;notePage=Math.max(0,Math.min(pages-1,page));
  $('fillNotePager').hidden=!paged;
  for(const [i,card] of cards.entries())card.dataset.pageHidden=String(paged&&Math.floor(i/notePageSize)!==notePage);
  $('fillNotePage').textContent=(notePage+1)+' / '+pages;
  $('fillNotePrev').disabled=notePage===0;$('fillNoteNext').disabled=notePage===pages-1;
 }
 function level(part,value){for(const session of sessions)session.transport.level(part,value);if(part==='bass'&&streamBassGain)streamBassGain.gain.setTargetAtTime(value,ctx.currentTime,.015);if(part==='chords'&&streamKeyGain)streamKeyGain.gain.setTargetAtTime(value,ctx.currentTime,.015);}

 function applyVoiceLevel(){
  const needsVoice=!voice||voiceVolume<1;
  if(usingRecordingMix&&voiceReady===null&&isolateVoice!==needsVoice){
   isolateVoice=needsVoice;rendered=null;
   if(playing)void updatePlayback();
  }else level('voice',voice?voiceVolume:0);
 }
 function settings(){
  const [idea,part='0']=$('fillIdea').value.split('/');
  return {key:$('fillKey').value,mode:kind==='basslines'?(P.lines[Number(idea)]?.mode||'major'):'major',
   from:$('fillFrom').value,to:$('fillTo').value,idea,part:kind==='basslines'?Number(part):null,bpm:practiceTempo??$('fillTempo').value};
 }

 function keyOptions(mode='major',tonic=Number($('fillKey').value)||0){
  $('fillKey').replaceChildren(...globalThis.BassEarDSP.names.map((_,i)=>new Option(E.keyLabel(i,mode),i)));$('fillKey').value=String(tonic);
 }
 function draw(){
  drumOptions();
  const group=[kind,kind==='basslines'?$('fillCollection').value:$('fillGroup').value,drumKit,drumGroove].join('/');
  if(group!==tempoGroup){tempoGroup=group;practiceTempo=null;}
  if(imported()){
   const [id,phraseIndex='0']=$('fillIdea').value.slice(5).split('/');
   if($('fillClip').value!==id){$('fillClip').value=id;partOptions();}
   $('fillExcerpt').value='phrase-'+phraseIndex;
   clipControls();
   remembered[kind]=$('fillIdea').value;rememberedClips[$('fillCollection').value]=id;
   const identity='recording:'+id+':'+$('fillExcerpt').value;
   const value=U.practicePlan(id,$('fillExcerpt').value,practiceTempo);
   if(U.find(id)?.culturalUpload){
    value.recreated=true;value.recording=null;value.audio=null;
   }
   tempoIdentity=identity;practiceTempo=value.bpm;$('fillTempo').value=Number(value.bpm.toFixed(2));
   const target=recordingKeys.get(id)??value.tonic,key=E.shift(value.tonic,target);keyOptions(value.minor?'minor':'major',target);$('fillKey').title='Recording key'+(value.keyUncertain?' · Estimated':'')+' · Change to transpose the audio and notes';
   const selected=$('fillIdea').selectedOptions[0];
   const progression=progressionText(value.degrees);
   selected.textContent=selected.dataset.name;selected.title=(U.find(id)?.originalTitle||U.find(id)?.title||'Recording')+' · '+progression;
   showPlan(E.transposePlan(value,key));
   return;
  }
  clipControls();if($('fillIdea').value===''){showPlan(null);return;}if($('fillFrom').value===$('fillTo').value)$('fillTo').value=String(Number($('fillFrom').value)%7+1);
  for(const o of $('fillTo').options)o.disabled=o.value===$('fillFrom').value;
  keyOptions(settings().mode);$('fillKey').title='Practice key · Transpose notes and backing';
  remembered[kind]=$('fillIdea').value;
  const draft=P.make(kind,settings()),choice=bandFor(draft);
  const identity=kind+':'+remembered[kind]+':'+choice.loop.id;
  if(practiceTempo===null){
   const automatic=drumKit==='auto'&&drumGroove==='auto';
   practiceTempo=choice.loop.bpm;
   if(automatic&&draft.recordedStudy)practiceTempo=draft.recordedStudy.nativeBpm;
   else if(automatic&&!draft.seriesDrum&&!['gs-','owner-','fl-'].some(prefix=>choice.loop.id.startsWith(prefix))){
    practiceTempo=choice.id==='reggae'?77:choice.loop.bpm;
   }
  }
  tempoIdentity=identity;practiceTempo=Math.max(40,Math.min(220,practiceTempo));
  $('fillTempo').value=Number(practiceTempo.toFixed(2));
  showPlan(P.make(kind,settings()));
 }
 function showPlan(value){
  pausedBeat=null;
  selectMix(!!value?.recording?.originalMix);
  if(plan?.audio!==value?.audio){
   voiceReady=null;isolateVoice=usingRecordingMix&&(!voice||voiceVolume<1);
   L.selectRecording(value?.recording?.originalMix?value.audio:null);
  }rendered=null;plan=value&&value.kind!=='uploaded'?R.plan(value):value;$('fillPlayer').hidden=!plan;$('fillEmpty').hidden=!!plan;state();soundSettings();if(!plan){stop();return;}
  const row=kind==='basslines'?(plan.kind==='uploaded'?U.items.find(c=>c.id===plan.clipId):P.lines[plan.idea]):collections()[plan.idea];$('fillHeading').textContent=plan.kind==='uploaded'?$('fillIdea').selectedOptions[0].dataset.name:$('fillIdea').selectedOptions[0].textContent;harmonyChips();
  const source=plan.recordedStudy;
  $('fillDifference').textContent=source?'Adapted':row?.difference?N.fitName(row.difference):'';$('fillDifference').title=source?source.family+' · '+source.sourceTitle+' · '+plan.from+'→'+plan.to+' · Estimated':row?.difference||'';$('fillDifference').hidden=!source&&!row?.difference;
  $('fillStatus').textContent='';$('fillNotes').title=plan.kind==='uploaded'?'Automatic bass transcription; check uncertain notes.':'';$('fillNotes').replaceChildren();notePage=0;
  plan.bass.forEach((n,i)=>{const chord=harmony[N.active(harmony,n.beat)];$('fillNotes').append(noteCard(n,i,chord?.rootPc,preview,plan.kind==='uploaded'?U.time(n.sourceTime):''));});notePages();state();if(playing)void updatePlayback();
 }
 function noteCard(n,i,rootPc,hear,detail=''){
  const b=document.createElement('button');b.type='button';b.textContent=F.note(n.midi);b.dataset.index=i;
  b.title=b.textContent+(detail?' · '+detail:' · beat '+(Math.round((n.beat%4+1)*100)/100));
  if(n.review){b.classList.add('needs-review');b.title+=' · Check note';}
  b.classList.toggle('landing',n.role==='landing'||(n.midi%12+12)%12===rootPc);
  b.setAttribute('aria-label','Hear '+b.textContent);b.onclick=()=>void hear(n);return b;
 }
 async function preview(n){
  const mine=token;try{ctx??=new AudioContext();await ctx.resume();await window.BassPracticeAudio.prepare('bass',ctx,{notes:[n]});if(mine!==token)return;voices.push(window.BassPracticeAudio.tone(ctx,n.midi,ctx.currentTime,.65,'bass',0,85,.8));}catch{$('fillStatus').textContent='Sound unavailable';}
 }
 async function play(){
  if(!plan)return;if(playing){pause();return;}
  if(api?.busy?.()){$('fillStatus').textContent='Finish recording first';return;}
  playing=true;repeating=true;state();api?.pause?.();await updatePlayback();
 }
 let pendingRender=Promise.resolve();
 function updatePlayback(){
  const request=++revision;
  pendingRender=pendingRender.catch(()=>{}).then(async()=>{
   if(request!==revision)return;
   if(transport||recordedAudio)await new Promise(resolve=>setTimeout(resolve,85));
   if(request===revision && playing)return preparePlayback(request);
  });
  return pendingRender;
 }
 async function preparePlayback(request){
  if(!playing||!plan)return;
  const mine=token,current=plan,choices=accompaniment();
  $('fillStatus').textContent=transport||recordedAudio?'':'Loading…';
  try{
   if(current.kind==='uploaded'&&!current.recording&&!current.recreated){
    await playRecording(mine,request,current,choices);return;
   }
   ctx??=new AudioContext();await ctx.resume();await E.prepare(ctx);
   if(request!==revision||mine!==token)return;
   let audio;
   try{audio=rendered||await L.render(ctx,current,{...choices,...(usingRecordingMix?{originalDrums:true}:{}),naturalBalance:usingRecordingMix,isolateVoice,recorded:!!current.recording,cancelled:()=>mine!==token||request!==revision,sourceCancelled:()=>mine!==token||!playing||plan?.audio!==current.audio,progress:p=>{if(mine===token&&request===revision)$('fillStatus').textContent='Preparing voices '+p+'%';}});}
   catch(error){if(!current.recording||current.recording.pack||current.recording.originalMix)throw error;if(mine===token&&request===revision)await playRecording(mine,request,current,choices);return;}
   if(mine!==token||request!==revision||!audio||!$('earTrainerDialog').open)return;
   const previous=transport,oldPlan=sessions.at(-1)?.plan;
   const same=oldPlan&&oldPlan.kind===current.kind&&oldPlan.idea===current.idea&&oldPlan.clipId===current.clipId&&oldPlan.part===current.part&&oldPlan.from===current.from&&oldPlan.to===current.to;
   const quantum=1;
   const priorOffset=previous?.offsetBeats||0;
   const nextBeat=previous?Math.ceil((priorOffset+Math.max(0,ctx.currentTime+.12-previous.when)/previous.beatSeconds)/quantum)*quantum:0;
   const when=previous&&previous.when>ctx.currentTime?previous.when:previous?previous.when+(nextBeat-priorOffset)*previous.beatSeconds:ctx.currentTime+.08;
   rendered=audio;voiceReady=audio.voicePending?null:!!audio.stems.voice;state();
   const offsetBeats=previous&&same?nextBeat:(pausedBeat??0);
   const next=L.start(ctx,audio,{when,offsetBeats,drumPhase:audio.drumPhase??(current.recording?current.phase:0),repeat:true,fadeIn:previous?.006:0,bass:bassVolume,drums:drums?drumVolume:0,chords:backing?keyVolume:0,voice:voice?voiceVolume:0});
   // A prepared loop may still be waiting for its first beat.
   // Drop that silent replacement before the new one begins.
   if(previous && previous.when>ctx.currentTime){
    previous.cancelPending();
    sessions=sessions.filter(session=>session.transport!==previous);
   }else previous?.stopAt(when,.006);
   transport=next;pausedBeat=null;
   sessions.push({transport:next,plan:current,rendered:audio});
   clearStreamBand?.();const previousRecording=recordedAudio;if(previousRecording){previousRecording.pause();recordedAudio=null;}
   for(const voice of voices)try{voice.stop();}catch{}voices=[];
   cancelAnimationFrame(recordedFrame);
   const tick=()=>{
    if(mine!==token||!playing)return;
    const active=sessions.filter(s=>s.transport.when+(s.transport.latency||0)<=ctx.currentTime).at(-1);
    if(active){
     sessions=sessions.filter(s=>s===active||s.transport.when+(s.transport.latency||0)>ctx.currentTime);
     const elapsed=active.transport.position()-(window.BassPlaybackTiming?.outputDelay(ctx)||0)-(active.transport.latency||0);
     const beat=(Math.max(0,elapsed)%active.rendered.seconds)/active.rendered.beatSeconds;
     if(active.plan===plan){highlightChord(beat);$('fillStatus').textContent=active.rendered.voiceUnavailable?'Voice n/a':'';
      highlightNotes(active.plan.bass,beat,elapsed>=0);
     }else highlightNotes([],0,false);
    }
    recordedFrame=requestAnimationFrame(tick);
   };recordedFrame=requestAnimationFrame(tick);
  }catch(error){if(mine===token&&request===revision){console.warn('Practice audio:',error);$('fillStatus').title=error.message||'Audio unavailable';if(!transport&&!recordedAudio)stop();$('fillStatus').textContent=transport||recordedAudio?'Change unavailable. Loop continues.':'Sound unavailable';}}
 }

 async function playRecording(mine,request,current,choices){
  ctx??=new AudioContext();await ctx.resume();await E.prepare(ctx);
  const stale=()=>mine!==token||request!==revision||!$('earTrainerDialog').open;
  const continuing=recordedAudio&&streamPlan?.clipId===current.clipId&&streamPlan?.part===current.part;
  const audio=continuing?recordedAudio:new Audio(),beat=60/current.bpm,keys=H.arrange(current,choices.style);
  const K=window.BassPracticeKeys;
  let route=continuing?streamRoute:null;
  let metadata,media=continuing?streamMedia:null,bassGain=continuing?streamBassGain:null,drumBuffer;
  if(!continuing){
   audio.preload='auto';audio.preservesPitch=true;
   metadata=new Promise((resolve,reject)=>{
    const started=performance.now();
    const timer=setInterval(()=>{
     if(stale()||performance.now()-started>20000)finish(Error('Recording load interrupted'));
    },150);
    function finish(error){clearInterval(timer);audio.onloadedmetadata=audio.onerror=null;error?reject(error):resolve();}
    audio.onloadedmetadata=()=>finish();audio.onerror=()=>finish(Error('Recording unavailable'));
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
    audio.currentTime=current.sourceStart+(pausedBeat??0)*current.step;audio.muted=true;
    route=E.mixer(ctx,{semitones:current.semitones||0});media=ctx.createMediaElementSource(audio);bassGain=ctx.createGain();bassGain.gain.value=bassVolume;media.connect(bassGain);bassGain.connect(route.pitched);
    await audio.play();
   }
  }catch(error){if(!continuing){audio.pause();media?.disconnect();bassGain?.disconnect();route?.disconnect();}throw error;}
  if(stale()){if(!continuing){audio.pause();media?.disconnect();bassGain?.disconnect();route?.disconnect();}return;}
  if(!continuing)recordedAudio?.pause();
  for(const s of sessions)s.transport.stop();sessions=[];transport=null;clearStreamBand?.(!!continuing);
  streamRoute=route;streamMedia=media;streamBassGain=bassGain;streamRoute.setSemitones(current.semitones||0);audio.muted=false;
  recordedAudio=audio;streamPlan=current;pausedBeat=null;cancelAnimationFrame(recordedFrame);
  const gain=ctx.createGain();gain.connect(streamRoute.drums);streamKeyGain=ctx.createGain();streamKeyGain.gain.value=backing?keyVolume:0;streamKeyGain.connect(streamRoute.guide);const keyContext=Object.assign(Object.create(streamRoute.context),{destination:streamKeyGain});
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
     if(length>0)liveKeys.push({voice:K.tone(keyContext,n,when,length,choices.sound,.22),end:when+length+.25});
    }
   }
  }
  audio.onwaiting=audio.onseeking=stopBand;audio.onplaying=schedule;
  audio.onerror=()=>{if(recordedAudio===audio){stop();$('fillStatus').textContent='Recording unavailable';}};
  const timer=setInterval(schedule,25);
  clearStreamBand=(keepMedia=false)=>{clearInterval(timer);audio.onplaying=audio.onwaiting=audio.onseeking=audio.onerror=null;stopBand();gain.disconnect();streamKeyGain?.disconnect();streamKeyGain=null;if(!keepMedia){route?.disconnect();if(streamRoute===route)streamRoute=null;media.disconnect();bassGain?.disconnect();if(streamBassGain===bassGain)streamBassGain=null;if(streamMedia===media)streamMedia=null;}clearStreamBand=null;};
  const tick=()=>{
   if(recordedAudio!==audio||mine!==token)return;
   const pos=(audio.currentTime-current.sourceStart)/current.step;
   if(current===plan){highlightChord(pos);highlightNotes(current.bass,pos,!audio.paused&&!audio.seeking);}
   recordedFrame=requestAnimationFrame(tick);
  };
  gain.gain.value=drums?drumVolume:0;schedule();
  $('fillStatus').textContent='';
  recordedFrame=requestAnimationFrame(tick);
 }
 function init(panel,hooks){
  api=hooks;panel.innerHTML=`<div id="fillPatternRow" class="fill-settings"><select id="fillGroup" aria-label="Run or fill group"></select><select id="fillCollection" aria-label="Bassline genre" hidden></select><select id="fillIdea" aria-label="Run or fill pattern"></select></div>
  <p id="fillCount" role="status"></p><div id="fillSettings" class="fill-settings"><select id="fillClip" aria-label="Uploaded bassline" hidden></select><select id="fillExcerpt" aria-label="Song section" hidden></select>
  <select id="fillFrom" aria-label="From degree"></select><select id="fillTo" aria-label="To degree"></select>
  <div class="fill-pitch-row"><select id="fillKey" aria-label="Practice key"></select><label id="fillTempoWrap" class="fill-tempo"><span>BPM</span><input id="fillTempo" aria-label="Practice tempo BPM" type="number" min="40" max="220" step="0.01"></label><button id="fillTempoReset" type="button" title="Use the original drum loop tempo">Reset</button></div>
  </div>
  <p id="fillEmpty" hidden>No patterns in this group. Choose another group or restore deleted patterns.</p><div id="fillPlayer"><div class="fill-actions"><button id="fillPlay" type="button">Play</button><button id="fillRepeat" type="button" aria-pressed="false">Repeat</button><button id="fillNext" type="button">Next</button></div><div class="ear-stem-row"><button id="fillBacking" type="button" aria-pressed="true" data-icon="🔊">Others</button><button id="fillDrums" type="button" aria-pressed="true" data-icon="🔊">Drums 🥁</button><button id="fillVoice" type="button" aria-pressed="true" data-icon="🔊">Voice 🎙</button></div><p id="fillAccompaniment"></p><details id="fillDrumOptions"><summary>Band</summary><div class="fill-settings"><label class="fill-band-choice">Drum genre<select id="fillDrumKit" aria-label="Drum genre"></select></label><label class="fill-band-choice">Drum loop<select id="fillDrumGroove" aria-label="Drum loop"></select></label><label class="fill-band-choice">Keys style<select id="fillKeyStyle" aria-label="Keyboard style"></select></label><label class="fill-band-choice">Keys sound<select id="fillKeySound" aria-label="Keyboard sound"></select></label><label class="fill-drum-volume">Drums <input id="fillDrumVolume" type="range" min="0" max="100" step="1" value="21"><output id="fillDrumLevel">21%</output></label><label class="fill-drum-volume"><span id="fillKeyLabel">Keys</span> <input id="fillKeyVolume" type="range" min="0" max="100" step="1" value="7"><output id="fillKeyLevel">7%</output></label><label class="fill-drum-volume">Bass <input id="fillBassVolume" type="range" min="0" max="100" step="1" value="100"><output id="fillBassLevel">100%</output></label><label class="fill-drum-volume">Voice <input id="fillVoiceVolume" type="range" min="0" max="100" step="1" value="21"><output id="fillVoiceLevel">21%</output></label><button id="fillGenreReset" type="button">Reset band</button></div><p id="fillMixNotice" hidden>At 100% Voice, you hear the original vocal. Lower levels use an estimate and may soften nearby instruments.</p></details><h3 id="fillHeading"></h3><p id="fillHarmony" hidden></p><p id="fillDifference" hidden></p>

  <div id="fillNotes" aria-label="Bass fill notes"></div><div id="fillNotePager" hidden aria-label="Note pages"><button id="fillNotePrev" type="button" aria-label="Previous notes">‹</button><output id="fillNotePage"></output><button id="fillNoteNext" type="button" aria-label="Next notes">›</button></div><p id="fillStatus" role="status"></p></div><div class="my-fill-actions"><button id="fillDelete" type="button" aria-label="Delete pattern" title="Delete pattern">Delete</button><button id="fillRestore" type="button" aria-expanded="false" aria-controls="fillDeletedPanel">Deleted</button></div><section id="fillDeletedPanel" hidden aria-label="Deleted items"><div class="fill-deleted-heading"><h3>Deleted</h3><button id="fillDeletedClose" type="button" aria-label="Close deleted items">×</button></div><p id="fillDeletedEmpty" hidden>No deleted items.</p><ul id="fillDeletedList"></ul><button id="fillEmptyDeleted" type="button" aria-label="Permanently empty deleted items" title="Permanently empty deleted items">Empty bin</button></section><p id="fillManageStatus" role="status"></p>`;
  function option(id,value,label){const o=document.createElement('option');o.value=value;o.textContent=label;$(id).append(o);}
  for(const id of ['fillDrumKit','fillDrumGroove','fillKeyStyle','fillKeySound'])option(id,'auto','Auto');
  for(const [id,label] of B.genres)option('fillDrumKit',id,N.menu(label));drumOptions();for(const [id,p] of Object.entries(H.profiles))option('fillKeyStyle',id,N.menu(p.label));for(const [id,label] of [['piano','Grand piano'],['electric','Wurlitzer'],['organ','Organ']])option('fillKeySound',id,label);
  for(const id of ['fillDrumKit','fillKeyStyle','fillKeySound'])N.sortMenu($(id));
  $('fillDrumKit').value=drumKit;$('fillDrumGroove').value=drumGroove;$('fillKeyStyle').value=keyStyle;$('fillKeySound').value=keySound;$('fillDrumVolume').value=Math.round(drumVolume*100);$('fillDrumLevel').textContent=Math.round(drumVolume*100)+'%';$('fillKeyVolume').value=Math.round(keyVolume*100);$('fillKeyLevel').textContent=Math.round(keyVolume*100)+'%';
  const changeSound=event=>{drumKit=$('fillDrumKit').value;if(event?.target.id==='fillDrumKit'){drumGroove='auto';drumOptions();}else drumGroove=$('fillDrumGroove').value;keyStyle=$('fillKeyStyle').value;keySound=$('fillKeySound').value;saveDrums();draw();};
  for(const id of ['fillDrumKit','fillDrumGroove','fillKeyStyle','fillKeySound'])$(id).onchange=changeSound;
  $('fillGenreReset').onclick=()=>{
   bassVolume=1;drumVolume=voiceVolume=.21;keyVolume=.07;drums=backing=voice=true;
   displayMix();level('bass',1);level('drums',drumVolume);level('chords',keyVolume);applyVoiceLevel();saveDrums();state();
   if(usingRecordingMix)return;
   drumKit=drumGroove=keyStyle=keySound='auto';for(const id of ['fillDrumKit','fillKeyStyle','fillKeySound'])$(id).value='auto';drumOptions();practiceTempo=null;changeSound();
  };
  $('fillTempoReset').onclick=()=>{
   practiceTempo=imported()&&plan?plan.originalBpm:null;
   draw();
  };
  $('fillKeyVolume').oninput=()=>{keyVolume=Number($('fillKeyVolume').value)/100;$('fillKeyLevel').textContent=Math.round(keyVolume*100)+'%';level('chords',backing?keyVolume:0);saveDrums();};
  $('fillBassVolume').value=Math.round(bassVolume*100);$('fillBassLevel').textContent=Math.round(bassVolume*100)+'%';
  $('fillBassVolume').oninput=()=>{bassVolume=Number($('fillBassVolume').value)/100;$('fillBassLevel').textContent=Math.round(bassVolume*100)+'%';level('bass',bassVolume);saveDrums();};
  $('fillDrumVolume').oninput=()=>{drumVolume=Number($('fillDrumVolume').value)/100;$('fillDrumLevel').textContent=Math.round(drumVolume*100)+'%';level('drums',drums?drumVolume:0);saveDrums();};
  $('fillVoiceVolume').value=Math.round(voiceVolume*100);$('fillVoiceLevel').textContent=Math.round(voiceVolume*100)+'%';
  $('fillVoiceVolume').oninput=()=>{voiceVolume=Number($('fillVoiceVolume').value)/100;$('fillVoiceLevel').textContent=Math.round(voiceVolume*100)+'%';applyVoiceLevel();saveDrums();};
  $('fillVoice').onclick=()=>{voice=!voice;saveDrums();applyVoiceLevel();state();};
  $('fillDrums').onclick=()=>{drums=!drums;saveDrums();level('drums',drums?drumVolume:0);state();};
  if(G){for(const [id,label] of G.groups)option('fillGroup',id,label);loadGroup();$('fillGroup').onchange=()=>{drumKit=drumGroove='auto';$('fillDrumKit').value='auto';selectedGroups[kind]=$('fillGroup').value;try{localStorage.setItem(groupKey,JSON.stringify(selectedGroups));}catch{}transitionOptions();ideaOptions();draw();};}
  collectionOptions();
  
  clipOptions();
  $('fillCollection').onchange=()=>{drumKit=drumGroove='auto';$('fillDrumKit').value='auto';clipOptions();ideaOptions();draw();};$('fillClip').onchange=()=>{partOptions();draw();};
  $('fillExcerpt').onchange=()=>{if(imported()){const id=$('fillClip').value,part=Number($('fillExcerpt').value.slice(7));$('fillIdea').selectedOptions[0].value='clip:'+id+(part?'/'+part:'');}draw();};
  for(let i=1;i<=7;i++){option('fillFrom',i,'From: '+i);option('fillTo',i,'To: '+i);} $('fillTo').value='4';
  keyOptions();F.styles.forEach((s,i)=>option('fillIdea',i,(i+1)+'. '+s[0]));$('fillTempo').value='80';
  $('fillIdea').onchange=draw;
  $('fillKey').onchange=()=>{if(imported())recordingKeys.set($('fillClip').value,Number($('fillKey').value));draw();};
  for(const id of ['fillFrom','fillTo'])$(id).onchange=()=>{transitionOptions();ideaOptions();draw();};
  let editedIdea='';
  function applyTempo(){
   clearTimeout(tempoTimer);
   const bpm=$('fillTempo').valueAsNumber;
   if(editedIdea!==tempoIdentity||!Number.isFinite(bpm)||bpm<40||bpm>220)return;
   if(plan&&Math.abs(plan.bpm-bpm)<.005)return;
   practiceTempo=bpm;draw();
  }
  $('fillTempo').oninput=()=>{editedIdea=tempoIdentity;clearTimeout(tempoTimer);tempoTimer=setTimeout(applyTempo,350);};
  $('fillTempo').onchange=()=>{editedIdea=tempoIdentity;applyTempo();};
  $('fillTempo').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();editedIdea=tempoIdentity;applyTempo();}};

  $('fillNotePrev').onclick=()=>notePages(notePage-1);$('fillNoteNext').onclick=()=>notePages(notePage+1);
  $('fillPlay').onclick=()=>void play();$('fillRepeat').onclick=()=>{if(!playing&&pausedBeat!==null){api.openHome();return;}if(playing){stop();$('fillStatus').textContent='Stopped';}else void play();};
  $('fillNext').onclick=()=>{
   const active=playing,clip=imported()?U.items.find(c=>c.id===$('fillClip').value):null;
   const excerpt=$('fillExcerpt'),following=excerpt.options[excerpt.selectedIndex+1];
   if(clip?.sections&&following){
    const part=Number(following.value.slice(7));$('fillIdea').selectedOptions[0].value='clip:'+clip.id+(part?'/'+part:'');
   }else{
    $('fillIdea').selectedIndex=($('fillIdea').selectedIndex+1)%$('fillIdea').options.length;
    if(imported()){
     const id=$('fillIdea').value.slice(5).split('/')[0],row=U.items.find(c=>c.id===id);
     if(row?.sections){const part=row.sections.findIndex((_,i)=>D.visible('uploaded',id+'/'+i));$('fillIdea').selectedOptions[0].value='clip:'+id+(part>0?'/'+part:'');}
    }
   }
   draw();if(!active)void play();
  };

  $('fillBacking').onclick=()=>{
   backing=!backing;saveDrums();
   level('chords',backing?keyVolume:0);
   state();
  };
  $('fillDelete').onclick=()=>{const id=deletionKey();if(!id)return;try{D.remove(...id);refreshDeleted();$('fillManageStatus').textContent='Pattern deleted';}catch{$('fillManageStatus').textContent='Could not save deletion.';}};
  $('fillRestore').onclick=()=>{const open=$('fillDeletedPanel').hidden;$('fillDeletedPanel').hidden=!open;$('fillRestore').setAttribute('aria-expanded',String(open));if(open)deletedItems();};
  $('fillEmptyDeleted').onclick=async()=>{
   const count=window.BassCatalogueReview.removed().length;
   if(!count||!window.confirm('Permanently empty '+count+' deleted items? You will not be able to restore them.'))return;
   try{
    D.emptyDeleted();refreshDeleted();
    try{await window.BassLibraryFills?.purgeDeleted?.();}catch{$('fillManageStatus').textContent='Deleted items emptied. Cached fill data could not be cleared.';return;}
    $('fillManageStatus').textContent='Deleted items emptied';
   }catch{$('fillManageStatus').textContent='Could not empty deleted items.';}
  };
  $('fillDeletedClose').onclick=()=>{$('fillDeletedPanel').hidden=true;$('fillRestore').setAttribute('aria-expanded','false');$('fillRestore').focus();};
  window.addEventListener('pagehide',stop);groupOptions();transitionOptions();ideaOptions();draw();
 }
 function setKind(next){
  kind=['fills','runs','basslines'].includes(next)?next:'fills';if(kind==='basslines')clipOptions();$('fillSettings').hidden=false;$('fillNext').hidden=false;groupOptions();transitionOptions();loadGroup();ideaOptions();draw();
 }
 return {init,stop,setKind,noteCard,preview};
})();
