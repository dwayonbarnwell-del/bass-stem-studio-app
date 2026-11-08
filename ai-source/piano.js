/* RC237: independent lead-melody practice; no bass-note substitution. */
window.BassPiano=(()=>{
 'use strict';
 const $=id=>document.getElementById(id),names=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
 const label=m=>names[((m%12)+12)%12]+(Math.floor(m/12)-1),black=m=>[1,3,6,8,10].includes(((m%12)+12)%12);
 let api,data={version:1,notes:[],done:[],jobs:{}},busy=false,token=0,page=-1,signature='',editing=null,undo=null,voice=null;
 const clone=x=>JSON.parse(JSON.stringify(x));
 function clean(raw,duration=Infinity){return (Array.isArray(raw)?raw:[]).filter(n=>Number.isFinite(n.midi)&&Number.isFinite(n.start)&&Number.isFinite(n.end)&&n.midi>=21&&n.midi<=108&&n.start>=0&&n.end>n.start&&n.start<duration).map(n=>({...n,midi:Math.round(n.midi),end:Math.min(duration,n.end)})).sort((a,b)=>a.start-b.start);}
 function range(notes,count){const values=notes.map(n=>n.midi).sort((a,b)=>a-b),middle=values.length?values[Math.floor(values.length/2)]:66;let low=Math.round((middle-(count-1)/2)/12)*12;low=Math.max(24,Math.min(108-count,low));return {low,high:low+count-1};}
 function join(notes){const out=[];for(const n of notes){const prev=out.at(-1);if(n.continuation&&!n.manual&&prev&&!prev.manual&&prev.midi===n.midi&&Math.abs(prev.end-n.start)<.025){prev.end=n.end;prev.confidence=Math.min(prev.confidence,n.confidence);prev.uncertain=prev.uncertain||n.uncertain;}else out.push({...n});}return out;}
 function state(){return api.get();}
 function message(s){$('pianoStatus').textContent=s;}
 function exportData(){return clone(data);}
 function restore(value){token++;busy=false;data={version:1,jobs:value?.jobs&&typeof value.jobs==='object'?clone(value.jobs):{},notes:clean(value?.notes,api?.get().duration||Infinity),done:(value?.done||[]).filter(r=>Number.isFinite(r.start)&&Number.isFinite(r.end)&&r.start>=0&&r.end>r.start)};undo=null;page=-1;signature='';if(api){render(true);message(data.notes.length?'Saved melody · tap a note to correct it. Dotted notes need checking.':'Choose Find melody to analyse the lead vocals.');}}
 function reset(){restore(null);$('pianoEditor')?.close();}
 async function persist(){await api.changed();}
 async function analyse(){
  if(busy)return;const s=state();if(!s.buffer)return message('Import a song first.');if(s.busy)return message('Wait for the current analysis to finish.');
  api.pause();busy=true;const mine=++token,session=s.session;const cancelled=()=>mine!==token||state().session!==session;
  $('pianoAnalyse').disabled=true;$('pianoCancel').hidden=false;
  try{
   for(let start=0;start<s.duration;start+=180){const end=Math.min(start+180,s.duration);if(data.done.some(r=>r.start<=start+.001&&r.end>=end-.001))continue;
    const from=Math.max(0,start-.25),to=Math.min(s.duration,end+.25);
    const job=data.jobs[String(start)]??={};
    const found=await api.cloud({start,end,from,to,job},persist,cancelled,message);
    if(cancelled())return;
    const clipped=found.filter(n=>n.end>start&&n.start<end).map(n=>({...n,start:Math.max(start,n.start),end:Math.min(end,n.end),continuation:n.start<start}));
    // Retain manual corrections, including user deletions, when continuing later.
    const keep=data.notes.filter(n=>n.manual||n.end<=start||n.start>=end);
    data.notes=join(clean([...keep,...clipped.filter(n=>!keep.some(k=>k.manual&&k.start<n.end&&k.end>n.start))],s.duration));
    data.done.push({start,end});signature='';render(true);await persist();
   }
   if(!cancelled())message(data.notes.length?'Melody ready · tap a note to correct it. Check dotted notes and choir passages.':'No clear lead melody found. You can add notes manually.');
  }catch(e){if(!cancelled())message('Melody paused: '+(/load|fetch|network/i.test(e.message)?'The vocal model could not load. Check your connection and try again':e.message)+'. Completed passages are kept.');}
  finally{if(mine===token){busy=false;$('pianoCancel').hidden=true;render(true);}}
 }
 function keyCount(width){return width>=650?36:24;}
 function render(force=false){
  if(!api)return;const s=state(),panel=$('pianoViewPanel');if(panel.hidden&&!force)return;
  const width=panel.clientWidth||340,step=s.step||1,slots=Math.max(2,Math.min(8,Math.floor(width/100))),span=slots*step;
  if(page<0||s.playing)page=Math.floor(s.time/span);page=Math.max(0,Math.min(Math.ceil(s.duration/span)-1,page)||0);
  const start=page*span,end=Math.min(s.duration,start+span),display=data.notes.map(n=>({...n,midi:n.midi+s.transpose}));
  const sig=[page,width,step,s.transpose,data.notes.length,data.done.length,JSON.stringify(s.chords),s.selection].join('|');
  $('pianoAnalyse').disabled=busy||!s.buffer;$('pianoCancel').hidden=!busy;$('pianoAdd').disabled=busy||!s.buffer;$('pianoUndo').disabled=busy||!undo;
  if(force||sig!==signature){signature=sig;const timeline=$('pianoTimeline');timeline.replaceChildren();timeline.style.setProperty('--piano-slots',slots);
   for(let i=0;i<slots;i++){const a=start+i*step,b=Math.min(a+step,s.duration);if(a>=s.duration)break;const col=document.createElement('div');col.className='piano-cell';
    const time=document.createElement('button');time.className='piano-time';time.textContent=api.fmt(a);time.title='Select repeat interval';time.onclick=()=>{api.select(a);signature='';render(true);};time.classList.toggle('selected',api.selected(a));
    const chord=document.createElement('div');chord.className='piano-chord';chord.textContent=s.chords.filter(c=>c.start<b&&c.end>a).map(c=>c.label).filter((v,i,ar)=>ar.indexOf(v)===i).join(' · ')||'—';
    const lane=document.createElement('div');lane.className='piano-notes';
    data.notes.forEach((n,index)=>{if((n.start<a||n.start>=b)&&!(i===0&&n.start<a&&n.end>a))return;const btn=document.createElement('button');btn.className='piano-note'+(n.uncertain&&!n.manual?' uncertain':'');btn.textContent=(n.start<a?'↳ ':'')+label(n.midi+s.transpose);btn.dataset.index=index;btn.dataset.start=n.start;btn.dataset.end=n.end;btn.title=`${label(n.midi+s.transpose)}, ${n.start.toFixed(2)}–${n.end.toFixed(2)} seconds. Tap to correct`;btn.onclick=()=>edit(index);lane.append(btn);});
    col.append(time,chord,lane);timeline.append(col);
   }
   const visible=display.filter(n=>n.end>start&&n.start<end),r=range(visible,keyCount(width)),keyboard=$('pianoKeyboard');keyboard.replaceChildren();const whites=[];for(let m=r.low;m<=r.high;m++)if(!black(m))whites.push(m);
   for(let m=r.low;m<=r.high;m++){const k=document.createElement('button');k.className='piano-key '+(black(m)?'black':'white');k.dataset.midi=m;k.textContent=black(m)?names[m%12]:label(m);k.setAttribute('aria-label','Play '+label(m));const w=100/whites.length;
    const before=whites.filter(n=>n<m).length;k.style.left=((black(m)?before-.32:before)*w)+'%';k.style.width=(black(m)?.64*w:w)+'%';k.onclick=()=>sound(m);keyboard.append(k);}
   $('pianoRange').textContent=label(r.low)+' – '+label(r.high)+' · '+keyCount(width)+' keys';
   $('pianoPrevious').disabled=page===0;$('pianoNext').disabled=end>=s.duration;$('pianoPage').textContent=api.fmt(start)+' – '+api.fmt(end);
  }
  panel.querySelectorAll('.piano-note').forEach(el=>el.classList.toggle('active',s.time>=+el.dataset.start&&s.time<+el.dataset.end));
  const active=display.find(n=>s.time>=n.start&&s.time<n.end);panel.querySelectorAll('.piano-key').forEach(el=>el.classList.toggle('active',!!active&&+el.dataset.midi===active.midi));
  $('pianoNow').textContent=active?label(active.midi):'—';
  if(!s.buffer)message('Import a song, then choose Find melody.');
 }
 function sound(midi){voice??=new AudioContext();voice.resume();const o=voice.createOscillator(),g=voice.createGain();o.type='triangle';o.frequency.value=440*2**((midi-69)/12);g.gain.setValueAtTime(.16,voice.currentTime);g.gain.exponentialRampToValueAtTime(.001,voice.currentTime+.65);o.connect(g).connect(voice.destination);o.start();o.stop(voice.currentTime+.7);}
 function edit(index=null){if(busy)return message('Pause melody analysis before editing notes.');api.pause();editing=index;const s=state(),n=index===null?{midi:60,start:Math.min(s.time,Math.max(0,s.duration-.1)),end:Math.min(s.duration,s.time+.4)}:data.notes[index];$('pianoPitch').value=n.midi+s.transpose;$('pianoStart').value=n.start.toFixed(3);$('pianoEnd').value=n.end.toFixed(3);$('pianoDelete').hidden=index===null;$('pianoEditError').textContent='';$('pianoEditor').showModal();}
 function commit(remove=false){const s=state(),midi=Number($('pianoPitch').value)-s.transpose,start=Number($('pianoStart').value),end=Number($('pianoEnd').value);
  if(!remove&&(!Number.isInteger(midi)||midi<21||midi>108||!Number.isFinite(start+end)||start<0||end<=start||end>s.duration+.001)){$('pianoEditError').textContent='Choose a valid note and times within the song.';return;}
  undo=clone(data);if(editing!==null)data.notes.splice(editing,1);
  if(!remove)data.notes.push({midi,start,end,manual:true,confidence:1,source:'manual'});
  data.notes=clean(data.notes,s.duration);$('pianoEditor').close();signature='';render(true);void persist();
 }
 function init(hooks){api=hooks;const select=$('pianoPitch');for(let m=21;m<=108;m++){const o=document.createElement('option');o.value=m;o.textContent=label(m);select.append(o);}
  $('pianoAnalyse').onclick=analyse;$('pianoCancel').onclick=()=>{token++;busy=false;message('Paused checking. The submitted passage continues on the server. Find melody resumes it.');render(true);};
  $('pianoAdd').onclick=()=>edit();$('pianoUndo').onclick=()=>{if(undo){data=undo;undo=null;signature='';render(true);void persist();}};
  $('pianoSaveNote').onclick=()=>commit();$('pianoDelete').onclick=()=>commit(true);$('pianoCloseNote').onclick=()=>$('pianoEditor').close();
  $('pianoPrevious').onclick=()=>{api.pause();page=Math.max(0,page-1);render(true);};$('pianoNext').onclick=()=>{api.pause();page++;render(true);};
  window.addEventListener('resize',()=>{signature='';render();});render(true);
 }
 return {init,render,reset,exportData,restore,range,keyCount,clean,join,isBusy:()=>busy,follow:()=>{page=-1;signature='';render(true);}};
})();
