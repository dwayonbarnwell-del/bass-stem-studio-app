(()=>{
 const $=id=>document.getElementById(id),sleep=ms=>new Promise(r=>setTimeout(r,ms)),out=$('fixtureResult'),audios=[],tones=[];
 const NativeAudio=window.Audio;window.Audio=function(...args){const a=new NativeAudio(...args);audios.push(a);return a;};window.Audio.prototype=NativeAudio.prototype;
 const tone=window.BassPianoAudio.tone;window.BassPianoAudio.tone=(...a)=>{const v=tone(...a);tones.push(a[1]);return v;};
 const check=(ok,label)=>{if(!ok)throw Error(label);out.textContent+='\nPASS '+label;};
 const change=(id,value)=>{$(id).value=value;$(id).dispatchEvent(new Event('change'));};
 async function until(fn){const st=performance.now();while(!fn()){if(performance.now()-st>20000)throw Error('Timed out: '+$('fillStatus').textContent);await sleep(40);}}
 $('fixtureRun').onclick=async()=>{
  $('fixtureRun').disabled=true;out.textContent='Running RC267';
  try{
   $('openEarTraining').click();$('earSectionFills').click();$('earSectionBasslines').click();change('fillCollection','bass-lady');
   check($('fillClip').options.length===11,'11 Bass Lady lessons');check($('fillKey').hidden&&$('fillTempo').hidden&&$('fillBacking').hidden,'recorded lessons do not invent key or chords');
   change('fillClipSpeed','50');$('fillPlay').click();await until(()=>audios.length&&audios.at(-1).currentTime>window.BassUploadedCore.items.find(c=>c.id===$('fillClip').value).parts[Number($('fillExcerpt').value)].start+.2);
   const a=audios.at(-1);check(!a.paused&&a.playbackRate===.5&&a.preservesPitch,'recorded bass plays at half speed with pitch preserved');$('fillPlay').click();check(a.paused,'Stop pauses recorded bass');
   change('fillClipSound','notes');change('fillClipTranspose','2');check(!$('fillClipTranspose').hidden,'note playback allows transposition');const before=tones.length;$('fillPlay').click();await until(()=>tones.length>before);check(true,'transcribed note playback produces real bass voices');$('fillPlay').click();
   change('fillCollection','bassmatics');check($('fillClip').options.length===10,'10 Bassmatics lessons');change('fillCollection','bass-sounds');check($('fillClip').options.length===22,'22 uploaded grooves');
   change('fillCollection','studies');check(!$('fillIdea').hidden&&$('fillClip').hidden&&!$('fillKey').hidden,'original basslines remain available');
   change('earMode','notes');check(!$('earNotes').hidden&&$('earFillStudy').hidden,'Notes section stays separate');$('earClose').click();out.textContent+='\nALL RC267 CHECKS PASSED';
  }catch(e){out.textContent+='\nFAIL '+e.message;if($('earTrainerDialog').open)$('earClose').click();}
  finally{$('fixtureRun').disabled=false;}
 };
})();
