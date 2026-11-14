/* RC257: browser-only ear training, generated exercises and local progress. */
window.BassEarTrainer=(()=>{
 'use strict';
 const C=window.BassEarTrainingCore,$=id=>document.getElementById(id),A=()=>window.BassPianoAudio;
 const titles={notes:'Notes by ear',intervals:'Intervals',chords:'Chords',progressions:'Worship progressions',rhythm:'Rhythm'};
 const hints={notes:'Hear the notes, then play them back.',intervals:'Name the distance between two notes.',chords:'Recognise the chord sound.',progressions:'Identify four chords. Home chord is optional.',rhythm:'Copy the taps. No microphone needed.'};
 const storageKey='bass-ear-training-v1';let api,dialog,context,voices=[],timers=[],token=0,phase='idle',question=null,round=null,entered=[],taps=[],heard=false,answered=false,progress=C.empty(),storageOK=true;
 let looping=false,exampleHistory={};
 const listening=()=>!!round&&round.playback!=='questions';
 function readProgress(){try{progress=C.restore(JSON.parse(localStorage.getItem(storageKey)||'null'));const raw=JSON.parse(localStorage.getItem('bass-ear-examples-v1')||'{}');exampleHistory=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};}catch{progress=C.empty();storageOK=false;}}
 function save(){try{localStorage.setItem(storageKey,JSON.stringify(progress));storageOK=true;}catch{storageOK=false;}}
 function text(id,value){$(id).textContent=value;}
 function stopSound(){token++;looping=false;for(const id of timers)clearTimeout(id);timers=[];for(const v of voices){try{v.stop();}catch{}}voices=[];}
 function later(fn,ms){timers.push(setTimeout(fn,Math.max(0,ms)));}
 function status(message){text('earStatus',message);}
 function updateProgress(){
  const list=$('earProgressList');list.replaceChildren();for(const mode of C.modes){const s=progress.modes[mode],li=document.createElement('li');li.textContent=titles[mode]+': '+(s?.total?s.correct+'/'+s.total+' correct':'Not started');list.append(li);}
  text('earStorageNote',storageOK?'Progress stays on this device.':'Progress cannot be saved in this browser.');
 }
 function options(){return {mode:$('earMode').value,level:Number($('earLevel').value),sound:$('earSound').value,count:Number($('earCount').value),playback:$('earPlayback').value};}
 function controls(){
  const busy=phase==='loading'||phase==='playing',active=!!round&&phase!=='summary';
  for(const id of ['earMode','earLevel','earSound','earCount','earPlayback'])$(id).disabled=active;
  $('earSound').parentElement.hidden=$('earMode').value==='rhythm';
  $('earCount').parentElement.hidden=$('earPlayback').value!=='questions';
  $('earStart').hidden=active;$('earStart').textContent=phase==='summary'?'Practise again':$('earPlayback').value==='questions'?'Start practice':'Start listening';$('earFinish').hidden=!active;
  $('earQuestion').hidden=!question||phase==='summary';$('earListen').disabled=!question;$('earListen').textContent=busy||looping?'Stop':heard?'Replay':'Play';
  $('earHome').hidden=question?.mode!=='progressions';$('earHome').disabled=busy||looping;
  $('earReveal').hidden=listening();$('earScore').hidden=listening();if(listening())text('earCounter','Listen only');
  $('earReveal').disabled=busy||!heard||answered;$('earNext').hidden=!answered||busy;
  if(listening())$('earNext').hidden=false;
  $('earNext').textContent=listening()?'Next example':round?.answered>=round?.count?'See results':'Next question';
  $('earCheckNotes').disabled=busy||!heard||answered||entered.length!==question?.answer?.length;
  $('earUndoNote').disabled=busy||!entered.length||answered;$('earClearNotes').disabled=busy||!entered.length||answered;
  $('earTap').disabled=busy||!heard||answered;$('earCheckRhythm').disabled=busy||answered||taps.length<2;$('earResetTaps').disabled=busy||answered||!taps.length;
  for(const button of $('earAnswers').querySelectorAll('button'))button.disabled=busy||!heard||answered;
  for(const button of $('earKeyboard').querySelectorAll('button'))button.disabled=busy||!heard||answered;
 }
 function paintQuestion(){
  heard=false;answered=false;entered=[];taps=[];phase='ready';
  text('earPrompt',question.prompt);text('earCounter','Question '+(round.answered+1)+' of '+round.count);text('earScore',round.correct+'/'+round.answered+' correct');status('Tap Listen');
  text('earFeedback','');$('earFeedback').className='ear-feedback';$('earSummary').hidden=true;
  $('earNotes').hidden=listening()||question.mode!=='notes';$('earRhythm').hidden=listening()||question.mode!=='rhythm';$('earAnswers').hidden=listening();$('earAnswers').replaceChildren();
  for(const answer of question.options){const b=document.createElement('button');b.type='button';b.textContent=answer;b.onclick=()=>submit(answer);$('earAnswers').append(b);}
  if(question.mode==='notes'){
   const keys=$('earKeyboard');keys.replaceChildren();const whites=question.keyboard.filter(m=>![1,3,6,8,10].includes(m%12));
   question.keyboard.forEach(m=>{const b=document.createElement('button'),black=[1,3,6,8,10].includes(m%12);b.type='button';b.className=black?'ear-black':'ear-white';b.textContent=C.note(m);b.setAttribute('aria-label','Play '+C.note(m));b.dataset.midi=m;
    if(black){const preceding=whites.filter(w=>w<m).length;b.style.left=(preceding*100/whites.length-3.4)+'%';}else b.style.left=(whites.indexOf(m)*100/whites.length)+'%';
    b.onclick=()=>enterNote(m);keys.append(b);
   });text('earEntered','Choose '+question.answer.length+' notes.');
  }
  if(question.mode==='rhythm'){text('earTapCount','0 taps · '+question.bpm+' BPM');text('earTap','Tap rhythm');}
  if(listening())text('earFeedback',question.explanation);
  controls();
 }
 function next(){stopSound();if(!listening()&&round.answered>=round.count){finish();return;}const previous=question?.key,key=round.mode+':'+round.level+':'+round.sound,recent=Array.isArray(exampleHistory[key])?exampleHistory[key].slice(-3):[];question=C.make(round.mode,round.level,{sound:round.sound,previous,recent});exampleHistory[key]=[...recent,question.key].slice(-3);try{localStorage.setItem('bass-ear-examples-v1',JSON.stringify(exampleHistory));}catch{}paintQuestion();}
 async function start(){
  if(api?.busy?.())return status('Finish the current recording first.');
  api?.pause?.();stopSound();const mine=token;context??=new AudioContext();try{await context.resume();}catch{return status('Tap Start again');}if(mine!==token||!dialog.open)return;
  const o=options();round={...o,answered:0,correct:0};question=null;next();if(listening())void listen(true);
 }
 async function listen(automatic=false){
  if(!question)return;
  if(automatic!==true&&(phase==='loading'||phase==='playing'||looping)){stopSound();phase=answered?'feedback':heard?'answer':'ready';status('Playback stopped');controls();return;}
  stopSound();looping=listening();const mine=token;phase='loading';status('Loading sound');controls();
  try{
   context??=new AudioContext();await context.resume();
   if(question.mode!=='rhythm')await A().prepare(question.sound,context,{notes:[...(question.reference||[]),...question.events,...(question.keyboard||[]).map(midi=>({midi,velocity:80}))]});
   if(mine!==token||!dialog.open)return;
   phase='playing';status('Listen');controls();
   const start=context.currentTime+.08;
   let duration=0;
   if(question.mode==='rhythm'){
    const beat=60/question.bpm;
    // Four quieter count-in clicks, followed by the rhythm to copy.
    for(let i=0;i<4;i++)click(start+i*beat,true,i===0);
    question.answer.forEach(t=>click(start+4*beat+t,false));duration=8*beat;
   }else{
    const offset=0;
    for(const n of question.events)voices.push(A().tone(context,n.midi,start+offset+n.start,n.end-n.start,question.sound,0,n.velocity,question.mode==='notes'||question.mode==='intervals'?.72:.45));
    duration=offset+Math.max(...question.events.map(n=>n.end))+.4;
   }
   const delay=window.BassPlaybackTiming?.outputDelay(context)||0;
   later(()=>{if(mine!==token||!dialog.open)return;heard=true;phase=answered?'feedback':'answer';status(listening()?'Listen again':answered?'Replay complete':question.mode==='rhythm'?'Your turn':'Choose your answer');controls();if(listening())later(()=>{if(mine!==token||!dialog.open||!looping)return;if(round.playback==='varied')next();void listen(true);},1200);},(duration+.08+delay)*1000);
  }catch(e){if(mine!==token)return;looping=false;phase=answered?'feedback':'ready';status('Sound unavailable. Try again.');controls();}
 }
 async function home(){
  if(!question?.reference||phase==='loading'||phase==='playing'||looping)return;
  stopSound();const mine=token,previousPhase=phase;phase='loading';status('Home chord');controls();
  try{context??=new AudioContext();await context.resume();await A().prepare(question.sound,context,{notes:question.reference});if(mine!==token||!dialog.open)return;phase='playing';controls();const start=context.currentTime+.08;for(const n of question.reference)voices.push(A().tone(context,n.midi,start+n.start,n.end-n.start,question.sound,0,n.velocity,.55));later(()=>{if(mine!==token||!dialog.open)return;phase=previousPhase;status('Play four chords');controls();},(1.25+(window.BassPlaybackTiming?.outputDelay(context)||0))*1000);}catch{if(mine===token){phase=previousPhase;status('Sound unavailable');controls();}}
 }
 function click(when,countIn=false,accent=false){
  const o=context.createOscillator(),g=context.createGain();o.type='sine';o.frequency.value=countIn?(accent?1100:850):1500;g.gain.setValueAtTime(0,when);g.gain.linearRampToValueAtTime(countIn?.09:.18,when+.003);g.gain.exponentialRampToValueAtTime(.0001,when+.06);o.connect(g).connect(context.destination);o.start(when);o.stop(when+.075);o.onended=()=>{o.disconnect();g.disconnect();};voices.push({stop(){try{o.stop();}catch{}}});
 }
 function enterNote(midi){
  if(!heard||answered||phase==='loading'||phase==='playing'||entered.length>=question.answer.length)return;
  entered.push(midi);text('earEntered',entered.map(C.note).join(' → '));voices.push(A().tone(context,midi,context.currentTime,.45,question.sound,0,80,.65));controls();
 }
 function submit(response,revealed=false){
  if(!question||!round||listening()||answered||!heard||phase!=='answer')return;
  const result=revealed?{correct:false}:C.grade(question,response);stopSound();answered=true;phase='feedback';round.answered++;if(result.correct)round.correct++;
  progress=C.record(progress,round.mode,result.correct,round.level);save();updateProgress();
  const heading=revealed?'Answer shown':result.correct?'Correct':'Keep practising';
  const detail=question.mode==='rhythm'&&!revealed?(result.message+' '+question.explanation):question.explanation;
  text('earFeedback',heading+'. '+detail);$('earFeedback').classList.add(result.correct?'correct':'review');status(result.correct?'Well done':'Replay to compare');text('earScore',round.correct+'/'+round.answered+' correct');
  for(const b of $('earAnswers').children){if(b.textContent===question.answer){b.classList.add('correct');b.setAttribute('aria-label',b.textContent+', correct answer');}else if(b.textContent===response)b.classList.add('review');}
  controls();$('earNext').focus({preventScroll:true});
 }
 function tap(){
  if(!heard||answered||phase==='loading'||phase==='playing')return;
  if(taps.length>=question.answer.length)return;
  const now=performance.now()/1000;if(taps.length&&now-taps.at(-1)<.07)return;
  taps.push(now);text('earTapCount',taps.length+'/'+question.answer.length+' taps');$('earTap').classList.add('pressed');later(()=>$('earTap').classList.remove('pressed'),90);
  if(taps.length===question.answer.length)submit(taps);else controls();
 }
 function finish(){
  stopSound();if(!round)return;
  phase='summary';$('earSummary').hidden=false;const total=round.answered;
  if(total){const s=progress.modes[round.mode];s.rounds++;save();}
  text('earSummaryTitle',total?round.correct+' of '+total+' correct':'Practice paused');
  const nextLevel=total>=5&&round.correct/total>=.8&&round.level<3;
  text('earSummaryText',nextLevel?'Ready for the next level.':total?'Practise again to strengthen your listening.':'Your earlier progress is kept.');
  $('earAdvance').hidden=!nextLevel;updateProgress();controls();
 }
 function resetQuestion(){if(answered)return;entered=[];taps=[];text('earEntered','Choose '+question.answer.length+' notes.');text('earTapCount','0 taps · '+question.bpm+' BPM');controls();}
 function close(){stopSound();phase='idle';answered=false;question=null;round=null;if(context?.state==='running')void context.suspend();}
 function modeChanged(){const mode=$('earMode').value;text('earHint',hints[mode]);$('earLevel').value=String(progress.modes[mode]?.level||1);controls();}
 function init(hooks){
  api=hooks;if(dialog)return;
  const wrap=document.createElement('div');wrap.innerHTML=`<dialog id="earTrainerDialog" aria-labelledby="earTitle"><header class="ear-header"><div><h2 id="earTitle">Ear training</h2><p>Build your listening skills</p></div><button id="earClose" type="button">Close</button></header><div class="ear-settings"><label>Practise<select id="earMode"><option value="notes">Notes by ear</option><option value="intervals">Intervals</option><option value="chords">Chords</option><option value="progressions">Worship progressions</option><option value="rhythm">Rhythm</option></select></label><label>Level<select id="earLevel"><option value="1">1 · Guided</option><option value="2">2 · Building</option><option value="3">3 · Confident</option></select></label><label>Sound<select id="earSound"><option value="piano">Grand piano</option><option value="bass">Bass</option></select></label><label>Playback<select id="earPlayback"><option value="questions">Questions</option><option value="repeat">Repeat example</option><option value="varied">New examples</option></select></label><label>Questions<select id="earCount"><option value="5">5</option><option value="10">10</option></select></label></div><p id="earHint"></p><div class="ear-start-row"><button id="earStart" type="button">Start practice</button><button id="earFinish" type="button" hidden>Finish practice</button></div><p id="earStatus" role="status" aria-live="polite"></p><section id="earQuestion" hidden><div class="ear-score-row"><span id="earCounter"></span><span id="earScore"></span></div><h3 id="earPrompt"></h3><div class="ear-actions"><button id="earListen" type="button">Listen</button><button id="earReveal" type="button">Show answer</button></div><button id="earHome" type="button" hidden>Home chord</button><div id="earAnswers" class="ear-answers"></div><div id="earNotes" hidden><div id="earKeyboard" aria-label="Answer piano keyboard"></div><p id="earEntered" aria-live="polite"></p><div class="ear-note-actions"><button id="earUndoNote" type="button">Undo</button><button id="earClearNotes" type="button">Clear</button><button id="earCheckNotes" type="button">Check</button></div></div><div id="earRhythm" hidden><button id="earTap" type="button">Tap rhythm</button><p id="earTapCount" aria-live="polite"></p><div class="ear-actions"><button id="earResetTaps" type="button">Try taps again</button><button id="earCheckRhythm" type="button">Check taps</button></div></div><p id="earFeedback" class="ear-feedback" aria-live="polite"></p><button id="earNext" type="button" hidden>Next question</button></section><section id="earSummary" hidden><h3 id="earSummaryTitle"></h3><p id="earSummaryText"></p><button id="earAdvance" type="button" hidden>Try next level</button></section><details class="ear-progress"><summary>Your progress</summary><ul id="earProgressList"></ul><small id="earStorageNote"></small></details></dialog>`;
  dialog=wrap.firstElementChild;$('appRoot').append(dialog);readProgress();modeChanged();updateProgress();
  $('openEarTraining').onclick=()=>{if(api?.busy?.())return;api?.pause?.();close();$('earSummary').hidden=true;dialog.showModal();status('No song needed');controls();};
  $('earClose').onclick=()=>{close();dialog.close();};dialog.addEventListener('close',()=>{if(!dialog.open)close();});dialog.addEventListener('cancel',close);
  $('earMode').onchange=modeChanged;$('earPlayback').onchange=controls;$('earHome').onclick=home;$('earStart').onclick=start;$('earFinish').onclick=finish;$('earListen').onclick=listen;$('earNext').onclick=()=>{next();if(listening())void listen(true);};$('earReveal').onclick=()=>submit(null,true);
  $('earCheckNotes').onclick=()=>submit(entered);$('earUndoNote').onclick=()=>{entered.pop();text('earEntered',entered.length?entered.map(C.note).join(' → '):'Choose '+question.answer.length+' notes.');controls();};$('earClearNotes').onclick=resetQuestion;
  $('earTap').onclick=tap;$('earResetTaps').onclick=resetQuestion;$('earCheckRhythm').onclick=()=>submit(taps);
  $('earAdvance').onclick=()=>{$('earLevel').value=String(Math.min(3,round.level+1));void start();};
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&dialog.open){stopSound();if(phase==='playing'||phase==='loading'){phase=answered?'feedback':'ready';if(!answered)heard=false;status('Tap Listen');controls();}}});
 }
 return {init};
})();
