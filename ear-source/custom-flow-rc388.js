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
  const parts=value.normalize('NFKC').trim().split(/[,;]/),degrees=[];
  for(const part of parts){
   if(!/^[1-7]+$/.test(part.trim())&&!/^\s*[1-7](?:(?:\s*(?:->|→|[-–—>/|]|\bto\b)\s*|\s+)[1-7])*\s*$/i.test(part))return null;
   const group=part.match(/[1-7]/g).map(Number);
   if(group.length>1&&degrees.at(-1)===group[0])group.shift();
   degrees.push(...group);
  }
  return degrees.length>=2&&degrees.length<=16?degrees:null;
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
    if(D.visible('uploaded',item.id+'/'+part))add(H.recordingGroup(item),{kind:'basslines',clip:item.id,part,id:'clip/'+item.id+'/'+part,label:item.sections?N.clip(item):N.phrase(item,part,window.BassRecordedPhrases[item.id].length)});
   });
  }
  return genres;
 }
 function allowed(i){
  if(state.degrees[i]===state.degrees[i+1])return [{id:'hold',kind:'basslines',label:'Hold chord'},...rows.filter(r=>r.kind==='basslines')];
  return rows.filter(r=>r.kind==='basslines'||G.supports(r.kind,r.idea,state.degrees[i],state.degrees[i+1]));
 }
 function source(r,from=1,to=4){
  return r.clip?U.plan(r.clip,'phrase-'+r.part):P.make(r.kind,{idea:r.idea,part:r.part,key:0,from,to,bpm:state.bpm});
 }
 // Keep untreated recording extracts out of the beat picker.
 // A drum stem estimated from a song or lesson may still contain speech.
 let flowBeats=new Map();
 function selectedBeat(){
  const beat=flowBeats.get(state.beat);
  if(!beat)throw Error('Choose an instrumental beat.');
  return beat;
 }
 function hydrate(){
  rows=(catalogue.get(state.genre)||[]).filter(r=>{
   if(!r.clip)return true;
   r.shape??=U.rehearsalShape(r.clip,r.part);return r.shape.length;
  }).sort(compare);
  // Use the study picker's manual bank and the actual Auto assignment for
  // each visible bassline, run and fill in this genre.
  const bank=window.BassSuppliedDrums,manual=bank.byStyle(state.genre);
  flowBeats=new Map(manual.map(loop=>[loop.id,loop]));
  const numbered=new Map(),other=[],menu=el('Beat');
  let firstTempo;
  for(const kind of ['basslines','runs','fills']){
   for(const row of rows.filter(r=>r.kind===kind).sort((a,b)=>Number(!!a.clip)-Number(!!b.clip)||compare(a,b))){
    const study=source(row),band=H.resolve(study),loop=band.loop;
    if(!loop||(!bank.instrumental.includes(loop)&&!manual.includes(loop)))continue;
    const id='study/'+row.id,choice={id,label:row.label,loop};
    flowBeats.set(id,loop);flowBeats.set(loop.id,loop);
    if(/^Practice \d+$/.test(row.label)){
     // Basslines supplies the default backing when several sections share a number.
     // An existing flow keeps its own assignment for that number.
     if(!numbered.has(row.label)||id===state.beat)numbered.set(row.label,choice);
    }else other.push(choice);
    firstTempo??=row.clip?U.practicePlan(row.clip,'phrase-'+row.part).bpm:study.recordedStudy?.nativeBpm||(!study.seriesDrum&&band.id==='reggae'?77:loop.bpm);
   }
  }
  const beats=[...numbered.values()].sort(compare),listed=new Set(beats.map(b=>b.loop.id));
  for(const choice of other){
   if(listed.has(choice.loop.id))continue;
   // Identify additional drum recordings by the loop itself, including when
   // multiple excerpts use the same short study name.
   beats.push({...choice,label:choice.loop.title});listed.add(choice.loop.id);
  }
  if(!beats.length)for(const loop of manual)beats.push({id:loop.id,label:loop.title,loop});
  const needsBeat=!flowBeats.has(state.beat);
  if(needsBeat)state.beat=beats[0]?.id||'';
  // Old saved flows can reference a recording directly. Keep the saved ID
  // and its sound without adding a second menu entry.
  const visible=beats.find(b=>b.id===state.beat)||beats.find(b=>b.loop===flowBeats.get(state.beat));
  options(menu,beats,visible?.id||'');
  if(fresh||needsBeat){
   const tempo=window.BassFillTrainer.basslineTempo(state.genre)??firstTempo??flowBeats.get(state.beat)?.bpm??96;
   state.bpm=Number(Math.min(220,Math.max(40,tempo)).toFixed(2));
   el('Bpm').value=state.bpm;fresh=false;
  }
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
  if(state.choices[i]==='hold')return [{beat:0,length:3.7,midi:36+pc(state.key+degree(F.scales[state.mode],state.degrees[i])),velocity:92}];
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
  if(!acceptChords(true))return;
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
 function chartFor(p,single){
  const degrees=single?state.degrees.slice(selected,selected+2):state.degrees;
  const scale=F.scales[state.mode];
  const bars=degrees.map((d,i)=>{
   const idx=(single?selected:0)+i,row=i<degrees.length-1&&rows.find(r=>r.id===state.choices[idx]);
   const third=degree(scale,d+2)-degree(scale,d),fifth=degree(scale,d+4)-degree(scale,d);
   return {idx,degree:d,rootPc:pc(state.key+degree(scale,d)),chord:F.names[pc(state.key+degree(scale,d))]+(fifth===6?'dim':third===3?'m':''),pattern:row?({fills:'Fill',runs:'Run',basslines:'Bassline'}[row.kind]+' · '+row.label):i<degrees.length-1?'Hold chord':'Landing',kind:row?.kind};
  });
  return {bars,p};
 }
 let editorScroll=0,editorSelection=0,editorTrigger='Play',typingStart=null;
 function backToEditor(){
  if(host?.dataset.focus!=='true')return false;
  stop();selected=editorSelection;draw();el(editorTrigger).focus({preventScroll:true});
  document.getElementById('earContent').scrollTop=editorScroll;return true;
 }
 function compact(on){
  if(on&&host.dataset.focus!=='true'){
   editorScroll=document.getElementById('earContent').scrollTop;editorSelection=selected;editorTrigger=playing==='change'?'Change':'Play';
  }
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
  const bar=Math.min(score.bars.length-1,Math.floor(beat/4)),view=el('View').value,seconds=beat*score.step;
  const idx=score.bars[Math.min(bar,score.bars.length-2)].idx;
  if(idx!==selected){selected=idx;draw();}
  const harmony=el('Harmony');
  if(!layoutKey){
   harmony.replaceChildren(...score.bars.map(b=>{
    const chip=document.createElement('span');chip.className='fill-chord';chip.textContent=b.degree+' · '+b.chord;return chip;
   }));
  }
  for(let i=0;i<harmony.children.length;i++)if(harmony.children[i].getAttribute('aria-current')!==String(i===bar))harmony.children[i].setAttribute('aria-current',String(i===bar));
  const board=el('Fret'),list=el('Timeline'),onFret=view.startsWith('fret');
  board.hidden=!onFret;list.hidden=onFret;board.classList.toggle('ff-single-board',view==='fret2');
  if(onFret){
   if(!fret){fret=window.BassFretFlow.create();fret.init({get:()=>({notes:score?.notes||[],strings:5,time:viewBeat*(score?.step||0),loaded:!!score,highlight:true})},board);}
   layoutKey=view;fret.draw(seconds);return;
  }
  const index=score.p.bass.findLastIndex(n=>n.beat<=beat);
  const page=Math.floor(Math.max(0,index)/25),key=view+'/'+page;
  if(layoutKey!==key){
   layoutKey=key;activeKey='';list.replaceChildren();
   score.p.bass.slice(page*25,page*25+25).forEach((n,i)=>{
    const root=score.bars[Math.floor(n.beat/4)].rootPc;
    list.append(window.BassFillTrainer.noteCard(n,page*25+i,root,window.BassFillTrainer.preview));
   });
  }
  const n=score.p.bass[index],active=n&&beat<n.beat+n.length?String(index):'-1';
  if(activeKey!==active){activeKey=active;for(const chip of list.children)chip.classList.toggle('sounding',chip.dataset.index===active);}

 }
 function actions(){
  el('Change').textContent=playing==='change'?'Stop change':'Play change';
  el('Play').textContent=playing==='all'?'Pause flow':paused==='all'?'Resume flow':'Play flow';
 }
 function follow(){
  if(pendingScore&&ctx.currentTime>=pendingScore.start){installScore(pendingScore);pendingScore=null;}
  if(score?.transport&&player){const pos=Math.max(0,score.transport.position()-score.transport.latency)%score.transport.seconds;paint(pos/score.step);}
  const i=score&&player&&sounding==='all'?Math.floor(viewBeat/4):-1;
  Array.from(el('Changes').children).forEach((b,k)=>{if(k===i)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
 }
 let beatPlayer=null,beatRequest='',beatRevision=0;
 function beatButton(active){
  const button=el('Audition');button.textContent=active?'■':'▶';
  button.title=active?'Stop beat':'Play beat';button.setAttribute('aria-label',button.title);
  el('Audition').setAttribute('aria-pressed',String(active));
 }
 function stopBeat(){
  beatRevision++;beatRequest='';beatPlayer?.stop();beatPlayer=null;
  if(host)beatButton(false);
 }
 async function previewBeat(){
  const bpm=state.bpm,id=state.beat,key=id+'/'+bpm;
  if(beatRequest===key)return;
  const ticket=++beatRevision;beatRequest=key;beatButton(true);el('Status').textContent='Preparing beat…';
  try{
   ctx??=new AudioContext();await ctx.resume();await window.BassEarAudio.prepare(ctx);
   if(ticket!==beatRevision)return;
   const loop=selectedBeat();
   const frames=Math.round(ctx.sampleRate*60/bpm),beatSeconds=frames/ctx.sampleRate;
   const task=renderQueue.then(()=>ticket===beatRevision?window.BassSuppliedDrums.render(ctx,loop,frames,()=>ticket!==beatRevision):null);
   renderQueue=task.catch(()=>null);const buffer=await task;
   if(ticket!==beatRevision)return;
   if(!buffer)throw Error('This beat could not load.');
   const when=ctx.currentTime+.035;
   const at=beatPlayer?Math.max(0,(beatPlayer.position()+.035)/beatPlayer.beatSeconds)%loop.beats:0;
   const rendered={stems:{drums:buffer},levels:{drums:window.BassEarAudio.normalisation(buffer,.18)},seconds:buffer.duration,beatSeconds,gain:1};
   const next=window.BassPracticeLoop.start(ctx,rendered,{when,offsetBeats:at,drums:1,fadeIn:.008});
   beatPlayer?.stopAt(when,.008);beatPlayer=next;el('Status').textContent='';
  }catch(e){
   if(ticket!==beatRevision)return;
   if(!beatPlayer)stopBeat();
   el('Status').textContent=beatPlayer?'This beat could not load. The previous beat is still playing.':e.message;
  }
 }
 function stop(){
  stopBeat();
  revision++;clearInterval(clock);sounding='';player?.stop();player=null;playing='';paused='';offset=0;
  pendingScore=null;score=null;layoutKey='';if(host){compact(false);follow();actions();el('Status').textContent='';}
 }
 async function play(mode,resume=0){
  const ticket=++revision;playing=mode;paused='';actions();el('Status').textContent='Preparing audio…';
  try{
   ctx??=new AudioContext();await ctx.resume();await window.BassEarAudio.prepare(ctx);
   if(ticket!==revision)return;
   const p=plan(mode==='change'),band={...H.resolve(p,{groove:selectedBeat().id}),loop:selectedBeat(),recorded:false};
   const chart=mode==='all'?chartFor(p,false):null;
   const task=renderQueue.then(()=>ticket===revision?window.BassPracticeLoop.render(ctx,p,{...band,cancelled:()=>revision!==ticket}):null);
   renderQueue=task.catch(()=>null);
   const rendered=await task;
   if(ticket!==revision)return;
   if(!rendered)throw Error('The beat could not load. Try again or choose another beat.');
   const when=ctx.currentTime+.035,continuing=player&&sounding===mode&&mode==='all';
   const at=continuing?Math.max(0,(player.position()+.035)/player.beatSeconds)%p.beats:resume%p.beats;
   const next=window.BassPracticeLoop.start(ctx,rendered,{when,offsetBeats:at,fadeIn:.008});
   player?.stopAt(when,.008);player=next;sounding=mode;
   if(mode==='change'){score=null;pendingScore=null;clearInterval(clock);el('Status').textContent='';return;}
   pendingScore={...chart,step:next.beatSeconds,transport:next,start:when+next.latency};
   if(!score?.transport||paused){installScore(pendingScore);pendingScore=null;}
   compact(true);follow();clearInterval(clock);clock=setInterval(follow,24);el('Status').textContent='';
  }catch(e){if(ticket===revision){if(player){playing=sounding;actions();}else stop();el('Status').textContent=e.message;}}
 }
 function toggle(mode){
  if(mode==='change'&&playing==='change'){stop();return;}
  if(host.dataset.focus!=='true'&&!acceptChords(true))return;
  if(beatRequest)stopBeat();
  if(playing===mode){
   if(!player){stop();return;}
   follow();revision++;clearInterval(clock);pendingScore=null;player.stop();player=null;
   playing='';sounding='';paused=mode;offset=viewBeat;actions();el('Status').textContent='';return;
  }
  if(mode==='change'&&score&&sounding==='all'){selected=score.bars[Math.min(Math.floor(viewBeat/4),score.bars.length-2)].idx;draw();}
  void play(mode,paused===mode?offset:0);
 }
 function draw(){
  for(const name of ['Genre','Beat']){
   const caption=el(name).selectedOptions[0]?.text||(name==='Beat'?flowBeats.get(state.beat)?.title:'')||'';
   let short=caption.replace(/ · Recreated$/,'').replace(/^FL\s+|^6[-/]8\s+/gi,'').replace(/^6[-/]8\s+/,'')
    .replace(/shufflegroove/i,'Shuffle').replace(/rockgroove/i,'Rock').replace(/oldschool/i,'Old skool');
   if(name==='Genre'&&state.genre==='nigerian68')short='Nigerian 6/8';
   const lines=short.match(/^(.*?)\s+(\S+)$/)?.slice(1)||[short];
   if(lines.some(line=>line.length>10)&&name==='Beat'&&el('Beat').selectedIndex>=0)lines.splice(0,lines.length,'Beat',String(el('Beat').selectedIndex+1).padStart(2,'0'));
   el(name+'Name').replaceChildren(...lines.map(line=>{
    const part=document.createElement('b');part.textContent=line;return part;
   }));el(name).title=caption;
  }
  el('BeatNext').disabled=el('Beat').length<2;el('Audition').disabled=!state.beat;
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
  const preview=el('Notes');preview.replaceChildren();
  if(can){
   const pitches=notes(selected).map(n=>F.names[pc(n.midi)]);
   pitches.push(F.names[pc(state.key+degree(scale,to))]);
   for(const [i,name] of pitches.entries()){
    const chip=document.createElement('span');chip.textContent=name;
    if(i===pitches.length-1){chip.className='flow-landing';chip.textContent='→ '+name;}
    preview.append(chip);
   }
  }else preview.textContent='No existing pattern fits this change.';
  actions();
 }
 function update(){
  save();draw();
  if(beatRequest)void previewBeat();
  if(playing)void play(playing);
  else if(paused&&score){
   const chart=chartFor(plan(paused==='change'),paused==='change');installScore({...chart,step:60/state.bpm});
   offset%=chart.p.beats;paint(offset);
  }
 }
 function acceptChords(report){
  const field=el('Degrees'),next=parse(field.value);
  if(!next){
   if(report){el('Status').textContent='Enter 2 to 16 chord degrees, for example 1 4 4 5 1.';field.setAttribute('aria-invalid','true');field.focus();}
   return false;
  }
  if(field.hasAttribute('aria-invalid'))el('Status').textContent='';
  field.removeAttribute('aria-invalid');
  if(next.join()===state.degrees.join())return true;
  const before=typingStart||state,old=new Map();
  before.choices.forEach((id,i)=>{const pair=before.degrees.slice(i,i+2).join('/');if(!old.has(pair))old.set(pair,[]);old.get(pair).push(id);});
  state.degrees=next;state.choices=next.slice(1).map((_,i)=>old.get(next.slice(i,i+2).join('/'))?.shift());
  selected=Math.min(selected,next.length-2);offset=0;el('Status').textContent='';hydrate();update();return true;
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
  host.innerHTML=`<div class="flow-grid" id="flowSetup"><div class="wide flow-beats">
   <label><select aria-label="Genre" id="flowGenre"></select><span aria-hidden="true" id="flowGenreName"></span></label>
   <label><select aria-label="Beat" id="flowBeat"></select><span aria-hidden="true" id="flowBeatName"></span></label>
   <button type="button" id="flowBeatNext" aria-label="Next beat" title="Next beat">⏭&#xfe0e;</button><button type="button" id="flowAudition" aria-label="Play beat" title="Play beat" aria-pressed="false">▶</button></div>
   <div class="flow-settings wide"><label class="flow-value"><span>Key</span><select id="flowKey"></select></label>
   <label class="flow-value"><span>BPM</span><input type="number" id="flowBpm" min="40" max="220" step="any"></label><button type="button" id="flowShowSave" aria-controls="flowSavePanel" aria-expanded="false">Save</button><button type="button" id="flowShowOpen" aria-controls="flowOpenPanel" aria-expanded="false">Open</button></div>
   <div class="flow-inline wide" id="flowSavePanel" hidden><label><input aria-label="Progression name" placeholder="Progression name" id="flowName" maxlength="80"></label><button type="button" id="flowSave">Save flow</button></div>
   <div class="flow-inline wide" id="flowOpenPanel" hidden><label><select aria-label="Saved progressions on this device" id="flowSaved"></select></label><button type="button" id="flowOpen">Open flow</button></div>
   <div class="wide" id="flowProgression"><label><input aria-label="Chord progression" id="flowDegrees" maxlength="180" placeholder="1 → 5 → 6 → 5 → 1"></label></div>
   <div class="wide" id="flowChanges" role="group" aria-label="Choose a chord change"></div></div>
   <div class="flow-picker"><label><select aria-label="Pattern for this change" id="flowPattern"></select></label><button type="button" id="flowPrev" aria-label="Previous pattern">‹</button><button type="button" id="flowNext" aria-label="Next pattern">›</button></div>
   <div class="flow-transport"><button type="button" id="flowChange">Play change</button><button type="button" id="flowPlay">Play flow</button></div>
   <section id="flowVisual" aria-label="Timed rehearsal" hidden><div class="flow-top" id="flowViewActions"><select aria-label="Rehearsal view" id="flowView"><option value="notes">Band</option><option value="fret">Fret View</option><option value="fret2">Fret View 2</option></select><button type="button" id="flowEdit">Edit flow</button></div>
   <div id="flowHarmony" aria-label="Chords"></div><div id="flowTimeline" aria-label="Bass notes"></div><div id="flowFret" hidden></div></section>

   <div id="flowNotes" role="group" aria-label="Notes leading to the next chord"></div><p role="status" id="flowStatus"></p>`;
  el('BeatNext').onclick=()=>{
   const beats=el('Beat');beats.selectedIndex=(beats.selectedIndex+1)%beats.length;
   beats.dispatchEvent(new Event('change'));
  };
  el('Audition').onclick=()=>{
   if(beatRequest){stopBeat();el('Status').textContent='';}
   else{if(playing)stop();void previewBeat();}
  };
  el('Saved').onchange=()=>{el('Open').disabled=!el('Saved').value;};
  el('Save').onclick=saveNamed;el('Open').onclick=openNamed;el('Edit').onclick=backToEditor;
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
  el('Genre').onchange=e=>{state.genre=e.target.value;state.beat='';hydrate();update();};
  el('Beat').onchange=e=>{state.beat=e.target.value;update();};
  el('Key').onchange=e=>{const [key,mode]=e.target.value.split('/');state.key=Number(key);state.mode=mode;update();};
  el('Bpm').onchange=e=>{if(!e.target.value||!e.target.reportValidity()){e.target.value=state.bpm;return;}state.bpm=Number(e.target.value);update();};
  const degrees=el('Degrees');
  degrees.onfocus=()=>{typingStart={degrees:[...state.degrees],choices:[...state.choices]};};
  degrees.oninput=()=>acceptChords(false);
  degrees.onblur=()=>{if(acceptChords(false))degrees.value=state.degrees.join(' → ');typingStart=null;};
  degrees.onkeydown=e=>{if(e.key==='Enter'&&acceptChords(true))degrees.blur();};
  el('Pattern').onchange=e=>{state.choices[selected]=e.target.value;update();};
  for(const [id,dir] of [['Prev',-1],['Next',1]])el(id).onclick=()=>{
   if(host.dataset.focus==='true'&&score){selected=score.bars[Math.min(Math.floor(viewBeat/4),score.bars.length-2)].idx;draw();}
   const s=el('Pattern');s.selectedIndex=(s.selectedIndex+dir+s.length)%s.length;s.dispatchEvent(new Event('change'));
  };
  el('Change').onclick=()=>toggle('change');el('Play').onclick=()=>toggle('all');
  window.addEventListener('pagehide',stop);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing)stop();});
 }
 return {init,open,stop,backToEditor};
})();
