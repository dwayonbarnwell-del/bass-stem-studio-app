window.BassIdeas=(()=>{
 const names=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
 const tones={maj:[0,4,7],min:[0,3,7],sus2:[0,2,7],sus4:[0,5,7],dim:[0,3,6],aug:[0,4,8],'7':[0,4,7,10],maj7:[0,4,7,11],min7:[0,3,7,10],'6':[0,4,7,9],min6:[0,3,7,9],add9:[0,4,7,14],minadd9:[0,3,7,14],'9':[0,4,7,10,14],maj9:[0,4,7,11,14],min9:[0,3,7,10,14],'11':[0,4,7,10,14,17],min11:[0,3,7,10,14,17],'13':[0,4,7,10,14,21],min13:[0,3,7,10,14,21],'7sus4':[0,5,7,10],dim7:[0,3,6,9],min7b5:[0,3,6,10],'7b9':[0,4,7,10,13],'7#9':[0,4,7,10,15]};
 const suffix={maj:'',min:'m',maj7:'maj7',min7:'m7',min6:'m6',minadd9:'m(add9)',maj9:'maj9',min9:'m9',min11:'m11',min13:'m13',min7b5:'m7b5'};
 const pc=n=>((n%12)+12)%12, note=m=>names[pc(m)]+(Math.floor(m/12)-1);
 const label=c=>names[pc(c.rootPc)]+(suffix[c.quality]??c.quality)+(c.bassPc!=null&&pc(c.bassPc)!==pc(c.rootPc)?'/'+names[pc(c.bassPc)]:'');
 function collect(chords,start,end){const out=[];for(const c of [...chords].sort((a,b)=>a.start-b.start)){
  if(!Number.isFinite(c.rootPc)||!tones[c.quality]||!Number.isFinite(c.start)||!Number.isFinite(c.end)||c.end<=start||c.start>=end||c.end<=c.start)continue;
  const next={...c,start:Math.max(start,c.start),end:Math.min(end,c.end)},last=out.at(-1);
  if(last&&last.rootPc===next.rootPc&&last.quality===next.quality&&(last.bassPc??null)===(next.bassPc??null)&&next.start<=last.end+.03)last.end=Math.max(last.end,next.end);else out.push(next);
 }return out.slice(0,8);}
 function bassMidi(root,near=36){return Array.from({length:28},(_,i)=>28+i).filter(n=>pc(n)===pc(root)).sort((a,b)=>Math.abs(a-near)-Math.abs(b-near))[0];}
 function approachBass(root){const target=bassMidi(root);return target>28?target-1:target+1;}
 function generate(chords,style='jazz',bold=false){const coloured=chords.map((original,i)=>{
  const next=chords[i+1],c={...original};let reason='Keep the chord';
  const dominant=next&&pc(original.rootPc-next.rootPc)===7;
  if(['jazz','gospel','soul'].includes(style)){
   if(c.quality==='maj'){c.quality=dominant?'9':style==='gospel'?'add9':style==='soul'?'maj9':'maj7';reason=dominant?'Dominant colour':'Add chord colour';}
   else if(c.quality==='min'){c.quality=style==='jazz'?'min7':'min9';reason='Add chord colour';}
   else if(c.quality==='7'){c.quality='9';reason='Add the ninth';}
   if(bold&&style==='jazz'&&dominant&&['7','9','13','7b9','7#9'].includes(original.quality)&&original.bassPc==null){c.rootPc=pc(original.rootPc+6);c.quality='7';reason='Tritone substitute';}
  }
  return {original,chord:c,reason};
 });return coloured.map(({original,chord:c,reason},i)=>{
  const next=coloured[i+1]?.chord;
  const root=bassMidi(c.bassPc??c.rootPc),quality=tones[c.quality],third=quality[1],fifth=quality.find(x=>[6,7,8].includes(x))??7;
  const fit=n=>n>55?n-12:n<28?n+12:n;
  let bass=[root,fit(bassMidi(c.rootPc)+fifth),root,fit(root+12)],beats=[0,.25,.5,.75];
  if(style==='jazz')bass=[root,fit(bassMidi(c.rootPc)+third),fit(bassMidi(c.rootPc)+fifth),next?approachBass(next.bassPc??next.rootPc):root];
  if(style==='gospel')bass=[root,fit(bassMidi(c.rootPc)+fifth),fit(root+12),next?approachBass(next.bassPc??next.rootPc):root];
  if(style==='reggae'){bass=[root,root,fit(bassMidi(c.rootPc)+fifth)];beats=[0,.375,.75];}
  if(style==='funk'){bass=[root,fit(root+12),root,fit(bassMidi(c.rootPc)+fifth),root];beats=[0,.1875,.375,.625,.875];}
  if(style==='soul')bass=[root,fit(bassMidi(c.rootPc)+fifth),fit(root+12),root];
  return {original:{...original},chord:c,label:label(c),before:label(original),bass,beats,reason};
 });}
 let api,items=[],snapshot=null,context=null,active=[],timer=null,playing=false;
 const $=id=>document.getElementById(id),clock=t=>Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0');
 function stop(){clearTimeout(timer);for(const n of active)try{n.stop();}catch{}active=[];const old=context;context=null;if(old&&old.state!=='closed')void old.close();playing=false;if(api)$('ideasStop').disabled=true;}
 function refresh(){stop();const jazz=$('ideasStyle').value==='jazz';$('ideasColour').disabled=!jazz;if(!jazz)$('ideasColour').value='light';const s=api.get($('ideasScope').value);snapshot=s;items=generate(collect(s.chords,s.start,s.end),$('ideasStyle').value,$('ideasColour').value==='bold');
  $('ideasStatus').textContent=!s.loaded?'Import and analyse a song.':!items.length?'No clear chords here. Analyse or choose another part.':clock(items[0].chord.start)+'–'+clock(items.at(-1).chord.end)+' · '+items.length+' changes';
  const area=$('ideasRows');area.replaceChildren();
  items.forEach(x=>{const card=document.createElement('article');card.className='idea-card';const head=document.createElement('strong');head.textContent=x.before+' → '+x.label;const bass=document.createElement('p');bass.textContent='Bass: '+x.bass.map(note).join(' · ');const why=document.createElement('small');why.textContent=x.reason;card.append(head,bass,why);area.append(card);});
  const tips={jazz:'Walking bass. Check the melody.',gospel:'Root, fifth and passing notes. Leave room for vocals.',reggae:'Space between notes. Hold the low notes.',funk:'Short notes and octave jumps.',soul:'Smooth chord colour and steady bass.',pop:'Simple roots and fifths.'};$('ideasTip').textContent=tips[$('ideasStyle').value];
  for(const id of ['ideasOriginal','ideasPreview','ideasSave'])$(id).disabled=!items.length;
 }
 async function preview(alternative){
  stop();if(!items.length)return;
  if(api.get($('ideasScope').value).session!==snapshot.session){refresh();return;}
  api.pause();const ctx=new (window.AudioContext||window.webkitAudioContext)();context=ctx;playing=true;$('ideasStop').disabled=false;
  try{await ctx.resume();if(context!==ctx)return;const volume=ctx.createGain(),guard=ctx.createDynamicsCompressor();volume.gain.value=.4;guard.threshold.value=-12;guard.ratio.value=12;volume.connect(guard).connect(ctx.destination);
   const start=ctx.currentTime+.05,origin=items[0].chord.start;let end=start;
   function tone(midi,time,duration,bass){const osc=ctx.createOscillator(),g=ctx.createGain();osc.type=bass?'triangle':'sine';osc.frequency.value=440*Math.pow(2,(midi-69)/12);g.gain.setValueAtTime(0,time);g.gain.linearRampToValueAtTime(bass?.18:.045,time+.015);g.gain.setTargetAtTime(0,time+Math.max(.02,duration-.07),.025);osc.connect(g).connect(volume);osc.start(time);osc.stop(time+duration+.1);active.push(osc);}
   for(const item of items){const c=alternative?item.chord:item.original,t=start+c.start-origin,d=Math.max(.08,c.end-c.start);end=Math.max(end,t+d);
    for(const interval of tones[c.quality])tone(48+pc(c.rootPc)+interval,t,d,false);
    const bass=alternative?item.bass:[bassMidi(c.bassPc??c.rootPc)],beats=alternative?item.beats:[0];
    bass.forEach((m,i)=>tone(m,t+beats[i]*d,Math.max(.04,((beats[i+1]??1)-beats[i])*d*.8),true));
   }
   $('ideasStatus').textContent=alternative?'Playing idea…':'Playing chord guide…';timer=setTimeout(()=>{stop();$('ideasStatus').textContent='Preview finished.';},Math.max(0,(end-ctx.currentTime+.2)*1000));
  }catch{stop();$('ideasStatus').textContent='Preview unavailable. Try again.';}
 }
 function init(hooks){api=hooks;$('openIdeas').onclick=()=>{refresh();$('ideasDialog').showModal();$('ideasDialog').scrollTop=0;};
  for(const id of ['ideasStyle','ideasColour','ideasScope'])$(id).onchange=refresh;
  $('ideasRefresh').onclick=refresh;$('ideasOriginal').onclick=()=>preview(false);$('ideasPreview').onclick=()=>preview(true);$('ideasStop').onclick=()=>{stop();$('ideasStatus').textContent='Stopped.';};
  $('ideasClose').onclick=()=>{stop();$('ideasDialog').close();};$('ideasDialog').addEventListener('cancel',e=>{e.preventDefault();$('ideasClose').click();});window.addEventListener('pagehide',stop);
  $('ideasSave').onclick=()=>{if(api.get($('ideasScope').value).session!==snapshot.session){refresh();return;}const q=v=>'"'+String(v).replace(/"/g,'""')+'"';const rows=['Start,End,Original,Suggestion,Bass notes,Style',...items.map(x=>[x.chord.start.toFixed(3),x.chord.end.toFixed(3),q(x.before),q(x.label),q(x.bass.map(note).join(' ')),q($('ideasStyle').value)].join(','))];const url=URL.createObjectURL(new Blob([rows.join('\r\n')],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='Bass_Studio_Ideas.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);};
 }
 return {init,generate,collect,note,label,stop};
})();
