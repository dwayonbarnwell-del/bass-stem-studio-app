/* RC258: concise practice controls; accessible names retain their meaning. */
(()=>{
 const $=id=>document.getElementById(id);
 const icons={
  openLiveAudio:['Live audio','<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/>'],
  openEarTraining:['Ear training','<path d="M7 9a6 6 0 0 1 12 0c0 4-3 5-4 7l-1 3a4 4 0 0 1-7-2M10 9a3 3 0 0 1 6 0c0 2-2 2-3 4M4 6a10 10 0 0 0 0 7"/>'],
  openMoreTools:['More tools','<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/>'],
  openSettings:['Settings','<path d="m9 3 1-2h4l1 2 2 1 2-.2 2 3-1 2v3l1 2-2 3-2-.2-2 1-1 2h-4l-1-2-2-1-2 .2-2-3 1-2V9L3 7l2-3 2 .2Z" transform="translate(0 1)"/><circle cx="12" cy="11.5" r="3"/>']
 };
 function install(){
  for(const [id,[label,paths]] of Object.entries(icons)){const b=$(id);if(!b)continue;b.innerHTML='<svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+paths+'</svg>';b.title=label;b.setAttribute('aria-label',label);}
  const settings=$('settingsDialog'),close=$('settingsClose');
  if(settings&&!$('soundCreditsLink')){const p=document.createElement('p'),a=document.createElement('a');a.id='soundCreditsLink';a.textContent='Sound credits';a.href='./SOUND_CREDITS.txt';a.target='_blank';a.rel='noopener';a.style.color='#b8e5f3';p.append(a);settings.insertBefore(p,close);}
 }
 const style=document.createElement('style');
 const root='html body '+Array(8).fill('#appRoot').join('');
 style.textContent=root+' #liveAudioEntry{grid-template-columns:repeat(5,minmax(0,1fr))!important}'+root+' #liveAudioEntry #openEarTraining{background:#514665!important;border-color:#9c8faf!important}'+root+' #liveAudioEntry svg{display:block!important;width:25px!important;height:25px!important;flex:none!important}';
 document.head.append(style);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
