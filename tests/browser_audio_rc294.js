/* Runs against the real application, AudioContext, workers and supplied audio. */
(()=>{
 const $=id=>document.getElementById(id),out=$('qaResult294'),button=$('qaRun294'),pause=ms=>new Promise(r=>setTimeout(r,ms));
 const check=(value,name)=>{if(!value)throw Error(name);out.textContent+='\nPASS '+name;};
 const until=async fn=>{const end=performance.now()+60000;while(!fn()){if(performance.now()>end)throw Error('Timed out: '+$('fillStatus')?.textContent);await pause(40);}};
 button.onclick=async()=>{
  button.disabled=true;out.textContent='Running RC294 playback checks';let context;const errors=[];
  const onError=e=>errors.push(String(e.reason||e.message));window.addEventListener('unhandledrejection',onError);
  try{
   const {BassAccompaniment:H,BassSuppliedDrums:B,BassPracticeLoop:L,BassPracticeCore:P,BassRegister:R}=window;
   context=new AudioContext();await context.resume();
   check(B.loops.length===45,'45 supplied loops');
   check(H.resolve(P.make('basslines',{idea:0})).sound==='piano','Grand piano default');
   check(H.resolve(P.make('basslines',{idea:0})).loop.genre==='soul','Worship uses R&B / soul');
   for(const row of B.loops){const response=await fetch(row.url);check(response.ok,'Audio '+row.id);const audio=await context.decodeAudioData(await response.arrayBuffer());if(Math.abs(audio.duration-row.beats*60/row.bpm)>.002)throw Error('Incorrect native tempo: '+row.id);}
   check(true,'All loop lengths match native BPM');
   let lastRendered;
   for(const bpm of [40,80,137,220]){
    const plan=R.plan(P.make('basslines',{idea:0,bpm}));
    const rendered=await L.render(context,plan,H.resolve(plan));
    check(rendered.stems.bass.length===plan.beats*rendered.beatFrames&&rendered.stems.drums.length===32*rendered.beatFrames,'Shared beat clock at '+bpm+' BPM');
    check(Object.keys(rendered.stems).length===3,'Bass, drums and piano at '+bpm+' BPM');lastRendered=rendered;
   }
   const frames=lastRendered.stems.drums.length,offline=new OfflineAudioContext(2,frames*2+6000,context.sampleRate),run=L.start(offline,lastRendered,{repeat:true});
   const mixed=await offline.startRendering(),start=Math.round(run.when*context.sampleRate);let peak=0,diff=0;
   for(let c=0;c<2;c++){const data=mixed.getChannelData(c);for(const v of data){if(!Number.isFinite(v))throw Error('Invalid audio');peak=Math.max(peak,Math.abs(v));}for(let i=0;i<frames;i++)diff=Math.max(diff,Math.abs(data[start+i]-data[start+frames+i]));}
   check(peak>.01&&peak<.99&&diff<.00002,'No clipping or repeat drift');
   let starts=[],stops=[],buttonStopped=false,watch=false;
   const nativeStart=L.start;L.start=(ctx,r,options)=>{const t=nativeStart(ctx,r,options),id=starts.length,original=t.stopAt;starts.push({when:t.when,beat:r.beatSeconds,id});t.stopAt=(at,fade)=>{stops.push({id,at});return original(at,fade);};return t;};
   $('openEarTraining').click();$('earSectionFills').click();$('earSectionBasslines').click();
   check(!$('fillRatingGuide')&&!$('fillTip')&&!$('fillRating'),'Descriptions removed');
   check($('earSound').value==='piano','Ear training starts with grand piano');
   const change=(id,value)=>{$(id).value=value;$(id).dispatchEvent(new Event('change'));};
   change('fillCollection','worship');
   check(Number($('fillTempo').value)===80,'Native worship drum tempo is 80 BPM');
   change('fillTempo','220');
   const observer=new MutationObserver(()=>{if(watch&&$('fillPlay').textContent==='Play')buttonStopped=true;});observer.observe($('fillPlay'),{childList:true});
   $('fillPlay').click();await until(()=>starts.length===1);watch=true;
   check($('fillRepeat').getAttribute('aria-pressed')==='true','Play loops automatically');
   const edit=async(id,value)=>{const before=starts.length;change(id,value);check($('fillPlay').textContent==='Stop',id+' keeps playing while loading');await until(()=>starts.length>before);await until(()=>$('fillStatus').textContent.startsWith('Playing'));};
   await edit('fillKeySound','organ');await edit('fillKeySound','piano');await edit('fillKeyStyle','soul');
   await edit('fillDrumKit','funk');check(Number($('fillTempo').value)===110,'Selected funk loop uses labelled 110 BPM');
   await edit('fillTempo','137');
   const before=starts.length;$('fillBacking').click();$('fillDrums').click();$('fillKeyVolume').value='53';$('fillKeyVolume').dispatchEvent(new Event('input'));$('fillDrumVolume').value='62';$('fillDrumVolume').dispatchEvent(new Event('input'));
   check(starts.length===before,'Mute and volume retain the same transport');$('fillBacking').click();$('fillDrums').click();
   const idea=$('fillIdea').value;$('fillNext').click();await until(()=>starts.length>before);await until(()=>$('fillStatus').textContent.startsWith('Playing'));check($('fillIdea').value!==idea,'Next changes the study');
   const first=starts.length;change('fillKeySound','organ');change('fillKeySound','electric');change('fillKeySound','piano');await until(()=>starts.length>first);await until(()=>$('fillStatus').textContent.startsWith('Playing'));
   check(starts.length===first+1,'Rapid changes keep only the latest choice');
   const sectionStart=starts.length;$('earSectionRuns').click();check($('fillPlay').textContent==='Stop','Changing practice section keeps playing');await until(()=>starts.length>sectionStart);await until(()=>$('fillStatus').textContent.startsWith('Playing'));
   check(stops.every(s=>starts[s.id+1]&&Math.abs(starts[s.id+1].when-s.at)<1e-7),'Sound changes and Next share an uninterrupted boundary');
   check(!buttonStopped,'Playback never enters stopped state during changes');
   watch=false;change('fillKeySound','organ');$('fillPlay').click();const stoppedAt=starts.length;await pause(1500);check(starts.length===stoppedAt&&$('fillPlay').textContent==='Play','Stop cancels a pending sound change');
   observer.disconnect();L.start=nativeStart;
   const elements=[],nativeMedia=AudioContext.prototype.createMediaElementSource;
   AudioContext.prototype.createMediaElementSource=function(element){
    elements.push({element,clock:this});return nativeMedia.call(this,element);
   };
   try{
    $('earSectionBasslines').click();change('fillCollection','seben');change('fillIdea','clip:clip-34');change('fillExcerpt','1');
    const recording=window.BassUploadedCore.practicePlan('clip-34',1);
    $('fillPlay').click();await until(()=>elements.length&&$('fillStatus').textContent.includes('BPM'));
    const {element,clock}=elements[0];
    for(const bpm of [87,160]){
     change('fillTempo',String(bpm));await until(()=>$('fillStatus').textContent.includes(bpm+' BPM'));
     const speed=bpm/recording.originalBpm;
     check(Math.abs(element.playbackRate-speed)<.0001&&elements.length===1,'Recorded bass retains its playhead and runs at '+bpm+' BPM');
     const mediaTime=element.currentTime,audioTime=clock.currentTime;await pause(450);
     check(Math.abs(element.currentTime-mediaTime-(clock.currentTime-audioTime)*speed)<.065,'Bass and band clocks advance together at '+bpm+' BPM');
    }
    element.currentTime=recording.sourceEnd-.12;await until(()=>element.currentTime<recording.sourceStart+.55);
    check(!element.paused,'Recorded passage repeats at the chosen tempo');
    $('fillPlay').click();
   }finally{AudioContext.prototype.createMediaElementSource=nativeMedia;}
   $('earClose').click();
   check(!errors.length,'No unhandled playback errors');await context.close();
   out.textContent+='\nALL CHECKS PASSED';button.textContent='RC294 checks passed';
  }catch(error){out.textContent+='\nFAIL '+error.stack;button.textContent='RC294 check failed';if(context)await context.close();}
  button.disabled=false;window.removeEventListener('unhandledrejection',onError);
 };
})();
