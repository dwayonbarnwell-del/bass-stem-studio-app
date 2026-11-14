/* Isolated test: compact layout, real keyboard geometry and repeat within questions. */
(()=>{
 const $=id=>document.getElementById(id),sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const panel=document.createElement('aside');panel.style='position:fixed;top:48px;right:8px;z-index:999999;background:#fff;color:#111;padding:8px;max-width:420px;font:13px system-ui';panel.innerHTML='<button id="rc259Run">Run RC259 checks</button><pre id="rc259Results" style="max-height:280px;overflow:auto;white-space:pre-wrap">Ready RC259</pre>';document.body.append(panel);
 const out=$('rc259Results'),say=s=>out.textContent+='\n'+s,check=(ok,label)=>{if(!ok)throw Error(label);say('PASS '+label);};let q,tones=[];
 const make=window.BassEarTrainingCore.make,tone=window.BassPianoAudio.tone;window.BassEarTrainingCore.make=(...a)=>(q=make(...a));window.BassPianoAudio.tone=(...a)=>{tones.push({midi:a[1],sound:a[4]});return tone(...a);};
 async function until(fn,ms=45000){const start=performance.now();while(!fn()){if(performance.now()-start>ms)throw Error('Timeout: '+$('earStatus')?.textContent);await sleep(30);}}
 async function start(mode){if($('earTrainerDialog').open)$('earClose').click();$('openEarTraining').click();$('earMode').value=mode;$('earMode').dispatchEvent(new Event('change'));$('earLevel').value='1';$('earSound').value='bass';document.querySelector('[data-playback="questions"]').click();$('earStart').click();await until(()=>!$('earQuestion').hidden);}
 const rect=e=>e.getBoundingClientRect();
 $('rc259Run').onclick=async()=>{
  out.textContent='Running RC259';$('rc259Run').disabled=true;
  try{
   $('openEarTraining').click();check(!$('earTrainerDialog').textContent.includes('Build your listening skills'),'no redundant subtitle');
   check($('earPlayback').type==='hidden'&&$('earPlaybackChoices').querySelectorAll('button').length===3,'playback choices are buttons');
   check($('earCount').tagName==='BUTTON','question count is a compact button');$('earCount').click();check($('earCount').value==='10','question count switches to ten');$('earCount').click();
   const backgrounds=[...$('liveAudioEntry').querySelectorAll('button')].map(b=>getComputedStyle(b).backgroundColor);check(new Set(backgrounds).size===5,'five different practice-control colours');
   check($('openMoreTools').querySelectorAll('path').length===2&&!$('openMoreTools').querySelector('rect'),'wrench tools icon');
   await start('notes');check($('earSetup').hidden&&$('earPlaybackChoices').hidden,'setup collapses during questions');
   const header=rect($('earTitle')),close=rect($('earClose'));check(Math.abs((header.top+header.height/2)-(close.top+close.height/2))<2,'Close aligned with title');
   const actions=['earListen','earRepeat','earReveal','earNext'].map(id=>$(id));check(Math.max(...actions.map(e=>rect(e).top))-Math.min(...actions.map(e=>rect(e).top))<1,'four action buttons share one row');check(new Set(actions.map(e=>getComputedStyle(e).backgroundColor)).size===4,'four different action colours');
   const white=$('earKeyboard').querySelector('.ear-white'),black=$('earKeyboard').querySelector('.ear-black');check(rect(white).height===96&&rect(black).height===58,'short black keys and full white keys');check(Math.abs(rect(white).top-rect(black).top)<1&&getComputedStyle(black).whiteSpace==='nowrap','black keys align and labels do not wrap');
   check(getComputedStyle(white).backgroundColor!==getComputedStyle(black).backgroundColor&&Number(getComputedStyle(black).zIndex)>Number(getComputedStyle(white).zIndex),'black keys stay solid and above white keys');
   const height=$('earTrainerDialog').scrollHeight;check(height<560,'active notes fit within 560px: '+height);
   $('earListen').click();await until(()=>!$('earReveal').disabled);for(const midi of q.answer)$('earKeyboard').querySelector('[data-midi="'+midi+'"]').click();$('earCheckNotes').click();check($('earFeedback').textContent.startsWith('Correct'),'keyboard input still scores');check(!$('earNext').disabled,'Next enabled after answer');
   await start('intervals');tones=[];const key=q.key;$('earRepeat').click();await until(()=>tones.length>=4);check(q.key===key&&$('earRepeat').getAttribute('aria-pressed')==='true','Repeat loops the current interval');$('earRepeat').click();const count=tones.length;await sleep(1800);check(tones.length===count&&$('earRepeat').getAttribute('aria-pressed')==='false','Repeat button stops the loop');check($('earScore').textContent==='0/0 correct','repeating does not change scores');
   $('earListen').click();await until(()=>!$('earReveal').disabled);[...$('earAnswers').children].find(b=>b.textContent===q.answer).click();check($('earFeedback').textContent.startsWith('Correct'),'interval answer remains accurate');$('earNext').click();check(q.key!==key,'Next selects another example');
   for(const mode of ['chords','progressions','rhythm']){await start(mode);check(!$('earRepeat').disabled,mode+' has repeat playback');check($('earTrainerDialog').scrollWidth<=$('earTrainerDialog').clientWidth+1,mode+' fits without horizontal scrolling');}
   $('earClose').click();say('DONE ALL RC259 CHECKS');
  }catch(e){say('FAIL '+e.message);if($('earTrainerDialog').open)$('earClose').click();}finally{$('rc259Run').disabled=false;}
 };
})();
