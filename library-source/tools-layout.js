/* Keep the two music tools together without duplicating their handlers. */
(()=>{
 const $=id=>document.getElementById(id);
 function install(){
  const tools=$('extraTools'),chords=$('openSongChords'),rhythm=$('openRhythm');
  if(!tools||!chords||!rhythm)return;
  $('bassHelpShare')?.remove();
  const row=document.createElement('div');row.className='bs-other-row';
  row.append(chords,rhythm);tools.replaceChildren(row);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
