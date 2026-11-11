/* RC244: two featured cards and two rows of three distinct tools. */
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
 // Sound check takes the first position; six tools form two equal rows.
 // Move existing buttons; never clone or replace their event handlers.
 const order=['openSoundCheck','openTrash','openPatterns','openLoopShare','openIdeas','openRhythm'];
 const remaining=order.map($).filter(Boolean);
 const otherNodes=Array.from(tools.children).filter(el=>el.tagName!=='BUTTON');
 if(remaining.length===6){
  const sizes=[3,3],rows=[];let pos=0;
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
