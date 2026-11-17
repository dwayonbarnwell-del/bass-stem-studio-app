/* Inject into a local copy of index.html. Runs against the real UI and audio engine. */
(()=>{
 const $=id=>document.getElementById(id),C=window.BassCuratedStudies,report=document.createElement('pre'),button=document.createElement('button');
 report.id='curatedResults';report.textContent='Not run';button.id='curatedTest';button.textContent='Test ranked catalogue';
 const box=document.createElement('aside');box.style='position:fixed;z-index:999999;top:0;right:0;background:#102b40;color:white;padding:8px;max-width:350px;font-size:12px';box.append(button,report);document.body.append(box);
 const check=(ok,label)=>{if(!ok)throw Error(label);},select=(id,value)=>{$(id).value=String(value);$(id).dispatchEvent(new Event('change',{bubbles:true}));},wait=ms=>new Promise(r=>setTimeout(r,ms));
 button.onclick=async()=>{let checks=0;try{
  if(!$('earTrainerDialog').open)$('openEarTraining').click();$('earSectionFills').click();
  for(const kind of ['fills','runs']){
   $(kind==='fills'?'earSectionMyFills':'earSectionRuns').click();select('fillPack','new');select('fillStyle','all');select('fillQuality','all');
   check($('fillIdea').options.length===55,kind+' count');check($('fillIdea').selectedOptions[0].text.startsWith('Most amazing'),kind+' starts with highest rating');checks+=2;
   for(const [genre] of C.genres)for(const tier of ['all','0','1','2']){select('fillStyle',genre);select('fillQuality',tier);check($('fillIdea').options.length===(tier==='all'?11:tier==='2'?3:4),kind+' filtered count '+genre+'/'+tier);for(const o of $('fillIdea').options){const m=C.metadata(kind,Number(o.value));check(m.genre===genre&&(tier==='all'||m.tier===Number(tier)),'Wrong filtered entry');}checks++;}
   select('fillStyle','all');select('fillQuality','all');const visible=[...$('fillIdea').options];
   for(const o of visible){select('fillIdea',o.value);const m=C.get(kind,o.value);check($('fillNotes').children.length===m.notes.length+2,'Missing playable notes '+m.title);check($('fillSource').href===m.source.url,'Wrong source '+m.title);check($('fillRating').textContent.includes('Original study'),'Missing provenance');checks++;}
   const selected=$('fillIdea').value,title=$('fillIdea').selectedOptions[0].text;$('fillDelete').click();check(![...$('fillIdea').options].some(o=>o.value===selected),'Deleted phrase still visible');select('fillQuality','2');select('fillQuality','all');check(![...$('fillIdea').options].some(o=>o.value===selected),'Sort restored deleted phrase');$('fillRestore').click();check([...$('fillIdea').options].some(o=>o.text===title),'Restore failed');checks+=3;
   select('fillStyle','other');check(!$('fillIdea').options.length&&$('fillPlay').disabled&&!$('fillEmpty').hidden,'Empty filter handling');checks++;select('fillStyle','all');
   select('fillIdea',visible[0].value);select('fillKey','9');select('fillFrom','6');select('fillTo','2');check($('fillNotes').children.length===C.get(kind,visible[0].value).notes.length+2,'Transposed selection');checks++;
  }
  select('fillStyle','jazz');select('fillQuality','0');$('earSectionMyFills').click();check($('fillStyle').value==='all'&&$('fillQuality').value==='all','Independent category filters');$('earSectionRuns').click();check($('fillStyle').value==='jazz'&&$('fillQuality').value==='0','Remembered category filters');checks+=2;
  $('earSectionBasslines').click();check($('fillFilters').hidden&&$('fillRating').hidden,'Filters leaked into basslines');checks++;
  $('earSectionMyFills').click();select('fillPack','new');select('fillStyle','all');select('fillQuality','all');select('fillKey','0');select('fillFrom','1');select('fillTo','4');select('fillTempo','160');
  const A=window.BassPianoAudio,original=A.tone,scheduled=[];A.tone=function(...args){scheduled.push({midi:args[1],start:args[2],duration:args[3],sound:args[4]});return original.apply(this,args);};
  try{$('fillRepeat').click();for(let i=0;i<80&&!scheduled.length;i++)await wait(100);check(scheduled.length>0&&!$('fillStatus').textContent.includes('unavailable'),'Real audio playback failed');const n=scheduled.length;await wait(3400);check(scheduled.length>n,'Repeat did not schedule the second phrase');$('fillPlay').click();check($('fillPlay').textContent==='Play','Stop failed');checks+=3;}finally{A.tone=original;window.BassFillTrainer.stop();}
  $('fillFilterPanel').open=true;const controls=['fillStyle','fillQuality','fillPack','fillIdea'];for(const id of controls){const r=$(id).getBoundingClientRect();check(r.width>80&&r.left>=0&&r.right<=innerWidth+1,'Mobile overflow '+id);}checks++;$('fillFilterPanel').open=false;
  report.textContent='PASS '+checks+' checks: 110 selectable phrases, filters, order, sources, deletions, transposition, real audio, repeat and mobile layout.';
 }catch(e){window.BassFillTrainer?.stop();report.textContent='FAIL: '+e.message;}};
})();
