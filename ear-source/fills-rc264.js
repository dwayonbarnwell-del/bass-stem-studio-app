/* Original two-bar bass studies. Degrees follow the selected mode. Original practice patterns, not song transcriptions. */
window.BassFillCore=(()=>{
 'use strict';
 const names=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
 const scales={major:[0,2,4,5,7,9,11],minor:[0,2,3,5,7,8,10],dorian:[0,2,3,5,7,9,10],phrygian:[0,1,3,5,7,8,10],lydian:[0,2,4,6,7,9,11],mixolydian:[0,2,4,5,7,9,10],locrian:[0,1,3,5,6,8,10]};
 const styles=[
  ['Soul walk','A fifth, then a flowing scale approach.'],
  ['Octave lift','An octave jump with a late pickup.'],
  ['Gospel triplets','Six triplets curl around the landing note.'],
  ['Chromatic turn','Short outside notes resolve to the next root.'],
  ['Syncopated pocket','Space, offbeats and a sixteenth-note pickup.'],
  ['Broken-chord lift','Wide chord tones descend into the new root.'],
  ['Jazz fill','Swung chord tones and a chromatic enclosure.'],
  ['Blues fill','Blue notes and triplets resolve into the next root.'],
  ['Pentatonic fill','A five-note scale run between the two chord roots.'],
  ['Contemporary worship','Open fifths, an octave lift and a gentle pickup.'],
  ['Hinge connection','Pivot through a chord tone, then approach the new root.'],
  ['Gospel neighbour turn','Circle the next root with a quick turn.'],
  ['Modal climb','Climb through the selected mode towards the next root.'],
  ['Octave answer','Answer the low root in the upper register before landing.']
 ];
 const pc=m=>(m%12+12)%12, note=m=>names[pc(m)]+(Math.floor(m/12)-1);
 function make({key=0,mode='major',from=1,to=4,idea=0,bpm=80}={}){
  if(window.BassCuratedStudies?.get('fills',idea))return window.BassCuratedStudies.make('fills',{key,from,to,idea,bpm});
  key=pc(Math.round(Number(key)||0));mode=Object.hasOwn(scales,mode)?mode:'major';
  from=Math.max(1,Math.min(7,Math.round(Number(from)||1)));to=Math.max(1,Math.min(7,Math.round(Number(to)||4)));
  if(from===to)to=from%7+1;idea=Math.max(0,Math.min(styles.length-1,Math.round(Number(idea)||0)));bpm=Math.max(40,Math.min(220,Number(bpm)||80));
  const scale=scales[mode],tonic=36+key-(key+scale[from-1]>=12?12:0),degree=n=>tonic+scale[(n%7+7)%7]+12*Math.floor(n/7),source=degree(from-1);
  let targetIndex=to-1;
  while(degree(targetIndex)-source>6)targetIndex-=7;
  while(degree(targetIndex)-source< -6)targetIndex+=7;
  const target=degree(targetIndex),third=degree(from+1),fifth=degree(from+3),octave=source+12;
  const minorThird=third-source===3,blues=minorThird?[0,3,5,6,7,10]:[0,2,3,4,7,9];
  const pentatonic=mode==='major'?[0,2,4,7,9]:mode==='minor'?[0,3,5,7,10]:[0,1,2,4,5].map(i=>scale[i]);
  const shared=[source,third,fifth].find(n=>[0,2,4].some(i=>pc(n)===pc(degree(to-1+i))))??fifth;
  const pentRun=Array.from({length:72},(_,i)=>24+i).filter(m=>m>target&&pentatonic.includes(pc(m-tonic))).slice(0,4).reverse();
  const lines=[
   [[0,source,1.4],[1.5,fifth,.4],[2,degree(targetIndex-3),.4],[2.5,degree(targetIndex-2),.4],[3,degree(targetIndex-1),.85]],
   [[0,source,.8],[1.5,octave,.4],[2.25,fifth,.35],[2.75,third,.35],[3.25,source,.3],[3.75,target-1,.2]],
   [[0,source,1.4],[2,third,.27],[2+1/3,fifth,.27],[2+2/3,octave,.27],[3,target+2,.27],[3+1/3,target-1,.27],[3+2/3,target+1,.27]],
   [[0,source,1.2],[1.5,fifth,.6],[2.5,target+2,.2],[2.75,target+1,.2],[3.25,target-2,.2],[3.5,target-1,.4]],
   [[0,source,.6],[1.25,octave,.35],[2,third,.4],[2.75,fifth,.35],[3.25,degree(targetIndex-1),.35],[3.75,target-1,.2]],
   [[0,source,.8],[1,third+12,.4],[1.5,octave,.4],[2.25,fifth,.35],[2.75,third,.35],[3.25,target+2,.35],[3.75,target+1,.2]],
   [[0,source,.85],[1,third,.58],[1+2/3,fifth,.25],[2,target+2,.58],[2+2/3,target-1,.25],[3,target+1,.58],[3+2/3,target-1,.25]],
   [[0,source,.85],[1,source+blues[2],.27],[1+1/3,source+blues[3],.27],[1+2/3,source+blues[4],.27],[2,source+blues[5],.4],[2.5,source+blues[4],.4],[3,target-2,.4],[3.5,target-1,.4]],
   [[0,source,1.2],[1.5,pentRun[0],.4],[2,pentRun[1],.4],[2.5,pentRun[2],.4],[3,pentRun[3],.85]],
   [[0,source,1.35],[1.5,fifth,.4],[2,octave,.8],[3,degree(targetIndex-1),.4],[3.5,target,.35]],
   [[0,source,.85],[1,shared,.7],[2,shared+12,.4],[2.5,degree(targetIndex+1),.4],[3,target+1,.4],[3.5,target-1,.4]],
   [[0,source,1.7],[2,target+2,.2],[2.25,target-1,.2],[2.5,target+1,.2],[2.75,target,.2],[3,degree(targetIndex+2),.4],[3.5,degree(targetIndex+1),.4]],
   [[0,source,1.4],...[-4,-3,-2,-1].map((d,i)=>[2+i*.5,degree(targetIndex+d),.4])],
   [[0,source,.7],[1,octave,.7],[2,third+12,.4],[2.5,fifth,.4],[3,degree(targetIndex+2),.4],[3.5,degree(targetIndex+1),.4]]
  ];
  const bass=lines[idea].map(([beat,midi,length],i)=>({midi,beat,length,velocity:i===0?88:78+(i%3)*4,role:'bass'}));
  bass.push({midi:target,beat:4,length:2.9,velocity:94,role:'landing'});
  if(Math.min(...bass.map(n=>n.midi))<23)for(const n of bass)n.midi+=12;
  const triad=d=>[0,2,4].map(n=>degree(d-1+n)+24);
  const chordName=d=>{const notes=triad(d),a=notes[1]-notes[0],b=notes[2]-notes[0];return names[pc(notes[0])]+(b===6?'dim':b===8?'aug':a===3?'m':'');};
  const chords=[...triad(from).map(midi=>({midi,beat:0,length:3.7,velocity:48,role:'chord'})),...triad(to).map(midi=>({midi,beat:4,length:3.5,velocity:50,role:'chord'}))];
  return {kind:'fills',key,mode,from,to,idea,bpm,beats:8,source:bass[0].midi,target:bass.at(-1).midi,bass,chords,title:styles[idea][0],tip:styles[idea][1],fromChord:chordName(from),toChord:chordName(to)};
 }
 return {make,styles,names,scales,note};
})();

