/* Run from the isolated preview, using real Web Audio and actual controls. */
(()=>{
 const $=id=>document.getElementById(id),button=$('testAudio292'),out=$('testResult292');
 const check=(ok,label)=>{if(!ok)throw Error(label);out.textContent+='\nPASS '+label;};
 const pause=ms=>new Promise(r=>setTimeout(r,ms));
 const until=async fn=>{const end=performance.now()+60000;while(!fn()){if(performance.now()>end)throw Error('Timed out: '+$('fillStatus')?.textContent);await pause(50);}};
 button.onclick=async()=>{
  button.disabled=true;out.hidden=false;out.textContent='Checking real audio';let ctx;
  try{
   ctx=new AudioContext();await ctx.resume();const L=window.BassPracticeLoop,P=window.BassPracticeCore,R=window.BassRegister;
   const plan=R.plan(P.make('runs',{idea:51,key:11,from:6,to:4,bpm:137}));
   for(const kit of ['vintage','studio','jazz']){
    const rendered=await L.render(ctx,plan,{kit,groove:kit==='jazz'?'swing':kit==='vintage'?'pocket':'gospel',chords:true});
    check(Object.keys(rendered.stems).length===3,kit+' bass, piano and drum buffers decoded');
    const offline=new OfflineAudioContext(2,Math.ceil(rendered.frames*6+.1*ctx.sampleRate),ctx.sampleRate);
    const run=L.start(offline,rendered,{repeat:true,drums:.45,chords:.25});
    const mixed=await offline.startRendering(),start=Math.round(run.when*ctx.sampleRate);let peak=0,difference=0;
    for(let ch=0;ch<2;ch++){const data=mixed.getChannelData(ch);for(const value of data){if(!Number.isFinite(value))throw Error('Invalid sample');peak=Math.max(peak,Math.abs(value));}
     for(let cycle=2;cycle<5;cycle++)for(let i=0;i<rendered.frames;i++)difference=Math.max(difference,Math.abs(data[start+cycle*rendered.frames+i]-data[start+rendered.frames+i]));
    }
    check(peak>.02&&peak<=.99,kit+' audible mix without clipping');
    check(difference<.00002,kit+' six cycles repeat within one sample without drift');
   }
   let starts=0,last,renderCount=0;const start=L.start,render=L.render;
   L.start=(...args)=>{starts++;return last=start(...args);};L.render=(...args)=>{renderCount++;return render(...args);};
   $('openEarTraining').click();check($('earSound').value==='bass','Bass is the default ear-training sound');
   $('earSectionFills').click();$('earSectionRuns').click();$('fillTempo').value='160';$('fillTempo').dispatchEvent(new Event('change'));
   check($('fillBacking').getAttribute('aria-pressed')==='false','Piano chords are optional and off initially');
   $('fillRepeat').click();await until(()=>starts===1);check($('fillRepeat').getAttribute('aria-pressed')==='true','Repeat begins with drums');
   const began=last.when;await pause(6300);check(starts===1&&last.when===began&&$('fillPlay').textContent==='Stop','Multiple live cycles keep one audio-clock transport');
   $('fillDrums').click();$('fillBacking').click();check(starts===1&&$('fillRepeat').getAttribute('aria-pressed')==='true','Drum and chord mute preserve repeat phase');
   $('fillDrumVolume').value='20';$('fillDrumVolume').dispatchEvent(new Event('input'));check($('fillDrumLevel').textContent==='20%','Drum volume control updates');
   $('fillRepeat').click();check($('fillPlay').textContent==='Play','Repeat stops all parts');
   $('fillPlay').click();await until(()=>starts===2);check(renderCount===1,'Replay reuses its prepared sound');
   $('earSectionBasslines').click();check($('fillPlay').textContent==='Play','Changing section stops the previous loop');
   $('fillDrumOptions').open=true;check($('fillDrumKit').options.length===3&&$('fillDrumGroove').options.length===8,'Three drum sounds and eight beats available');
   $('fillDrumKit').value='studio';$('fillDrumKit').dispatchEvent(new Event('change'));$('fillDrumGroove').value='highlife';$('fillDrumGroove').dispatchEvent(new Event('change'));check(JSON.parse(localStorage.getItem('bass-practice-drums-v1')).groove==='highlife','Drum choices are saved');
   const long=window.BassUploadedCore.items.find(c=>c.collection==='recorded-makossa'&&c.parts[0].end-c.parts[0].start>1200);
   $('fillCollection').value=long.collection;$('fillCollection').dispatchEvent(new Event('change'));$('fillClip').value=long.id;$('fillClip').dispatchEvent(new Event('change'));$('fillExcerpt').value='0';$('fillExcerpt').dispatchEvent(new Event('change'));$('fillClipSound').value='notes';$('fillClipSound').dispatchEvent(new Event('change'));
   $('fillPlay').click();await until(()=>$('fillStatus').textContent.startsWith('Playing ·'));
   check($('fillDrums').hidden&&$('fillPlay').textContent==='Stop','Long recorded lessons retain note playback without unverified drums');$('fillPlay').click();check($('fillPlay').textContent==='Play','Long lesson stops cleanly');
   $('earClose').click();L.start=start;L.render=render;await ctx.close();out.textContent+='\nALL CHECKS PASSED';button.textContent='Audio checks passed';
  }catch(e){out.textContent+='\nFAIL '+e.stack;button.textContent='Audio check failed';if(ctx)await ctx.close();}
  button.disabled=false;
 };
})();
