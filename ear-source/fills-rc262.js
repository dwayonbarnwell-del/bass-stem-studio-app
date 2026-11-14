/* Original two-bar bass studies. Degrees follow the selected major/natural-minor scale. */
window.BassFillCore=(()=>{
 'use strict';
 const names=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
 const scales={major:[0,2,4,5,7,9,11],minor:[0,2,3,5,7,8,10]};
 const styles=[
  ['Soul walk','A fifth, then a flowing scale approach.'],
  ['Octave lift','An octave jump with a late pickup.'],
  ['Gospel triplets','Six triplets curl around the landing note.'],
  ['Chromatic turn','Short outside notes resolve to the next root.'],
  ['Syncopated pocket','Space, offbeats and a sixteenth-note pickup.'],
  ['Broken-chord lift','Wide chord tones descend into the new root.'],
  ['Jazz fill','Swung chord tones and a chromatic enclosure.'],
  ['Blues fill','Blue notes and triplets resolve into the next root.'],
  ['Pentatonic fill','A five-note scale run between the two chord roots.'],
  ['Contemporary worship','Open fifths, an octave lift and a gentle pickup.']
 ];
 const pc=m=>(m%12+12)%12, note=m=>names[pc(m)]+(Math.floor(m/12)-1);
 function make({key=0,mode='major',from=1,to=4,idea=0,bpm=80}={}){
  key=pc(Math.round(Number(key)||0));mode=mode==='minor'?'minor':'major';
  from=Math.max(1,Math.min(7,Math.round(Number(from)||1)));to=Math.max(1,Math.min(7,Math.round(Number(to)||4)));
  if(from===to)to=from%7+1;idea=Math.max(0,Math.min(styles.length-1,Math.round(Number(idea)||0)));bpm=Math.max(40,Math.min(160,Number(bpm)||80));
  const scale=scales[mode],tonic=36+key-(key+scale[from-1]>=12?12:0),degree=n=>tonic+scale[(n%7+7)%7]+12*Math.floor(n/7),source=degree(from-1);
  let targetIndex=to-1;
  while(degree(targetIndex)-source>6)targetIndex-=7;
  while(degree(targetIndex)-source< -6)targetIndex+=7;
  const target=degree(targetIndex),third=degree(from+1),fifth=degree(from+3),octave=source+12;
  const minorThird=third-source===3,blues=minorThird?[0,3,5,6,7,10]:[0,2,3,4,7,9];
  const pentatonic=mode==='minor'?[0,3,5,7,10]:[0,2,4,7,9];
  const pentRun=Array.from({length:72},(_,i)=>24+i).filter(m=>m>target&&pentatonic.includes(pc(m-tonic))).slice(0,4).reverse();
  const lines=[
   [[0,source,1.4],[1.5,fifth,.4],[2,degree(targetIndex-3),.4],[2.5,degree(targetIndex-2),.4],[3,degree(targetIndex-1),.85]],
   [[0,source,.8],[1.5,octave,.4],[2.25,fifth,.35],[2.75,third,.35],[3.25,source,.3],[3.75,target-1,.2]],
   [[0,source,1.4],[2,third,.27],[2+1/3,fifth,.27],[2+2/3,octave,.27],[3,target+2,.27],[3+1/3,target-1,.27],[3+2/3,target+1,.27]],
   [[0,source,1.2],[1.5,fifth,.6],[2.5,target+2,.2],[2.75,target+1,.2],[3.25,target-2,.2],[3.5,target-1,.4]],
   [[0,source,.6],[1.25,octave,.35],[2,third,.4],[2.75,fifth,.35],[3.25,degree(targetIndex-1),.35],[3.75,target-1,.2]],
   [[0,source,.8],[1,third+12,.4],[1.5,octave,.4],[2.25,fifth,.35],[2.75,third,.35],[3.25,target+2,.35],[3.75,target+1,.2]],
   [[0,source,.85],[1,third,.58],[1+2/3,fifth,.25],[2,target+2,.58],[2+2/3,target-1,.25],[3,target+1,.58],[3+2/3,target-1,.25]],
   [[0,source,.85],[1,source+blues[2],.27],[1+1/3,source+blues[3],.27],[1+2/3,source+blues[4],.27],[2,source+blues[5],.4],[2.5,source+blues[4],.4],[3,target-2,.4],[3.5,target-1,.4]],
   [[0,source,1.2],[1.5,pentRun[0],.4],[2,pentRun[1],.4],[2.5,pentRun[2],.4],[3,pentRun[3],.85]],
   [[0,source,1.35],[1.5,fifth,.4],[2,octave,.8],[3,degree(targetIndex-1),.4],[3.5,target,.35]]
  ];
  const bass=lines[idea].map(([beat,midi,length],i)=>({midi,beat,length,velocity:i===0?88:78+(i%3)*4,role:'bass'}));
  bass.push({midi:target,beat:4,length:2.9,velocity:94,role:'landing'});
  const triad=d=>[0,2,4].map(n=>degree(d-1+n)+24);
  const chordName=d=>{const notes=triad(d),a=notes[1]-notes[0],b=notes[2]-notes[0];return names[pc(notes[0])]+(b===6?'dim':b===8?'aug':a===3?'m':'');};
  const chords=[...triad(from).map(midi=>({midi,beat:0,length:3.7,velocity:48,role:'chord'})),...triad(to).map(midi=>({midi,beat:4,length:3.5,velocity:50,role:'chord'}))];
  return {key,mode,from,to,idea,bpm,beats:8,source,target,bass,chords,title:styles[idea][0],tip:styles[idea][1],fromChord:chordName(from),toChord:chordName(to)};
 }
 return {make,styles,names,scales,note};
})();

window.BassFillTrainer=(()=>{
 'use strict';
 const F=window.BassFillCore,$=id=>document.getElementById(id);
 let api,ctx,voices=[],timers=[],token=0,playing=false,repeating=false,backing=true,plan;
 function later(fn,ms){timers.push(setTimeout(fn,ms));}
 function state(){ $('fillPlay').textContent=playing?'Stop':'Play';$('fillRepeat').setAttribute('aria-pressed',String(repeating));$('fillBacking').textContent=backing?'Chords on':'Bass only';$('fillBacking').setAttribute('aria-pressed',String(backing)); }
 function stop(){token++;playing=false;repeating=false;timers.forEach(clearTimeout);timers=[];voices.forEach(v=>{try{v.stop();}catch{}});voices=[];if($('fillPlay')){state();for(const e of $('fillNotes').children)e.classList.remove('sounding');}}
 function settings(){return {key:$('fillKey').value,mode:$('fillMode').value,from:$('fillFrom').value,to:$('fillTo').value,idea:$('fillIdea').value,bpm:$('fillTempo').value};}
 function draw(){
  stop();if($('fillFrom').value===$('fillTo').value)$('fillTo').value=String(Number($('fillFrom').value)%7+1);
  for(const o of $('fillTo').options)o.disabled=o.value===$('fillFrom').value;
  plan=F.make(settings());$('fillHeading').textContent=plan.from+' → '+plan.to+' · '+plan.fromChord+' → '+plan.toChord;
  $('fillTip').textContent=plan.tip;$('fillStatus').textContent='Two bars · land on beat 1';$('fillNotes').replaceChildren();
  plan.bass.forEach((n,i)=>{const b=document.createElement('button');b.type='button';b.textContent=F.note(n.midi);b.title=F.note(n.midi)+' · beat '+(Math.round((n.beat%4+1)*100)/100);b.setAttribute('aria-label','Hear '+F.note(n.midi));b.dataset.index=i;if(n.role==='landing')b.classList.add('landing');b.onclick=()=>void preview(n);$('fillNotes').append(b);});state();
 }
 async function preview(n){
  stop();const mine=token;try{ctx??=new AudioContext();await ctx.resume();await window.BassPianoAudio.prepare('bass',ctx,{notes:[n]});if(mine!==token)return;voices.push(window.BassPianoAudio.tone(ctx,n.midi,ctx.currentTime,.65,'bass',0,85,.8));}catch{$('fillStatus').textContent='Sound unavailable';}
 }
 async function play(again=false){
  if(playing&&!again){stop();$('fillStatus').textContent='Stopped';return;}
  if(api?.busy?.()){$('fillStatus').textContent='Finish recording first';return;}
  const repeat=repeating;stop();repeating=repeat;playing=true;const mine=token;state();api?.pause?.();$('fillStatus').textContent='Loading sound';
  try{
   ctx??=new AudioContext();await ctx.resume();const A=window.BassPianoAudio;
   await A.prepare('bass',ctx,{notes:plan.bass});if(backing)await A.prepare('piano',ctx,{notes:plan.chords});
   if(mine!==token||!$('earTrainerDialog').open)return;
   const start=ctx.currentTime+.08,beat=60/plan.bpm,delay=window.BassPlaybackTiming?.outputDelay(ctx)||0;
   $('fillStatus').textContent='Listen to the landing';
   for(const n of [...plan.bass,...(backing?plan.chords:[])])voices.push(A.tone(ctx,n.midi,start+n.beat*beat,n.length*beat,n.role==='chord'?'piano':'bass',0,n.velocity,n.role==='chord'?.24:.8));
   plan.bass.forEach((n,i)=>{const e=$('fillNotes').children[i];later(()=>e.classList.add('sounding'),(.08+n.beat*beat+delay)*1000);later(()=>e.classList.remove('sounding'),(.08+(n.beat+n.length)*beat+delay)*1000);});
   later(()=>{if(mine!==token)return;playing=false;state();$('fillStatus').textContent='Play it again';if(repeating)void play(true);},(.08+plan.beats*beat+delay)*1000);
  }catch{if(mine===token){stop();$('fillStatus').textContent='Sound unavailable';}}
 }
 function init(panel,hooks){
  api=hooks;panel.innerHTML=`<div class="fill-settings">
  <select id="fillFrom" aria-label="From degree"></select><select id="fillTo" aria-label="To degree"></select>
  <select id="fillKey" aria-label="Fill key"></select><select id="fillMode" aria-label="Fill scale"><option value="major">Major</option><option value="minor">Minor</option></select>
  <select id="fillIdea" aria-label="Fill idea"></select><select id="fillTempo" aria-label="Fill tempo"></select></div>
  <h3 id="fillHeading"></h3><p id="fillTip"></p>
  <div class="fill-actions"><button id="fillPlay" type="button">Play</button><button id="fillRepeat" type="button" aria-pressed="false">Repeat</button><button id="fillNext" type="button">Next idea</button><button id="fillBacking" type="button" aria-pressed="true">Chords on</button></div>
  <div id="fillNotes" aria-label="Bass fill notes"></div><p id="fillStatus" role="status"></p>`;
  function option(id,value,label){const o=document.createElement('option');o.value=value;o.textContent=label;$(id).append(o);}
  for(let i=1;i<=7;i++){option('fillFrom',i,'From: '+i);option('fillTo',i,'To: '+i);} $('fillTo').value='4';
  F.names.forEach((n,i)=>option('fillKey',i,'Key: '+n));F.styles.forEach((s,i)=>option('fillIdea',i,(i+1)+'. '+s[0]));[40,50,60,70,80,90,100,110,120,140,160].forEach(n=>option('fillTempo',n,n+' BPM'));$('fillTempo').value='80';
  for(const id of ['fillFrom','fillTo','fillKey','fillMode','fillIdea','fillTempo'])$(id).onchange=draw;
  $('fillPlay').onclick=()=>void play();$('fillRepeat').onclick=()=>{if(repeating){stop();$('fillStatus').textContent='Repeat stopped';}else{repeating=true;if(!playing)void play();else state();}};
  $('fillNext').onclick=()=>{$('fillIdea').value=String((Number($('fillIdea').value)+1)%F.styles.length);draw();void play();};
  $('fillBacking').onclick=()=>{backing=!backing;const resume=playing;stop();state();if(resume)void play();};
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});window.addEventListener('pagehide',stop);draw();
 }
 return {init,stop};
})();
