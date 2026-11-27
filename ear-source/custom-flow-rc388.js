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
 function actions(){
  el('Change').textContent=playing==='change'?'Pause change':paused==='change'?'Resume change':'Play change';
  el('Play').textContent=playing==='all'?'Pause flow':paused==='all'?'Resume flow':'Play flow';
 }
 function follow(){
  const i=player&&sounding==='all'?Math.floor(Math.max(0,player.position()-player.latency)%player.seconds/player.beatSeconds/4):-1;
  Array.from(el('Changes').children).forEach((b,k)=>{if(k===i)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
 }
 function stop(){
  revision++;clearInterval(clock);sounding='';player?.stop();player=null;playing='';paused='';offset=0;
  if(host){follow();actions();el('Status').textContent='';}
 }
 async function play(mode,resume=0){
  const ticket=++revision;playing=mode;paused='';actions();el('Status').textContent='Preparing audio…';
  try{
   ctx??=new AudioContext();await ctx.resume();await window.BassEarAudio.prepare(ctx);
   if(ticket!==revision)return;
   const p=plan(mode==='change'),band=H.resolve(p,{groove:state.beat});
   const task=renderQueue.then(()=>ticket===revision?window.BassPracticeLoop.render(ctx,p,{...band,cancelled:()=>revision!==ticket}):null);
   renderQueue=task.catch(()=>null);
   const rendered=await task;
   if(ticket!==revision)return;
   if(!rendered)throw Error('The beat could not load. Try again or choose another beat.');
   const when=ctx.currentTime+.035,continuing=player&&sounding===mode&&mode==='all';
   const at=continuing?Math.max(0,(player.position()+.035)/player.beatSeconds)%p.beats:resume%p.beats;
   const next=window.BassPracticeLoop.start(ctx,rendered,{when,offsetBeats:at,fadeIn:.008});
   player?.stopAt(when,.008);player=next;sounding=mode;clearInterval(clock);clock=setInterval(follow,100);el('Status').textContent='';
  }catch(e){if(ticket===revision){if(player){playing=sounding;actions();}else stop();el('Status').textContent=e.message;}}
 }
 function toggle(mode){
  if(playing===mode){
   const beat=player?Math.max(0,player.position()/player.beatSeconds):0;
   stop();paused=mode;offset=beat;actions();return;
  }
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
 function update(){save();draw();if(playing)void play(playing);}
 function open(){
  catalogue=library();
  const labels=new Map([...H.availableGroups(),...G.groups]);
  const genres=[...catalogue.keys()].map(id=>({id,label:labels.get(id)||id})).sort(compare);
  if(!catalogue.has(state.genre))state.genre=genres[0]?.id;
  options(el('Genre'),genres,state.genre);el('Key').value=state.key;el('Mode').value=state.mode;el('Bpm').value=state.bpm;
  el('Degrees').value=state.degrees.join(' → ');hydrate();draw();
 }
 function init(section){
  host=section;restore();
  host.innerHTML=`<div class="flow-grid"><label>Genre<select id="flowGenre"></select></label><label>Beat<select id="flowBeat"></select></label>
   <label>Key<select id="flowKey"></select></label><label>Scale<select id="flowMode"><option value="major">Major</option><option value="minor">Minor</option></select></label>
   <label>Tempo (BPM)<input type="number" id="flowBpm" min="40" max="220" step="any"></label>
   <label class="wide">Chord progression<input id="flowDegrees" maxlength="180" placeholder="1 → 5 → 6 → 5 → 1"></label><button type="button" id="flowApply">Apply chords</button>
   <div class="wide" id="flowChanges" role="group" aria-label="Choose a chord change"></div><label class="wide">Pattern for this change<select id="flowPattern"></select></label>
   <button type="button" id="flowPrev">Previous</button><button type="button" id="flowNext">Next</button><p class="wide" id="flowNotes"></p>
   <button type="button" id="flowChange">Play change</button><button type="button" id="flowPlay">Play flow</button></div><p role="status" id="flowStatus"></p>`;
  options(el('Key'),F.names.map((label,id)=>({label,id})),state.key);
  el('Genre').onchange=e=>{state.genre=e.target.value;hydrate();update();};
  el('Beat').onchange=e=>{state.beat=e.target.value;update();};
  el('Mode').onchange=e=>{state.mode=e.target.value;update();};
  el('Key').onchange=e=>{state.key=Number(e.target.value);update();};
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
   const s=el('Pattern');s.selectedIndex=(s.selectedIndex+dir+s.length)%s.length;s.dispatchEvent(new Event('change'));
  };
  el('Change').onclick=()=>toggle('change');el('Play').onclick=()=>toggle('all');
  window.addEventListener('pagehide',stop);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing)stop();});
 }
 return {init,open,stop};
})();
