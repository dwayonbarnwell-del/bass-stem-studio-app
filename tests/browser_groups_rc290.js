/* Local production-page fixture. Isolate localStorage before the application loads. */
(()=>{
 const $=id=>document.getElementById(id),G=window.BassStudyGroups,C=window.BassCuratedStudies;
 const report=document.createElement('pre');report.id='groupResults';report.textContent='Not run';
 const button=document.createElement('button');button.id='groupTest';button.textContent='Test five groups';
 const box=document.createElement('aside');box.style='position:fixed;z-index:999999;top:0;right:0;background:#102b40;color:white;padding:8px;max-width:350px;font-size:12px';box.append(button,report);document.body.append(box);
 const check=(ok,label)=>{if(!ok)throw Error(label);},select=(id,value)=>{$(id).value=String(value);$(id).dispatchEvent(new Event('change',{bubbles:true}));},wait=ms=>new Promise(r=>setTimeout(r,ms));
 button.onclick=async()=>{let checks=0;try{
  $('openEarTraining').click();$('earSectionFills').click();check(!document.querySelector('#fillPack,#fillQuality,#fillStyle'),'Old filters still present');checks++;
  for(const kind of ['fills','runs']){
   $(kind==='fills'?'earSectionMyFills':'earSectionRuns').click();check($('fillGroup').options.length===5,'Not five groups');checks++;const seen=new Set();
   for(const [group] of G.groups){select('fillGroup',group);const options=[...$('fillIdea').options];check(options.length===G.matching(kind,group).length,'Wrong group size');
    for(const o of options){const i=Number(o.value);check(!seen.has(i)&&G.groupOf(kind,i)===group,'Repeated or misgrouped pattern');seen.add(i);select('fillIdea',i);check($('fillNotes').children.length>=5,'Missing playable notes');const entry=C.get(kind,i);if(entry){check($('fillSource').href===entry.source.url,'Missing source');check($('fillNotes').children.length===entry.notes.length+2,'Wrong notes');}checks++;}
    const first=Number(options[0].value);select('fillIdea',first);check(C.metadata(kind,first).tier===0,'Best choices not first');checks++;
   }
   check(seen.size===100,'Not 100 distinct choices');checks++;
  }
  select('fillGroup','african');$('earSectionMyFills').click();select('fillGroup','jazz');$('earSectionRuns').click();check($('fillGroup').value==='african','Runs group not remembered');$('earSectionMyFills').click();check($('fillGroup').value==='jazz','Fills group not remembered');checks+=2;
  const stored=JSON.parse(localStorage.getItem('bass-study-groups-v1'));check(stored.runs==='african'&&stored.fills==='jazz','Group preferences not saved');checks++;
  const prior=$('fillIdea').value,count=$('fillIdea').options.length;$('fillDelete').click();check($('fillIdea').options.length===count-1&&!Array.from($('fillIdea').options).some(o=>o.value===prior),'Deletion failed');$('fillRestore').click();check($('fillIdea').options.length===count,'Restore failed');checks+=2;
  select('fillGroup','african');for(const o of [...$('fillIdea').options]){select('fillIdea',o.value);$('fillDelete').click();}check($('fillPlay').disabled&&!$('fillEmpty').hidden,'Empty group broken');$('fillRestore').click();checks++;
  $('earSectionBasslines').click();check($('fillGroupRow').hidden&&$('fillCount').hidden,'Groups leaked into basslines');checks++;
  const A=window.BassPianoAudio,original=A.tone,scheduled=[];A.tone=function(...args){scheduled.push({midi:args[1],at:args[2],length:args[3]});return original.apply(this,args);};
  try{for(const [kind,group] of [['fills','african'],['runs','funk']]){
   $(kind==='fills'?'earSectionMyFills':'earSectionRuns').click();select('fillGroup',group);select('fillTempo','160');select('fillKey','7');select('fillFrom','6');select('fillTo','2');scheduled.length=0;
   $('fillRepeat').click();for(let i=0;i<80&&!scheduled.length;i++)await wait(100);check(scheduled.length>0&&!$('fillStatus').textContent.includes('unavailable'),'Audio failed');const n=scheduled.length;await wait(3400);check(scheduled.length>n,'Repeat failed');$('fillPlay').click();check($('fillPlay').textContent==='Play','Stop failed');checks+=3;
  }}finally{A.tone=original;window.BassFillTrainer.stop();}
  $('earSectionMyFills').click();select('fillGroup','gospel');select('fillKey','0');select('fillFrom','1');select('fillTo','4');select('fillTempo','80');
  for(const id of ['fillGroup','fillIdea']){const r=$(id).getBoundingClientRect();check(r.width>120&&r.left>=0&&r.right<=innerWidth+1,'Phone overflow');}checks++;
  report.textContent='PASS '+checks+' checks: 200 choices, five groups, ordering, sources, saved groups, delete/restore, actual audio, repeat and mobile layout.';
 }catch(e){window.BassFillTrainer?.stop();report.textContent='FAIL: '+e.message;}};
})();
