window.BassFillTrainer=(()=>{
 'use strict';
 const F=window.BassFillCore,P=window.BassPracticeCore,$=id=>document.getElementById(id);
 let api,ctx,voices=[],timers=[],token=0,playing=false,repeating=false,backing=true,plan,kind='fills',selected=null;
 const remembered={fills:'0',runs:'0',basslines:'0'};
 const collections=()=>kind==='runs'?P.runs:kind==='basslines'?P.lines.map(x=>[x.name,x.tip]):F.styles;
 function later(fn,ms){timers.push(setTimeout(fn,ms));}
 function state(){ $('fillPlay').textContent=playing?'Stop':'Play';$('fillPlay').disabled=!plan;$('fillRepeat').disabled=!plan;$('fillRepeat').setAttribute('aria-pressed',String(repeating));$('fillBacking').textContent=backing?'Chords on':'Bass only';$('fillBacking').setAttribute('aria-pressed',String(backing)); }
 function stop(){token++;playing=false;repeating=false;timers.forEach(clearTimeout);timers=[];voices.forEach(v=>{try{v.stop();}catch{}});voices=[];if($('fillPlay')){state();for(const e of $('fillNotes').children)e.classList.remove('sounding');}}
 function settings(){return {key:$('fillKey').value,mode:$('fillMode').value,from:$('fillFrom').value,to:$('fillTo').value,idea:$('fillIdea').value,bpm:$('fillTempo').value};}
 function draw(){
  stop();if(kind==='library'){if(selected)showPlan(window.BassTransitionCore.plan(selected,Number($('fillSpeed').value)));return;}if($('fillFrom').value===$('fillTo').value)$('fillTo').value=String(Number($('fillFrom').value)%7+1);
  for(const o of $('fillTo').options)o.disabled=o.value===$('fillFrom').value;
  remembered[kind]=$('fillIdea').value;showPlan(P.make(kind,settings()));
 }
 function showPlan(value){
  plan=value;$('fillPlayer').hidden=!plan;if(!plan)return;
  $('fillHeading').textContent=plan.heading||plan.from+' → '+plan.to+' · '+plan.fromChord+' → '+plan.toChord;
  $('fillTip').textContent=plan.title+' · '+plan.tip;$('fillStatus').textContent=kind==='library'?'Selected: '+selected.title+' · '+window.BassLibraryFills.time(selected.change):kind==='basslines'?'Four-bar loop':'Two bars · land on beat 1';$('fillModeGuide').textContent=kind==='library'?'':P.modes[plan.mode][1];$('fillNotes').replaceChildren();
  plan.bass.forEach((n,i)=>{const b=document.createElement('button');b.type='button';b.textContent=F.note(n.midi);b.title=F.note(n.midi)+' · beat '+(Math.round((n.beat%4+1)*100)/100);b.setAttribute('aria-label','Hear '+F.note(n.midi));b.dataset.index=i;if(n.role==='landing')b.classList.add('landing');b.onclick=()=>void preview(n);$('fillNotes').append(b);});state();
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
  api=hooks;panel.innerHTML=`<div id="fillLibrary" hidden></div><div id="fillSettings" class="fill-settings">
  <select id="fillFrom" aria-label="From degree"></select><select id="fillTo" aria-label="To degree"></select>
  <select id="fillKey" aria-label="Fill key"></select><select id="fillTempo" aria-label="Fill tempo"></select><select id="fillMode" aria-label="Fill scale"></select>
  <select id="fillIdea" aria-label="Fill idea"></select></div>
  <div id="fillPlayer"><h3 id="fillHeading"></h3><p id="fillTip"></p>
  <p id="fillModeGuide"></p><div class="fill-actions"><button id="fillPlay" type="button">Play</button><button id="fillRepeat" type="button" aria-pressed="false">Repeat</button><button id="fillNext" type="button">Next idea</button><button id="fillBacking" type="button" aria-pressed="true">Chords on</button></div>
  <div id="fillNotes" aria-label="Bass fill notes"></div><div id="fillSavedActions" class="my-fill-actions" hidden><select id="fillSpeed" aria-label="Saved fill speed"><option value="50">50% speed</option><option value="75">75% speed</option><option value="100" selected>Original speed</option></select><button id="fillOriginal" type="button">Open song part</button></div><p id="fillStatus" role="status"></p></div><details id="fillResources"><summary>Online lessons</summary><p>These playable studies are original practice patterns. Explore recorded examples and technique lessons below.</p><ul><li><a href="https://michaelphils.com/how-to-accompany-nigerian-gospel-praise/" target="_blank" rel="noopener noreferrer">Michael Phils · Nigerian praise</a></li><li><a href="https://www.musicademy.com/blog/info/worship-bass/worship-bass-song-learner/" target="_blank" rel="noopener noreferrer">Musicademy · Worship bass</a></li><li><a href="https://daricbennett.com/free-online-bass-lessons/" target="_blank" rel="noopener noreferrer">Daric Bennett · Gospel runs and technique</a></li><li><a href="https://www.talkingbass.net/can-use-scales-create-cool-bass-fills/" target="_blank" rel="noopener noreferrer">TalkingBass · Modal fills</a></li><li><a href="https://www.talkingbass.net/top-5-must-know-bob-marley-bass-riffs/" target="_blank" rel="noopener noreferrer">TalkingBass · Reggae classics</a></li></ul></details>`;
  function option(id,value,label){const o=document.createElement('option');o.value=value;o.textContent=label;$(id).append(o);}
  for(let i=1;i<=7;i++){option('fillFrom',i,'From: '+i);option('fillTo',i,'To: '+i);} $('fillTo').value='4';
  for(const [value,m] of Object.entries(P.modes))option('fillMode',value,m[0]);
  F.names.forEach((n,i)=>option('fillKey',i,'Key: '+n));F.styles.forEach((s,i)=>option('fillIdea',i,(i+1)+'. '+s[0]));[40,50,60,70,80,90,100,110,120,140,160].forEach(n=>option('fillTempo',n,n+' BPM'));$('fillTempo').value='80';
  for(const id of ['fillFrom','fillTo','fillKey','fillMode','fillIdea','fillTempo'])$(id).onchange=draw;
  $('fillIdea').onchange=()=>{if(kind==='basslines')$('fillMode').value=P.lines[Number($('fillIdea').value)].mode||'major';draw();};
  $('fillPlay').onclick=()=>void play();$('fillRepeat').onclick=()=>{if(repeating){stop();$('fillStatus').textContent='Repeat stopped';}else{repeating=true;if(!playing)void play();else state();}};
  $('fillNext').onclick=()=>{$('fillIdea').value=String((Number($('fillIdea').value)+1)%collections().length);draw();void play();};
  $('fillBacking').onclick=()=>{backing=!backing;const resume=playing;stop();state();if(resume)void play();};
  $('fillSpeed').onchange=draw;
  $('fillOriginal').onclick=async()=>{if(!selected)return;stop();$('fillOriginal').disabled=true;try{await api.openPart(selected); }catch(e){$('fillStatus').textContent=e.message||'Could not open song';}finally{$('fillOriginal').disabled=false;}};
  window.BassLibraryFills.init($('fillLibrary'),{select:item=>{selected=item;draw();$('fillPlayer').scrollIntoView({block:'nearest'});}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});window.addEventListener('pagehide',stop);draw();
 }
 function setKind(next){
  stop();kind=next;const saved=kind==='library';$('fillLibrary').hidden=!saved;$('fillSettings').hidden=saved;$('fillSavedActions').hidden=!saved;$('fillNext').hidden=saved;$('fillBacking').hidden=saved;$('fillResources').hidden=saved;
  $('fillFrom').hidden=kind==='basslines';$('fillTo').hidden=kind==='basslines';
  $('fillIdea').replaceChildren();collections().forEach((s,i)=>{const o=document.createElement('option');o.value=i;o.textContent=(i+1)+'. '+s[0];$('fillIdea').append(o);});$('fillIdea').value=remembered[kind]||'0';
  if(saved){plan=null;$('fillPlayer').hidden=!selected;state();void window.BassLibraryFills.show();}draw();
 }
 return {init,stop,setKind};
})();
