/* Original studies using common bass techniques; no copied recordings or transcriptions. */
window.BassPracticeCore=(()=>{
 'use strict';
 const F=window.BassFillCore,pc=n=>(n%12+12)%12;
 const modes={major:['Ionian (major)','Major harmony; let the 3rd and 7th lead into the next chord.'],dorian:['Dorian','Minor with a natural 6th. Try a minor groove when the harmony allows that 6th.'],phrygian:['Phrygian','Minor with a flat 2nd. Use that close neighbour briefly and hear it against the chord.'],lydian:['Lydian','Major with a sharp 4th. Use the bright raised note where the harmony supports it.'],mixolydian:['Mixolydian','Major with a flat 7th. Useful over dominant seventh chords.'],minor:['Aeolian (minor)','Natural minor. Keep the flat 6th and flat 7th consistent with the song.'],locrian:['Locrian','Diminished colour with a flat 5th. Best as passing tension over diminished or half-diminished harmony.']};
 const lines=[
  {name:'Worship · 1–5–6–4',degrees:[1,5,6,4],feel:'worship',tip:'A spacious four-chord loop. Add movement near the next chord.'},
  {name:'Worship · 6–4–1–5',degrees:[6,4,1,5],feel:'worship',tip:'A minor-starting worship loop with a late pickup.'},
  {name:'Gospel · 1–6–2–5',degrees:[1,6,2,5],feel:'gospel',tip:'A turnaround with chord tones and a short approach into each change.'},
  {name:'Praise · 1–4–5–1',degrees:[1,4,5,1],feel:'praise',tip:'A lively syncopated praise groove. Keep the root clear.'},
  {name:'Reggae · 1–4–5–4',degrees:[1,4,5,4],feel:'reggae',tip:'Short notes, rests and a repeating root/fifth shape.'},
  {name:'Reggae · 1–5–1–4',degrees:[1,5,1,4],feel:'reggae',tip:'A relaxed repeating bass phrase. Leave the rests empty.'},
  {name:'Minor reggae · 1–7–6–7',degrees:[1,7,6,7],feel:'dub',mode:'minor',tip:'Try Aeolian for this descending minor progression.'},
  {name:'Highlife praise · 1–5–1–5',degrees:[1,5,1,5],feel:'highlife',tip:'A syncopated root-and-fifth study for an upbeat praise groove.'},
  {name:'Worship · 4–5–6–1',degrees:[4,5,6,1],feel:'lift',tip:'Build towards the home chord with octaves and a gentle pickup.'}
 ];
 lines.push(
  {name:'Gospel · Sunday turnaround',degrees:[1,6,2,5],feel:'church',tip:'A rolling triplet pickup resolves each change.'},
  {name:'Highlife · Dancing sixths',degrees:[1,4,2,5],feel:'sixths',tip:'Interlocking upper chord tones with a late descending answer.'},
  {name:'Funk · Octave engine',degrees:[1,4,6,5],feel:'funk',tip:'Short octave bursts and rests keep the groove crisp.'},
  {name:'Soul · Walking turnaround',degrees:[1,6,2,5],feel:'walk',tip:'Four steady steps, then a chromatic pickup.'},
  {name:'Praise · Makossa motion',degrees:[1,5,4,5],feel:'makossa',tip:'Offbeat answers and a three-note lead into each chord.'},
  {name:'Worship · Rising anthem',degrees:[6,4,1,5],feel:'anthem',tip:'Build from a held root into a flowing final beat.'},
  {name:'Minor · Broken-octave drive',degrees:[1,6,3,7],feel:'drive',mode:'minor',tip:'A minor chord pattern with a descending pickup.'},
  {name:'Gospel · Chromatic pocket',degrees:[2,5,1,6],feel:'pocket',tip:'Space first, then a tight enclosure around the next root.'}
 );
 const runs=[['Pentatonic cascade','A descending five-note shape with an octave return.'],['Gospel triplet burst','A rising chord shape followed by a quick triplet descent.'],['Modal sequence','Move through the mode in groups of three.'],['Chromatic enclosure','Surround the next root, then resolve clearly.'],['Octave staircase','Link lower and upper chord tones across the strings.'],['Blues turnaround','A short blue-note phrase resolves into the next root.'],['Sixteenth-note lift','A rising modal burst; start slowly before increasing the tempo.'],['Neighbour-note flourish','Alternate chord tones with neighbouring scale notes.']];
 runs.push(['Gospel waterfall','Descending chord tones turn into a rising modal answer.'],['Pentatonic double-back','A five-note climb doubles back before the landing.'],['Highlife ribbon','Alternating thirds spiral down to the next root.'],['Chromatic corkscrew','Two tight enclosures resolve on the downbeat.'],['Octave fireworks','Wide octave answers fold into a close approach.'],['Triplet summit','Twelve quick notes rise and fall over two beats.'],['Soul staircase','Descending pairs lead smoothly into the next chord.'],['Praise homecoming','A rising sequence turns back for a firm landing.']);
 function make(kind,opts={}){
  if(window.BassCuratedStudies?.get(kind,opts.idea))return window.BassCuratedStudies.make(kind,opts);
  if(kind==='fills')return F.make(opts);
  const key=pc(Math.round(Number(opts.key)||0)),mode=Object.hasOwn(modes,opts.mode)?opts.mode:'major',scale=F.scales[mode];
  const degree=n=>36+key+scale[(n%7+7)%7]+12*Math.floor(n/7);
  const near=(n,ref)=>{while(n-ref>6)n-=12;while(n-ref< -6)n+=12;return n;};
  const chord=d=>[0,2,4].map(i=>degree(d-1+i)+12);
  const chordName=d=>{const a=chord(d);return F.names[pc(a[0])]+(a[2]-a[0]===6?'dim':a[1]-a[0]===3?'m':'');};
  const bpm=Math.max(30,Math.min(160,Number(opts.bpm)||80)),bass=[],chords=[];
  const add=(beat,midi,length,role='bass')=>bass.push({beat,midi,length,role,velocity:role==='landing'?94:84});
  let idea=Math.max(0,Math.round(Number(opts.idea)||0));
  if(kind==='basslines'){
   idea=Math.min(lines.length-1,idea);const line=lines[idea],roots=[];
   for(const d of line.degrees)roots.push(near(degree(d-1),roots.at(-1)??40));
   line.degrees.forEach((d,bar)=>{
    const root=roots[bar],third=near(degree(d+1),root+4),fifth=near(degree(d+3),root+7),next=roots[(bar+1)%roots.length],offset=bar*4;
    let shape;
    if(line.shape)shape=line.shape.map(([b,n,l])=>[b,typeof n==='number'?degree(d-1+n)+root-degree(d-1):next+Number(n.slice(1)),l]);
    else if(line.feel==='church')shape=[[0,root,.8],[1,third,.6],[2,fifth,.6],[3,next-3,.25],[3+1/3,next-2,.25],[3+2/3,next-1,.25]];
    else if(line.feel==='sixths')shape=[[0,root,.45],[.75,third+12,.3],[1.25,fifth,.3],[2,root+12,.45],[3,fifth,.2],[3.25,third,.2],[3.5,next-1,.3]];
    else if(line.feel==='funk')shape=[[0,root,.2],[.75,root+12,.2],[1.5,fifth,.2],[2,root,.2],[2.75,root+12,.2],[3.25,next+2,.18],[3.5,next+1,.18],[3.75,next-1,.18]];
    else if(line.feel==='walk')shape=[[0,root,.8],[1,third,.8],[2,fifth,.8],[3,next-2,.4],[3.5,next-1,.4]];
    else if(line.feel==='makossa')shape=[[0,root,.3],[.75,fifth,.3],[1.5,third,.3],[2.25,root+12,.3],[3,fifth,.2],[3.25,next-2,.2],[3.5,next-1,.3]];
    else if(line.feel==='anthem')shape=[[0,root,1.7],[2,fifth,.7],[3,third,.2],[3.25,fifth,.2],[3.5,next-2,.2],[3.75,next-1,.2]];
    else if(line.feel==='drive')shape=[[0,root,.4],[.5,root+12,.4],[1,third,.4],[1.5,fifth,.4],[2,root+12,.7],[3,fifth,.2],[3.25,third,.2],[3.5,next+1,.3]];
    else if(line.feel==='pocket')shape=[[0,root,1.2],[1.5,fifth,.3],[2.5,third,.3],[3,next+2,.2],[3.25,next+1,.2],[3.5,next-1,.3]];
    else if(line.feel==='highlife')shape=[[0,root,.35],[.75,third,.2],[1.25,fifth,.35],[2,root+12,.35],[2.75,fifth,.35],[3.5,next,.35]];
    else if(line.feel==='reggae')shape=[[0,root,.6],[.75,root,.2],[1.5,fifth,.4],[2.5,root,.65],[3.5,third,.3]];
    else if(line.feel==='dub')shape=[[.5,root,1.1],[2,root,.4],[2.75,fifth,.35],[3.5,next,.3]];
    else if(line.feel==='gospel')shape=[[0,root,.8],[1,third,.65],[2,fifth,.65],[3,next-2,.35],[3.5,next-1,.35]];
    else if(line.feel==='praise')shape=[[0,root,.35],[.75,fifth,.35],[1.5,root+12,.35],[2,root,.65],[3,fifth,.35],[3.5,next-1,.35]];
    else if(line.feel==='lift')shape=[[0,root,1.2],[1.5,fifth,.35],[2,root+12,.8],[3.5,next,.35]];
    else shape=[[0,root,1.7],[2,fifth,.7],[3,third,.4],[3.5,next,.35]];
    shape.forEach(([b,n,l],i)=>add(offset+b,n,l,i===0?'landing':'bass'));
    chord(d).forEach(midi=>chords.push({midi,beat:offset,length:3.8,velocity:47,role:'chord'}));
   });
   if(Math.min(...bass.map(n=>n.midi))<23)for(const n of bass)n.midi+=12;
   return {kind,key,mode,idea,bpm,beats:line.degrees.length*4,bass,chords,source:line.source,title:line.name,tip:line.tip,heading:line.degrees.join('–')+' · '+line.degrees.map(chordName).join(' → ')};
  }
  idea=Math.min(runs.length-1,idea);const base=F.make({...opts,key,mode,idea:0}),source=base.source,target=base.target;
  const third=source+pc(degree(Number(opts.from||1)+1)-source),fifth=source+pc(degree(Number(opts.from||1)+3)-source);
  let ti=0;while(degree(ti)<target)ti++;while(degree(ti)>target)ti--;
  const pents=(mode==='major'?[0,2,4,7,9]:mode==='minor'?[0,3,5,7,10]:[0,1,2,4,5].map(i=>scale[i]));
  const pent=Array.from({length:72},(_,i)=>24+i).filter(n=>n>target&&pents.includes(pc(n-key))).slice(0,5).reverse();
  const shapes=[pent.concat([pent[0],pent[2],target+1]),[source+12,fifth,third,...[5,4,3,2,1,0].map(i=>degree(ti+i))],[4,2,3,2,0,1,0,-2].map(i=>degree(ti+i)),[target+2,target-1,target+1,target-2,target-1,target+1,target+12,target-1],[source,source+12,base.bass[1].midi,base.bass[1].midi+12,source+12,source+7,target+12,target+1],[source+5,source+6,source+7,source+10,source+7,source+6,target-2,target-1],[-7,-6,-5,-4,-3,-2,-1,0].map(i=>degree(ti+i)),[2,1,3,2,1,0,1,-1].map(i=>degree(ti+i))];
  shapes.push([source+12,fifth,third,source,...[-3,-2,-1,1].map(i=>degree(ti+i))], [0,2,3,1,4,2,1,0].map(i=>pent[i%pent.length]),[5,3,4,2,3,1,2,-1].map(i=>degree(ti+i)),[target+3,target+2,target-1,target+1,target+2,target-2,target+1,target-1],[source,source+12,third,third+12,fifth,source+12,target+2,target-1],[-3,-2,-1,0,1,2,3,4,3,2,1,-1].map(i=>degree(ti+i)),[5,4,3,4,2,3,1,-1].map(i=>degree(ti+i)),[-4,-2,-3,-1,0,2,1,-1].map(i=>degree(ti+i)));
  if(runs[idea].steps){const run=runs[idea],pentScale=mode==='major'?[0,2,4,7,9]:mode==='minor'?[0,3,5,7,10]:[0,1,2,4,5].map(i=>scale[i]);const pool=Array.from({length:100},(_,i)=>12+i).filter(n=>pentScale.includes(pc(n-key)));let anchor=pool.findIndex(n=>n>=target);shapes[idea]=run.steps.map(i=>run.type==='chromatic'?target+i:run.type==='pent'?pool[Math.max(0,Math.min(pool.length-1,anchor+i))]:degree(ti+i));}
  add(0,source,1.7);const notes=shapes[idea],step=2/notes.length;
  notes.forEach((n,i)=>add(2+i*step,n,step*.82));add(4,target,2.8,'landing');
  if(Math.min(...bass.map(n=>n.midi))<23)for(const n of bass)n.midi+=12;
  return {...base,kind,idea,bpm,bass,source:bass[0].midi,target:bass.at(-1).midi,title:runs[idea][0],tip:runs[idea][1],lesson:runs[idea].source,heading:base.from+' → '+base.to+' · '+base.fromChord+' → '+base.toChord};
 }
 return {make,modes,lines,runs};
})();

window.BassTransitionCore=(()=>{
 'use strict';
 const F=window.BassFillCore,pc=n=>(n%12+12)%12,valid=n=>n!==null&&n!==''&&Number.isFinite(Number(n));
 const scales={...F.scales,ionian:F.scales.major,aeolian:F.scales.minor,'harmonic minor':[0,2,3,5,7,8,11],'melodic minor':[0,2,3,5,7,9,11]};
 function keyContext(value){
  if(typeof value==='string'){
   const m=value.trim().replaceAll('♯','#').replaceAll('♭','b').match(/^([A-G])([#b]?)\s+(.*)$/i);if(!m)return null;
   const root=pc(({C:0,D:2,E:4,F:5,G:7,A:9,B:11})[m[1].toUpperCase()]+(m[2]==='#'?1:m[2]==='b'?-1:0));
   return keyContext({rootPc:root,mode:m[3]});
  }
  if(!value||!valid(value.rootPc))return keyContext(value?.scaleText||'');
  const mode=String(value.mode||'').toLowerCase().replace(/natural[ -]?minor/,'minor');
  if(!scales[mode])return null;return {root:pc(Number(value.rootPc)),mode,scale:scales[mode]};
 }
 function degree(root,ctx){
  if(!ctx)return '?';const semitone=pc(root-ctx.root),major=[0,2,4,5,7,9,11];
  const i=ctx.scale.indexOf(semitone);if(i>=0)return (ctx.scale[i]===major[i]?'':ctx.scale[i]<major[i]?'♭':'♯')+(i+1);
  const above=major.findIndex(n=>n===semitone+1);return above>=0?'♭'+(above+1):'♯'+(major.indexOf(semitone-1)+1);
 }
 function extract(project,meta={}){
  const a=project?.analysis||{},duration=Number(project?.source?.duration)||Infinity;
  const notes=(Array.isArray(a.notes)?a.notes:[]).filter(n=>valid(n.start)&&valid(n.end)&&valid(n.midi)&&Number(n.start)>=0&&Number(n.end)>Number(n.start)&&Number(n.midi)>=23&&Number(n.midi)<=88).map(n=>({...n,start:Number(n.start),end:Math.min(Number(n.end),duration),midi:Math.round(Number(n.midi))})).filter(n=>n.end>n.start).sort((x,y)=>x.start-y.start);
  const raw=(Array.isArray(a.chords)?a.chords:[]).filter(c=>valid(c.start)&&valid(c.end)&&valid(c.rootPc)&&Number(c.start)>=0&&Number(c.end)>Number(c.start)&&Number(c.rootPc)>=0&&Number(c.rootPc)<12).map(c=>({...c,start:Number(c.start),end:Math.min(Number(c.end),duration),rootPc:Number(c.rootPc)})).filter(c=>c.end>c.start).sort((x,y)=>x.start-y.start);
  const chords=[];for(const c of raw){const p=chords.at(-1);if(p&&p.rootPc===c.rootPc&&p.quality===c.quality&&c.start<=p.end+.1)p.end=Math.max(p.end,c.end);else chords.push({...c});}
  if(!notes.length||chords.length<2)return {items:[],reason:!notes.length?'No bass notes':'No chord changes'};
  const bpm=valid(a.tempoBpm)&&Number(a.tempoBpm)>=30&&Number(a.tempoBpm)<=240?Number(a.tempoBpm):null,beat=bpm?60/bpm:.75;
  const base=keyContext(a.baseScale)||keyContext(a.scale),keyAt=t=>{const correction=(a.keyCorrections||[]).find(s=>t>=s.start&&t<s.end),section=(a.keySections||[]).find(s=>t>=s.start&&t<s.end);return keyContext(correction)||keyContext(section?.scale)||base;};
  const items=[];let first=0;
  for(let i=1;i<chords.length;i++){
   const before=chords[i-1],after=chords[i],change=after.start;if(before.rootPc===after.rootPc||change-before.end>.25||before.end>change+.25||after.end-change<.15)continue;
   const start=Math.max(before.start,change-Math.min(12,beat*8)),end=Math.min(after.end,change+beat*1.5,duration);
   while(first<notes.length&&notes[first].end<=start)first++;
   const slice=[];for(let j=first;j<notes.length&&notes[j].start<end;j++){const n=notes[j];if(n.end>start)slice.push({midi:n.midi,start:Math.max(start,n.start),end:Math.min(end,n.end),confidence:n.confidence,manual:!!n.manual,isFill:!!n.isFill});}
   const lead=slice.filter(n=>n.start<change-.02);if(!qualifies({notes:slice,change})||slice.length>96)continue;
   const ctx=keyAt(change+.01),oldKey=keyAt(Math.max(before.start,change-.01)),modulates=!!ctx&&!!oldKey&&(ctx.root!==oldKey.root||ctx.mode!==oldKey.mode);
   const from=modulates?'?':degree(before.rootPc,ctx),to=degree(after.rootPc,ctx),label=c=>c.label||F.names[c.rootPc]+({minor:'m',min:'m',dim:'dim',diminished:'dim',aug:'aug',sus2:'sus2',sus4:'sus4','7':'7',maj7:'maj7',min7:'m7','6':'6',min6:'m6',add9:'add9',minadd9:'madd9','9':'9',maj9:'maj9',min9:'m9','11':'11',min11:'m11','13':'13',min13:'m13','7sus4':'7sus4',dim7:'dim7',min7b5:'m7♭5','7b9':'7♭9','7#9':'7♯9'}[c.quality]||'');
   const check=before.uncertain||after.uncertain||[before,after,...slice].some(n=>!n.manual&&valid(n.confidence)&&Number(n.confidence)<.55);
   const sections=project.settings?.sections||{},section=Object.entries(sections).find(([,s])=>change>=s?.start&&change<s?.end)?.[0]||(a.structure?.segments||[]).find(s=>change>=s.start&&change<s.end)?.label||'';
   items.push({id:meta.id+':'+Math.round(change*1000),songId:meta.id,title:meta.title||project.projectName||'Song',filename:meta.filename,stamp:meta.stamp,change,start,end,bpm,from,to,fromChord:label(before),toChord:label(after),key:ctx?F.names[ctx.root]+' '+ctx.mode:'Key unknown',modulates,section,check:!!check,notes:slice});
  }
  return {items,reason:items.length?'':'No moving fills found'};
 }
 function qualifies(item){const lead=(item.notes||[]).filter(n=>n.start<item.change-.02);const moving=lead.filter((n,i)=>!i||n.midi!==lead[i-1].midi);return moving.length>=3&&new Set(moving.map(n=>n.midi)).size>=3;}
 function plan(item,speed=100){
  const bpm=item.bpm||80,beat=60/bpm;
  return {kind:'library',bpm:bpm*speed/100,beats:(item.end-item.start)/beat,bass:item.notes.map(n=>({midi:n.midi,beat:(n.start-item.start)/beat,length:(n.end-n.start)/beat,velocity:85,role:n.start>=item.change?'landing':'bass'})),chords:[],title:item.title,heading:item.from+' → '+item.to+' · '+item.fromChord+' → '+item.toChord,tip:'Detected notes · '+item.key+(item.check?' · Check against the original':''),item};
 }
 return {extract,plan,keyContext,degree,qualifies};
})();
