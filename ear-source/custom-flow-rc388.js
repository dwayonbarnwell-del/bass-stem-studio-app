// One saved arrangement. Every occurrence owns its choice, even when a change repeats.
window.BassCustomFlow=(()=>{
 'use strict';
 const P=window.BassPracticeCore,F=window.BassFillCore,H=window.BassAccompaniment,G=window.BassStudyGroups;
 const U=window.BassUploadedCore,D=window.BassPracticeCatalogue,S=window.BassPracticeSeries,N=window.BassStudyDisplay;
 const storage='bass-ear-custom-flow-v1',kinds={basslines:'Basslines',fills:'Fills',runs:'Runs'};
 const families={'World Methods':'world-method','Bass Lady':'bass-lady',Bassmatics:'bassmatics'};
 const pc=n=>(n%12+12)%12,compare=(a,b)=>a.label.localeCompare(b.label,'en',{numeric:true});
 let host,catalogue,rows=[],selected=0,ctx,player,revision=0,playing='',paused='',offset=0;
 let renderQueue=Promise.resolve(),clock=0,sounding='',fresh=true;
 const state={genre:'worship',key:0,mode:'major',bpm:96,beat:'',degrees:[1,5,6,5,1],choices:[]};
 const el=id=>host.querySelector('#flow'+id);
 function parse(value){
  const parts=value.trim().split(/[,;]/),degrees=[];
  for(const part of parts){
   if(!/^\s*[1-7](?:(?:\s*(?:->|→|[-–>]|\bto\b)\s*|\s+)[1-7])*\s*$/i.test(part))return null;
   const group=part.match(/[1-7]/g).map(Number);
   if(group.length>1&&degrees.at(-1)===group[0])group.shift();
   degrees.push(...group);
  }
  return degrees.length>=2&&degrees.length<=16&&degrees.every((d,i)=>!i||d!==degrees[i-1])?degrees:null;
 }
 function save(){try{localStorage.setItem(storage,JSON.stringify(state));}catch{}}
 function restore(){
  try{
   const s=JSON.parse(localStorage.getItem(storage)),degrees=parse(s.degrees.join(','));
   if(degrees&&Number.isInteger(s.key)&&s.key>=0&&s.key<12&&['major','minor'].includes(s.mode)&&s.bpm>=40&&s.bpm<=220&&Array.isArray(s.choices))
    {fresh=false;Object.assign(state,{degrees,key:s.key,mode:s.mode,bpm:Number(s.bpm),genre:s.genre,beat:s.beat,choices:s.choices.slice(0,15)});}
  }catch{}
 }
 function library(){
  const genres=new Map();
  function add(group,row){
   if(!group)return;
   if(group==='african-praise')group='praise';
   if(!genres.has(group))genres.set(group,[]);
   genres.get(group).push(row);
  }
  for(const [kind,list] of Object.entries({basslines:P.lines,fills:F.styles,runs:P.runs})){
   for(const [idea,item] of list.entries()){
    const line=kind==='basslines',entry=line?null:window.BassCuratedStudies.get(kind,idea);
    if(line?!D.visible(kind,item.id):!G.visible(kind,idea))continue;
    const group=line?H.category(item):families[entry?.recordedStudy?.family]||G.groupOf(kind,idea);
    const parts=line?P.phrases(item.degrees):[null];
    parts.forEach((_,part)=>{
     if(line&&!D.visible(kind,item.id+'/'+part))return;
     const label=S.menuLabel(kind,idea,part,group)||N.label(kind,item);
     add(group,{kind,idea,part,id:kind+'/'+(entry?.id||item.id||idea)+'/'+part,label});
    });
   }
  }
  for(const item of U.items){
   if(!D.visible('uploaded',item.id))continue;
   (window.BassRecordedPhrases[item.id]||[]).forEach((_,part)=>{
    if(D.visible('uploaded',item.id+'/'+part))add(H.recordingGroup(item),{kind:'basslines',clip:item.id,part,id:'clip/'+item.id+'/'+part,label:N.clip(item)+(part?' .'+(part+1):'')});
   });
  }
  return genres;
 }
 function allowed(i){
  return rows.filter(r=>r.kind==='basslines'||G.supports(r.kind,r.idea,state.degrees[i],state.degrees[i+1]));
 }
 function source(r,from=1,to=4){
  return r.clip?U.plan(r.clip,'phrase-'+r.part):P.make(r.kind,{idea:r.idea,part:r.part,key:0,from,to,bpm:state.bpm});
 }
 function hydrate(){
  rows=(catalogue.get(state.genre)||[]).filter(r=>{
   if(!r.clip)return true;
   r.shape??=U.rehearsalShape(r.clip,r.part);return r.shape.length;
  }).sort(compare);
  const ids=new Set();let preferred;
  for(const r of rows){
   const p=source(r);
   const loop=H.resolve(p).loop;if(loop){ids.add(loop.id);if(r.kind==='fills'&&r.label==='Practice 09')preferred=loop;}
  }
  const all=window.BassSuppliedDrums.available;
  const beats=all.filter(l=>ids.has(l.id)||l.genre===state.genre||l.styles?.includes(state.genre)).map(l=>({id:l.id,label:l.title||l.id})).sort(compare);
  if(!beats.some(b=>b.id===state.beat))state.beat=preferred?.id||all.find(l=>ids.has(l.id))?.id||beats[0]?.id||'';
  if(fresh){state.bpm=Math.max(40,Math.min(220,Math.round(all.find(l=>l.id===state.beat)?.bpm||96)));fresh=false;el('Bpm').value=state.bpm;}
  options(el('Beat'),beats,state.beat);
  state.choices=state.degrees.slice(1).map((_,i)=>{
   const pool=allowed(i);return pool.find(r=>r.id===state.choices[i])?.id||pool.find(r=>r.kind==='fills')?.id||pool[0]?.id||'';
  });
 }
 function options(select,list,value){
  select.replaceChildren(...list.map(r=>new Option(r.label,r.id)));select.value=value;
 }
 function degree(scale,d){return scale[(d-1)%7]+12*Math.floor((d-1)/7);}
 function phrase(r,from,to){
  const scale=F.scales[state.mode],root=36+pc(state.key+degree(scale,from));
  if(r.clip)return r.shape.map(n=>({...n,midi:root+n.semitones+(n.role==='third'?degree(scale,from+2)-degree(scale,from)-pc(n.semitones):n.role==='fifth'?degree(scale,from+4)-degree(scale,from)-7:0),velocity:87}));
  const p=source(r,from,to),line=r.kind==='basslines',native=F.scales[p.mode]||F.scales.major;
  const bar=line?Math.max(0,p.degrees.findIndex((d,i)=>d===from&&p.degrees[(i+1)%p.degrees.length]===to)):0;
  const src=line?p.degrees[bar]:from,dst=line?p.degrees[(bar+1)%p.degrees.length]:to;
  const original=pc((p.key||0)+degree(native,src)),dest=pc((p.key||0)+degree(native,dst));
  const wanted=pc(state.key+degree(scale,to)),shift=root-(36+original);
  return p.bass.filter(n=>n.beat>=bar*4&&n.beat<(bar+1)*4&&n.length>0).map(n=>{
   const beat=n.beat-bar*4,interval=pc(n.midi-original);
   let adjust=0;
   for(let d=0;d<7;d++)if(pc(degree(native,src+d)-degree(native,src))===interval){
    adjust=degree(scale,from+d)-degree(scale,from)-(degree(native,src+d)-degree(native,src));break;
   }
   // Preserve a late chromatic approach relative to the requested destination.
   if(beat>=3&&Math.abs((pc(n.midi-dest)+6)%12-6)<=2)adjust=(pc(wanted-dest-shift)+6)%12-6;
   const delta=shift+adjust;
   return {...n,beat,midi:n.midi+delta,...Number.isFinite(n.slideFrom)?{slideFrom:n.slideFrom+delta}:{},length:Math.min(n.length,4-beat)};
  });
 }
 function notes(i){
  const r=rows.find(r=>r.id===state.choices[i]);if(!r)throw Error('Choose an available pattern for each change.');
  return phrase(r,state.degrees[i],state.degrees[i+1]);
 }
 function plan(single){
  const first=single?selected:0,degrees=single?state.degrees.slice(selected,selected+2):state.degrees;
  const bass=[],chords=[],scale=F.scales[state.mode];
  degrees.forEach((d,i)=>{
   const beat=i*4,root=36+pc(state.key+degree(scale,d));
   for(const k of [0,2,4])chords.push({beat,length:3.8,midi:48+state.key+degree(scale,d+k),velocity:52});
   if(i===degrees.length-1)bass.push({beat,length:3.6,midi:root,velocity:94});
   else for(const n of notes(first+i))bass.push({...n,beat:n.beat+beat});
  });
  return window.BassRegister.plan({kind:'custom',practiceStyle:state.genre,bpm:state.bpm,beats:degrees.length*4,bass,chords});
 }
 const namedPrefix='bass-ear-flow-arrangement/';
 function savedMenu(value=''){
  const select=el('Saved');select.replaceChildren(new Option('Choose a saved flow',''));
  try{
   const names=Object.keys(localStorage).filter(k=>k.startsWith(namedPrefix)).map(k=>k.slice(namedPrefix.length)).sort((a,b)=>a.localeCompare(b,'en',{numeric:true}));
   for(const name of names)select.add(new Option(name,name));
  }catch{}
  select.value=value;el('Open').disabled=!select.value;
 }
 function saveNamed(){
  const name=el('Name').value.trim();
  if(!name){el('Name').focus();el('Status').textContent='Give your progression a name.';return;}
  if(parse(el('Degrees').value)?.join()!==state.degrees.join()){el('Status').textContent='Apply your chord changes before saving.';return;}
  try{
   const key=namedPrefix+name;
   if(localStorage.getItem(key)&&!window.confirm('Replace the saved progression “'+name+'”?'))return;
   localStorage.setItem(key,JSON.stringify(state));savedMenu(name);
   el('Status').textContent='Saved '+name+' on this device.';
  }catch{el('Status').textContent='This browser could not save the progression.';}
 }
 function openNamed(){
  const name=el('Saved').value;
  try{
   const s=JSON.parse(localStorage.getItem(namedPrefix+name));
   if(!s||!Array.isArray(s.degrees)||!parse(s.degrees.join(','))||!Array.isArray(s.choices)||!catalogue.has(s.genre)||!Number.isInteger(s.key)||s.key<0||s.key>11||!['major','minor'].includes(s.mode)||!Number.isFinite(s.bpm)||s.bpm<40||s.bpm>220)throw Error();
   stop();Object.assign(state,{genre:s.genre,key:s.key,mode:s.mode,bpm:s.bpm,beat:s.beat,degrees:s.degrees,choices:s.choices});fresh=false;selected=0;
   open();el('Name').value=name;savedMenu(name);save();
   el('Status').textContent=s.choices.join()===state.choices.join()&&s.beat===state.beat?'Opened '+name+'.':'Opened '+name+'. An unavailable beat or pattern was replaced.';
  }catch{el('Status').textContent='This saved progression could not be opened.';}
 }
 let score=null,pendingScore=null,fret=null,viewBeat=0,layoutKey='',activeKey='';
 const pitch=m=>F.names[pc(m)]+(Math.floor(m/12)-1);
 function stamp(seconds){const t=Math.floor(Math.max(0,seconds));return Math.floor(t/60)+':'+String(t%60).padStart(2,'0');}
 function chartFor(p,single){
  const degrees=single?state.degrees.slice(selected,selected+2):state.degrees;
  const scale=F.scales[state.mode];
  const bars=degrees.map((d,i)=>{
   const idx=(single?selected:0)+i,row=i<degrees.length-1&&rows.find(r=>r.id===state.choices[idx]);
   const third=degree(scale,d+2)-degree(scale,d),fifth=degree(scale,d+4)-degree(scale,d);
   return {idx,degree:d,chord:F.names[pc(state.key+degree(scale,d))]+(fifth===6?'dim':third===3?'m':''),pattern:row?({fills:'Fill',runs:'Run',basslines:'Bassline'}[row.kind]+' · '+row.label):'Landing',kind:row?.kind};
  });
  return {bars,p};
 }
 function compact(on){
  host.dataset.focus=String(on);el('Visual').hidden=!on;el('Setup').hidden=on;el('Notes').hidden=on;
  if(on)document.getElementById('earContent').scrollTop=0;
 }
 function installScore(value){
  score=value;layoutKey='';activeKey='';
  score.notes=score.p.bass.map(n=>({midi:n.midi,start:n.beat*score.step,end:(n.beat+n.length)*score.step,isFill:['fills','runs'].includes(score.bars[Math.floor(n.beat/4)]?.kind)}));
 }
 function paint(beat){
  if(!score||el('Visual').hidden)return;
  viewBeat=beat;
  const bar=Math.min(score.bars.length-1,Math.floor(beat/4)),current=score.bars[bar],next=score.bars[bar+1],view=el('View').value,seconds=beat*score.step;
  const time=stamp(seconds)+' / '+stamp(score.p.beats*score.step);
  if(el('Time').textContent!==time)el('Time').textContent=time;
  const caption=current.degree+' · '+current.chord+(next?' → '+next.degree+' · '+next.chord:'')+'  |  '+current.pattern;
  if(el('Now').textContent!==caption)el('Now').textContent=caption;
  const board=el('Fret'),list=el('Timeline'),onFret=view.startsWith('fret');
  board.hidden=!onFret;list.hidden=onFret;board.classList.toggle('ff-single-board',view==='fret2');
  if(onFret){
   if(!fret){fret=window.BassFretFlow.create();fret.init({get:()=>({notes:score?.notes||[],strings:5,time:viewBeat*(score?.step||0),loaded:!!score,highlight:true})},board);}
   fret.draw(seconds);return;
  }
  const key=view+'/'+bar;
  if(key!==layoutKey){
   layoutKey=key;activeKey='';list.replaceChildren();
   const first=view==='phrase'?Math.floor(bar/4)*4:bar;
   for(let i=first;i<Math.min(score.bars.length,first+(view==='phrase'?4:1));i++){
    const b=score.bars[i],box=document.createElement('div'),title=document.createElement('strong');
    title.textContent=stamp(i*4*score.step)+' · '+b.degree+' '+b.chord+' · '+b.pattern;box.append(title);
    const chips=document.createElement('div');chips.className='flow-chips';
    score.p.bass.forEach((n,index)=>{
     if(Math.floor(n.beat/4)!==i)return;
     const chip=document.createElement('span');chip.dataset.note=index;
     if(view==='notes'){const time=document.createElement('small');time.textContent=(n.beat*score.step).toFixed(2)+' s';chip.append(time);}
     chip.append(document.createTextNode(pitch(n.midi)));chips.append(chip);
    });
    box.append(chips);list.append(box);
   }
  }
  const index=score.p.bass.findLastIndex(n=>n.beat<=beat&&beat<n.beat+n.length);
  if(activeKey!==String(index)){activeKey=String(index);for(const chip of list.querySelectorAll('[data-note]'))chip.classList.toggle('sounding',Number(chip.dataset.note)===index);}
 }
 function actions(){
  el('Change').textContent=playing==='change'?'Pause change':paused==='change'?'Resume change':'Play change';
  el('Play').textContent=playing==='all'?'Pause flow':paused==='all'?'Resume flow':'Play flow';
 }
 function follow(){
  if(pendingScore&&ctx.currentTime>=pendingScore.start){installScore(pendingScore);pendingScore=null;}
  if(score?.transport&&player){const pos=Math.max(0,score.transport.position()-score.transport.latency)%score.transport.seconds;paint(pos/score.step);}
  const i=score&&player&&sounding==='all'?Math.floor(viewBeat/4):-1;
  Array.from(el('Changes').children).forEach((b,k)=>{if(k===i)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
 }
 function stop(){
  revision++;clearInterval(clock);sounding='';player?.stop();player=null;playing='';paused='';offset=0;
  pendingScore=null;score=null;layoutKey='';if(host){compact(false);follow();actions();el('Status').textContent='';}
 }
 async function play(mode,resume=0){
  const ticket=++revision;playing=mode;paused='';actions();el('Status').textContent='Preparing audio…';
  try{
   ctx??=new AudioContext();await ctx.resume();await window.BassEarAudio.prepare(ctx);
   if(ticket!==revision)return;
   const p=plan(mode==='change'),band=H.resolve(p,{groove:state.beat});
   const chart=chartFor(p,mode==='change');
   const task=renderQueue.then(()=>ticket===revision?window.BassPracticeLoop.render(ctx,p,{...band,cancelled:()=>revision!==ticket}):null);
   renderQueue=task.catch(()=>null);
   const rendered=await task;
   if(ticket!==revision)return;
   if(!rendered)throw Error('The beat could not load. Try again or choose another beat.');
   const when=ctx.currentTime+.035,continuing=player&&sounding===mode&&mode==='all';
   const at=continuing?Math.max(0,(player.position()+.035)/player.beatSeconds)%p.beats:resume%p.beats;
   const next=window.BassPracticeLoop.start(ctx,rendered,{when,offsetBeats:at,fadeIn:.008});
   player?.stopAt(when,.008);player=next;sounding=mode;pendingScore={...chart,step:next.beatSeconds,transport:next,start:when+next.latency};
   if(!score?.transport||paused){installScore(pendingScore);pendingScore=null;}
   compact(true);follow();clearInterval(clock);clock=setInterval(follow,24);el('Status').textContent='';
  }catch(e){if(ticket===revision){if(player){playing=sounding;actions();}else stop();el('Status').textContent=e.message;}}
 }
 function toggle(mode){
  if(playing===mode){
   if(!player){stop();return;}
   follow();revision++;clearInterval(clock);pendingScore=null;player.stop();player=null;
   playing='';sounding='';paused=mode;offset=viewBeat;actions();el('Status').textContent='';return;
  }
  if(mode==='change'&&score&&sounding==='all'){selected=score.bars[Math.min(Math.floor(viewBeat/4),score.bars.length-2)].idx;draw();}
  void play(mode,paused===mode?offset:0);
 }
 function draw(){
  const moves=el('Changes');moves.replaceChildren();
  state.degrees.slice(1).forEach((to,i)=>{
   const b=document.createElement('button');b.type='button';b.textContent=state.degrees[i]+' → '+to;
   b.setAttribute('aria-label','Change '+(i+1)+', '+b.textContent);b.setAttribute('aria-pressed',String(i===selected));
   b.onclick=()=>{selected=i;draw();if(playing==='change')void play('change');else if(paused==='change'){offset=0;}};moves.append(b);
  });
  const select=el('Pattern'),pool=allowed(selected);select.replaceChildren();
  for(const [kind,label] of Object.entries(kinds)){
   const group=document.createElement('optgroup');group.label=label;
   for(const r of pool.filter(r=>r.kind===kind))group.append(new Option(r.label,r.id));
   if(group.children.length)select.append(group);
  }
  select.value=state.choices[selected]||'';
  const can=!!select.value&&!!state.beat;
  el('Change').disabled=!can;el('Play').disabled=!state.beat||state.choices.some(id=>!id);
  el('Prev').disabled=el('Next').disabled=select.length<2;
  const scale=F.scales[state.mode],to=state.degrees[selected+1];
  el('Notes').textContent=can?notes(selected).map(n=>F.names[pc(n.midi)]).join(' · ')+' → '+F.names[pc(state.key+degree(scale,to))]:'No existing pattern fits this change.';
  actions();
 }
 function update(){
  save();draw();
  if(playing)void play(playing);
  else if(paused&&score){
   const chart=chartFor(plan(paused==='change'),paused==='change');installScore({...chart,step:60/state.bpm});
   offset%=chart.p.beats;paint(offset);
  }
 }
 function open(){
  catalogue=library();savedMenu(el('Saved').value);
  const labels=new Map([...H.availableGroups(),...G.groups]);
  const genres=[...catalogue.keys()].map(id=>({id,label:labels.get(id)||id})).sort(compare);
  if(!catalogue.has(state.genre))state.genre=genres[0]?.id;
  options(el('Genre'),genres,state.genre);el('Key').value=state.key+'/'+state.mode;el('Bpm').value=state.bpm;
  el('Degrees').value=state.degrees.join(' → ');hydrate();draw();
 }
 function init(section){
  host=section;restore();
  host.innerHTML=`<div class="flow-grid" id="flowSetup"><label>Genre<select id="flowGenre"></select></label><label>Beat<select id="flowBeat"></select></label>
   <div class="flow-settings wide"><label>Key<select id="flowKey"></select></label>
   <label>BPM<input type="number" id="flowBpm" min="40" max="220" step="any"></label><button type="button" id="flowShowSave" aria-controls="flowSavePanel" aria-expanded="false">Save</button><button type="button" id="flowShowOpen" aria-controls="flowOpenPanel" aria-expanded="false">Open</button></div>
   <div class="flow-inline wide" id="flowSavePanel" hidden><label>Progression name<input id="flowName" maxlength="80"></label><button type="button" id="flowSave">Save flow</button></div>
   <div class="flow-inline wide" id="flowOpenPanel" hidden><label>Saved on this device<select id="flowSaved"></select></label><button type="button" id="flowOpen">Open flow</button></div>
   <div class="flow-inline wide"><label>Chord progression<input id="flowDegrees" maxlength="180" placeholder="1 → 5 → 6 → 5 → 1"></label><button type="button" id="flowApply">Apply chords</button></div>
   <div class="wide" id="flowChanges" role="group" aria-label="Choose a chord change"></div><label class="wide">Pattern for this change<select id="flowPattern"></select></label>
</div>
   <section id="flowVisual" aria-label="Timed rehearsal" hidden><div class="flow-top"><select aria-label="Rehearsal view" id="flowView"><option value="notes">Note View</option><option value="phrase">Phrase View</option><option value="fret">Fret View</option><option value="fret2">Fret View 2</option></select><button type="button" id="flowEdit">Edit flow</button></div>
   <p><output id="flowTime"></output> · <span id="flowNow"></span></p><div id="flowTimeline"></div><div id="flowFret" hidden></div></section>
   <div class="flow-transport"><button type="button" id="flowPrev" aria-label="Previous pattern" title="Previous pattern">◀</button><button type="button" id="flowNext" aria-label="Next pattern" title="Next pattern">▶</button><button type="button" id="flowChange">Play change</button><button type="button" id="flowPlay">Play flow</button></div>
   <p id="flowNotes"></p><p role="status" id="flowStatus"></p>`;
  el('Saved').onchange=()=>{el('Open').disabled=!el('Saved').value;};
  el('Save').onclick=saveNamed;el('Open').onclick=openNamed;el('Edit').onclick=()=>{stop();draw();};
  el('View').onchange=()=>{layoutKey='';paint(viewBeat);};
  options(el('Key'),F.names.flatMap((name,key)=>['major','minor'].map(mode=>({label:name+(mode==='minor'?'m':''),id:key+'/'+mode}))),state.key+'/'+state.mode);
  for(const action of ['Save','Open'])el('Show'+action).onclick=()=>{
   const expand=el(action+'Panel').hidden;
   for(const item of ['Save','Open']){
    const visible=expand&&item===action;
    el(item+'Panel').hidden=!visible;el('Show'+item).setAttribute('aria-expanded',String(visible));
   }
   if(expand){if(action==='Open')savedMenu(el('Saved').value);el(action==='Save'?'Name':'Saved').focus();}
  };
  el('Genre').onchange=e=>{state.genre=e.target.value;hydrate();update();};
  el('Beat').onchange=e=>{state.beat=e.target.value;update();};
  el('Key').onchange=e=>{const [key,mode]=e.target.value.split('/');state.key=Number(key);state.mode=mode;update();};
  el('Bpm').onchange=e=>{if(!e.target.value||!e.target.reportValidity()){e.target.value=state.bpm;return;}state.bpm=Number(e.target.value);update();};
  el('Apply').onclick=()=>{
   const next=parse(el('Degrees').value);
   if(!next){el('Status').textContent='Enter 2 to 16 chords using degrees 1 to 7. Each change needs two different chords.';return;}
   const old=new Map();
   state.choices.forEach((id,i)=>{const pair=state.degrees.slice(i,i+2).join('/');if(!old.has(pair))old.set(pair,[]);old.get(pair).push(id);});
   state.degrees=next;state.choices=next.slice(1).map((_,i)=>old.get(next.slice(i,i+2).join('/'))?.shift());selected=0;offset=0;
   el('Degrees').value=next.join(' → ');el('Status').textContent='';hydrate();update();
  };
  el('Degrees').onkeydown=e=>{if(e.key==='Enter')el('Apply').click();};
  el('Pattern').onchange=e=>{state.choices[selected]=e.target.value;update();};
  for(const [id,dir] of [['Prev',-1],['Next',1]])el(id).onclick=()=>{
   if(host.dataset.focus==='true'&&score){selected=score.bars[Math.min(Math.floor(viewBeat/4),score.bars.length-2)].idx;draw();}
   const s=el('Pattern');s.selectedIndex=(s.selectedIndex+dir+s.length)%s.length;s.dispatchEvent(new Event('change'));
  };
  el('Change').onclick=()=>toggle('change');el('Play').onclick=()=>toggle('all');
  window.addEventListener('pagehide',stop);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing)stop();});
 }
 return {init,open,stop};
})();
