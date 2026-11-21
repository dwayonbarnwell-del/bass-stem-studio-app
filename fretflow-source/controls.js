/* Shared rehearsal controls. Switching views keeps transport and mute state. */
window.BassPracticeControls=(()=>{
 'use strict';let api,root,controls,strings,stringCard,stringNumber,vocals,status,message,cancel,resize;
 function layout(){const r=document.getElementById('playBtn').getBoundingClientRect();for(const[k,v]of [['--ff-control-w',r.width],['--ff-control-h',r.height]]){const value=Math.round(v*100)/100+'px';if(root.style.getPropertyValue(k)!==value)root.style.setProperty(k,value);}}
 function update(){
  if(!api)return;const s=api.get(),b=window.BassBacking.state(),hasStrings=s.view==='bass'||s.view==='fretflow';
  document.body.classList.toggle('practice-no-strings',!hasStrings);stringCard.hidden=!hasStrings;
  strings.value=String(s.strings);stringNumber.textContent=String(s.strings);
  vocals.disabled=!s.loaded||s.busy||b.busy||(!b.vocalsReady&&!b.canRetry);vocals.setAttribute('aria-pressed',String(b.vocalsMuted));
  const label=b.vocalsMuted?'Restore vocals':'Mute vocals';vocals.setAttribute('aria-label',label);
  vocals.title=b.vocalsReady?'Mute or restore vocals independently of the bass':'Prepare vocal mute for this song';
  message.textContent=b.message;status.hidden=!b.message&&!b.busy;cancel.hidden=!b.busy;layout();
 }
 function showControls(show=true){
  const card=document.getElementById('practiceViewCard'),head=document.querySelector('.practice-view-head'),transport=document.querySelector('.transport-main');
  if(show&&card.parentNode!==head){head.prepend(card);document.getElementById('ffHeaderTools').append(controls);}
  if(!show&&card.parentNode!==transport){transport.prepend(card);transport.append(controls);}
  document.body.classList.toggle('practice-controls-hidden',!show);controls.textContent=show?'Hide controls':'Show controls';controls.setAttribute('aria-expanded',String(show));update();window.BassFretFlow?.invalidate();}
 function init(hooks){
  api=hooks;root=document.getElementById('practiceWorkspace');document.body.classList.add('practice-controls-ready');
  const host=document.createElement('div');host.id='ffHeaderTools';host.innerHTML='<div id="ffStringsCard"><span class="ff-string-display" aria-hidden="true"><strong id="ffStringNumber">5</strong><span>strings</span></span><select id="ffStrings" aria-label="Bass strings"><option value="4">4 strings</option><option value="5">5 strings</option><option value="6">6 strings</option></select></div><button id="ffControls" type="button" aria-expanded="true" aria-controls="practiceWorkspace">Hide controls</button>';
  document.querySelector('.practice-view-head').append(host);controls=host.querySelector('#ffControls');strings=host.querySelector('#ffStrings');stringCard=host.querySelector('#ffStringsCard');stringNumber=host.querySelector('#ffStringNumber');
  controls.onclick=()=>showControls(document.body.classList.contains('practice-controls-hidden'));strings.onchange=()=>{api.setStrings(Number(strings.value));update();};
  vocals=document.createElement('button');vocals.id='vocalPracticeToggle';vocals.type='button';vocals.className='btn stacked-control';vocals.innerHTML='<span aria-hidden="true">🔇</span><span>Vocals</span>';vocals.onclick=()=>void window.BassBacking.toggle('vocals');document.querySelector('.transport-main').append(vocals);
  status=document.createElement('div');status.id='practiceMuteStatus';status.hidden=true;status.innerHTML='<span id="practiceMuteMessage" role="status"></span><button id="ffCancel" type="button" hidden>Cancel</button>';document.querySelector('.simple-timeline-head').after(status);message=status.querySelector('span');cancel=status.querySelector('button');cancel.onclick=()=>window.BassBacking.cancel();
  resize=new ResizeObserver(update);resize.observe(root);resize.observe(document.querySelector('.practice-view-head'));resize.observe(document.getElementById('playBtn'));update();
 }
 return {init,update,showControls};
})();
