/* Fit study rhythms to the harmony and timing of a recorded passage. */
(function(root){
 'use strict';
 const styles=[
  ['auto','Suggested'],['roots','Roots'],['worship','Worship'],['gospel','Gospel'],['soul','Soul'],['rnb','R&B'],['jazz','Jazz'],['blues','Blues'],['fusion','Funk & fusion'],
  ['praise','Praise'],['nigerian68','Nigerian 6/8 Praise'],['woro','Woro'],['highlife','Highlife'],['ariaria','Ariaria'],['makossa','Makossa'],
  ['seben','Seben'],['soukous','Soukous'],['afrobeat','Afrobeat'],['mbalax','Mbalax'],['mbaqanga','Mbaqanga'],['sungura','Sungura'],
  ['reggae','Reggae'],['soca','Soca'],['zouk','Zouk']
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

 // A short window separates kick attacks from the brighter drum transients.
 const attackStep=.01;
 function attacks(buffer,start,end){
  const {first,second,rate}=samplesOf(buffer);
  const hop=Math.round(rate*attackStep),stride=Math.max(1,Math.floor(rate/6000));
  const frames=Math.floor((end-start)/attackStep);
  const kick=new Float32Array(frames),bright=new Float32Array(frames);
  const alpha=1-Math.exp(-2*Math.PI*155*stride/rate);
  let low=0,previousWide=0,previousLow=0;
  for(let f=0;f<frames;f++){
   const offset=Math.round(start*rate)+f*hop;
   let wide=0,bass=0,count=0;
   for(let p=offset;p<Math.min(offset+hop,first.length);p+=stride){
    const a=first[p],b=second[p];
    const value=(a+b)*.5;
    low+=alpha*(value-low);
    bass+=low*low;wide+=(value-low)**2+(a-b)**2*.12;count++;
   }
   wide=Math.log1p(60*Math.sqrt(wide/Math.max(1,count)));
   bass=Math.log1p(60*Math.sqrt(bass/Math.max(1,count)));
   if(f){kick[f]=Math.max(0,bass-previousLow);bright[f]=Math.max(0,wide-previousWide);}
   previousWide=wide;previousLow=bass;
  }
  function normalise(row){
   const nonzero=row.filter(n=>n>.004);
   const denominator=Math.max(.025,median(nonzero)*3);
   return row.map((value,i)=>Math.min(2,(.6*value+.4*Math.max(row[i-1]||0,row[i+1]||0))/denominator));
  }
  const lowHits=normalise(kick),highHits=normalise(bright);
  const groove=lowHits.map((n,i)=>n*.68+highHits[i]*.32);
  return {start,kick:lowHits,groove};
 }

 function bestHit(signal,time,seconds,key='groove'){
  const row=signal[key];
  const centre=(time-signal.start)/attackStep,radius=seconds/attackStep;
  const first=Math.max(0,Math.ceil(centre-radius)),last=Math.min(row.length-1,Math.floor(centre+radius));
  let pick={time,strength:0},score=0;
  for(let i=first;i<=last;i++){
   const rank=row[i]*(1-.6*Math.abs(i-centre)/Math.max(1,radius));
   if(rank>score){score=rank;pick={time:signal.start+i*attackStep,strength:row[i]};}
  }
  return pick;
 }

 function pulse(buffer,start,end,signal=attacks(buffer,start,end)){
  const peaks=signal.groove,frames=peaks.length;
  const mean=peaks.reduce((a,b)=>a+b,0)/Math.max(1,frames);
  if(frames<350||mean<.025)return null;
  function correlation(lag){
   let cross=0,left=0,right=0;
   for(let i=lag;i<frames;i++){
    const a=peaks[i]-mean,b=peaks[i-lag]-mean;
    cross+=a*b;left+=a*a;right+=b*b;
   }
   return cross/Math.sqrt(left*right||1);
  }
  const candidates=[];
  for(let lag=28;lag<=145;lag++){
   const before=correlation(lag-1),score=correlation(lag),after=correlation(lag+1);
   if(score<before||score<after)continue;
   const curve=before-2*score+after;
   const refined=lag+(curve?.5*(before-after)/curve:0);
   const bpm=60/(refined*attackStep),extreme=bpm<72||bpm>150;
   candidates.push({lag:refined,score,rank:score+.24*correlation(lag*2)+.14*correlation(lag*3)-(extreme?.12:0)});
  }
  const best=candidates.sort((a,b)=>b.rank-a.rank)[0];
  if(!best||best.score<.11)return null;
  const slower=candidates.find(c=>c.lag<=83&&Math.abs(c.lag-best.lag*2)<=2&&c.score>=best.score*.94&&c.rank>=best.rank*.89);
  const {lag,score}=slower||best,step=lag*attackStep;
  let phase=0,highest=0;
  for(let i=0;i<lag;i++){
   let sum=0,count=0;
   for(let t=i;t<frames;t+=lag){
    const pos=Math.round(t);
    sum+=Math.max(peaks[pos]||0,(peaks[pos-1]||0)*.8,(peaks[pos+1]||0)*.8);
    count++;
   }
   const value=sum/Math.max(1,count);
   if(value>highest){phase=i;highest=value;}
  }
  if(highest<mean*1.16)return null;
  return {step,bpm:60/step,anchor:start+phase*attackStep,confidence:score};
 }

 function beatGrid({start,end,beats=[],meter=4,phase=0,confidence=0,manualBpm=0,tempo=0,buffer,rhythm,pulseEstimate}){
  if(!manualBpm&&confidence>=.55&&beats.length>=meter+1){
   // Preserve the project's measured beats and downbeat phase.
   const points=beats.map((time,index)=>({time,index})).filter(b=>b.time>=start-.012&&b.time<=end+.012);
   const first=points.findIndex(b=>(b.index-phase)%meter===0),last=points.findLastIndex(b=>(b.index-phase)%meter===0);
   const section=first>=0?points.slice(first,last+1):[];
   const spacings=section.slice(1).map((p,i)=>p.time-section[i].time);
   if(section.length>=meter+1&&spacings.every(s=>s>=.23&&s<=1.5)){
    return {points:section.map(p=>p.time),meter,bpm:60/median(spacings),source:'Saved beats',snap:true};
   }
  }
  const signal=rhythm||(buffer&&attacks(buffer,start,end));
  const detected=pulseEstimate??(signal&&pulse(buffer,start,end,signal));
  const override=manualBpm>=40&&manualBpm<=220;
  const bpm=override?manualBpm:detected?.bpm||(tempo>=40&&tempo<=220?tempo:0);
  if(!bpm)return null;
  const step=60/bpm;
  let first=override?start:detected?.anchor??start;
  if(!override&&signal){
   // Select a bar phase using repeated low-drum accents across successive bars.
   const accents=Array.from({length:meter},(_,phase)=>{
    let energy=0,count=0;
    for(let time=first+phase*step;time<end;time+=meter*step){
     energy+=bestHit(signal,time,step*.13,'kick').strength;count++;
    }
    return count>=2?energy/count:0;
   });
   const weight=Math.max(...accents);
   if(weight>median(accents)*1.18)first+=accents.indexOf(weight)*step;
  }
  const closeEnd=end+.001,points=[];
  for(let time=first,index=0;time<=closeEnd;index++){
   if(time>=start&&time<=end+.001)points.push(Math.min(time,end));
   const target=first+(index+1)*step;
   if(target>closeEnd+step*.12)break;
   if(override||!signal){time=target;continue;}
   const proposed=time+step+(target-time-step)*.18;
   const hit=bestHit(signal,proposed,step*.13);
   time=hit.strength>=.28?proposed+(hit.time-proposed)*.82:proposed;
  }
  points.length=Math.floor(Math.max(0,points.length-1)/meter)*meter+Math.min(1,points.length);
  if(points.length<meter+1)return null;
  return {points,meter,bpm,source:override?'Manual BPM':detected?.confidence>=.25?'Drum timing':'Estimated timing',snap:!override};
 }

 // One saved partition of the recording, rather than overlapping sets of picks.
 function phraseSignature(song){
  const text=JSON.stringify([song.duration,song.tempo||song.bpm,song.meter,song.phase,song.confidence,song.beats,
   song.sections?.map(s=>[s.start,s.end,s.name]),song.chords?.map(c=>[c.start,c.end,c.rootPc,c.bassPc]),
   song.notes?.map(n=>[n.start,n.end,n.midi])]);
  let hash=2166136261;
  for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619);
  return (hash>>>0).toString(36);
 }

 function validPhrasePlan(plan,song){
  if(plan?.version!==1||plan.signature!==phraseSignature(song)||plan.duration!==song.duration||!Array.isArray(plan.phrases)||!plan.phrases.length)return false;
  let end=0;
  for(const p of plan.phrases){
   if(!Number.isFinite(p.start)||!Number.isFinite(p.end)||p.start!==end||p.end<=p.start||p.end>song.duration)return false;
   end=p.end;
  }
  const grid=plan.grid;
  if(grid&&(!Array.isArray(grid.points)||!Number.isFinite(grid.bpm)||grid.bpm<40||grid.bpm>220||!Number.isInteger(grid.meter)||grid.meter<2||grid.meter>12||
   grid.points.some((t,i)=>!Number.isFinite(t)||t<0||t>song.duration+.012||i>0&&t<=grid.points[i-1])))return false;
  return end===song.duration;
 }

 function phrasePlan(song,saved=song.rehearsalPhrases){
  if(validPhrasePlan(saved,song))return saved;
  const duration=Number(song.duration);
  if(!Number.isFinite(duration)||duration<=0)return null;
  const grid=beatGrid({...song,start:0,end:duration,tempo:song.tempo||song.bpm||0});
  const sections=(song.sections||[]).filter(s=>Number.isFinite(s.start)&&Number.isFinite(s.end)&&s.end>s.start&&s.end>0&&s.start<duration)
   .map(s=>({start:Math.max(0,s.start),end:Math.min(duration,s.end),name:String(s.name||'').trim().slice(0,30)})).sort((a,b)=>a.start-b.start);
  const chords=(song.chords||[]).filter(c=>Number.isFinite(c.start)&&Number.isFinite(c.end)&&c.end>c.start).sort((a,b)=>a.start-b.start);
  const notes=(song.notes||[]).filter(n=>Number.isFinite(n.start)&&Number.isFinite(n.end)&&n.end>n.start);
  const bars=grid?grid.points.filter((_,i)=>i%grid.meter===0&&grid.points[i]>=0&&grid.points[i]<=duration):[];
  const round=t=>Math.round(t*100)/100;
  // Keep known section boundaries, without creating several tiny fragments at
  // overlapping/near-identical section edges. Every remaining sample is kept.
  const anchors=[0];
  const edges=[...new Set(sections.flatMap(s=>[round(s.start),round(s.end)]))].sort((a,b)=>a-b);
  for(const time of edges)if(time-anchors.at(-1)>=6&&duration-time>=6)anchors.push(time);
  anchors.push(duration);
  const phrases=[];
  const at=time=>chords.find(c=>c.start<=time+.015&&c.end>time+.015);
  function boundaryCost(start,end){
   let cost=0;
   const from=at(start),to=at(end);
   if(from&&to&&!from.uncertain&&!to.uncertain&&((from.bassPc??from.rootPc)!==(to.bassPc??to.rootPc)||from.quality!==to.quality))cost+=3.5;
   // A release before a bar line is preferable to cutting a sustained bass note.
   if(notes.some(n=>n.start<end-.06&&n.end>end+.08))cost+=.9;
   if(notes.some(n=>n.end<=end&&n.end>=end-.25))cost-=.25;
   if(sections.some(s=>Math.abs(s.start-end)<.015||Math.abs(s.end-end)<.015))cost-=.35;
   return cost;
  }
  for(let region=0;region<anchors.length-1;region++){
   const a=anchors[region],z=anchors[region+1];
   let inside=bars.map(round).filter(t=>t>a+.05&&t<z-.05);
   // Without a usable beat grid there is no claim of a verified turnaround.
   // Balanced fallback phrases still cover the intro, rests and outro exactly.
   const checkpoints=[a,...inside,z],fallback=[];
   for(let i=1;i<checkpoints.length;i++){
    const gap=checkpoints[i]-checkpoints[i-1],count=Math.ceil(gap/15);
    for(let p=1;p<count;p++)fallback.push(round(checkpoints[i-1]+gap*p/count));
   }
   inside=[...new Set([...inside,...fallback])].sort((x,y)=>x-y);
   const points=[a,...inside,z],cost=Array(points.length).fill(Infinity),next=[];
   cost[points.length-1]=0;
   for(let i=points.length-2;i>=0;i--)for(let j=i+1;j<points.length;j++){
    const seconds=points[j]-points[i];
    if(seconds>22&&j>i+1)break;
    const outside=Math.max(0,10-seconds,seconds-15);
    const short=seconds<6&&z-a>=6?30:0;
    const score=2+.055*(seconds-12.5)**2+outside**2*.7+short+boundaryCost(points[i],points[j])+cost[j];
    if(score<cost[i]){cost[i]=score;next[i]=j;}
   }
   for(let i=0;i<points.length-1;){
    const j=next[i]??points.length-1,start=points[i],end=points[j];
    const section=sections.find(s=>s.start<=start+.05&&s.end>start+.05);
    phrases.push({start,end,section:section?.name||'',estimated:true});i=j;
   }
  }
  return {version:1,signature:phraseSignature(song),duration,grid,phrases};
 }

 function phraseGrid(plan,phrase){
  const grid=plan?.grid;
  if(!grid)return null;
  const points=grid.points.filter(t=>t>=phrase.start-.006&&t<=phrase.end+.006);
  return points.length>=2?{...grid,points}:null;
 }

 const repeat={
  ranges(clip,selected=[],phrase=null){
   const cells=Array.from(selected),rows=cells.length?cells.map(t=>({start:Math.max(clip.start,t),end:Math.min(clip.end,t+1)})):[phrase||clip];
   const result=[];
   for(const r of rows.map(r=>({start:Math.max(clip.start,r.start),end:Math.min(clip.end,r.end)})).filter(r=>Number.isFinite(r.start+r.end)&&r.end>r.start).sort((a,b)=>a.start-b.start)){
    const last=result.at(-1);
    if(last&&r.start<=last.end+.000001)last.end=Math.max(last.end,r.end);else result.push(r);
   }
   return result.length?result:[{start:clip.start,end:clip.end}];
  },
  pack(context,tracks,clip,ranges){
   const source=tracks.source,rate=source.sampleRate,map=[];
   let frames=0;
   for(const r of ranges){
    const a=Math.max(0,tracks.offset+(r.start-clip.start)),z=Math.min(tracks.end,tracks.offset+(r.end-clip.start));
    const first=Math.round(a*rate),last=Math.min(source.length??Math.round(source.duration*rate),Math.round(z*rate));
    if(last<=first)continue;
    const duration=(last-first)/rate;
    map.push({...r,offset:frames/rate,duration,first,last});frames+=last-first;
   }
   if(!map.length)throw Error('Choose a section within this passage.');
   if(map.length===1){
    const r=map[0],start=Math.max(0,tracks.offset+(r.start-clip.start)),end=Math.min(tracks.end,tracks.offset+(r.end-clip.start));
    r.duration=end-start;
    return {source,start,end,seconds:end-start,map};
   }
   const joined=context.createBuffer(source.numberOfChannels,frames,rate);
   for(let channel=0;channel<source.numberOfChannels;channel++){
    const output=joined.getChannelData(channel),input=source.getChannelData(channel);let offset=0;
    for(const r of map){
     const length=r.last-r.first;output.set(input.subarray(r.first,r.last),offset);
     // A very short edge fade prevents clicks at skipped sections. It adds no
     // samples or time, so bass and backing retain the same audio-clock loop.
     const fade=Math.min(Math.floor(rate*.002),Math.floor(length/8));
     for(let i=0;i<fade;i++){output[offset+i]*=i/fade;output[offset+length-1-i]*=i/fade;}
     offset+=length;
    }
   }
   return {source:joined,start:0,end:frames/rate,seconds:frames/rate,map};
  },
  notes(notes,loop){
   const result=[];
   for(const r of loop.map)for(const n of notes){
    const from=Math.max(n.time,r.start),to=Math.min(n.stop,r.end);
    if(to<=from)continue;
    const scale=r.duration/(r.end-r.start);
    result.push({...n,time:r.offset+(from-r.start)*scale,stop:Math.min(loop.seconds,r.offset+(to-r.start)*scale)});
   }
   return result.sort((a,b)=>a.time-b.time);
  },
  position(loop,phase){
   const p=phase>=0?phase%loop.seconds:((phase%loop.seconds)+loop.seconds)%loop.seconds;
   const r=loop.map.find(r=>p<r.offset+r.duration)||loop.map.at(-1);
   return r.start+Math.max(0,p-r.offset)/r.duration*(r.end-r.start);
  },
  phase(loop,position){
   const r=loop.map.find(r=>position>=r.start&&position<r.end);
   if(r)return r.offset+(position-r.start)/(r.end-r.start)*r.duration;
   return (loop.map.find(r=>r.start>=position)||loop.map[0]).offset;
  }
 };

 function suggest(chords,grid){
  if(!grid)return 'roots';
  const duration=median(chords.map(c=>c.end-c.start)),beatsPerChange=duration*grid.bpm/60;
  if(beatsPerChange>=3.5&&grid.bpm<=102)return 'worship';
  if(grid.bpm>=122)return 'praise';
  return 'gospel';
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
  for(let i=0;i<points.length-1;i+=meter)result.push({...progression[(i/meter)%progression.length],start:points[i],end:points[Math.min(i+meter,points.length-1)]});
  return result;
 }

 const safePitch=(pitch,reference=36)=>{
  let target=23+pc(pitch-23);
  for(let n=target+12;n<=47;n+=12)if(Math.abs(n-reference)<Math.abs(target-reference))target=n;
  return target;
 };

 function pattern(line,practice,idea){
  if(!line)return [];
  const expressive=window.BassExpressiveStudies?.basslineShape(line,idea);if(expressive)return expressive;
  const plan=practice.make('basslines',{idea,key:0,bpm:120});
  const root=plan.chords[0]?.midi;
  if(!Number.isFinite(root))return [];
  const anchor=plan.bass.find(n=>n.beat<4&&pc(n.midi-root)===0)?.midi??root-12;
  const roles=new Map([[0,'root'],[3,'third'],[4,'third'],[7,'fifth']]);
  return plan.bass.filter(n=>n.beat<4&&n.beat>=0&&roles.has(pc(n.midi-root))).map(n=>({
   beat:n.beat,length:n.length,role:pc(n.midi-root)===0&&n.midi>anchor?'octave':roles.get(pc(n.midi-root))
  }));
 }

 function patternScore(grid,signal,shape){
  if(!grid||!signal||!shape.length)return 0;
  let total=0,hits=0;
  const stride=Math.max(1,Math.ceil((grid.points.length-1)/grid.meter/32));
  for(let b=0;b<grid.points.length-1;b+=grid.meter*stride){
   for(const hit of shape){
    if(hit.beat%1<.03)continue;
    if(b+hit.beat*grid.meter/4>=grid.points.length-1)continue;
    const time=beatTime(grid,b+hit.beat*grid.meter/4);
    total+=Math.min(1.4,bestHit(signal,time,.055,'kick').strength)-.38;
    hits++;
   }
  }
  return hits?total/hits:0;
 }

 function beatTime({points},beat){
  const index=Math.floor(beat+1e-7),fraction=beat-index;
  return points[index]+(fraction>1e-7?(points[index+1]-points[index])*fraction:0);
 }

 function fit({chords,start,end,grid,shape=[],recorded=false,fill='bar',transpose=0,quiet=[],roots=[],rhythm}){
  const notes=[],picked=chords.filter(c=>c.end>start&&c.start<end&&Number.isInteger(c.rootPc))
   .sort((a,b)=>a.start-b.start);
  const active=t=>picked.findLast(c=>c.start<=t+.018&&c.end>t+.012)||
   roots.find(c=>c.start<=t+.018&&c.end>t+.012);
  const bassPc=c=>Number.isInteger(c.bassPc)?c.bassPc:c.rootPc;
  const target=c=>safePitch(bassPc(c)+transpose);
  const offsets=shape.filter(n=>Number.isFinite(n.semitones)).map(n=>n.semitones);
  const bounded=pitch=>{while(pitch<23)pitch+=12;while(pitch>59)pitch-=12;return pitch;};
  function shapeRoot(pitch){
   if(!offsets.length)return safePitch(pitch);
   const low=Math.min(0,...offsets),high=Math.max(0,...offsets),choices=[];
   for(let midi=23;midi<=59;midi++)if(pc(midi)===pc(pitch)&&midi+low>=23&&midi+high<=59)choices.push(midi);
   return choices.sort((a,b)=>Math.abs(a-35)-Math.abs(b-35))[0]??safePitch(pitch);
  }
  const isQuiet=time=>quiet.some(r=>time>=r.start&&time<r.end);
  function push(time,stop,midi,role,accent=0){
   if(time<start-.002||isQuiet(time)||recorded&&midi===null)return;
   const nextQuiet=quiet.find(r=>r.start>time);
   stop=Math.min(end,stop,nextQuiet?.start??end);
   if(stop-time>=.032)notes.push({time:Math.max(start,time),stop,midi,role,accent});
  }
  function add(time,stop,role='root',accent=0,semitones=null){
   const c=active(time),root=c?shapeRoot(c.rootPc+transpose):null;
   let midi=c?(offsets.length?shapeRoot(bassPc(c)+transpose):target(c)):null;
   const quality=c?.quality||'maj';
   if(c&&!c.rootOnly){
    const third=/^(min|dim)/.test(quality)?3:4;
    const fifth=/^(dim|min7b5)/.test(quality)?6:quality==='aug'?8:7;
    if(role==='third'&&(/sus/.test(quality)||(c.uncertain&&!c.manual)))midi=target(c);
    else if(role==='third')midi=Number.isFinite(semitones)?bounded(root+third+12*Math.floor(semitones/12)):safePitch(root+third,root+3);
    else if(role==='fifth')midi=Number.isFinite(semitones)?bounded(root+fifth+12*Math.floor(semitones/12)):safePitch(root+fifth,root+5);
    else if(role==='octave')midi=Number.isFinite(semitones)?bounded(root+semitones):root+(root<=47?12:0);
    else if(role==='root'&&Number.isFinite(semitones))midi=bounded(midi+semitones);
    else if(role==='passing'&&Number.isFinite(semitones)&&(!c.uncertain||c.manual))midi=bounded(root+semitones);
   }
   const finish=Math.min(c?.end??(time+.085),stop);
   if(finish-time>=.032)push(time,finish,midi,role,accent);
   else push(time,Math.min(time+.06,stop),null,role,accent);
  }

  if(!grid){
   for(const c of picked){
    const time=Math.max(start,c.start);
    if(time<end&&active(time)===c)push(time,Math.min(c.end,time+3),target(c),'root');
   }
   return notes;
  }

  const {points,meter}=grid;
  // Generated patterns have a steady root behind the syncopation.
  // Recorded rhythms keep their own attacks and rests.
  if(!recorded)for(let b=0;b<points.length-1;b++){
   const time=points[b],length=points[b+1]-time;
   const kick=rhythm?bestHit(rhythm,time,length*.14,'kick').strength:0;
   add(time,time+length*.76,'root',b%meter===0?1:Math.min(1,kick*.65));
  }
  for(let bar=0;bar<points.length-1;bar+=meter){
   for(const hit of shape){
    const beat=bar+hit.beat*meter/4;
    if(beat>=points.length-1)continue;
    if(!recorded&&Math.abs(beat-Math.round(beat))<.04)continue;
    const count=Math.floor(beat),nominal=beatTime(grid,beat);
    const step=points[count+1]-points[count];
    const kick=rhythm?bestHit(rhythm,nominal,Math.min(.065,step*.14),'kick'):null;
    const time=grid.snap&&kick?.strength>=.65?Math.max(points[bar],kick.time):nominal;
    const stop=beatTime(grid,Math.min(points.length-1,bar+meter,beat+hit.length*meter/4));
    add(time,Math.max(time+.045,stop),hit.role,kick?Math.min(1,kick.strength*.6):0,hit.semitones);
   }
  }
  if(fill!=='off')for(let b=meter;b<points.length;b+=meter){
   const time=points[b],beat=time-points[b-1],launch=time-beat*.54;
   const landingTime=b===points.length-1&&end-time<.018?start:time;
   if(quiet.some(r=>r.start<time&&r.end>launch)||isQuiet(landingTime))continue;
   const from=active(launch),to=active(landingTime+.025);
   if(fill==='ends'&&(!from||!to||from.rootPc===to.rootPc))continue;
   const root=from?target(from):null;
   const next=to?target(to):null;
   const fifth=from&&!from.rootOnly?safePitch(from.rootPc+transpose+(/^(dim|min7b5)/.test(from.quality)?6:from.quality==='aug'?8:7),root+5):root;
   const pickup=from&&to&&from.rootPc!==to.rootPc&&!from.uncertain&&!to.uncertain&&!from.rootOnly&&!to.rootOnly
    ?[next-1,next+1].find(n=>n!==root&&n!==fifth&&n>=23&&n<=59)??root:root;
   for(let i=notes.length-1;i>=0;i--)if(notes[i].time>=launch-.018&&notes[i].time<time-.02)notes.splice(i,1);
   [root,fifth,pickup].forEach((midi,i)=>{
    const at=launch+i*beat*.18;
    push(at,at+beat*.13,midi,'fill',.4+i*.15);
   });
  }
  const distinct=[];
  for(const note of notes.sort((a,b)=>a.time-b.time)){
   const prior=distinct.at(-1);
   if(prior&&note.time-prior.time<.026){
    if(note.role==='fill'||(note.role==='root'&&prior.role!=='root'))distinct[distinct.length-1]=note;
    continue;
   }
   if(prior)prior.stop=Math.min(prior.stop,note.time-.007);
   distinct.push(note);
  }
  return distinct.filter(n=>n.stop-n.time>=.031);
 }

 const api={styles,passages,quietRanges,attacks,pulse,beatGrid,phraseSignature,validPhrasePlan,phrasePlan,phraseGrid,repeat,suggest,barChords,pattern,patternScore,fit};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BassRehearsalCore=api;
})(globalThis);
