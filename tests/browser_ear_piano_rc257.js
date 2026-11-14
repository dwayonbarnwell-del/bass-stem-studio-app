/* Isolated staging audit: generated questions, browser audio and genuine controls. */
(()=>{
 const $=id=>document.getElementById(id),sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const panel=document.createElement('aside');panel.id='rc257Audit';panel.style='position:fixed;top:48px;right:8px;z-index:999999;background:#fff;color:#111;padding:8px;max-width:440px;font:13px system-ui';panel.innerHTML='<button id="rc257Run">Run ear and piano checks</button><pre id="rc257Results" style="max-height:260px;overflow:auto;white-space:pre-wrap">Ready RC257</pre>';document.body.append(panel);
 const out=$('rc257Results'),say=s=>{out.textContent+='\n'+s;},check=(ok,label)=>{if(!ok)throw Error(label);say('PASS '+label);};let current;
 const original=window.BassEarTrainingCore.make;window.BassEarTrainingCore.make=(...args)=>current=original(...args);
 async function until(fn,ms=20000){const start=performance.now();while(!fn()){if(performance.now()-start>ms)throw Error('Timed out: '+$('earStatus')?.textContent);await sleep(30);}}
 async function startMode(mode,level=1){if($('earTrainerDialog').open){$('earClose').click();await sleep(40);}$('openEarTraining').click();$('earMode').value=mode;$('earMode').dispatchEvent(new Event('change'));$('earLevel').value=level;$('earStart').click();await until(()=>!$('earQuestion').hidden);}
 async function listen(){ $('earListen').click();await until(()=>!$('earReveal').disabled||$('earStatus').textContent==='Replay complete',30000);}
 function answer(correct=true){if(current.mode==='notes'){for(const m of current.answer)$('earKeyboard').querySelector('[data-midi="'+m+'"]').click();$('earCheckNotes').click();}else{const value=correct?current.answer:current.options.find(x=>x!==current.answer);[...$('earAnswers').children].find(b=>b.textContent===value).click();}}
 $('rc257Run').onclick=async()=>{
  $('rc257Run').disabled=true;out.textContent='Running RC257';
  try{
   const ctx=new AudioContext();await ctx.resume();const A=window.BassPianoAudio,G=window.BassGrandPiano;
   const notes=[40,80,112].map(velocity=>({midi:60,velocity}));await A.prepare('piano',ctx,{notes});
   let last=0;for(const n of notes){const channels=G.render([{...n,start:0,end:.5}],0,44100,44100);const peak=Math.max(...channels[0].map(Math.abs));check(peak>last,'velocity '+n.velocity+' has rising loudness');last=peak;check(channels[0].some((v,i)=>Math.abs(v-channels[1][i])>.001),'stereo channels differ '+n.velocity);const onset=channels[0].findIndex(v=>Math.abs(v)>.001)/44100;check(onset>=0&&onset<.012,'decoded attack '+(onset*1000).toFixed(1)+' ms');check(channels[0].slice(23000,27000).some(v=>Math.abs(v)>.0001),'natural release retained');}
   const wav=await A.exportAudio({notes:[{midi:60,start:0,end:.5}],start:0,end:.7});const decoded=await ctx.decodeAudioData(await wav.arrayBuffer());check(decoded.numberOfChannels===2&&decoded.duration>.9,'stereo WAV with release');
   const mp3=await A.exportAudio({notes:[{midi:60,start:0,end:.5}],start:0,end:.7,format:'mp3',encoder:async()=>{if(!window.lamejs)await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='./vendor/lamejs/lame.min.js';s.onload=resolve;s.onerror=reject;document.head.append(s);});return window.lamejs;}});const mp3decoded=await ctx.decodeAudioData(await mp3.arrayBuffer());check(mp3decoded.numberOfChannels===2,'browser-decodable stereo MP3');
   const cached=await caches.open('bass-piano-salamander-v1');check(!!await cached.match('./ai-source/salamander/60-medium.mp3'),'sample cached for offline reuse');
   await ctx.close();
   await startMode('notes',3);await listen();answer();check($('earFeedback').textContent.startsWith('Correct'),'notes keyboard scoring');const score=$('earScore').textContent;await listen();check($('earScore').textContent===score&&$('earCheckNotes').disabled&&$('earReveal').disabled,'replay cannot score twice');
   await startMode('intervals',3);await listen();answer(false);check($('earFeedback').textContent.startsWith('Keep practising'),'wrong interval gets explanation');
   await startMode('progressions',2);await listen();answer();check($('earFeedback').textContent.startsWith('Correct'),'worship progression scoring');
   await startMode('rhythm');await listen();for(let i=0;i<current.answer.length;i++){if(i)await sleep((current.answer[i]-current.answer[i-1])*1000);$('earTap').click();}check($('earFeedback').textContent.startsWith('Correct'),'rhythm taps graded on spacing');
   await startMode('chords');for(let i=0;i<5;i++){await listen();answer();$('earNext').click();}check($('earSummaryTitle').textContent==='5 of 5 correct','complete five-question round');check(!$('earAdvance').hidden,'next level offered');const saved=JSON.parse(localStorage.getItem('bass-ear-training-v1'));check(saved.modes.chords.correct>=5&&saved.modes.chords.rounds>=1,'progress saved');$('earAdvance').click();await until(()=>!$('earQuestion').hidden);check(current.level===2,'next level starts');
   $('earListen').click();$('earClose').click();await sleep(300);check(!$('earTrainerDialog').open,'close cancels pending sound');$('openEarTraining').click();check($('earQuestion').hidden,'reopen starts safely');
   for(const mode of ['notes','intervals','progressions','rhythm','chords'])check($('earProgressList').textContent.includes({notes:'Notes by ear',intervals:'Intervals',progressions:'Worship progressions',rhythm:'Rhythm',chords:'Chords'}[mode]),mode+' progress visible');
   const d=$('earTrainerDialog');check(d.scrollWidth<=d.clientWidth+1,'dialog has no horizontal overflow');$('earClose').click();say('DONE ALL RC257 CHECKS');
  }catch(e){say('FAIL '+e.message);if($('earTrainerDialog').open)$('earClose').click();}finally{$('rc257Run').disabled=false;}
 };
})();
