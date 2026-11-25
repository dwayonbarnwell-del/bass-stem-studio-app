/* RC239 preview: fitted piano timeline, automatic following and compact controls. */
window.BassPiano=(()=>{
 'use strict';
 const $=id=>document.getElementById(id),A=()=>window.BassPianoAudio,names=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
 const timecode=t=>{const n=Math.round(t*100);return Math.floor(n/6000)+':'+((n%6000)/100).toFixed(2).padStart(5,'0');};
 const label=m=>names[((m%12)+12)%12]+(Math.floor(m/12)-1),black=m=>[1,3,6,8,10].includes(((m%12)+12)%12),clone=x=>JSON.parse(JSON.stringify(x));
 let api,data={version:2,notes:[],done:[],jobs:{}},busy=false,token=0,signature='',editing=null,undo=null,voice=null;
 let auditionPitch=null,auditionTimer=null;
 let preparedSound='',preparedTranspose=null,soundToken=0,keyboardRange=null;
 let zoom=90,noticeTimer=null,frame=0,solo=false,sound='piano',timer=null,lastClock=null,scheduled=new Map(),exporting=false,exportToken=0,recording=null,recordToken=0,take=null,stopping=false,micURL=null;
 let bassFlow=false,rollActive=false,bassExportSound='bass';
 const exportSound=()=>bassFlow?bassExportSound:sound;
 const playbackSound=()=>bassFlow?'bass':'piano';
 const player=()=>bassFlow?window.BassPracticeAudio:A();
 const lineNotes=()=>bassFlow?api.bassNotes():data.notes;
 const state=()=>api.get();
 function message(text){
  clearTimeout(noticeTimer);
  if($('pianoExportDialog')?.open){$('pianoExportStatus').textContent=text;return;}
  $('pianoStatus').textContent=text;$('pianoNotice').hidden=!text;
  if(text&&!busy)noticeTimer=setTimeout(()=>{$('pianoNotice').hidden=true;},6500);
 }
 const refresh=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>render());};
 function clean(raw,duration=Infinity,minMidi=21){return (Array.isArray(raw)?raw:[]).filter(n=>Number.isFinite(n.midi)&&Number.isFinite(n.start)&&Number.isFinite(n.end)&&n.midi>=minMidi&&n.midi<=108&&n.start>=0&&n.end>n.start&&n.start<duration).map(n=>({...n,midi:Math.round(n.midi),end:Math.min(duration,n.end)})).sort((a,b)=>a.start-b.start);}
 function range(notes,count){const values=notes.map(n=>n.midi).sort((a,b)=>a-b),middle=values.length?values[Math.floor(values.length/2)]:66;let bottom=Math.floor((middle-(count-1)/2)/12)*12;bottom=Math.max(21,Math.min(109-count,bottom));return {low:bottom,high:bottom+count-1};}
 function join(notes){const out=[];for(const n of notes){const prev=out.at(-1);if(n.continuation&&!n.manual&&prev&&!prev.manual&&prev.midi===n.midi&&Math.abs(prev.end-n.start)<.025){prev.end=n.end;prev.confidence=Math.min(prev.confidence,n.confidence);prev.uncertain=prev.uncertain||n.uncertain;}else out.push({...n});}return out;}
 function exportData(){return {...clone(data),sound};}
 function restore(value){token++;busy=false;data={version:2,updatedAt:Number(value?.updatedAt)||0,jobs:value?.jobs&&typeof value.jobs==='object'?clone(value.jobs):{},notes:clean(value?.notes,api?.get().duration||Infinity),done:(Array.isArray(value?.done)?value.done:[]).filter(r=>Number.isFinite(r.start)&&Number.isFinite(r.end)&&r.start>=0&&r.end>r.start)};sound=value?.sound==='bass'?'bass':'piano';keyboardRange=null;undo=null;signature='';setSolo(false);if(api){$('pianoSound').value=sound;message('');$('pianoRollViewport').scrollLeft=0;render(true);}}
 function reset(){rollActive=false;bassFlow=false;clearTimeout(auditionTimer);auditionPitch=null;exportToken++;exporting=false;recordToken++;if(recording){void recording.close();recording=null;}take=null;stopping=false;$('pianoLiveDialog')?.close();$('pianoExportDialog')?.close();if(micURL){URL.revokeObjectURL(micURL);micURL=null;}restore(null);$('pianoEditor')?.close();}
 async function persist(){data.updatedAt=Date.now();await api.changed();}
 function passageDone(start,end,automatic){
  return data.done.some(r=>(automatic||!r.estimated||!api.cloudAvailable?.())&&r.start<=start+.001&&r.end>=end-.1);
 }
 function unfinished(automatic=false){const duration=state().duration;for(let start=0;start<duration;start+=180)if(!passageDone(start,Math.min(start+180,duration),automatic))return true;return false;}
 function shortError(e){const t=String(e?.message||e);if(/key|401|403/i.test(t))return 'Check analysis key';if(/network|fetch|load failed|offline/i.test(t))return 'Connection interrupted';if(/repeat range/i.test(t))return 'Select repeat range';if(/No (?:melody|bass) notes/i.test(t))return bassFlow?'No bass notes':'No melody notes';if(/cancel/i.test(t))return 'Melody paused';return 'Melody paused';}
 async function passage(part,cancelled,progress){
  for(let retry=0;;retry++){
   if(cancelled())throw Error('Cancelled');
   try{return await api.cloud(part,persist,cancelled,progress);}
   catch(e){const transient=/network|fetch|load failed|timed? ?out|timeout|disconnect/i.test(String(e?.message))||e?.httpStatus===429||e?.httpStatus>=500;
    if(cancelled()||!part.job.id||part.job.failed||!transient||retry>=2)throw e;
    message('Reconnecting melody');await new Promise(r=>setTimeout(r,3000*(retry+1)));
   }
  }
 }
 async function analyse({automatic=false}={}){
  if(busy)return;const s=state();if(!s.buffer)return message('Import a song');if(s.busy)return message('Analysis in progress');
  if(!automatic)api.pause();busy=true;const mine=++token,session=s.session;const cancelled=()=>mine!==token||state().session!==session;
  render(true);
  try{
   for(let start=0;start<s.duration;start+=180){if(cancelled())return;const end=Math.min(start+180,s.duration);if(passageDone(start,end,automatic))continue;
    const from=Math.max(0,start-.25),to=Math.min(s.duration,end+.25);
    const job=data.jobs[String(start)]??={};
    const progress=()=>message('Melody '+(Math.floor(start/180)+1)+'/'+Math.ceil(s.duration/180));progress();
    const found=await passage({start,end,from,to,job,automatic},cancelled,progress);
    if(cancelled())return;
    const clipped=found.filter(n=>n.end>start&&n.start<end).map(n=>({...n,start:Math.max(start,n.start),end:Math.min(end,n.end),continuation:n.start<start}));
    // Retain manual corrections, including user deletions, when continuing later.
    const keep=data.notes.filter(n=>n.manual||n.end<=start||n.start>=end);
    data.notes=join(clean([...keep,...clipped.filter(n=>!keep.some(k=>k.manual&&k.start<n.end&&k.end>n.start))],s.duration));
    data.done=data.done.filter(r=>r.start!==start);data.done.push({start,end,estimated:!!job.estimated});signature='';if(rollActive&&!bassFlow)setSolo(solo);render(true);await persist();
   }
   if(!cancelled())message(data.notes.length?'Melody ready':'No melody found');
  }catch(e){if(!cancelled())message(shortError(e));}
  finally{if(mine===token){busy=false;render(true);}}
 }

 function keyCount(width){return width>=650?36:24;}
 // Prefer a stable chromatic keyboard. For a wide-ranging passage, spare rows
 // go to neighbouring keys; every pitch in the visible passage is retained.
 function fitKeys(notes,start,end,height,transpose=0){
  const pitches=list=>[...new Set(list.map(n=>n.midi+transpose))].sort((a,b)=>a-b);
  const all=pitches(notes),current=pitches(notes.filter(n=>n.end>start&&n.start<end));
  let use=all.length&&all.at(-1)-all[0]<24?all:current;
  if(!use.length){const near=notes.find(n=>n.end>start)||notes.at(-1);use=near?[near.midi+transpose]:[60,64,67];}
  const low=Math.floor(use[0]/12)*12,high=Math.max(low+23,Math.floor(use.at(-1)/12)*12+11);
  return Array.from({length:high-low+1},(_,i)=>high-i);
 }
 function metrics(){const s=state(),view=$('pianoRollViewport'),gridWidth=Math.max(60,view.clientWidth-58),step=s.step||1,columns=Math.max(1,Math.floor(gridWidth/70)),page=columns*step;return {view,gridWidth,step,page,scale:gridWidth/page,height:Math.max(1,view.clientHeight-$('pianoRollHeader').offsetHeight)};}
 function highlightChord(time){
  for(const el of $('pianoChordRuler').children){
   const current=time>=Number(el.dataset.start)&&time<Number(el.dataset.end);
   el.classList.toggle('current-chord',current);
   if(current)el.setAttribute('aria-current','true');else el.removeAttribute('aria-current');
  }
 }
 function ruler(){if(!api)return;const s=state(),{view,gridWidth,step}=metrics(),time=$('pianoTimeRuler'),chords=$('pianoChordRuler'),a=Math.max(0,view.scrollLeft/zoom),b=Math.min(s.duration,a+gridWidth/zoom);
  const sig=[Math.round(view.scrollLeft),step,s.selection,zoom,JSON.stringify(s.chords)].join('|');if(time.dataset.signature===sig){highlightChord(s.time);return;}time.dataset.signature=sig;time.replaceChildren();chords.replaceChildren();
  for(let t=Math.floor(a/step)*step;t<s.duration&&t<=b;t+=step){const btn=document.createElement('button');btn.className='piano-time';btn.textContent=api.fmt(t);btn.title='Select this repeat interval';btn.style.setProperty('left',t*zoom+'px','important');btn.style.setProperty('width',step*zoom+'px','important');btn.classList.toggle('selected',api.selected(t));btn.onclick=()=>{api.select(t);ruler();};time.append(btn);}
  for(const c of s.chords){if(c.end<=a||c.start>=b)continue;const el=document.createElement('div');el.className='piano-chord';el.dataset.start=c.start;el.dataset.end=c.end;const space=(Math.min(c.end,b)-Math.max(a,c.start))*zoom;el.textContent=space>=c.label.length*8+10?c.label:'';el.title=c.label;el.setAttribute('aria-label',c.label);const left=Math.max(c.start,a);el.style.left=left*zoom+'px';el.style.width=Math.max(0,(Math.min(c.end,b)-left)*zoom)+'px';chords.append(el);}
  highlightChord(s.time);
 }
 function render(force=false){
  if(!api)return;const s=state(),panel=$('pianoViewPanel');
  const complete=s.duration>0&&!unfinished();$('pianoAnalyse').disabled=!s.buffer||exporting||(s.busy&&!busy)||(!busy&&complete);$('pianoAnalyse').innerHTML=busy?'Pause<br>checking':(complete?(data.done.some(r=>r.estimated)?'Estimated<br>melody':'Melody<br>ready'):data.done.length?'Continue<br>melody':'Find<br>melody');
  $('pianoUndo').disabled=busy||!undo||exporting;
  $('pianoSolo').disabled=!lineNotes().length;$('pianoSolo').setAttribute('aria-pressed',String(solo));$('pianoSolo').innerHTML=solo?'Hear<br>song':bassFlow?'Bass<br>only':'Melody<br>only';
  for(const id of ['pianoPrint','pianoWav','pianoMp3','pianoMidi'])$(id).disabled=!lineNotes().length||exporting||busy;
  $('pianoRecord').disabled=busy||s.busy||exporting;$('pianoExportCancel').hidden=!exporting;
  $('pianoExport').disabled=!s.buffer||!lineNotes().length||exporting||busy;
  $('pianoExportTitle').textContent=bassFlow?'Export bass':'Export melody';
  if(panel.hidden)return;
  if(bassFlow){
   $('pianoAnalyse').disabled=true;
   $('pianoAnalyse').textContent=lineNotes().length?(lineNotes()[0].source?.startsWith('estimated-bass')?'Estimated bass':'Bass ready'):s.busy||api.checkingBass()?'Finding bass':'No bass notes';
  }
  const {view,gridWidth,page,scale,height,step}=metrics(),canvas=$('pianoRollCanvas'),grid=$('pianoTimeline'),keyboard=$('pianoKeyboard');
  const oldStart=view.scrollLeft/zoom;zoom=scale;
  const pages=Math.max(1,Math.ceil(s.duration/page)),width=pages*gridWidth;
  panel.style.setProperty('--piano-visible-width',view.clientWidth+'px');canvas.style.width=(width+58)+'px';canvas.style.height=view.clientHeight+'px';
  if(s.playing)view.scrollLeft=Math.min((pages-1)*gridWidth,Math.floor(s.time/page)*gridWidth);
  else if(render.scale!==scale)view.scrollLeft=oldStart*scale;
  render.scale=scale;
  const start=view.scrollLeft/zoom,end=start+page,keys=fitKeys(lineNotes(),start,end,height,s.transpose),row=height/keys.length,visible=lineNotes().map((n,index)=>({...n,index,midi:n.midi+s.transpose})).filter(n=>n.end>start&&n.start<end);
  const sig=[bassFlow,keys.join(','),Math.round(height*100),zoom,s.duration,s.transpose,data.notes.length,data.done.length,visible.map(n=>[n.index,n.start,n.end,n.midi]).join(',')].join('|');
  $('pianoRollCorner').textContent=bassFlow?'Bass':'Vocal';panel.style.setProperty('--piano-row',row+'px');panel.style.setProperty('--piano-label',Math.min(14,Math.max(6,row-1))+'px');
  if(force||sig!==signature){signature=sig;grid.style.width=width+'px';grid.style.height=height+'px';grid.style.backgroundSize=step*zoom+'px '+row+'px';keyboard.style.height=height+'px';grid.replaceChildren();keyboard.replaceChildren();
   keys.forEach((m,i)=>{const k=document.createElement('button');k.className='piano-key '+(black(m)?'black':'white')+(i&&keys[i-1]-m>1?' pitch-gap':'');k.dataset.midi=m;k.textContent=label(m);k.setAttribute('aria-label','Play '+label(m));k.title='Play '+label(m);k.style.setProperty('top',i*row+'px','important');k.disabled=busy||exporting;k.onclick=()=>void audition(m);keyboard.append(k);});
   visible.forEach(n=>{const index=keys.indexOf(n.midi);if(index<0)return;const btn=document.createElement('button');btn.className='piano-note'+(n.uncertain&&!n.manual?' uncertain':'');const noteWidth=Math.max(5,(Math.min(n.end,end)-Math.max(n.start,start))*zoom);btn.textContent=noteWidth>=28?label(n.midi):'';btn.dataset.index=n.index;btn.dataset.start=n.start;btn.dataset.end=n.end;btn.style.setProperty('left',Math.max(n.start,start)*zoom+'px','important');btn.style.setProperty('top',index*row+1+'px','important');btn.style.setProperty('width',noteWidth+'px','important');btn.title=`${label(n.midi)}, ${n.start.toFixed(2)} to ${n.end.toFixed(2)} seconds. Tap to correct`;btn.setAttribute('aria-label',btn.title);btn.onclick=()=>bassFlow?audition(n.midi):edit(n.index);grid.append(btn);});
   grid.onclick=e=>{if(bassFlow||e.target!==grid)return;const box=grid.getBoundingClientRect(),pitch=keys[Math.min(keys.length-1,Math.floor((e.clientY-box.top)/row))],time=Math.max(0,Math.min(s.duration-.025,(e.clientX-box.left)/zoom));void addAtPlayhead(pitch,time);};
   const playhead=document.createElement('div');playhead.id='pianoPlayhead';playhead.setAttribute('aria-hidden','true');grid.append(playhead);
   $('pianoTimeRuler').dataset.signature='';
  }
  const playheadVisible=s.time>=start&&s.time<end;const active=new Set(lineNotes().filter(n=>s.playing&&playheadVisible&&s.time>=n.start&&s.time<n.end).map(n=>n.midi+s.transpose));
  panel.querySelectorAll('.piano-note').forEach(el=>el.classList.toggle('active',s.playing&&playheadVisible&&s.time>=+el.dataset.start&&s.time<+el.dataset.end));panel.querySelectorAll('.piano-key').forEach(el=>{el.classList.toggle('active',active.has(+el.dataset.midi));el.classList.toggle('auditioning',auditionPitch===Number(el.dataset.midi));});
  $('pianoPlayhead').style.left=s.time*zoom+'px';view.scrollTop=0;ruler();
 }
 async function addAtPlayhead(displayPitch,chosenTime=null){
  if(busy||exporting)return;const s=state();if(!s.buffer||!s.duration){void audition(displayPitch);return message('Import a song');}
  const midi=displayPitch-s.transpose;if(midi<21||midi>108)return message('Choose another note');
  api.pause();const start=Math.min(chosenTime??s.time,Math.max(0,s.duration-.1)),existing=data.notes.findIndex(n=>n.midi===midi&&n.start<=start+.01&&n.end>start);
  if(existing>=0){void audition(displayPitch);edit(existing);return;}
  const next=data.notes.filter(n=>n.start>start+.025).reduce((t,n)=>Math.min(t,n.start),s.duration),end=Math.min(s.duration,next,start+.4);
  undo=clone(data);data.notes=clean([...data.notes,{midi,start,end,manual:true,confidence:1,source:'manual'}],s.duration);stopVoices();signature='';render(true);void audition(displayPitch);await persist();
 }
 function stopVoices(){for(const n of scheduled.values())n.voice.stop();scheduled.clear();lastClock=null;}
 function transport(){if(!rollActive||!api)return;const sound=playbackSound(),s=state();s.time=s.transportTime??s.time;if(!s.playing){stopVoices();return;}if(preparedSound===sound&&preparedTranspose!==s.transpose){preparedSound='';stopVoices();void unlock().then(transport).catch(()=>message('Sound unavailable'));return;}if(!voice||voice.state!=='running'||preparedSound!==sound)return;
  const rate=Math.max(.25,s.speed/100||1),now=voice.currentTime;if(lastClock&&(Math.abs(s.time-lastClock.song-(now-lastClock.audio)*rate)>.12||lastClock.rate!==rate||lastClock.transpose!==s.transpose))stopVoices();lastClock={song:s.time,audio:now,rate,transpose:s.transpose};
  for(const [i,item] of scheduled)if(item.end+(sound==='piano'?.24*rate:0)<=s.time)scheduled.delete(i);
  lineNotes().forEach((n,i)=>{if(n.end<=s.time||n.start>s.time+.18*rate||scheduled.has(i))return;const age=Math.max(0,s.time-n.start)/rate,length=(n.end-n.start)/rate;scheduled.set(i,{end:n.end,voice:player().tone(voice,n.midi+s.transpose,now+Math.max(0,n.start-s.time)/rate,length,sound,age,n.velocity)});});
 }
 async function unlock(extra=[]){voice??=new AudioContext();const selected=playbackSound(),transpose=state().transpose,mine=soundToken;if(voice.state!=='running')await voice.resume();await A().prepare(selected,voice,{notes:[...lineNotes().map(n=>({...n,midi:n.midi+transpose})),...extra]});if(mine!==soundToken||selected!==playbackSound())return false;preparedSound=selected;preparedTranspose=transpose;return true;}
 function setSolo(on){soundToken++;solo=!!on;stopVoices();if(timer)clearInterval(timer);timer=null;api?.solo(solo);if(rollActive){const mine=soundToken;preparedSound='';void unlock().then(ready=>{if(ready&&mine===soundToken)transport();}).catch(()=>{if(mine===soundToken)message('Sound unavailable');});timer=setInterval(transport,35);}if(api){$('pianoSolo').setAttribute('aria-pressed',String(solo));$('pianoSolo').innerHTML=solo?'Hear<br>song':bassFlow?'Bass<br>only':'Melody<br>only';}}
 async function audition(midi){const mine=soundToken;try{if(await unlock([{midi,velocity:80}])&&mine===soundToken){player().tone(voice,midi,voice.currentTime,.65,playbackSound());clearTimeout(auditionTimer);auditionPitch=midi;render();auditionTimer=setTimeout(()=>{auditionPitch=null;render();},750);}}catch{message('Sound unavailable');}}
 function edit(index=null){if(busy||exporting)return message('Pause melody first');api.pause();editing=index;const s=state(),n=index===null?{midi:60,start:Math.min(s.time,Math.max(0,s.duration-.1)),end:Math.min(s.duration,s.time+.4)}:data.notes[index];$('pianoPitch').value=n.midi+s.transpose;$('pianoStart').value=n.start.toFixed(3);$('pianoEnd').value=n.end.toFixed(3);$('pianoDelete').hidden=index===null;$('pianoEditError').textContent='';$('pianoEditor').showModal();}
 function commit(remove=false){const s=state(),midi=Number($('pianoPitch').value)-s.transpose,start=Number($('pianoStart').value),end=Number($('pianoEnd').value);if(!remove&&(!Number.isInteger(midi)||midi<21||midi>108||!Number.isFinite(start+end)||start<0||end<=start||end>s.duration+.001)){$('pianoEditError').textContent='Check note times';return;}
  undo=clone(data);if(editing!==null)data.notes.splice(editing,1);if(!remove)data.notes.push({midi,start,end,manual:true,confidence:1,source:'manual'});data.notes=clean(data.notes,s.duration);stopVoices();$('pianoEditor').close();signature='';render(true);void persist();
 }
 function exportRange(){
  const s=state(),selection=$('pianoExportScope').value==='selection',ranges=(selection?s.repeatRanges||[]:[{start:0,end:s.duration}]).filter(r=>Number.isFinite(r.start+r.end)&&r.end>r.start).map(r=>({start:Math.max(0,r.start),end:Math.min(s.duration,r.end)})).filter(r=>r.end>r.start);
  if(!ranges.length)throw Error('Select a repeat range using the existing controls first.');
  const notes=[];let offset=0;
  const source=clean(lineNotes(),s.duration,bassFlow?0:21);
  for(const r of ranges){for(const n of source){if(n.end<=r.start||n.start>=r.end)continue;const a=Math.max(r.start,n.start),b=Math.min(r.end,n.end);notes.push({...n,start:offset+a-r.start,end:offset+b-r.start,originalStart:a});}offset+=r.end-r.start;}
  return {notes,start:0,end:offset,selection};
 }
 function download(blob,extension,line='melody'){const name=(state().title||'Song').replace(/\.[^.]+$/,'').replace(/[\\/:*?"<>|]/g,'_'),a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name+' - '+line+'.'+extension;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
 async function exportFile(format){if(exporting)return;const s=state(),mine=++exportToken,line=bassFlow?'bass-flow':'melody',instrument=exportSound();try{const r=exportRange(),notes=clean(r.notes.map(n=>({...n,midi:n.midi+s.transpose})),Infinity,bassFlow?0:21);if(!notes.some(n=>n.end>r.start&&n.start<r.end))throw Error(bassFlow?'No bass notes in this range.':'No melody notes in this range.');if(format==='mid'){download(A().midi(notes,r.start,r.end,instrument),'mid',line);message('MIDI exported');return;}exporting=true;render(true);const blob=await A().exportAudio({...r,notes,sound:instrument,format,encoder:api.encoder,cancelled:()=>mine!==exportToken||s.session!==state().session,progress:p=>message('Exporting '+format.toUpperCase()+' '+p+'%')});if(mine!==exportToken||s.session!==state().session)return;download(blob,format,line);message(format.toUpperCase()+' exported');}catch(e){if(mine===exportToken)message(shortError(e));}finally{if(mine===exportToken){exporting=false;render(true);}}}
 function printSheet(){try{const s=state(),r=exportRange(),selected=r.notes;if(!selected.length)throw Error(bassFlow?'No bass notes in this range.':'No melody notes in this range.');api.pause();$('pianoPrintSheet')?.remove();const sheet=document.createElement('section');sheet.id='pianoPrintSheet';const title=document.createElement('h1');title.textContent=(s.title||'Song')+(bassFlow?' · Bass notes':' · Melody notes');const info=document.createElement('p');info.textContent=(r.selection?'Selected repeat':'Whole song')+' · original song timings. Displayed key; * means check this note. Timings are not rhythm notation.';const table=document.createElement('table'),thead=document.createElement('thead'),hr=document.createElement('tr');for(const text of ['Time','Note','Length','Chord']){const th=document.createElement('th');th.textContent=text;hr.append(th);}thead.append(hr);table.append(thead);const body=document.createElement('tbody');for(const n of selected){const a=Math.max(r.start,n.start),b=Math.min(r.end,n.end),tr=document.createElement('tr'),c=s.chords.find(c=>c.start<=n.originalStart&&c.end>n.originalStart);for(const text of [timecode(n.originalStart),label(n.midi+s.transpose)+(n.uncertain&&!n.manual?' *':''),(b-a).toFixed(2)+'s',c?.label||'—']){const td=document.createElement('td');td.textContent=text;tr.append(td);}body.append(tr);}table.append(body);sheet.append(title,info,table);document.body.append(sheet);window.addEventListener('afterprint',()=>sheet.remove(),{once:true});$('pianoExportDialog').close();window.print();}catch(e){message(shortError(e));}}
 function micMessage(text){$('pianoLiveStatus').textContent=text;}
 function micButtons(active){$('pianoLiveStart').disabled=active;$('pianoLiveStop').disabled=!active;$('pianoLiveUse').disabled=active||!take?.notes.length;}
 async function startCapture(){if(recording||stopping)return;const mine=++recordToken;take=null;micButtons(true);micMessage('Allow microphone access');if(micURL){URL.revokeObjectURL(micURL);micURL=null;}$('pianoLivePreview').removeAttribute('src');$('pianoLivePreview').hidden=true;
  try{recording=await A().capture({cancelled:()=>mine!==recordToken,update:({time,pitch,notes,limit})=>{if(mine!==recordToken)return;$('pianoLiveNote').textContent=pitch?label(pitch.midi):'—';micMessage('Recording '+api.fmt(time));if(limit)void stopCapture();}});if(mine!==recordToken){await recording.close();recording=null;}}catch(e){if(mine===recordToken){micButtons(false);micMessage(e.name==='NotAllowedError'?'Allow microphone access':'Recording paused');}}
 }
 async function stopCapture(){if(stopping)return;if(!recording){recordToken++;micButtons(false);return;}stopping=true;const active=recording;recording=null;try{take=await active.stop();micURL=URL.createObjectURL(take.blob);$('pianoLivePreview').src=micURL;$('pianoLivePreview').hidden=false;micMessage(take.notes.length?take.notes.length+' notes captured':'No melody found');}finally{stopping=false;micButtons(false);}}
 async function useCapture(){if(!take?.notes.length||stopping)return;const chosen=take;$('pianoLiveUse').disabled=true;try{await api.openRecording(chosen,$('pianoLiveName').value.trim()||'Live melody');$('pianoLiveDialog').close();message('Melody saved');}catch(e){micMessage('Recording paused');$('pianoLiveUse').disabled=false;}}
 function init(hooks){api=hooks;

  const select=$('pianoPitch');for(let m=21;m<=108;m++){const o=document.createElement('option');o.value=m;o.textContent=label(m);select.append(o);}
  $('pianoAnalyse').onclick=()=>{if(busy){token++;busy=false;message('Melody paused');render(true);}else return analyse();};
  $('pianoUndo').onclick=()=>{if(undo){data=undo;undo=null;stopVoices();$('pianoEditor').close();signature='';render(true);void persist();}};$('pianoSaveNote').onclick=()=>commit();$('pianoDelete').onclick=()=>commit(true);$('pianoCloseNote').onclick=()=>$('pianoEditor').close();
  $('pianoSolo').onclick=()=>{setSolo(!solo);};$('pianoSound').onchange=()=>{soundToken++;if(bassFlow)bassExportSound=$('pianoSound').value;else sound=$('pianoSound').value;preparedSound='';stopVoices();if(rollActive)setSolo(solo);if(!bassFlow)void persist();};
  const view=$('pianoRollViewport');view.addEventListener('scroll',refresh,{passive:true});
  $('pianoDismiss').onclick=()=>$('pianoNotice').hidden=true;
  $('pianoExport').onclick=()=>{$('pianoSound').value=exportSound();$('pianoExportStatus').textContent='';$('pianoNotice').hidden=true;$('pianoExportDialog').showModal();render();};
  const closeExport=()=>{if(exporting){exportToken++;exporting=false;render();}$('pianoExportDialog').close();};$('pianoExportClose').onclick=closeExport;$('pianoExportDialog').oncancel=e=>{e.preventDefault();closeExport();};
  $('pianoPrint').onclick=printSheet;$('pianoWav').onclick=()=>exportFile('wav');$('pianoMp3').onclick=()=>exportFile('mp3');$('pianoMidi').onclick=()=>exportFile('mid');$('pianoExportCancel').onclick=()=>{exportToken++;exporting=false;message('Export cancelled.');render(true);};
  $('pianoRecord').onclick=()=>{if(state().busy||busy)return;api.pause();setSolo(false);$('pianoLiveDialog').showModal();micButtons(!!recording);};$('pianoLiveStart').onclick=startCapture;$('pianoLiveStop').onclick=stopCapture;$('pianoLiveUse').onclick=useCapture;
  const closeMic=async()=>{await stopCapture();recordToken++;$('pianoLivePreview').pause();$('pianoLiveDialog').close();};$('pianoLiveClose').onclick=closeMic;$('pianoLiveDialog').oncancel=e=>{e.preventDefault();void closeMic();};
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&recording)void stopCapture();});window.addEventListener('pagehide',()=>{if(recording)void recording.close();setSolo(false);});window.addEventListener('resize',refresh);new ResizeObserver(refresh).observe(view);render(true);
 }
 function follow(){if(!api||$('pianoViewPanel').hidden)return;render(true);const {view,gridWidth,page}=metrics(),pages=Math.max(1,Math.ceil(state().duration/page));view.scrollLeft=Math.min((pages-1)*gridWidth,Math.floor(state().time/page)*gridWidth);signature='';render(true);}
 function setLine(bass){if(rollActive&&bassFlow===bass)return;rollActive=true;bassFlow=bass;signature='';setSolo(false);render(true);}
 function leave(){rollActive=false;bassFlow=false;const wasSolo=solo;setSolo(false);if(wasSolo)message('Song sound restored');}
 return {outputLatency:()=>solo&&voice?window.BassPlaybackTiming.outputDelay(voice):null,init,render,message,reset,analyse,unfinished,exportData,restore,range,keyCount,fitKeys,clean,join,isBusy:()=>busy||exporting,follow,transport,stopVoices,setLine,leave,isSolo:()=>solo,preparePlayback:()=>{if(rollActive)void unlock().catch(()=>message('Sound unavailable'));}};
})();
