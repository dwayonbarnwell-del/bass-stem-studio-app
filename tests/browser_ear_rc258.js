/* Runs only on the isolated test origin; no microphone or paid analysis. */
(()=>{
 const $=id=>document.getElementById(id),sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const panel=document.createElement('aside');panel.style='position:fixed;top:48px;right:8px;z-index:999999;background:white;color:#111;padding:8px;max-width:440px;font:13px system-ui';panel.innerHTML='<button id="rc258Run">Run RC258 checks</button><pre id="rc258Results" style="max-height:280px;overflow:auto;white-space:pre-wrap">Ready RC258</pre>';document.body.append(panel);
 const out=$('rc258Results'),say=s=>out.textContent+='\n'+s,check=(ok,label)=>{if(!ok)throw Error(label);say('PASS '+label);};
 let question,tones=[];const make=window.BassEarTrainingCore.make,tone=window.BassPianoAudio.tone;
 window.BassEarTrainingCore.make=(...args)=>(question=make(...args));window.BassPianoAudio.tone=(...args)=>{tones.push({midi:args[1],when:args[2],sound:args[4]});return tone(...args);};
 async function until(fn,ms=45000){const start=performance.now();while(!fn()){if(performance.now()-start>ms)throw Error('Timeout: '+$('earStatus')?.textContent);await sleep(30);}}
 async function start(mode,sound='piano',playback='questions',level=1){if($('earTrainerDialog').open)$('earClose').click();$('openEarTraining').click();$('earMode').value=mode;$('earMode').dispatchEvent(new Event('change'));$('earSound').value=sound;$('earPlayback').value=playback;$('earPlayback').dispatchEvent(new Event('change'));$('earLevel').value=level;$('earStart').click();await until(()=>!$('earQuestion').hidden);}
 $('rc258Run').onclick=async()=>{
  out.textContent='Running RC258';$('rc258Run').disabled=true;
  try{
   check($('openEarTraining').previousElementSibling.id==='openLiveAudio','ear button next to live audio');
   for(const id of ['openLiveAudio','openEarTraining','openMoreTools','openSettings'])check(!$(id).textContent.trim()&&!!$(id).querySelector('svg')&&!!$(id).getAttribute('aria-label'),id+' accessible icon');
   check(!$('earTrainerDialog').querySelector('.ear-credit')&&$('soundCreditsLink')?.getAttribute('href')==='./SOUND_CREDITS.txt','credits moved to Settings');
   const ctx=new AudioContext();await ctx.resume();const A=window.BassPianoAudio;
   await A.prepare('bass',ctx);await A.prepare('piano',ctx,{notes:[{midi:48,velocity:80}]});
   const bass=A.pcm([{midi:48,start:0,end:1}],0,44100,44100,'bass'),piano=window.BassGrandPiano.render([{midi:48,start:0,end:1,velocity:80}],0,44100,44100)[0];
   let diff=0,energy=0;for(let i=0;i<bass.length;i++){diff+=Math.abs(bass[i]-piano[i]);energy+=bass[i]*bass[i];}check(energy>.01&&diff>20,'bass has distinct decoded audio from grand piano');
   // Autocorrelation checks the actual decoded/pitch-shifted bass at C3.
   let best=0,lag=0;for(let k=300;k<380;k++){let cross=0,a=0,b=0;for(let i=4410;i<8820;i++){cross+=bass[i]*bass[i+k];a+=bass[i]*bass[i];b+=bass[i+k]*bass[i+k];}const score=cross/Math.sqrt(a*b);if(score>best){best=score;lag=k;}}
   check(Math.abs(1200*Math.log2((44100/lag)/130.8128))<20,'bass C3 pitch within 20 cents');await ctx.close();
   for(const sound of ['piano','bass']){
    await start('progressions',sound);tones=[];$('earListen').click();await until(()=>!$('earReveal').disabled);check(tones.length===16,'exactly four chords, no automatic home chord '+sound);check(tones.every(n=>n.sound===sound),'selected instrument honoured '+sound);check(tones[0].midi===question.events[0].midi,'first chord matches answer '+sound);
    const saved=tones;tones=[];$('earHome').click();await until(()=>$('earStatus').textContent==='Play four chords');check(tones.length===3&&tones.every(n=>n.sound===sound),'home chord separate '+sound);check($('earScore').textContent==='0/0 correct','home chord does not score');
   }
   const progress=localStorage.getItem('bass-ear-training-v1');
   await start('notes','bass','repeat');const key=question.key;await until(()=>tones.filter(n=>n.sound==='bass').length>3);await until(()=>$('earStatus').textContent==='Listen again');const count=tones.length;await until(()=>tones.length>count);check(question.key===key,'repeat keeps the same example');$('earListen').click();const stopped=tones.length;await sleep(1600);check(tones.length===stopped&&$('earStatus').textContent==='Playback stopped','Stop cancels repeats');
   await start('chords','bass','varied');const first=question.key;await until(()=>question.key!==first);check($('earAnswers').hidden&&$('earFeedback').textContent,'new examples show the answer for listening');check(localStorage.getItem('bass-ear-training-v1')===progress,'listening does not change test scores');$('earClose').click();const closed=tones.length;await sleep(1700);check(tones.length===closed,'closing cancels continuous playback');
   await start('chords','bass');const prior=question.key;$('earClose').click();await start('chords','bass');check(question.key!==prior,'new round avoids previous example');tones=[];$('earListen').click();await until(()=>!$('earReveal').disabled);[...$('earAnswers').children].find(b=>b.textContent===question.answer).click();check($('earFeedback').textContent.startsWith('Correct'),'normal questions still score');
   const d=$('earTrainerDialog');check(d.scrollWidth<=d.clientWidth+1,'dialog fits viewport');$('earClose').click();say('DONE ALL RC258 CHECKS');
  }catch(e){say('FAIL '+e.message);if($('earTrainerDialog').open)$('earClose').click();}finally{$('rc258Run').disabled=false;}
 };
})();
