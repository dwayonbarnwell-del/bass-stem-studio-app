/* Isolated preview fixture: real buffers, native transport and actual UI controls. */
(()=>{
const $=id=>document.getElementById(id),out=$('testResult293'),button=$('testAudio293'),pause=ms=>new Promise(r=>setTimeout(r,ms));
const check=(v,label)=>{if(!v)throw Error(label);out.textContent+='\nPASS '+label;};
const until=async fn=>{const end=performance.now()+60000;while(!fn()){if(performance.now()>end)throw Error('Timed out: '+$('fillStatus')?.textContent);await pause(50);}};
button.onclick=async()=>{
 button.disabled=true;out.hidden=false;out.textContent='Checking genres, sound and repeat';let ctx;const errors=[];window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
 try{
 const {BassAccompaniment:H,BassPracticeLoop:L,BassPracticeCore:P,BassRegister:R}=window;ctx=new AudioContext();await ctx.resume();
 const plan=R.plan(P.make('basslines',{idea:0,key:11,bpm:137}));let peakMax=0;
 for(const [id,p]of Object.entries(H.profiles)){
  const rendered=await L.render(ctx,plan,{...p,style:id,chords:true});check(Object.keys(rendered.stems).length===3,id+' bass, keys and drums decoded');
  const offline=new OfflineAudioContext(2,rendered.frames*4+Math.ceil(.1*ctx.sampleRate),ctx.sampleRate),run=L.start(offline,rendered,{repeat:true,drums:.45,chords:.8});
  const mixed=await offline.startRendering(),start=Math.round(run.when*ctx.sampleRate);let peak=0,diff=0,keyPeak=0;
  for(let ch=0;ch<2;ch++){for(const v of mixed.getChannelData(ch)){if(!Number.isFinite(v))throw Error('Invalid audio');peak=Math.max(peak,Math.abs(v));}const d=mixed.getChannelData(ch);for(let i=0;i<rendered.frames;i++)diff=Math.max(diff,Math.abs(d[start+rendered.frames+i]-d[start+2*rendered.frames+i]));for(const v of rendered.stems.chords.getChannelData(ch))keyPeak=Math.max(keyPeak,Math.abs(v));}
  check(peak>.02&&peak<.99&&keyPeak>.002&&diff<.00002,id+' audible keys, no clipping or repeat drift');peakMax=Math.max(peakMax,peak);
 }
 let starts=0,last,renderCount=0;const nativeStart=L.start,nativeRender=L.render;L.start=(...args)=>{starts++;return last=nativeStart(...args);};L.render=(...args)=>{renderCount++;return nativeRender(...args);};
 $('openEarTraining').click();$('earSectionFills').click();$('earSectionBasslines').click();
 check($('fillBacking').getAttribute('aria-pressed')==='true'&&$('fillDrums').getAttribute('aria-pressed')==='true','Chords and drums on by default');
 check($('fillCollection').options.length===10,'Only ten Bassline genres');
 let optionCount=0;for(const option of [...$('fillCollection').options]){$('fillCollection').value=option.value;$('fillCollection').dispatchEvent(new Event('change'));optionCount+=$('fillIdea').options.length;}
 check(optionCount===179,'All 107 studies and 72 recordings reachable once');
 $('fillCollection').value='reggae';$('fillCollection').dispatchEvent(new Event('change'));check($('fillAccompaniment').textContent.includes('Reggae one-drop')&&$('fillAccompaniment').textContent.includes('Drawbar organ'),'Reggae selects its own beat and organ');
 $('fillCollection').value='makossa';$('fillCollection').dispatchEvent(new Event('change'));check($('fillAccompaniment').textContent.includes('Makossa')&&$('fillAccompaniment').textContent.includes('Wurlitzer'),'Makossa selects a different beat and electric piano');
 $('fillDrumOptions').open=true;$('fillDrumGroove').value='shuffle';$('fillDrumGroove').dispatchEvent(new Event('change'));$('fillKeySound').value='piano';$('fillKeySound').dispatchEvent(new Event('change'));
 $('fillCollection').value='gospel';$('fillCollection').dispatchEvent(new Event('change'));check($('fillAccompaniment').textContent.includes('Blues shuffle')&&$('fillKeySound').value==='piano','Manual choices survive genre changes');
 $('fillGenreReset').click();check($('fillDrumGroove').value==='auto'&&$('fillKeySound').value==='auto','Return to automatic genre settings');
 $('fillTempo').value='160';$('fillTempo').dispatchEvent(new Event('change'));$('fillRepeat').click();await until(()=>starts===1);const when=last.when;
 $('fillBacking').click();$('fillDrums').click();$('fillKeyVolume').value='60';$('fillKeyVolume').dispatchEvent(new Event('input'));check(starts===1&&last.when===when&&$('fillRepeat').getAttribute('aria-pressed')==='true','Sound and volume changes preserve loop phase');
 $('fillBacking').click();$('fillDrums').click();await pause(6300);check(starts===1&&$('fillPlay').textContent==='Stop','Live repeat retains the same transport');$('fillRepeat').click();$('fillPlay').click();await until(()=>starts===2);check(renderCount===1,'Replay reuses audio');$('fillPlay').click();
 $('fillCollection').value='makossa';$('fillCollection').dispatchEvent(new Event('change'));const recorded=[...$('fillIdea').options].find(o=>o.value.startsWith('clip:'));$('fillIdea').value=recorded.value;$('fillIdea').dispatchEvent(new Event('change'));check(!$('fillIdea').hidden&&!$('fillExcerpt').hidden&&$('fillDrums').hidden,'Recordings remain in their genre with original playback controls');
 $('fillClipSound').value='notes';$('fillClipSound').dispatchEvent(new Event('change'));$('fillPlay').click();await until(()=>$('fillStatus').textContent.startsWith('Playing'));$('fillPlay').click();
 $('earSectionRuns').click();check(!$('fillDrums').hidden&&$('fillGroup').options.length===5,'Runs keep five groups and accompaniment');
 $('earClose').click();L.start=nativeStart;L.render=nativeRender;check(!errors.length,'No unhandled playback errors');await ctx.close();out.textContent+='\nALL CHECKS PASSED · max peak '+peakMax.toFixed(3);button.textContent='Genre checks passed';
 }catch(e){out.textContent+='\nFAIL '+e.stack;button.textContent='Genre check failed';if(ctx)await ctx.close();}button.disabled=false;
};
})();
