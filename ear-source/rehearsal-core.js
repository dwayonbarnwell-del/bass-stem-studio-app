/* Fit study rhythms to the harmony and timing of a recorded passage. */
(function(root){
 'use strict';
 const styles=[
  ['auto','Suggested'],['roots','Roots'],['worship','Worship'],['gospel','Gospel'],
  ['praise','Praise'],['afrobeat','Afrobeat'],['highlife','Highlife'],['makossa','Makossa'],
  ['reggae','Reggae'],['soukous','Soukous']
 ];
 const pc=n=>(n%12+12)%12;
 const median=values=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.floor(sorted.length/2)]||0;};

 function samplesOf(buffer){
  const first=buffer.getChannelData(0);
  const second=buffer.numberOfChannels>1?buffer.getChannelData(1):first;
  return {first,second,rate:buffer.sampleRate};
 }

 function energyBins(buffer,start,end,step){
  const {first,second,rate}=samplesOf(buffer);
  const bins=new Float32Array(Math.ceil((end-start)/step));
  const stride=Math.max(1,Math.floor(rate/1000));
  for(let i=0;i<bins.length;i++){
   let energy=0,count=0;
   const from=Math.round((start+i*step)*rate),to=Math.min(first.length,Math.round((start+(i+1)*step)*rate));
   for(let j=from;j<to;j+=stride){
    energy+=(first[j]**2+second[j]**2)*.5;
    count++;
   }
   bins[i]=Math.sqrt(energy/Math.max(count,1));
  }
  return bins;
 }

 function quietRanges(buffer,start,end){
  const step=.25,bins=energyBins(buffer,start,end,step),reference=median(bins.filter(value=>value>.001));
  const floor=Math.max(.001,Math.min(.008,reference*.13)),quiet=[];
  let begin=-1;
  for(let i=0;i<=bins.length;i++){
   if(i<bins.length&&bins[i]<floor){if(begin<0)begin=i;continue;}
   if(begin>=0&&i-begin>=2)quiet.push({start:start+begin*step,end:Math.min(end,start+i*step)});
   begin=-1;
  }
  return quiet;
 }

 function passages(buffer){
  const bins=energyBins(buffer,0,buffer.duration,1);
  const reference=median(bins.filter(value=>value>.002));
  const floor=Math.max(.002,reference*.2),length=Math.min(buffer.duration,16);
  const candidates=[];
  for(let i=0;i+length<=buffer.duration+.001;i+=4){
   const region=bins.slice(i,Math.ceil(i+length));
   const active=region.filter(value=>value>=floor).length/region.length;
   if(active<.8)continue;
   // Stable loudness favours sustained playing over scattered remarks and long breaks.
   const typical=median(region);
   const stable=region.filter(value=>value>=typical*.4&&value<=typical*2.5).length/region.length;
   candidates.push({start:i,end:i+length,score:active*stable*Math.min(2,typical/Math.max(reference,.002))});
  }
  const picks=[];
  for(const candidate of candidates.sort((a,b)=>b.score-a.score||a.start-b.start)){
   if(picks.some(p=>candidate.start<p.end&&candidate.end>p.start))continue;
   picks.push(candidate);
   if(picks.length===8)break;
  }
  return picks.sort((a,b)=>a.start-b.start);
 }

 function pulse(buffer,start,end){
  const {first,second,rate}=samplesOf(buffer);
  const dt=.01,hop=Math.round(rate*dt),stride=Math.max(1,Math.floor(rate/4000));
  const frames=Math.floor((end-start)/dt),envelope=new Float32Array(frames);
  const alpha=1-Math.exp(-2*Math.PI*130*stride/rate);
  let low=0,previousWide=0,previousLow=0;
  for(let f=0;f<frames;f++){
   const offset=Math.round(start*rate)+f*hop;
   let wide=0,bass=0,count=0;
   for(let p=offset;p<Math.min(offset+hop,first.length);p+=stride){
    const value=(first[p]+second[p])*.5;
    low+=alpha*(value-low);
    bass+=low*low;wide+=(value-low)**2;count++;
   }
   wide=Math.log1p(60*Math.sqrt(wide/Math.max(1,count)));
   bass=Math.log1p(60*Math.sqrt(bass/Math.max(1,count)));
   envelope[f]=f?Math.max(0,bass-previousLow)*.65+Math.max(0,wide-previousWide)*.35:0;
   previousWide=wide;previousLow=bass;
  }
  const peaks=envelope.map((value,i)=>Math.max(value,envelope[i-1]||0,envelope[i+1]||0)*.7+value*.3);
  const mean=peaks.reduce((a,b)=>a+b,0)/Math.max(1,frames);
  if(frames<450||mean<.002)return null;
  function correlation(lag){
   let cross=0,left=0,right=0;
   for(let i=lag;i<frames;i++){
    const a=peaks[i]-mean,b=peaks[i-lag]-mean;
    cross+=a*b;left+=a*a;right+=b*b;
   }
   return cross/Math.sqrt(left*right||1);
  }
  const candidates=[];
  for(let lag=29;lag<=100;lag++){
   const score=correlation(lag);
   if(score>=correlation(lag-1)&&score>=correlation(lag+1)){
    const bpm=60/(lag*dt),extreme=bpm<72||bpm>150;
    candidates.push({lag,score,rank:score+.24*correlation(lag*2)+.14*correlation(lag*3)-(extreme?.045:0)});
   }
  }
  const best=candidates.sort((a,b)=>b.rank-a.rank)[0];
  if(!best||best.score<.26)return null;
  // A half-time candidate is preferable only when it has essentially the same evidence.
  const slower=candidates.find(c=>c.lag<=83&&Math.abs(c.lag-best.lag*2)<=2&&c.score>=best.score*.94&&c.rank>=best.rank*.89);
  const {lag,score}=slower||best,step=lag*dt;
  let phase=0,highest=0;
  for(let i=0;i<lag;i++){
   let sum=0,count=0;
   for(let j=i;j<frames;j+=lag){sum+=peaks[j];count++;}
   const value=sum/Math.max(1,count);
   if(value>highest){phase=i;highest=value;}
  }
  if(highest<mean*1.24)return null;
  return {step,bpm:60/step,anchor:start+phase*dt,confidence:score};
 }

 function beatGrid({start,end,beats=[],meter=4,phase=0,confidence=0,manualBpm=0,buffer}){
  const useSaved=confidence>=.55&&beats.length>=meter+1;
  if(!manualBpm&&useSaved){
   const points=beats.map((time,index)=>({time,index})).filter(b=>b.time>=start-.012&&b.time<=end+.012);
   const first=points.findIndex(b=>(b.index-phase)%meter===0);
   const last=points.findLastIndex(b=>(b.index-phase)%meter===0);
   const section=first>=0?points.slice(first,last+1):[];
   const spacings=section.slice(1).map((p,i)=>p.time-section[i].time);
   if(section.length>=meter+1&&spacings.every(s=>s>=.23&&s<=1.5)){
    return {points:section.map(p=>p.time),meter,bpm:60/median(spacings),source:'Recorded beats'};
   }
  }
  const grid=manualBpm>=40&&manualBpm<=220?{step:60/manualBpm,bpm:manualBpm,anchor:start}:buffer?pulse(buffer,start,end):null;
  if(!grid)return null;
  const bars=Math.floor((end-grid.anchor+.001)/(meter*grid.step));
  if(bars<1)return null;
  return {points:Array.from({length:bars*meter+1},(_,i)=>grid.anchor+i*grid.step),meter,bpm:grid.bpm,source:manualBpm?'Manual · first beat at start':'Estimated pulse · check the first beat'};
 }

 function suggest(chords,grid){
  if(!grid||!chords.length)return 'roots';
  const duration=median(chords.map(c=>c.end-c.start)),beatsPerChange=duration*grid.bpm/60;
  if(beatsPerChange>=3.5&&grid.bpm<=105)return 'worship';
  if(beatsPerChange>=2&&grid.bpm>=110)return 'praise';
  return 'roots';
 }

 function barChords(text,grid){
  const names=text.trim().split(/[\s,|]+/).filter(Boolean);
  if(!names.length)return [];
  if(!grid)throw Error('Set the BPM and start time to place your chords.');
  const {points,meter}=grid,root={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
  const pitch=(letter,accidental)=>pc(root[letter.toUpperCase()]+(accidental==='#'?1:accidental==='b'?-1:0));
  const qualities={m:'min',M:'maj',maj:'maj',min:'min',m7:'min7',maj7:'maj7',M7:'maj7','7':'7',sus2:'sus2',sus4:'sus4',dim:'dim',aug:'aug'};
  const progression=names.map(label=>{
   const m=label.replaceAll('♯','#').replaceAll('♭','b').match(/^([A-Ga-g])([#b]?)(m7|maj7|M7|maj|min|sus2|sus4|dim|aug|m|M|7)?(?:\/([A-Ga-g])([#b]?))?$/);
   if(!m)throw Error('Check the chord '+label+'. Use names like C, G/B or Am.');
   return {rootPc:pitch(m[1],m[2]),quality:qualities[m[3]]||'maj',bassPc:m[4]?pitch(m[4],m[5]):null,label,manual:true};
  });
  const result=[];
  for(let i=0;i<points.length-1;i+=meter)result.push({...progression[(i/meter)%progression.length],start:points[i],end:points[i+meter]});
  return result;
 }

 const safePitch=(pitch,reference=36)=>{
  let target=23+pc(pitch-23);
  for(let n=target+12;n<=47;n+=12)if(Math.abs(n-reference)<Math.abs(target-reference))target=n;
  return target;
 };

 function pattern(line,practice,idea){
  if(!line)return [];
  const plan=practice.make('basslines',{idea,key:0,bpm:120});
  const root=plan.chords[0]?.midi;
  if(!Number.isFinite(root))return [];
  const anchor=plan.bass.find(n=>n.beat<4&&pc(n.midi-root)===0)?.midi??root-12;
  const roles=new Map([[0,'root'],[3,'third'],[4,'third'],[7,'fifth']]);
  return plan.bass.filter(n=>n.beat<4&&n.beat>=0&&roles.has(pc(n.midi-root))).map(n=>({
   beat:n.beat,length:n.length,role:pc(n.midi-root)===0&&n.midi>anchor?'octave':roles.get(pc(n.midi-root))
  }));
 }

 function fit({chords,start,end,grid,shape=[],fill='off',transpose=0,quiet=[]}){
  const notes=[],picked=chords.filter(c=>c.end>start&&c.start<end&&Number.isInteger(c.rootPc))
   .sort((a,b)=>a.start-b.start);
  const active=t=>picked.findLast(c=>c.start<=t+.018&&c.end>t+.012);
  const bassPc=c=>Number.isInteger(c.bassPc)?c.bassPc:c.rootPc;
  const target=c=>safePitch(bassPc(c)+transpose);
  const isQuiet=time=>quiet.some(r=>time>=r.start&&time<r.end);
  function push(time,stop,midi,role){
   if(time<start-.002||isQuiet(time))return;
   const nextQuiet=quiet.find(r=>r.start>time);
   stop=Math.min(end,stop,nextQuiet?.start??end);
   if(stop-time>=.045)notes.push({time:Math.max(start,time),stop,midi,role});
  }
  for(const c of picked){
   const time=Math.max(start,c.start),next=picked.find(n=>n.start>time+.03);
   if(time>=end||active(time)!==c)continue;
   push(time,Math.min(c.end,next?.start??end,end,time+(shape.length?.4:3)),target(c),'root');
  }
  if(grid){
   const {points,meter}=grid;
   function at(beat){
    const index=Math.floor(beat+1e-7),fraction=beat-index;
    return points[index]+(fraction>1e-7?(points[index+1]-points[index])*fraction:0);
   }
   for(let bar=0;bar<points.length-1;bar+=meter){
    const barEnd=points[bar+meter];
    for(const hit of shape){
     const beat=bar+hit.beat*meter/4;
     const time=at(beat),c=active(time);
     if(!c||time>=end)continue;
     const quality=c.quality||'maj',root=safePitch(c.rootPc+transpose);
     const third=/^(min|dim)/.test(quality)?3:4;
     if(hit.role==='third'&&(/sus/.test(quality)||(c.uncertain&&!c.manual)))continue;
     const fifth=/^(dim|min7b5)/.test(quality)?6:quality==='aug'?8:7;
     const midi=hit.beat===0?target(c):hit.role==='octave'?Math.min(root+12,root<=35?47:59):
      hit.role==='third'?safePitch(root+third,root+3):hit.role==='fifth'?safePitch(root+fifth,root+5):root;
     push(time,Math.min(c.end,barEnd,at(Math.min(bar+meter,beat+hit.length*meter/4))),midi,hit.beat===0?'root':hit.role);
    }
   }
   let lastFill=-Infinity;
   if(fill!=='off')for(let b=meter;b<points.length-1;b+=meter){
    const time=points[b],beat=points[b]-points[b-1],launch=time-beat*.63;
    if(b-lastFill<meter*(fill==='more'?2:4))continue;
    const from=active(launch),to=active(time+.035);
    if(!from||!to||from.rootPc===to.rootPc||Math.abs(to.start-time)>.09||from.end<time-.12)continue;
    if(quiet.some(r=>r.start<time+.05&&r.end>launch))continue;
    const tentative=from.uncertain||to.uncertain;
    if(tentative&&(![from,to].every(c=>c.manual||Number(c.confidence)>=.82)||!['maj','min'].includes(from.quality)))continue;
    const landing=target(to),root=safePitch(from.rootPc+transpose,landing);
    const diminished=/^(dim|min7b5)/.test(from.quality),fifth=safePitch(root+(diminished?6:from.quality==='aug'?8:7),landing);
    const approaches=landing>root?[landing-1,landing+1]:[landing+1,landing-1];
    const pickup=tentative?safePitch(root+(from.quality==='min'?3:4),landing):
     approaches.find(n=>n>=23&&n<=59&&n!==root&&n!==fifth);
    if(!Number.isFinite(pickup))continue;
    if(new Set([root,fifth,pickup]).size<3)continue;
    for(let i=notes.length-1;i>=0;i--)if(notes[i].time>=launch-.016&&notes[i].time<time-.016)notes.splice(i,1);
    for(const [i,midi] of [root,fifth,pickup].entries())push(launch+i*beat*.21,launch+(i+.79)*beat*.21,midi,'fill');
    lastFill=b;
   }
  }
  const distinct=[];
  for(const note of notes.sort((a,b)=>a.time-b.time)){
   const prior=distinct.at(-1);
   if(prior&&note.time-prior.time<.026){if(note.role==='root'&&prior.role!=='root')distinct[distinct.length-1]=note;continue;}
   if(prior)prior.stop=Math.min(prior.stop,note.time-.008);
   distinct.push(note);
  }
  return distinct.filter(n=>n.stop-n.time>=.04);
 }

 const api={styles,passages,quietRanges,pulse,beatGrid,suggest,barChords,pattern,fit};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BassRehearsalCore=api;
})(globalThis);
