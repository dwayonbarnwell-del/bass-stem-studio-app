// Runs only in the isolated staging build, inside the application closure.
{
 const $=id=>document.getElementById(id),sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const panel=document.createElement('aside');panel.style='position:fixed;top:48px;right:8px;z-index:999999;background:white;color:#111;padding:8px;max-width:420px;font:13px system-ui';panel.innerHTML='<button id="rc260Run">Run RC260 checks</button><pre id="rc260Results" style="max-height:250px;overflow:auto;white-space:pre-wrap">Ready RC260</pre>';document.body.append(panel);
 const say=s=>$('rc260Results').textContent+='\n'+s,check=(v,s)=>{if(!v)throw Error(s);say('PASS '+s);};
 async function until(fn,ms=45000){const start=performance.now();while(!fn()){if(performance.now()-start>ms)throw Error('Timeout: '+$('earStatus')?.textContent);await sleep(40);}}
 let q,tones=[];const make=window.BassEarTrainingCore.make,tone=window.BassPianoAudio.tone;
 window.BassEarTrainingCore.make=(...a)=>(q=make(...a));window.BassPianoAudio.tone=(...a)=>{tones.push({midi:a[1],sound:a[4]});return tone(...a);};
 $('rc260Run').onclick=async()=>{
  $('rc260Run').disabled=true;$('rc260Results').textContent='Running RC260';
  try{
   $('openEarTraining').click();check($('earTrainerDialog').getBoundingClientRect().top<=16,'panel starts near top');
   for(const id of ['earMode','earLevel','earSound'])check(getComputedStyle($(id)).textAlignLast==='center',id+' text centred');
   $('earMode').value='notes';$('earMode').dispatchEvent(new Event('change'));$('earLevel').value='1';$('earSound').value='bass';document.querySelector('[data-playback="questions"]').click();$('earStart').click();await until(()=>!$('earQuestion').hidden);
   let keys=[...$('earKeyboard').children];check(keys.length===12&&Number(keys[0].dataset.midi)%12===0&&Number(keys.at(-1).dataset.midi)%12===11,'fixed C to B keyboard');
   $('earListen').click();await until(()=>!$('earReveal').disabled);
   for(const m of q.answer)$('earKeyboard').querySelector('[data-midi="'+m+'"]').click();
   check($('earFeedback').textContent.startsWith('Correct'),'last selected note automatically checks answer');check(!$('earNext').disabled,'Next available automatically');
   check(q.answer.every(m=>$('earKeyboard').querySelector('[data-midi="'+m+'"]').classList.contains('ear-correct')),'correct notes light blue');
   check($('earKeyboard').querySelectorAll('.ear-correct').length===new Set(q.answer).size,'only correct notes highlighted');
   const score=$('earScore').textContent;tones=[];$('earAnswerSound').click();await until(()=>!$('earAnswerSound').disabled);check(JSON.stringify(tones.map(n=>n.midi))===JSON.stringify(q.answer),'Hear answer replays exact notes');
   const first=keys[0];first.click();check($('earScore').textContent===score&&!first.disabled,'keys remain available for sound reminders');
   $('earNext').click();check(!$('earKeyboard').querySelector('.ear-correct'),'Next clears answer highlights');$('earListen').click();await until(()=>!$('earReveal').disabled);
   for(const m of q.answer)$('earKeyboard').querySelector('[data-midi="'+(m===q.keyboard[0]?q.keyboard[1]:q.keyboard[0])+'"]').click();
   check($('earFeedback').textContent.startsWith('Keep practising')&&$('earKeyboard').querySelector('.ear-correct'),'wrong answer automatically shows correct notes');
   $('earClose').click();$('openEarTraining').click();$('earSectionFills').click();
   check(!$('earFillStudy').hidden&&$('earStartRow').hidden,'bass fills lesson replaces quiz controls');check($('fillFrom').options.length===7&&$('fillTo').options.length===7&&$('fillIdea').options.length===10,'all degrees and ten ideas available');
   $('fillTempo').value='160';$('fillTempo').dispatchEvent(new Event('change'));$('fillFrom').value='4';$('fillFrom').dispatchEvent(new Event('change'));$('fillTo').value='5';$('fillTo').dispatchEvent(new Event('change'));
   check($('fillHeading').textContent==='4 → 5 · F → G','degree and chord labels agree');
   tones=[];$('fillPlay').click();await until(()=>$('fillStatus').textContent==='Play it again');check(tones.some(n=>n.sound==='bass')&&tones.some(n=>n.sound==='piano'),'bass fill and chord backing both play');
   $('fillBacking').click();tones=[];$('fillRepeat').click();await until(()=>tones.length>=14);check(tones.every(n=>n.sound==='bass'),'Bass only repeats without piano');$('fillRepeat').click();const n=tones.length;await sleep(1800);check(tones.length===n,'fill Repeat stops without stray notes');
   $('fillNext').click();check($('fillIdea').value==='1','Next idea advances');$('earClose').click();const afterClose=tones.length;await sleep(800);check(tones.length===afterClose,'closing cancels fill playback');
   ensureCtx();const b=ctx.createBuffer(1,11025*8,11025),samples=b.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=.06*Math.sin(2*Math.PI*220*i/11025);
   check(await loadAudioFile(new File([wavBlob(b)],'Keyboard test.wav',{type:'audio/wav'}),{batchImport:true}),'synthetic song loads');
   window.BassPiano.restore({version:2,notes:[{midi:60,start:0,end:.4},{midi:67,start:1,end:1.5}],done:[{start:0,end:8}]});setPracticeVisualMode('piano');window.BassPiano.render(true);
   const before=JSON.stringify(window.BassPiano.exportData());let pianoKeys=[...$('pianoKeyboard').children];check(Number(pianoKeys[0].dataset.midi)%12===11&&Number(pianoKeys.at(-1).dataset.midi)%12===0,'piano view also uses complete C to B octaves');
   check(!$('pianoKeyboard').querySelector('.active'),'paused playhead does not leave keys yellow');pianoKeys[2].click();await until(()=>!!$('pianoKeyboard').querySelector('.auditioning'));
   check(JSON.stringify(window.BassPiano.exportData())===before,'piano key tap auditions without adding saved notes');await until(()=>!$('pianoKeyboard').querySelector('.auditioning'),3000);check(!$('pianoKeyboard').querySelector('.active'),'audition highlight clears');
   check($('earTrainerDialog').scrollWidth<=$('earTrainerDialog').clientWidth+1,'no trainer horizontal overflow');say('DONE ALL RC260 CHECKS');
  }catch(e){say('FAIL '+e.message);}finally{if($('earTrainerDialog').open)$('earClose').click();$('rc260Run').disabled=false;}
 };
}
