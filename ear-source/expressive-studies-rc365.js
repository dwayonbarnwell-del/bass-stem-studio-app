/* Original chord-connection studies. Technique references are teaching sources,
 * not artist transcriptions or endorsements. Recorded performances stay intact. */
window.BassExpressiveStudies=(()=>{
 'use strict';
 const P=window.BassPracticeCore,F=window.BassFillCore,Q=window.BassCuratedStudies,G=window.BassStudyGroups,H=window.BassAccompaniment;
 const pc=n=>(n%12+12)%12,clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),originalMake=P.make;
 const refs={
  pocket:{label:'Technique reference · Ryan Madora: rhythm, chord tones and call/response',url:'https://www.notreble.com/buzz/2026/07/29/how-to-build-a-killer-bass-groove-with-only-two-chords/'},
  approach:{label:'Technique reference · Andrew Pouska: the fifth of the destination',url:'https://www.studybass.com/lessons/harmony/the-fifth-approach/'},
  enclosure:{label:'Technique reference · Mark Smith: single and double approaches',url:'https://www.talkingbass.net/using-double-approach-notes-in-your-bass-lines/'},
  jazz:{label:'Technique reference · Jon Burr: line construction and chord connections',url:'https://www.notreble.com/buzz/2010/01/11/lesson-basic-line-construction-types/'}
 };
 const designs={
  worship:{fills:[['Gentle fold','pent',[1.5,2,2.5,3,3.5,3.75],'p2 p4 p3 p1 t2 t-1'],['Grace reply','grace',[1.75,2,2.75,3.5,3.75],'g d3 d5 t2 t-1'],['Open door','fifth',[1.5,2.25,2.75,3.5,3.75],'d3 d5 d6 t2 t7'],['Soft answer','enclosure',[1.5,2,2.5,3,3.5,3.75],'d5 d6 d3 t2 t1 t-1']],runs:[['Pearl fall','pent',[1.5,1.75,2,2.25,2.75,3,3.5,3.75],'p7 p5 p6 p4 p3 p1 t2 t-1'],['Triplet sigh','triplet',[1.5,2,7/3,8/3,3,10/3,11/3],'d5 d8 d6 d5 d3 t2 t-1'],['Ninth arch','guide',[1.25,1.75,2,2.5,2.75,3.25,3.5,3.75],'d3 d9 d8 d6 d5 d3 t2 t-1'],['Upper reply','octave',[1.5,1.75,2,2.5,2.75,3.25,3.5,3.75],'d8 d5 d3 d10 d8 d6 t2 t-1']]},
  gospel:{fills:[['Blue grace','grace',[1.5,1.75,2,2.75,3.5,3.75],'g d3 d5 d6 t2 t-1'],['Amen turn','triplet',[1.5,2,7/3,8/3,3,10/3,11/3],'d3 d5 d8 d6 d5 t2 t-1'],['Fifth lift','fifth',[1,1.75,2.5,3,3.5,3.75],'d3 d8 d5 d6 t2 t7'],['Side door','enclosure',[1.5,2,2.5,3,3.25,3.5,3.75],'d3 d7 d9 d5 t2 t1 t-1']],runs:[['Sunday fall','pent',[1,1.5,1.75,2,2.5,2.75,3.25,3.5,3.75],'p7 p4 p6 p3 p5 p2 p1 t2 t-1'],['Rolling turn','triplet',[1,4/3,5/3,2,7/3,8/3,3,10/3,11/3],'d3 d5 d8 d9 d8 d6 d5 t2 t-1'],['Guide weave','guide',[1,1.5,1.75,2.25,2.5,2.75,3.25,3.5,3.75],'d7 d5 d3 d9 d8 d6 d5 t1 t-1'],['Octave call','octave',[1,1.75,2,2.25,2.75,3,3.5,3.75],'d8 d1 d5 d10 d8 d6 t2 t-1']]},
  rnb:{fills:[['Late pocket','pent',[1.75,2.25,2.5,3,3.5,3.75],'p2 p4 p2 p1 t2 t-1'],['Velvet touch','grace',[1.75,2,2.75,3.25,3.75],'g d3 d6 d5 t-1'],['Low answer','fifth',[1.5,2.25,2.75,3.5,3.75],'d5 d3 d6 t2 t7'],['Close curl','enclosure',[1.75,2.25,2.5,3,3.5,3.75],'d3 d5 d9 t2 t1 t-1']],runs:[['Silk pairs','pent',[1.25,1.75,2,2.25,2.75,3.25,3.5,3.75],'p6 p4 p5 p3 p4 p1 t2 t-1'],['Pocket three','triplet',[1.5,2,7/3,8/3,3,10/3,11/3],'d5 d3 d6 d9 d8 t2 t-1'],['Seventh arc','guide',[1.5,1.75,2.25,2.5,3,3.25,3.5,3.75],'d7 d5 d9 d6 d3 d5 t2 t-1'],['High whisper','octave',[1.25,1.75,2.25,2.5,2.75,3.25,3.5,3.75],'d8 d5 d10 d9 d6 d3 t2 t-1']]},
  soul:{fills:[['Warm echo','pent',[1.5,2.25,2.5,3,3.5,3.75],'p2 p2 p4 p1 t2 t-1'],['Third sigh','grace',[1.75,2,2.5,3.25,3.75],'g d3 d5 d6 t-1'],['Fifth bridge','fifth',[1.5,2,2.75,3.5,3.75],'d3 d6 d5 t2 t7'],['Small reply','enclosure',[1.5,2.25,2.5,3,3.5,3.75],'d5 d3 d6 t2 t1 t-1']],runs:[['Golden fold','pent',[1.5,1.75,2.25,2.5,2.75,3.25,3.5,3.75],'p6 p4 p3 p5 p3 p1 t2 t-1'],['Sunday sway','triplet',[1,5/3,2,7/3,8/3,3,10/3,11/3],'d3 d5 d6 d8 d6 d5 t2 t-1'],['Third thread','guide',[1.25,1.75,2,2.5,2.75,3.25,3.5,3.75],'d3 d7 d5 d9 d6 d3 t2 t-1'],['Octave echo','octave',[1.5,1.75,2,2.5,2.75,3.25,3.5,3.75],'d8 d5 d8 d10 d6 d3 t2 t-1']]},
  jazz:{fills:[['Ninth reply','guide',[1.5,2,2.5,3,3.5,3.75],'d3 d7 d9 d5 t2 t-1'],['Blue brush','grace',[1.75,2,2.75,3.5,3.75],'g d3 d7 t2 t-1'],['Fifth pivot','fifth',[1.5,2.25,2.75,3.5,3.75],'d7 d3 d5 t2 t7'],['Double door','enclosure',[1,5/3,2,8/3,3,3.5,3.75],'d3 d7 d9 d5 t2 t1 t-1']],runs:[['Broken ninth','pent',[1,1.5,1.75,2.25,2.5,2.75,3.25,3.5,3.75],'p6 p4 p7 p5 p3 p4 p1 t2 t-1'],['Three by two','triplet',[1,4/3,5/3,2,7/3,8/3,3,10/3,11/3],'d3 d7 d9 d10 d8 d6 d5 t2 t-1'],['Seventh path','guide',[1,1.5,2,2.25,2.75,3,3.5,3.75],'d7 d3 d9 d5 d6 d3 t1 t-1'],['Wide answer','octave',[1,1.75,2,2.5,2.75,3.25,3.5,3.75],'d8 d3 d10 d5 d9 d7 t2 t-1']]}
 };
 const tips={pent:'Sing the paired shape; leave its gaps open and settle on the next root.',grace:'Brush into the chord third softly; let the following chord tones speak.',fifth:'Aim the last weak pickup at the fifth of the NEXT chord, then land on its bass.',enclosure:'Keep the chromatic neighbours short and quiet; the destination releases them.',triplet:'Feel three equal notes inside the beat; keep the root steady and soften the answer.',guide:'Connect chord colours as a melody. The actual chord quality decides the third and seventh.',octave:'Let the upper register answer the low root; return without rushing the destination.'};
 const entries=[];
 for(const [style,sets] of Object.entries(designs))for(const kind of ['fills','runs'])for(const [i,[title,technique,rhythm,tokens]]of sets[kind].entries()){
  const id='expressive365-'+kind+'-'+style+'-'+i,rhythmId=id+'-rhythm';Q.rhythms[rhythmId]=rhythm;
  entries.push(Q.register({id,kind,title,genre:style==='jazz'?'jazz':style==='soul'||style==='rnb'?'fusion':'contemporary',practiceStyle:style,mode:'major',rhythm:rhythmId,notes:tokens.replaceAll('g','s3'),tokens:tokens.split(' '),technique,tip:tips[technique],source:refs[technique==='fifth'?'approach':technique==='enclosure'?'enclosure':style==='jazz'?'jazz':'pocket'],tier:0,rank:-300+i,expressive:true}));
 }
 for(const [style,label]of [['worship','Worship'],['rnb','R&B'],['soul','Soul']])if(!G.groups.some(([id])=>id===style))G.groups.push([style,label]);
 const beds={worship:['Prayer bed','Open chorus'],gospel:['Church bed','Sunday pulse'],rnb:['Low pocket','Late answer'],soul:['Warm pocket','Steady home'],jazz:['Two bar walk','Guide loop']};
 for(const [style,sets]of Object.entries(designs))for(let i=0;i<2;i++)P.lines.push({id:'expressive365-basslines-'+style+'-'+i,name:beds[style][i],displayName:beds[style][i],degrees:i?[1,6,2,5]:[1,4,5,4],feel:style,practiceStyle:style,expressive:true,rank:-300+i,variant:i,tip:'Keep the low motif consistent; add the shaped answer at the end of the phrase.'});
 function styleOf(kind,idea){
  const row=kind==='basslines'?P.lines[idea]:(kind==='runs'?P.runs:F.styles)[idea],entry=Q.get(kind,idea);
  if(!row||entry?.recordedStudy||entry?.culturalStyle||kind!=='basslines'&&G.isCultural(kind,idea))return null;
  if(designs[entry?.practiceStyle||row.practiceStyle])return entry?.practiceStyle||row.practiceStyle;
  if(kind==='basslines'){const style=H.category(row);return designs[style]?style:null;}
  if(entry?.genre==='contemporary')return /worship|prayer/i.test(entry.title)?'worship':'gospel';
  if(entry?.genre==='jazz')return'jazz';if(entry?.genre==='pentatonic'||/soul/i.test(row[0]))return'soul';
  const style=H.identify({title:row[0]});return designs[style]?style:null;
 }
 function handles(entry){return !!entry&&!entry.recordedStudy&&!!styleOf(entry.kind,entry.index);}
 function intervals(q='maj'){
  q=q.toLowerCase();const minor=/^(min|minor|m(?!aj))|dim/.test(q),third=/sus2/.test(q)?2:/sus/.test(q)?5:minor?3:4,fifth=/dim|m7b5|min7b5/.test(q)?6:/aug/.test(q)?8:7;
  return {third,fifth,seventh:/dim7/.test(q)?9:/maj7|major7|maj9|maj13/.test(q)?11:minor||/7|9|11|13/.test(q)?10:11,minor};
 }
 function degreeChord(degree,key,mode,extended=false){const scale=F.scales[mode]||F.scales.major,d=degree-1,third=(scale[(d+2)%7]+12*Math.floor((d+2)/7))-scale[d],fifth=(scale[(d+4)%7]+12*Math.floor((d+4)/7))-scale[d],seventh=(scale[(d+6)%7]+12*Math.floor((d+6)/7))-scale[d];return {rootPc:pc(key+scale[d]),quality:extended?(fifth===6?'min7b5':third===3?'min7':seventh===11?'maj7':'dom7'):(fifth===6?'dim':third===3?'min':'maj')};}
 function nearest(pitch,reference=36,low=23,high=59){let best=null,cost=Infinity;for(let n=low;n<=high;n++)if(pc(n)===pc(pitch)){const c=Math.abs(n-reference);if(c<cost){cost=c;best=n;}}return best;}
 function pool(chord,key,scale){const info=intervals(chord.quality),values=new Set(scale?scale.map(n=>pc(key+n)):[0,2,info.third,5,info.fifth,info.minor?8:9,info.seventh].map(n=>pc(chord.rootPc+n)));for(const n of [0,info.third,info.fifth,.../7|9|11|13/.test(chord.quality)?[info.seventh]:[]])values.add(pc(chord.rootPc+n));if(/sus/.test(chord.quality)){values.delete(pc(chord.rootPc+3));values.delete(pc(chord.rootPc+4));}else values.delete(pc(chord.rootPc+(info.minor?4:3)));return values;}
 function phrase(entry,{from,to,key=0,mode='major',bpm=80,variant=0,keyKnown=true}){
  const style=entry.practiceStyle||styleOf(entry.kind,entry.index)||'gospel',tokens=entry.tokens||entry.notes,rhythm=Q.rhythms[entry.rhythm],scale=keyKnown?(F.scales[mode]||F.scales.major):null,info=intervals(from.quality),origin=nearest(from.bassPc??from.rootPc,35),target=nearest(to.bassPc??to.rootPc,origin+((pc(to.rootPc-from.rootPc)+6)%12-6));
  const rootIndex=scale?.indexOf(pc(from.rootPc-key))??-1,local=[0,2,info.third,5,info.fifth,info.minor?8:9,info.seventh],offset=d=>d===3?info.third:d===5?info.fifth:d===7&&/7|9|11|13/.test(from.quality)?info.seventh:rootIndex>=0?scale[(rootIndex+d-1)%7]+12*Math.floor((rootIndex+d-1)/7)-scale[rootIndex]:local[d-1];
  const quality=window.BassRehearsalHarmony,tones=quality?.chordTones(from)||new Set([0,info.third,info.fifth].map(n=>pc(from.rootPc+n))),allowed=pool(from,key,scale),pent=(info.minor?[1,3,4,5,7]:[1,2,3,5,6]).map(offset);
  const baseRoot=nearest(from.rootPc,origin),diatonic=n=>baseRoot+offset((n-1)%7+1)+12*Math.floor((n-1)/7);
  const notes=[{midi:origin,beat:0,length:Math.max(.1,Math.min(1.4,rhythm[0]-.14)),velocity:96,role:'bass',articulation:'held'}];
  for(const [i,token]of tokens.entries()){
   const number=Number(token.slice(1)),at=rhythm[i],next=rhythm[i+1]??4,gap=next-at;
   let wanted=token==='g'?diatonic(3)-1:token[0]==='d'?diatonic(number):token[0]==='t'?target+number:token[0]==='p'?baseRoot+pent[(number%5+5)%5]+12*Math.floor(number/5):baseRoot+number;
   const strong=Math.abs(at-Math.round(at))<.06,late=at>=3.5,approach=token[0]==='t'&&late;
   const choices=strong?tones:allowed;
   // Brief prepared neighbours and the V approach retain their intended pull.
   const chromatic=token==='g'||approach;
   let midi=nearest(wanted,wanted);if(!chromatic||strong){let cost=Infinity,chosen=midi;for(let n=23;n<=59;n++)if(choices.has(pc(n))){const c=Math.abs(n-wanted)+Math.max(0,Math.abs(n-notes.at(-1).midi)-12)*2;if(c<cost){cost=c;chosen=n;}}midi=chosen;}
   if(Math.abs(midi-notes.at(-1).midi)>12)midi=nearest(midi,notes.at(-1).midi);
   const touch=[.88,.64,.94,.7,.82,.62][(i+variant)%6],legato=i&&Math.abs(midi-notes.at(-1).midi)<=2&&i%3===1&&!approach;
   const offset=!strong&&['rnb','soul'].includes(style)&&!chromatic?Math.min(.012*bpm/60,gap*.05):0;
   const velocity=Math.round(clamp((i===0?85:i===Math.floor(tokens.length/2)?91:79)-(i>=tokens.length-2?9:0)-(token==='g'?17:0)+(variant%2?2:0),45,96));
   const note={midi,beat:at+offset,length:Math.max(.035,Math.min(gap-offset-.012,gap*(legato?.95:touch))),velocity,role:'bass',articulation:legato?'legato':'detached'};
   if(entry.expressive&&legato&&['rnb','soul'].includes(style)&&Math.abs(midi-notes.at(-1).midi)===2){note.slideFrom=notes.at(-1).midi;note.slideSeconds=.045;}
   notes.push(note);
  }
  notes.push({midi:target,beat:4,length:2.8,velocity:99,role:'landing',articulation:'held'});
  return {notes,origin,target,style};
 }
 function shapeEntry(plan){return plan.curated||{kind:plan.kind,index:plan.idea,practiceStyle:styleOf(plan.kind,plan.idea),rhythm:'expressive365-legacy-'+plan.kind+'-'+plan.idea,notes:[],tokens:[],technique:'pent'};}
 function make(kind,opts={}){
  const idea=Math.max(0,Math.round(Number(opts.idea)||0)),style=styleOf(kind,idea);
  if(!style)return originalMake(kind,opts);
  if(kind==='basslines')return bassline(originalMake(kind,opts),style);
  const entry=Q.get(kind,idea),plan=entry?Q.make(kind,opts):originalMake(kind,opts),e=shapeEntry(plan);
  if(!entry){const design=designs[style][kind][idea%4];e.tokens=design[3].split(' ');Q.rhythms[e.rhythm]=design[2];e.technique=design[1];}
  const from=degreeChord(plan.from,plan.key,plan.mode,e.genre==='jazz'),to=degreeChord(plan.to,plan.key,plan.mode,e.genre==='jazz'),built=phrase(e,{from,to,key:plan.key,mode:plan.mode,bpm:plan.bpm,variant:idea});
  return {...plan,bass:built.notes,source:built.origin,target:built.target,practiceStyle:style,expressive:true,technique:e.technique||'authored',tip:e.tip||plan.tip};
 }
 const pockets={
  worship:[[[0,1.42,'r',94],[1.75,.27,'5',73],[2.5,.74,'r',83]],[[0,.95,'r',94],[1.5,.28,'r',72],[2.75,.44,'5',80],[3.5,.27,'r',69]]],
  gospel:[[[0,.85,'r',96],[1.5,.35,'5',76],[2.25,.5,'r',88],[3.25,.22,'6',72],[3.5,.22,'5',77]],[[0,.72,'r',96],[.75,.2,'8',70],[1.75,.38,'5',80],[2.5,.58,'r',87],[3.5,.26,'5',73]]],
  rnb:[[[0,.65,'r',94],[.875,.1,'r',65],[1.75,.2,'8',74],[2.5,.32,'5',83],[3.25,.42,'r',77]],[[0,.98,'r',94],[1.75,.22,'5',73],[2.25,.35,'8',82],[3.5,.26,'r',72]]],
  soul:[[[0,.6,'r',95],[1.5,.3,'5',77],[2.25,.33,'8',85],[3.5,.25,'r',73]],[[0,.9,'r',95],[1.25,.32,'3',76],[2,.62,'5',86],[3.25,.42,'r',74]]],
  jazz:[[[0,.8,'r',94],[1,.78,'3',79],[2,.8,'5',85],[3,.72,'7',76]],[[0,.8,'r',94],[1,.76,'5',80],[2,.78,'3',85],[3,.7,'7',76]]]
 };
 function pocket(style,from,variant=0){
  const info=intervals(from.quality),root=nearest(from.bassPc??from.rootPc,35),chordRoot=nearest(from.rootPc,root),offsets={'3':info.third,'5':info.fifth,'6':9,'7':info.seventh,'8':12};
  return pockets[style][variant%2].map(([beat,length,tone,velocity],i)=>({beat,length,midi:tone==='r'?root:nearest(chordRoot+offsets[tone],chordRoot+offsets[tone]),velocity,role:i===0?'landing':'bass',articulation:'detached'}));
 }
 function bassline(plan,style){
  const bass=[],degrees=plan.degrees,variant=P.lines[plan.idea]?.variant??plan.idea%2;
  for(const [i,d]of degrees.entries()){
   const from=degreeChord(d,plan.key,plan.mode,style==='jazz'),to=degreeChord(degrees[(i+1)%degrees.length],plan.key,plan.mode,style==='jazz'),entry=entries.find(e=>e.kind==='fills'&&e.practiceStyle===style&&e.technique===(variant?'fifth':style==='jazz'?'guide':style==='gospel'?'grace':'pent'));
   const built=phrase(entry,{from,to,key:plan.key,mode:plan.mode,bpm:plan.bpm,variant:i+variant});
   const isAnswer=i%2===1||i===degrees.length-1;
   const phraseNotes=isAnswer?built.notes.filter(n=>n.beat<4):pocket(style,from,variant);
   phraseNotes.forEach((n,j)=>bass.push({...n,beat:n.beat+i*4,role:j===0?'landing':n.role}));
  }
  return {...plan,bass,practiceStyle:style,expressive:true};
 }
 function basslineShape(line,idea){
  const style=styleOf('basslines',idea);if(!style)return null;
  return pocket(style,{rootPc:0,quality:'maj'},line.variant??idea%2).map(n=>({...n,semitones:n.midi-36,role:n.midi===36?'root':'passing'}));
 }
 function rehearsalBassline(clip,choice){
  if(choice?.kind!=='basslines'||choice.recorded)return null;
  const idea=P.lines.findIndex(line=>line.id===choice.sourceId),style=styleOf('basslines',idea);if(!style||!clip.grid)return null;
  const M=window.BassRehearsalHarmony,{points,meter}=clip.grid,variant=P.lines[idea].variant??idea%2,out=[];
  const timeAt=b=>{const i=clamp(Math.floor(b),0,points.length-2);return points[i]+(b-i)*(points[i+1]-points[i]);};
  for(const chord of M.prepare(clip).segments){
   if(chord.rootOnly||chord.uncertain&&!chord.manual||/unknown|none|^n$/i.test(chord.quality||''))continue;
   const start=M.beat(clip,chord.start),end=M.beat(clip,chord.end);
   for(let bar=start;bar<end;bar+=meter)for(const note of pocket(style,chord,variant)){
    const at=bar+note.beat*meter/4;if(at>=end-.0001)continue;
    const time=timeAt(at),quiet=(clip.quiet||[]).find(r=>r.end>time&&r.start<timeAt(Math.min(end,at+note.length*meter/4)));
    if(quiet&&quiet.start<=time)continue;
    const stop=Math.min(chord.end,clip.end,timeAt(Math.min(end,at+note.length*meter/4)),quiet?.start??Infinity);
    if(stop-time>=.032)out.push({...note,time,stop,adapted:true,chordNumber:chord.number,chordName:chord.name});
   }
  }
  return out;
 }
 function rehearsalStudy(entry,change,clip){
  if(!handles(entry))return null;
  const p=window.BassRehearsalHarmony.prepare(clip),key=p.key?.tonic??0,mode=p.key?.mode||'major';
  const built=phrase(entry,{from:change.from,to:change.to,key,mode,keyKnown:!!p.key,bpm:clip.grid.bpm,variant:entry.index});
  return {interval:built.target-built.origin,events:built.notes.map(n=>({...n,offset:n.midi-built.origin,slideOffset:n.slideFrom==null?undefined:n.slideFrom-built.origin,confidence:1})),expressive:true,technique:entry.technique||'authored'};
 }
 P.make=make;
 return {entries,refs,designs,styleOf,handles,phrase,rehearsalStudy,basslineShape,rehearsalBassline,make};
})();
