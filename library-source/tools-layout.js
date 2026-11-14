/* RC253: two featured cards and one row of two retained tools. */
(()=>{
const $=id=>document.getElementById(id);
let featured;
function elem(tag,cl){const n=document.createElement(tag);n.className=cl;return n;}
function install(){
 const host=$('moreTools'),tools=$('extraTools'),chords=$('openSongChords'),lyrics=$('openLyrics');
 if(!host||!tools||!chords||!lyrics||host.querySelector('.bs-featured-tools'))return;
 featured=elem('div','bs-featured-tools');
 featured.setAttribute('aria-label','Featured music tools');
 featured.append(chords,lyrics);
 host.insertBefore(featured,tools);
 $('bassHelpShare')?.remove();
 // Sound check and Rhythm keep their existing handlers and equal sizes.
 // Move existing buttons; never clone or replace their event handlers.
 const order=['openSoundCheck','openRhythm'];
 const remaining=order.map($).filter(Boolean);
 const otherNodes=Array.from(tools.children).filter(el=>el.tagName!=='BUTTON');
 if(remaining.length===2){
  const sizes=[2],rows=[];let pos=0;
  for(const size of sizes){
   const row=elem('div','bs-other-row');
   for(const button of remaining.slice(pos,pos+size))row.append(button);
   rows.push(row);pos+=size;
  }
  tools.replaceChildren(...rows,...otherNodes);
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
