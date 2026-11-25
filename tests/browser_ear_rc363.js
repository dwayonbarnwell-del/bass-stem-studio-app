/* Isolated, real-audio UI regression checks. No library songs or analysis jobs. */
(()=>{
 function install(){
  if(!document.getElementById("earKeyboard")||!window.BassPracticeAudio){setTimeout(install,100);return;}
 const $=id=>document.getElementById(id),sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const out=$('fixtureResult'),button=$('fixtureRun'),say=s=>out.textContent+='\n'+s;
 const check=(ok,label)=>{if(!ok)throw Error(label);say('PASS '+label);};
 const visible=e=>!!e&&e.getClientRects().length>0;
 let q,tones=[],conceal=false,leaks=0;
 const make=window.BassEarTrainingCore.make,tone=window.BassPracticeAudio.tone;
 window.BassEarTrainingCore.make=(...args)=>(q=make(...args));
 window.BassPracticeAudio.tone=(...args)=>{const v=tone(...args);tones.push({midi:args[1],state:args[0].state,sound:args[4]});return v;};
 new MutationObserver(()=>{if(conceal&&document.querySelector('#earKeyboard .ear-playing,#earKeyboard .ear-correct'))leaks++;}).observe($('earKeyboard'),{subtree:true,attributes:true,attributeFilter:['class']});
 async function until(fn){const start=performance.now();while(!fn()){if(performance.now()-start>45000)throw Error('Timed out: '+$('earStatus').textContent);await sleep(40);}}
 function mode(value){$('earMode').value=value;$('earMode').dispatchEvent(new Event('change'));$('earLevel').value='1';}
 out.textContent='Lesson audit ready';
 button.onclick=async()=>{
  button.disabled=true;out.textContent='Running Ear Training audit';
  try{
   $('openEarTraining').click();
   check($('earMode').parentElement.id==='earSections'&&!$('earSectionNotes'),'one Notes dropdown in the top row');
   check(!$('earSectionRhythm')&&!$('earRhythm')&&!$('fillMode')&&!document.querySelector('[data-playback="questions"]'),'Rhythm, scales and Questions controls removed');
   check(getComputedStyle($('earMode')).backgroundColor!==getComputedStyle($('earSectionFills')).backgroundColor,'distinct Notes and Bass fills colours');
   check(visible($('earSetup'))&&visible($('earKeyboard'))&&!visible($('earBassSections'))&&!visible($('earFillStudy')),'Notes only shows its own controls');
   const key=$('earKeyboard').querySelector('[data-midi="60"]');key.click();check(key.classList.contains('ear-playing'),'free key press turns blue');
   await until(()=>tones.length>0);check(tones[0].midi===60&&tones[0].state==='running'&&tones[0].sound==='piano','real piano voice starts before any questions');await sleep(800);
   const prepare=window.BassPracticeAudio.prepare;let failOnce=true;
   window.BassPracticeAudio.prepare=async(...args)=>{if(failOnce){failOnce=false;throw Error('Audit temporary loading failure');}return prepare(...args);};
   key.click();await until(()=>$('earStatus').textContent==='Sound unavailable');
   const retryTones=tones.length;key.click();await until(()=>tones.length>retryTones);
   window.BassPracticeAudio.prepare=prepare;check(true,'a failed sound load can be retried without reloading');await sleep(800);
   $('earSectionFills').click();check(visible($('earFillStudy'))&&visible($('earBassSections'))&&!visible($('earKeyboard'))&&!visible($('earSetup'))&&!visible($('earProgress'))&&!visible($('earPlaybackChoices')),'Bass fills only shows its own controls');
   $('earSectionBasslines').click();check(visible($('fillIdea'))&&!visible($('fillFrom')),'Basslines keeps its progression controls');
   $('earSectionRuns').click();check(visible($('fillFrom'))&&!visible($('earSetup')),'Runs stays in the bass section');
   mode('notes');check(visible($('earKeyboard'))&&!visible($('earFillStudy'))&&!visible($('earBassSections')),'Notes dropdown returns directly from bass studies');
   for(const m of ['notes','intervals','chords','progressions']){
    mode(m);$('earStart').click();await until(()=>visible($('earQuestion')));check(visible($('earKeyboard')),m+' piano is available');
    const before=tones.length;conceal=true;leaks=0;$('earListen').click();await until(()=>!$('earReveal').disabled);conceal=false;
    check(tones.length>before&&leaks===0,m+' quiz plays sound without showing answer keys');
    if(m==='notes'){
     $('earKeyboard').querySelector('[data-midi="'+q.answer[0]+'"]').click();$('earUndoNote').click();
     check($('earEntered').textContent.startsWith('Choose'),'undo clears the entered note');
     $('earKeyboard').querySelector('[data-midi="'+q.answer[0]+'"]').click();$('earClearNotes').click();
     check($('earEntered').textContent.startsWith('Choose'),'clear resets note entry');
     for(const midi of q.answer)$('earKeyboard').querySelector('[data-midi="'+midi+'"]').click();}
    else [...$('earAnswers').children].find(b=>b.textContent===q.answer).click();
    check($('earFeedback').textContent.startsWith('Correct')&&!$('earNext').disabled,m+' answer scores correctly');
    if(m==='chords')check(document.querySelectorAll('#earKeyboard .ear-correct').length===new Set(q.events.map(n=>n.midi)).size,'chord notes appear only after answering');
    $('earAnswerSound').click();await until(()=>document.querySelector('#earKeyboard .ear-playing'));check(true,m+' answer playback lights the piano');
    $('earFinish').click();
   }
   document.querySelector('[data-playback="repeat"]').click();await until(()=>visible($('earQuestion')));check($('earCounter').textContent==='Listen only'&&!visible($('earAnswers')),'Repeat starts listening directly');$('earFinish').click();
   document.querySelector('[data-playback="varied"]').click();await until(()=>visible($('earQuestion')));check($('earCounter').textContent==='Listen only','New examples starts listening directly');$('earFinish').click();
   $('earClose').click();say('ALL EAR TRAINING LESSON CHECKS PASSED');
  }catch(e){conceal=false;say('FAIL '+e.message);if($('earTrainerDialog').open)$('earClose').click();}
  finally{button.disabled=false;}
 };
 }
 install();
})();
