/* RC257: original, deterministic ear-training exercises. No song analysis or paid API. */
window.BassEarTrainingCore=(()=>{
 'use strict';
 const modes=['notes','intervals','chords','progressions','rhythm'];
 const names=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
 const note=m=>names[((m%12)+12)%12]+(Math.floor(m/12)-1);
 const intervals=['Unison','Minor 2nd','Major 2nd','Minor 3rd','Major 3rd','Perfect 4th','Tritone','Perfect 5th','Minor 6th','Major 6th','Minor 7th','Major 7th','Octave'];
 const qualities=[['Major',[0,4,7]],['Minor',[0,3,7]],['Diminished',[0,3,6]],['Augmented',[0,4,8]],['Sus2',[0,2,7]],['Sus4',[0,5,7]],['Dominant 7th',[0,4,7,10]],['Major 7th',[0,4,7,11]],['Minor 7th',[0,3,7,10]],['Half-diminished 7th',[0,3,6,10]]];
 const progressions=[[1,4,5,1],[1,5,6,4],[6,4,1,5],[1,6,4,5],[2,5,1,1],[1,4,1,5],[4,1,5,6],[1,5,4,1],[6,2,5,1],[3,6,2,5],[4,5,3,6],[1,3,4,5]];
 const rhythmSets=[[[0,1,2,3],[0,.5,1,2,3],[0,1,1.5,2,3],[0,1,2,2.5,3]],[[0,.5,1.5,2,3],[0,1,1.5,2.5,3.5],[0,.5,1,2.5,3],[0,.5,1.5,2.5,3.5]],[[0,.75,1.5,2.5,3.25],[0,.5,1.25,2,2.75,3.5],[0,.75,1.75,2.5,3.5],[0,.25,1,1.75,2.75,3.5]]];
 const maxLevel=5;
 const compoundIntervals=['Minor 9th','Major 9th','Minor 10th','Major 10th','Perfect 11th','Augmented 11th','Perfect 12th','Minor 13th','Major 13th','Minor 14th','Major 14th','Double octave'];
 const extendedQualities=[['Major 6th',[0,4,7,9]],['Minor 6th',[0,3,7,9]],['Diminished 7th',[0,3,6,9]],['Dominant 9th',[0,4,7,10,14]],['Major 9th',[0,4,7,11,14]],['Minor 9th',[0,3,7,10,14]],['Dominant 7th sus4',[0,5,7,10]]];
 const advancedProgressions=[[1,3,6,4],[1,2,5,1],[4,5,6,3],[6,5,4,1],[2,4,5,1],[1,7,6,5],[3,4,2,5],[6,7,1,5]];
 const longProgressions=[[1,3,6,2,5,1],[1,5,6,4,2,5],[6,4,1,5,2,5],[1,6,2,5,4,1],[4,3,6,2,5,1],[1,4,7,3,6,5],[2,5,1,6,4,5],[6,2,5,1,4,5]];
 rhythmSets.push([[0,1/3,2/3,1.5,2,8/3,3.5],[0,.25,1,1.5,2.25,3,3.75],[0,.75,1,5/3,2,3,10/3],[0,.5,1.25,1.75,2.5,3.25,3.75]],[[0,.5,4/3,2,2.75,3.5,4,4.75,5.5,19/3,7],[0,.25,1,5/3,2.5,3.25,4,4.5,5.25,6,7.5],[0,2/3,1.5,2.25,3,11/3,4.5,5,5.75,6.5,7.25],[0,.75,1.25,2,8/3,3.5,4.25,5,17/3,6.75,7.5]]);
 const clampLevel=v=>Math.max(1,Math.min(maxLevel,Math.round(Number(v)||1)));
 const pick=(a,rng)=>a[Math.min(a.length-1,Math.floor(rng()*a.length))];
 function shuffle(a,rng){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.min(i,Math.floor(rng()*(i+1)));[a[i],a[j]]=[a[j],a[i]];}return a;}
 function choices(answer,all,rng,count=4){return shuffle([answer,...shuffle([...new Set(all)].filter(x=>x!==answer),rng).slice(0,count-1)],rng);}
 function event(midi,start,length=.65,velocity=80){return {midi,start,end:start+length,velocity};}
 function make(mode,level=1,{rng=Math.random,sound='piano',previous='',recent=[]}={}){
  if(!modes.includes(mode))mode='notes';level=clampLevel(level);
  let q;
  for(let attempt=0;attempt<64;attempt++){
   const bass=sound==='bass',base=bass?(['chords','progressions'].includes(mode)?48:36):60;
   q={mode,level,sound:bass?'bass':'piano',events:[],answer:null,options:[],key:'',explanation:'',prompt:''};
   if(mode==='notes'){
    const tonic=base,pool=(level===1?[0,2,4,7,9]:level===2?[0,2,4,5,7,9,11]:Array.from({length:12},(_,i)=>i)).map(n=>tonic+n),count=level+1;
    const result=[pick(pool,rng)];while(result.length<count){const candidate=pick(pool.filter(n=>n!==result.at(-1)),rng);result.push(candidate);}
    const spacing=level<=3?.9:level===4?.75:.6;
    q.answer=result;q.keyboard=Array.from({length:12},(_,i)=>tonic+i);q.events=result.map((m,i)=>event(m,i*spacing,Math.min(.65,spacing-.1)));q.prompt='First note: '+note(result[0])+'. Repeat all '+count+' notes.';q.explanation=result.map(note).join(' → ');q.key=result.slice(1).map((m,i)=>m-result[i]).join(',');
   }else if(mode==='intervals'){
    const pool=level===1?[2,4,5,7]:level===2?[1,2,3,4,5,7,8,9,12]:Array.from({length:12},(_,i)=>i+(level===5?13:1)),gap=pick(pool,rng),root=base+(level===5?12:0)+pick(level>=4?Array.from({length:12},(_,i)=>i):[0,2,4,5,7],rng),direction=level>=3&&rng()<.5?-1:1,harmonic=level>=3&&rng()<(level>=4?.6:.35);
    const label=n=>n<=12?intervals[n]:compoundIntervals[n-13],other=root+gap*direction;q.answer=label(gap);q.options=choices(q.answer,pool.map(label),rng,level>=4?6:4);q.events=[event(root,0,.8),event(other,harmonic?0:1,.8)];q.prompt=harmonic?'Name the interval heard together.':'Name the distance between the notes.';q.explanation=note(root)+' to '+note(other)+': '+q.answer+' ('+gap+' semitones).';q.key=String(gap);
   }else if(mode==='chords'){
    const pool=level===1?qualities.slice(0,2):level===2?qualities.slice(0,6):level===3?qualities.slice(6):level===4?qualities:[...qualities,...extendedQualities],quality=pick(pool,rng),root=base+pick(level===1?[0,5,7]:level<=3?[0,2,3,5,7,9,10]:Array.from({length:12},(_,i)=>i),rng);let pitches=quality[1].map(n=>root+n);
    const inversion=level<=2?0:level===3?(rng()<.5?1:0):Math.floor(rng()*Math.min(3,pitches.length));
    for(let i=0;i<inversion;i++){const lowest=Math.min(...pitches),at=pitches.indexOf(lowest);pitches[at]+=12;}pitches.sort((a,b)=>a-b);
    q.answer=quality[0];q.options=choices(q.answer,pool.map(x=>x[0]),rng,level>=4?6:4);q.events=pitches.map(m=>event(m,0,1.4,76));q.prompt=(level>=4?'Root: '+names[root%12]+' · ':'')+'Which type of chord do you hear?';q.explanation=names[root%12]+' '+quality[0].toLowerCase()+': '+pitches.map(note).join(', ')+'.';q.key=q.answer;
   }else if(mode==='progressions'){
    const pool=level<=3?progressions.slice(0,level*4):level===4?[...progressions,...advancedProgressions]:longProgressions,degrees=pick(pool,rng),root=base+pick(level===1?[0,5,7]:Array.from({length:12},(_,i)=>i),rng),scale=[0,2,4,5,7,9,11],spacing=level<=3?1.35:level===4?1.15:1.05;
    const label=a=>a.join('–');q.answer=label(degrees);q.options=choices(q.answer,pool.map(label),rng,level>=4?6:4);
    // The home chord is available separately; it is never prepended to the question.
    q.reference=[0,4,7].map(n=>event(root+n,0,.8,68));
    degrees.forEach((d,i)=>{const n=d-1,triad=[0,2,4].map(k=>root+scale[(n+k)%7]+12*Math.floor((n+k)/7));if(level>=4){const inversion=Math.floor(rng()*3);for(let j=0;j<inversion;j++)triad[j]+=12;triad.sort((a,b)=>a-b);}q.events.push(event(root+scale[n]-12,i*spacing,Math.min(1.05,spacing-.1),70),...triad.map(m=>event(m,i*spacing,Math.min(1.05,spacing-.1),76)));});
    q.prompt=names[root%12]+' major · Identify the '+(degrees.length===4?'four':'six')+' chords.';q.explanation=q.answer+' · '+degrees.map(d=>names[(root+scale[d-1])%12]+([2,3,6].includes(d)?'m':d===7?'dim':'')).join(' → ');q.tonic=root;q.degrees=[...degrees];q.key=q.answer;
   }else{
    q.beats=pick(rhythmSets[level-1],rng);q.barBeats=level===5?8:4;q.bpm=[72,84,96,100,108][level-1];q.answer=q.beats.map(b=>b*60/q.bpm);q.prompt='Listen, then tap the rhythm. Your first tap sets the start.';q.explanation='Rhythm: '+q.beats.map(b=>String(Number((b+1).toFixed(2)))).join(' · ')+' beats, at '+q.bpm+' BPM.';q.key=q.beats.join(',');
   }
   // Avoid identical examples, without making major/minor answers alternate predictably.
   q.key=[mode,level,q.sound,mode==='rhythm'?q.beats.join(','):q.events.map(n=>n.midi+'@'+n.start).join(',')].join('|');
   if(q.key!==previous&&!recent.includes(q.key))break;
  }
  return q;
 }
 function rhythmScore(expected,actual,level=1){
  if(!Array.isArray(actual)||actual.length!==expected.length||actual.length<2||actual.some((x,i)=>!Number.isFinite(x)||(i&&x<=actual[i-1])))return {correct:false,accuracy:0,meanError:null,message:'Match all '+expected.length+' taps.'};
  const origin=actual[0],errors=expected.slice(1).map((t,i)=>Math.abs((actual[i+1]-origin)-(t-expected[0]))),tolerance=[.20,.15,.12,.10,.09][clampLevel(level)-1],mean=errors.reduce((a,b)=>a+b,0)/errors.length;
  const correct=errors.every(e=>e<=tolerance),accuracy=Math.max(0,Math.round(100*(1-mean/(tolerance*2))));return {correct,accuracy,meanError:mean,message:correct?'Rhythm matched.':'Listen again and keep the spacing between taps.'};
 }
 function grade(q,response){if(q.mode==='rhythm')return rhythmScore(q.answer,response,q.level);const correct=Array.isArray(q.answer)?Array.isArray(response)&&q.answer.length===response.length&&q.answer.every((n,i)=>n===response[i]):response===q.answer;return {correct,accuracy:correct?100:0};}
 function empty(){return {version:1,modes:{}};}
 function restore(raw){const out=empty();if(!raw||raw.version!==1)return out;for(const mode of modes){const s=raw.modes?.[mode];if(!s)continue;const total=Math.min(1000000,Math.max(0,Math.floor(Number(s.total)||0))),correct=Math.min(total,Math.max(0,Math.floor(Number(s.correct)||0)));out.modes[mode]={total,correct,rounds:Math.min(100000,Math.max(0,Math.floor(Number(s.rounds)||0))),level:clampLevel(s.level),recent:(Array.isArray(s.recent)?s.recent:[]).filter(x=>typeof x==='boolean').slice(-20)};}return out;}
 function record(progress,mode,correct,level){const p=restore(progress),s=p.modes[mode]??={total:0,correct:0,rounds:0,level:clampLevel(level),recent:[]};s.total++;if(correct)s.correct++;s.recent.push(!!correct);s.recent=s.recent.slice(-20);s.level=clampLevel(level);return p;}
 return {modes,note,intervals,qualities,progressions,make,grade,rhythmScore,restore,record,empty,clampLevel,maxLevel};
})();
