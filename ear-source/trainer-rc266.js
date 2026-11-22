/* RC266: focused lesson sections and concealed quiz answers. */
window.BassEarTrainer=(()=>{
 'use strict';
 const C=window.BassEarTrainingCore,$=id=>document.getElementById(id),A=()=>window.BassPracticeAudio||window.BassPianoAudio;
 const titles={notes:'Notes by ear',intervals:'Intervals',chords:'Chords',progressions:'Worship progressions'};
 const hints={notes:'Hear the notes, then play them back.',intervals:'Name the distance between two notes.',chords:'Recognise the chord sound.',progressions:'Identify the chord sequence. Home chord is optional.'};
 const storageKey='bass-ear-training-v1';let api,dialog,context,voices=[],timers=[],token=0,phase='idle',question=null,round=null,entered=[],heard=false,answered=false,progress=C.empty(),storageOK=true;
 const litKeys=new Map();
 const pianoModes=['notes','intervals','chords','progressions'];
 function keyboardRange(q,sound='piano'){
  if(q?.keyboard?.length)return [...q.keyboard];
  const pitches=[...(q?.events||[]),...(q?.reference||[])].map(n=>n.midi).filter(Number.isFinite);
  if(!pitches.length)return Array.from({length:12},(_,i)=>(sound==='bass'?36:60)+i);
  const low=Math.max(sound==='bass'?23:0,Math.floor(Math.min(...pitches)/12)*12),high=Math.min(sound==='bass'?59:127,Math.ceil((Math.max(...pitches)+1)/12)*12-1);
  return Array.from({length:high-low+1},(_,i)=>low+i);
 }
 let looping=false,repeatQuestion=false,exampleHistory={},section='notes';
 let noteMode='notes';
 const selectedMode=()=>section==='notes'?noteMode:section;
 const answerVisible=()=>answered||listening();
 let viewportFrame=0;
 function fitViewport(){
  cancelAnimationFrame(viewportFrame);
  viewportFrame=requestAnimationFrame(()=>{
   if(!dialog)return;const v=window.visualViewport;
   const width=v?.width||document.documentElement.clientWidth||window.innerWidth,height=v?.height||window.innerHeight;
   for(const [name,value] of Object.entries({width,height,top:v?.offsetTop||0,left:v?.offsetLeft||0}))dialog.style.setProperty('--ear-view-'+name,value+'px');
  });
 }
 const listening=()=>!!round&&round.playback!=='questions';
 function readProgress(){try{progress=C.restore(JSON.parse(localStorage.getItem(storageKey)||'null'));const raw=JSON.parse(localStorage.getItem('bass-ear-examples-v1')||'{}');exampleHistory=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};}catch{progress=C.empty();storageOK=false;}}
 function save(){try{localStorage.setItem(storageKey,JSON.stringify(progress));storageOK=true;}catch{storageOK=false;}}
 function text(id,value){$(id).textContent=value;}
 function stopSound(){litKeys.clear();for(const b of $('earKeyboard')?.children||[])b.classList.remove('ear-playing');token++;looping=false;for(const id of timers)clearTimeout(id);timers=[];for(const v of voices){try{v.stop();}catch{}}voices=[];}
 function later(fn,ms){timers.push(setTimeout(fn,Math.max(0,ms)));}
 function status(message){text('earStatus',message);}
 function updateProgress(){
  const list=$('earProgressList');list.replaceChildren();for(const mode of pianoModes){const s=progress.modes[mode],li=document.createElement('li');li.textContent=titles[mode]+': '+(s?.total?s.correct+'/'+s.total+' correct':'Not started');list.append(li);}
  text('earStorageNote',storageOK?'Progress stays on this device.':'Progress cannot be saved in this browser.');
 }
 function options(playback){return {mode:selectedMode(),level:Number($('earLevel').value),sound:$('earSound').value,count:Number($('earCount').value),playback};}
 function controls(){
  const busy=phase==='loading'||phase==='playing',active=!!round&&phase!=='summary',mode=selectedMode(),fills=['fills','basslines','runs'].includes(mode);
  const rehearsal=mode==='rehearsal';
  dialog.dataset.lesson=mode;
  $('earSections').hidden=active;
  $('earMode').value=section==='notes'?noteMode:'';$('earMode').disabled=active;
  $('earMode').dataset.active=String(section==='notes');
  $('earSectionFills').setAttribute('aria-pressed',String(fills));
  $('earBassSections').hidden=!fills||active;
  for(const b of $('earBassSections').querySelectorAll('[data-section]'))b.setAttribute('aria-pressed',String(b.dataset.section===section));
  $('earProgress').hidden=fills||rehearsal;
  $('earFillStudy').hidden=!fills; $('earLevel').parentElement.hidden=fills; $('earSound').parentElement.hidden=fills;
  $('earStartRow').hidden=!active;$('earStatus').hidden=fills||rehearsal;$('earSummary').hidden=fills||rehearsal||phase!=='summary';
  $('earSetup').hidden=active||fills||rehearsal;$('earPlaybackChoices').hidden=active||fills||rehearsal;$('earHint').hidden=active||fills||rehearsal;$('earSession').hidden=!active;
  $('earRehearsal').hidden=!rehearsal;
  $('earSectionRehearsal').setAttribute('aria-pressed',String(rehearsal));
  if(rehearsal&&dialog.open)window.BassRehearsal?.refresh();
  if(active)text('earSession',titles[round.mode]+' · Level '+round.level+' · '+(round.sound==='bass'?'Bass':'Piano'));
  for(const b of $('earPlaybackChoices').querySelectorAll('button'))b.disabled=active;
  for(const id of ['earLevel','earSound','earCount'])$(id).disabled=active;

  $('earCount').parentElement.hidden=fills;
  $('earStart').hidden=active;$('earStart').textContent=phase==='summary'?'Play again':'Start';$('earFinish').hidden=!active;
  $('earNotes').hidden=!pianoModes.includes(mode);$('earNoteEntry').hidden=!active||mode!=='notes'||listening();$('earFeedbackPanel').hidden=!active;
  $('earQuestion').hidden=!question||phase==='summary';$('earListen').disabled=!question;$('earListen').textContent=busy||looping?'Stop':heard?'Replay':'Play';
  $('earHome').hidden=question?.mode!=='progressions';$('earHome').disabled=busy||looping;
  $('earReveal').hidden=listening();$('earScore').hidden=listening();if(listening())text('earCounter','Listen only');
  $('earReveal').disabled=busy||!heard||answered;$('earNext').hidden=false;$('earNext').disabled=!listening()&&(!answered||busy);
  $('earNext').textContent=!listening()&&round?.answered>=round?.count?'Results':'Next';
  $('earRepeat').disabled=!question;$('earRepeat').setAttribute('aria-pressed',String(repeatQuestion||(listening()&&round.playback==='repeat'&&looping)));
  $('earCheckNotes').disabled=busy||!heard||answered||entered.length!==question?.answer?.length;
  $('earUndoNote').disabled=busy||!entered.length||answered;$('earClearNotes').disabled=busy||!entered.length||answered;
  for(const button of $('earAnswers').querySelectorAll('button'))button.disabled=busy||!heard||answered;
  for(const button of $('earKeyboard').querySelectorAll('button'))button.disabled=busy||looping;
  $('earAnswerSoundRow').hidden=!answered;$('earAnswerSound').disabled=busy;
 }
 function paintQuestion(){
  heard=false;answered=false;entered=[];phase='ready';
  text('earPrompt',question.mode==='notes'?'Start '+C.note(question.answer[0])+' · '+question.answer.length+' notes':question.prompt);text('earCounter','Question '+(round.answered+1)+' of '+round.count);text('earScore',round.correct+'/'+round.answered+' correct');status('Tap Play');
  text('earFeedback','');$('earFeedback').className='ear-feedback';$('earSummary').hidden=true;
  $('earAnswers').hidden=listening();$('earAnswers').replaceChildren();
  for(const answer of question.options){const b=document.createElement('button');b.type='button';b.textContent=answer;b.onclick=()=>submit(answer);$('earAnswers').append(b);}
  drawKeyboard(question);
  if(question.mode==='notes')text('earEntered','Choose '+question.answer.length+' notes.');
  if(listening())text('earFeedback',question.explanation);
  controls();
 }
 function next(){repeatQuestion=false;stopSound();if(!listening()&&round.answered>=round.count){finish();return;}const previous=question?.key,key=round.mode+':'+round.level+':'+round.sound,recent=Array.isArray(exampleHistory[key])?exampleHistory[key].slice(-3):[];question=C.make(round.mode,round.level,{sound:round.sound,previous,recent});exampleHistory[key]=[...recent,question.key].slice(-3);try{localStorage.setItem('bass-ear-examples-v1',JSON.stringify(exampleHistory));}catch{}paintQuestion();}
 async function start(playback='questions'){
  if(api?.busy?.())return status('Finish the current recording first.');
  api?.pause?.();stopSound();const mine=token;context??=new AudioContext();try{await context.resume();}catch{return status('Tap Start again');}if(mine!==token||!dialog.open)return;
  const o=options(playback);round={...o,answered:0,correct:0};question=null;next();if(listening())void listen(true);
 }
 async function listen(automatic=false){
  if(!question)return;
  if(automatic!==true&&(phase==='loading'||phase==='playing'||looping)){repeatQuestion=false;stopSound();phase=answered?'feedback':heard?'answer':'ready';status('Playback stopped');controls();return;}
  stopSound();looping=listening()||repeatQuestion;const mine=token;phase='loading';status('Loading sound');controls();
  try{
   context??=new AudioContext();await context.resume();
   await A().prepare(question.sound,context,{notes:[...(question.reference||[]),...question.events,...(question.keyboard||[]).map(midi=>({midi,velocity:80}))]});
   if(mine!==token||!dialog.open)return;
   phase='playing';status('Listen');controls();
   const start=context.currentTime+.08;
   let duration=0;
   for(const n of question.events)voices.push(A().tone(context,n.midi,start+n.start,n.end-n.start,question.sound,0,n.velocity,question.mode==='notes'||question.mode==='intervals'?.72:.45));
   if(answerVisible())lightEvents(question.events);duration=Math.max(...question.events.map(n=>n.end))+.4;
   const delay=window.BassPlaybackTiming?.outputDelay(context)||0;
   later(()=>{if(mine!==token||!dialog.open)return;heard=true;phase=answered?'feedback':'answer';status(listening()||repeatQuestion?'Listen again':answered?'Replay complete':'Choose your answer');controls();if(listening()||repeatQuestion)later(()=>{if(mine!==token||!dialog.open||!looping)return;if(round.playback==='varied'&&!repeatQuestion)next();void listen(true);},1200);},(duration+.08+delay)*1000);
  }catch(e){if(mine!==token)return;looping=false;phase=answered?'feedback':'ready';status('Sound unavailable. Try again.');controls();}
 }
 function repeat(){
  if(!question)return;
  if(repeatQuestion||(listening()&&round.playback==='repeat'&&looping)){repeatQuestion=false;stopSound();phase=answered?'feedback':heard?'answer':'ready';status('Repeat stopped');controls();return;}
  repeatQuestion=true;if(phase!=='loading'&&phase!=='playing')void listen(true);else looping=true;controls();
 }
 async function home(){
  if(!question?.reference||phase==='loading'||phase==='playing'||looping)return;
  stopSound();const mine=token,previousPhase=phase;phase='loading';status('Home chord');controls();
  try{context??=new AudioContext();await context.resume();await A().prepare(question.sound,context,{notes:question.reference});if(mine!==token||!dialog.open)return;phase='playing';controls();const start=context.currentTime+.08;for(const n of question.reference)voices.push(A().tone(context,n.midi,start+n.start,n.end-n.start,question.sound,0,n.velocity,.55));if(answerVisible())lightEvents(question.reference);later(()=>{if(mine!==token||!dialog.open)return;phase=previousPhase;status('Play the chords');controls();},(1.25+(window.BassPlaybackTiming?.outputDelay(context)||0))*1000);}catch{if(mine===token){phase=previousPhase;status('Sound unavailable');controls();}}
 }
 function drawKeyboard(q=null){
  const visibleQuestion=q&&(q.mode==='notes'||answerVisible())?q:null;
  const keys=$('earKeyboard'),range=keyboardRange(visibleQuestion,$('earSound').value),whites=range.filter(m=>![1,3,6,8,10].includes(m%12));
  litKeys.clear();keys.replaceChildren();keys.style.setProperty('--ear-white-width',(100/whites.length)+'%');keys.style.setProperty('--ear-black-width',(58/whites.length)+'%');keys.style.setProperty('--ear-piano-min-width',(whites.length*32)+'px');
  for(const m of range){const b=document.createElement('button'),black=[1,3,6,8,10].includes(m%12);b.type='button';b.className=black?'ear-black':'ear-white';b.textContent=black?C.note(m).replace(/-?\d+$/,''):C.note(m);b.setAttribute('aria-label','Play '+C.note(m));b.title=C.note(m);b.dataset.midi=m;
   b.style.left=(black?(whites.filter(w=>w<m).length*100/whites.length-29/whites.length):whites.indexOf(m)*100/whites.length)+'%';b.onclick=()=>enterNote(m);keys.append(b);
  }
  $('earKeyboardScroll').scrollLeft=0;
 }
 function lightKey(midi,on){
  const b=$('earKeyboard').querySelector('[data-midi="'+midi+'"]');if(!b)return;
  const count=Math.max(0,(litKeys.get(midi)||0)+(on?1:-1));litKeys.set(midi,count);b.classList.toggle('ear-playing',count>0);
  if(on){const viewport=$('earKeyboardScroll'),left=b.offsetLeft,right=left+b.offsetWidth;if(left<viewport.scrollLeft)viewport.scrollLeft=left;else if(right>viewport.scrollLeft+viewport.clientWidth)viewport.scrollLeft=right-viewport.clientWidth;}
 }
 function lightEvents(events){
  const delay=window.BassPlaybackTiming?.outputDelay(context)||0;
  for(const n of events){later(()=>lightKey(n.midi,true),(n.start+.08+delay)*1000);later(()=>lightKey(n.midi,false),(n.end+.08+delay)*1000);}
 }
 function enterNote(midi){
  if(phase==='loading'||phase==='playing'||looping)return;
  if(question?.mode==='notes'&&round&&!listening()&&!answered&&heard&&phase==='answer'){
   if(entered.length>=question.answer.length)return;
   entered.push(midi);text('earEntered',entered.map(C.note).join(' → '));if(entered.length===question.answer.length)submit(entered);else controls();
  }
  void previewKey(midi);
 }
 async function previewKey(midi){
  const mine=token,sound=question&&phase!=='summary'?question.sound:$('earSound').value;
  lightKey(midi,true);later(()=>lightKey(midi,false),700);
  try{api?.pause?.();context??=new AudioContext();await context.resume();await A().prepare(sound,context,{notes:[{midi,velocity:80}]});if(mine!==token||!dialog.open)return;voices.push(A().tone(context,midi,context.currentTime,.6,sound,0,80,.65));}
  catch{if(mine===token&&dialog.open)status('Sound unavailable');}
 }
 function showKeys(){
  if(question.mode==='chords'){for(const b of $('earKeyboard').children)b.classList.toggle('ear-correct',question.events.some(n=>n.midi===Number(b.dataset.midi)));return;}
  if(question.mode!=='notes')return;
  for(const b of $('earKeyboard').children){const order=question.answer.map((m,i)=>m===Number(b.dataset.midi)?i+1:null).filter(Boolean);b.classList.toggle('ear-correct',order.length>0);if(order.length)b.dataset.order=order.join(', ');else delete b.dataset.order;}
 }
 function submit(response,revealed=false){
  if(!question||!round||listening()||answered||!heard||phase!=='answer')return;
  const result=revealed?{correct:false}:C.grade(question,response);repeatQuestion=false;stopSound();answered=true;phase='feedback';round.answered++;if(result.correct)round.correct++;
  progress=C.record(progress,round.mode,result.correct,round.level);save();updateProgress();
  const heading=revealed?'Answer shown':result.correct?'Correct':'Keep practising';
  const detail=question.explanation;
  text('earFeedback',heading+'. '+detail);$('earFeedback').classList.add(result.correct?'correct':'review');status(result.correct?'Well done':'Replay to compare');text('earScore',round.correct+'/'+round.answered+' correct');
  for(const b of $('earAnswers').children){if(b.textContent===question.answer){b.classList.add('correct');b.setAttribute('aria-label',b.textContent+', correct answer');}else if(b.textContent===response)b.classList.add('review');}
  drawKeyboard(question);showKeys();controls();$('earNext').focus({preventScroll:true});
 }
 function finish(){
  repeatQuestion=false;stopSound();if(!round)return;
  phase='summary';$('earSummary').hidden=false;const total=round.answered;
  if(total){const s=progress.modes[round.mode];s.rounds++;save();}
  text('earSummaryTitle',total?round.correct+' of '+total+' correct':'Practice paused');
  const nextLevel=total>=5&&round.correct/total>=.8&&round.level<C.maxLevel;
  text('earSummaryText',nextLevel?'Ready for the next level.':total?'Practise again to strengthen your listening.':'Your earlier progress is kept.');
  $('earAdvance').hidden=!nextLevel;updateProgress();controls();
 }
 function resetQuestion(){if(answered)return;entered=[];text('earEntered','Choose '+question.answer.length+' notes.');controls();}
 function close(){window.BassFillTrainer?.stop();window.BassRehearsal?.close();repeatQuestion=false;stopSound();phase='idle';answered=false;question=null;round=null;if(context?.state==='running')void context.suspend();}
 function modeChanged(){if(!['fills','runs','basslines'].includes(selectedMode()))window.BassFillTrainer?.stop();stopSound();if(question||round){question=null;round=null;answered=false;phase='idle';}drawKeyboard();const mode=selectedMode();text('earHint',hints[mode]||'');$('earLevel').value=String(progress.modes[mode]?.level||1);controls();if(['fills','basslines','runs'].includes(mode))window.BassFillTrainer?.setKind(mode);}
 function selectSection(nextSection){if(section===nextSection)return;const practice=['fills','runs','basslines'];if(!practice.includes(section)||!practice.includes(nextSection))close();section=nextSection;modeChanged();status('No song needed');dialog.scrollTop=0;}
 function init(hooks){
  api=hooks;if(dialog)return;
  const wrap=document.createElement('div');wrap.innerHTML=`<dialog id="earTrainerDialog" aria-labelledby="earTitle">
<header class="ear-header"><h2 id="earTitle">Ear training</h2><button id="earClose" type="button">Close</button></header>
<div id="earSections" role="group" aria-label="Ear training sections"><select id="earMode" aria-label="Notes lesson" title="Notes lesson"><option value="" disabled hidden>Notes</option><option value="notes" selected>Notes</option><option value="intervals">Intervals</option><option value="chords">Chords</option><option value="progressions">Progressions</option></select><button id="earSectionFills" type="button" data-section="fills" aria-pressed="false">Bass practice</button><button id="earSectionRehearsal" type="button" data-section="rehearsal" aria-pressed="false">Rehearse song</button></div>
<div id="earBassSections" role="group" aria-label="Bass studies" hidden><button id="earSectionBasslines" type="button" data-section="basslines" aria-pressed="false">Basslines</button><button id="earSectionRuns" type="button" data-section="runs" aria-pressed="false">Runs</button><button id="earSectionMyFills" type="button" data-section="fills" aria-pressed="false">My fills</button><button id="earLibrarySongs" type="button">Song view</button></div>
<div id="earSetup" class="ear-settings">
<label><select id="earLevel" aria-label="Select level" title="Select level"><option value="1">Level 1</option><option value="2">Level 2</option><option value="3">Level 3</option><option value="4">Level 4</option><option value="5">Level 5</option></select></label>
<label><select id="earSound" aria-label="Select sound" title="Select sound"><option value="piano" selected>Grand piano</option><option value="bass">Bass</option></select></label>
<label><button id="earCount" type="button" value="5" aria-label="Change question count">5 questions</button></label>
<button id="earStart" type="button">Start</button></div>
<div id="earPlaybackChoices" role="group" aria-label="Listen and practise"><button type="button" data-playback="repeat">Repeat</button><button type="button" data-playback="varied">New examples</button></div>
<p id="earHint"></p><div id="earStartRow" class="ear-start-row" hidden><span id="earSession" hidden></span><button id="earFinish" type="button" hidden>Finish</button></div>
<p id="earStatus" role="status" aria-live="polite"></p>
<section id="earQuestion" hidden><div class="ear-score-row"><span id="earCounter"></span><span id="earScore"></span></div>
<div class="ear-question-head"><h3 id="earPrompt"></h3><button id="earHome" type="button" aria-label="Play home chord" title="Play home chord" hidden>Home</button></div>
<div class="ear-actions"><button id="earListen" type="button">Play</button><button id="earRepeat" type="button" aria-pressed="false" title="Repeat this example">Repeat</button><button id="earReveal" type="button" aria-label="Show answer">Answer</button><button id="earNext" type="button" disabled>Next</button></div>
<div id="earAnswers" class="ear-answers"></div>
</section>
<section id="earNotes"><div id="earKeyboardScroll" tabindex="0" aria-label="Piano keyboard. Scroll sideways for more keys."><div id="earKeyboard" aria-label="Piano keys"></div></div><div id="earNoteEntry" hidden><p id="earEntered" aria-live="polite"></p><div class="ear-note-actions"><button id="earUndoNote" type="button">Undo</button><button id="earClearNotes" type="button">Clear</button><button id="earCheckNotes" type="button">Check</button></div></div></section>
<section id="earFeedbackPanel" hidden><p id="earFeedback" class="ear-feedback" aria-live="polite"></p><div id="earAnswerSoundRow" class="ear-answer-sound" hidden><button id="earAnswerSound" type="button">Hear answer</button></div></section>
<section id="earFillStudy" hidden></section>
<section id="earRehearsal" aria-label="Song rehearsal" hidden></section>
<section id="earSummary" hidden><h3 id="earSummaryTitle"></h3><p id="earSummaryText"></p><button id="earAdvance" type="button" hidden>Next level</button></section>
<details id="earProgress" class="ear-progress"><summary>Your progress</summary><ul id="earProgressList"></ul><small id="earStorageNote"></small></details></dialog>`;
  dialog=wrap.firstElementChild;$('appRoot').append(dialog);readProgress();modeChanged();updateProgress();
  window.addEventListener('resize',fitViewport);window.visualViewport?.addEventListener('resize',fitViewport);window.visualViewport?.addEventListener('scroll',fitViewport);screen.orientation?.addEventListener('change',fitViewport);fitViewport();
  $('openEarTraining').onclick=()=>{if(api?.busy?.())return;api?.pause?.();close();drawKeyboard();$('earSummary').hidden=true;dialog.showModal();dialog.scrollTop=0;fitViewport();status('No song needed');controls();};
  if(hooks.rehearsal)window.BassRehearsal.init($('earRehearsal'),hooks.rehearsal);
  window.BassFillTrainer.init($('earFillStudy'),hooks);$('earLibrarySongs').onclick=()=>{close();dialog.close();api?.openSongs?.();};$('earAnswerSound').onclick=()=>void listen(true);
  for(const b of dialog.querySelectorAll('[data-section]'))b.onclick=()=>selectSection(b.dataset.section);
  $('earClose').onclick=()=>{close();dialog.close();};dialog.addEventListener('close',()=>{if(!dialog.open)close();});dialog.addEventListener('cancel',close);
  try{const sound=localStorage.getItem('bass-ear-sound-v1');if(['bass','piano'].includes(sound))$('earSound').value=sound;}catch{}
  $('earSound').onchange=()=>{stopSound();drawKeyboard();try{localStorage.setItem('bass-ear-sound-v1',$('earSound').value);}catch{}};$('earMode').onchange=()=>{noteMode=$('earMode').value;if(section!=='notes')selectSection('notes');else modeChanged();};$('earCount').onclick=()=>{$('earCount').value=$('earCount').value==='5'?'10':'5';$('earCount').textContent=$('earCount').value+' questions';};for(const b of $('earPlaybackChoices').querySelectorAll('button'))b.onclick=()=>void start(b.dataset.playback);$('earRepeat').onclick=repeat;$('earHome').onclick=home;$('earStart').onclick=()=>void start();$('earFinish').onclick=finish;$('earListen').onclick=listen;$('earNext').onclick=()=>{next();if(listening())void listen(true);};$('earReveal').onclick=()=>submit(null,true);
  $('earCheckNotes').onclick=()=>submit(entered);$('earUndoNote').onclick=()=>{entered.pop();text('earEntered',entered.length?entered.map(C.note).join(' → '):'Choose '+question.answer.length+' notes.');controls();};$('earClearNotes').onclick=resetQuestion;
  $('earAdvance').onclick=()=>{$('earLevel').value=String(Math.min(C.maxLevel,round.level+1));void start();};
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&dialog.open){repeatQuestion=false;stopSound();if(phase==='playing'||phase==='loading'){phase=answered?'feedback':'ready';if(!answered)heard=false;status('Tap Play');}controls();}});
 }
 return {init,keyboardRange};
})();
