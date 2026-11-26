/* Fit alternatives to the song's actual chords and each approaching change.
 * Source recordings do not establish a verified original chord progression. */
window.BassRehearsalHarmony=(()=>{
 'use strict';
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const F=window.BassFillCore,C=window.BassRehearsalCore,Q=window.BassCuratedStudies,P=window.BassPracticeCore;
 const pc=n=>(n%12+12)%12,memo=new WeakMap(),studyCache=new WeakMap(),names=F.names;
 function keyOf(clip){
  let tonic=Number.isInteger(clip.keyRoot)?clip.keyRoot:Number.isInteger(clip.tonic)?clip.tonic:clip.root,mode=clip.keyMode||clip.mode||'major';
  if(!Number.isInteger(tonic)){
   const match=String(clip.key||'').match(/^([A-G])([#b♯♭]?)(?:\s*(major|minor|maj|min|m))?/i);
   if(!match)return null;tonic=({C:0,D:2,E:4,F:5,G:7,A:9,B:11})[match[1].toUpperCase()]+(/[#♯]/.test(match[2])?1:/[b♭]/.test(match[2])?-1:0);mode=/^(minor|min|m)$/.test(match[3]||'')?'minor':'major';
  }
  const scale=F.scales[mode];if(!scale)return null;
  const relative=clip.numbering==='relative-major'&&mode==='minor';
  return {tonic:pc(tonic),mode,scale,numberRoot:pc(tonic+(relative?3:0)),numberScale:relative?F.scales.major:scale};
 }
 function chordName(chord){
  const q=String(chord.quality||'maj').toLowerCase(),suffix=({maj:'',major:'',min:'m',minor:'m',min7:'m7',major7:'maj7',dom7:'7',min7b5:'m7♭5',m7b5:'m7♭5'})[q]??q;
  return names[pc(chord.rootPc)]+suffix+(Number.isInteger(chord.bassPc)&&pc(chord.bassPc)!==pc(chord.rootPc)?'/'+names[pc(chord.bassPc)]:'');
 }
 function degree(chord,key){
  if(!key)return chordName(chord);
  const delta=pc(chord.rootPc-key.numberRoot),index=key.numberScale.indexOf(delta);if(index>=0)return String(index+1);
  const flat=key.numberScale.findIndex(n=>pc(n-1)===delta);if(flat>=0)return '♭'+(flat+1);
  const sharp=key.numberScale.findIndex(n=>pc(n+1)===delta);return sharp>=0?'♯'+(sharp+1):chordName(chord);
 }
 const bass=chord=>pc(Number.isInteger(chord.bassPc)?chord.bassPc:chord.rootPc);
 const signature=chord=>[pc(chord.rootPc),chord.quality||'maj',bass(chord)].join(':');
 const safe=chord=>!!chord&&(!chord.uncertain||chord.manual)&&!chord.rootOnly&&!/unknown|none|^n$/i.test(chord.quality||'');
 function prepare(clip){
  if(memo.has(clip))return memo.get(clip);
  const key=keyOf(clip),segments=[];
  for(const chord of [...(clip.chords||[])].filter(c=>Number.isInteger(c.rootPc)&&c.end>clip.start&&c.start<clip.end).sort((a,b)=>a.start-b.start)){
   const item={...chord,start:Math.max(clip.start,chord.start),end:Math.min(clip.end,chord.end)};if(!(item.end>item.start))continue;
   const previous=segments.at(-1);
   if(previous&&signature(previous)===signature(item)&&previous.end>=item.start-.025){previous.end=Math.max(previous.end,item.end);continue;}
   if(previous)previous.end=Math.min(previous.end,item.start);
   if(previous&&previous.end<=previous.start)segments.pop();
   item.number=degree(item,key);item.name=chordName(item);item.signature=signature(item);segments.push(item);
  }
  const transitions=[];
  function append(from,to,at,loop=false){
   const id=from.signature+'>'+to.signature,interval=pc(bass(to)-bass(from));
   const phraseId=id+'@'+from.start.toFixed(5)+':'+at.toFixed(5);
   transitions.push({id,phraseId,from,to,at,loop,interval,label:from.number+'→'+to.number,names:from.name+'→'+to.name,safe:safe(from)&&safe(to)});
  }
  for(let i=1;i<segments.length;i++)if(Math.abs(segments[i-1].end-segments[i].start)<.04)append(segments[i-1],segments[i],segments[i].start);
  if(segments.length&&Math.abs(segments[0].start-clip.start)<.04&&Math.abs(segments.at(-1).end-clip.end)<.04)append(segments.at(-1),segments[0],clip.end,true);
  const result={key,segments,transitions,matches:new Map()};memo.set(clip,result);return result;
 }
 function at(clip,time){
  const rows=prepare(clip).segments;let lo=0,hi=rows.length;
  while(lo<hi){const mid=(lo+hi)>>>1;if(rows[mid].start<=time+.0001)lo=mid+1;else hi=mid;}
  const row=rows[lo-1];return row&&time<row.end-.0001?row:null;
 }
 function changes(clip,selection='all'){
  return prepare(clip).transitions.filter(t=>t.safe&&(selection==='all'||t.id===selection||t.phraseId===selection));
 }
 function options(clip){
  const seen=new Set();return changes(clip).filter(t=>t.from.signature!==t.to.signature&&!seen.has(t.id)&&seen.add(t.id));
 }
 function timestamp(time){
  const centiseconds=Math.round(time*100),seconds=centiseconds%6000/100;
  return Math.floor(centiseconds/6000)+':'+(centiseconds%100?seconds.toFixed(2):String(seconds)).padStart(centiseconds%100?5:2,'0');
 }
 function phraseOptions(clip){return changes(clip).filter(t=>t.from.signature!==t.to.signature).map(t=>({...t,range:timestamp(t.from.start)+'–'+timestamp(t.at)}));}
 function progression(clip){return prepare(clip).segments.map(c=>c.number).join('–');}
 function beat(clip,time){
  const grid=clip.grid;if(!grid)return 0;
  const a=grid.points;let lo=0,hi=a.length;
  while(lo<hi){const mid=(lo+hi)>>>1;if(a[mid]<=time+.00001)lo=mid+1;else hi=mid;}
  const i=Math.max(0,Math.min(a.length-2,lo-1));return i+(time-a[i])/Math.max(.001,a[i+1]-a[i]);
 }
 function stepAt(clip,time){
  const points=clip.grid?.points;if(!points?.length)return 60/(clip.grid?.bpm||100);
  const index=Math.max(0,Math.min(points.length-2,Math.floor(beat(clip,time))));return points[index+1]-points[index];
 }
 function beatTime(clip,value){
  const points=clip.grid.points,index=Math.max(0,Math.min(points.length-2,Math.floor(value)));
  return points[index]+(value-index)*(points[index+1]-points[index]);
 }
 function chordTones(chord){
  const q=String(chord.quality||'maj').toLowerCase();let offsets;
  if(!safe(chord))offsets=[0];
  else if(/sus2/.test(q))offsets=[0,2,7];
  else if(/sus/.test(q))offsets=[0,5,7];
  else if(/min7b5|m7b5|half.?dim/.test(q))offsets=[0,3,6,10];
  else if(/dim/.test(q))offsets=[0,3,6,.../7/.test(q)?[9]:[]];
  else if(/aug/.test(q))offsets=[0,4,8];
  else if(q==='5'||q==='power')offsets=[0,7];
  else offsets=[0,/^(min|minor|m(?!aj))/.test(q)?3:4,7];
  if(safe(chord)&&!/dim/.test(q)&&(/7/.test(q)||!/add/.test(q)&&/9|11|13/.test(q)))offsets.push(/maj|major/.test(q)?11:10);
  return new Set([...offsets.map(n=>pc(chord.rootPc+n)),bass(chord)]);
 }
 function passingTones(chord,key){
  if(!safe(chord))return new Set([bass(chord)]);
  const tones=chordTones(chord),q=String(chord.quality||'maj').toLowerCase();
  if(/dim|aug/.test(q))return tones;
  const local=/^(min|minor|m(?!aj))/.test(q)?[0,2,3,5,7,8,10]:/7|9|11|13/.test(q)&&!/maj|major|add/.test(q)?[0,2,4,5,7,9,10]:[0,2,4,5,7,9,11];
  for(const pitch of key?key.scale.map(n=>pc(n+key.tonic)):local.map(n=>pc(n+chord.rootPc)))tones.add(pitch);
  if(/sus/.test(q)){tones.delete(pc(chord.rootPc+3));tones.delete(pc(chord.rootPc+4));}
  else tones.delete(pc(chord.rootPc+(/^(min|minor|m(?!aj))/.test(q)?4:3)));
  return tones;
 }
 function choose(allowed,wanted,previous=35){
  let best=null,cost=Infinity;
  for(let midi=23;midi<=59;midi++)if(allowed.has(pc(midi))&&Math.abs(midi-previous)<=12){
   const value=Math.abs(midi-wanted)*.65+Math.abs(midi-previous)*.3+Math.max(0,midi-47)*1.2;
   if(value<cost){best=midi;cost=value;}
  }
  return best;
 }
 function normalise(notes){
  const sorted=notes.filter(n=>Number.isFinite(n.time+n.stop)&&(n.midi===null||Number.isInteger(n.midi)&&n.midi>=23&&n.midi<=59)).sort((a,b)=>a.time-b.time||Number(b.role==='landing')-Number(a.role==='landing')),out=[];
  for(const note of sorted){
   const previous=out.at(-1);
   if(previous?.midi!==null&&previous?.midi!==undefined&&note.midi!==null&&(note.adapted||note.role==='landing'))note.midi=choose(new Set([pc(note.midi)]),note.midi,previous.midi);
   if(previous&&note.time-previous.time<.018){if(note.role==='landing')out[out.length-1]=note;continue;}
   if(previous)previous.stop=Math.min(previous.stop,note.time-.006);
   if(note.stop-note.time>=.031)out.push({...note});
  }
  return out.filter(n=>n.stop-n.time>=.031);
 }
 function landing(notes,clip,chord,time,change){
  if(time>=clip.end-.01||time<clip.start-.01||(clip.quiet||[]).some(r=>r.start<=time&&r.end>time))return;
  const existing=notes.find(n=>Math.abs(n.time-time)<.000001&&n.midi!==null&&pc(n.midi)===bass(chord));
  if(existing){Object.assign(existing,{time,role:'landing',accent:1,changeId:change?.id,changeLabel:change?.label,chordNumber:chord.number,chordName:chord.name});return;}
  const previous=notes.filter(n=>n.time<time&&n.midi!==null).at(-1)?.midi??35;
  const midi=choose(new Set([bass(chord)]),35,previous),next=notes.find(n=>n.time>time+.018),stop=Math.min(chord.end,clip.end,time+stepAt(clip,time)*.72,next?.time-.006??Infinity);
  for(let i=notes.length-1;i>=0;i--)if(Math.abs(notes[i].time-time)<.018)notes.splice(i,1);
  if(stop-time>=.032)notes.push({time,stop,midi,role:'landing',accent:1,changeId:change?.id,changeLabel:change?.label,chordNumber:chord.number,chordName:chord.name});
 }
 function conform(notes,clip){
  const key=prepare(clip).key,out=[];let previous=35;
  for(const [index,note]of notes.entries()){
   const chord=at(clip,note.time);if(!chord){if(note.midi===null)out.push({...note});continue;}
   const step=stepAt(clip,note.time),phase=beat(clip,note.time),strong=Math.abs(phase-Math.round(phase))<.075||note.stop-note.time>step*.7;
   let allowed=strong?chordTones(chord):passingTones(chord,key);
   const next=notes[index+1];
   if(!strong&&next&&note.stop-note.time<step*.45&&next.time-note.time<step*.6&&next.time<chord.end&&chordTones(chord).has(pc(next.midi))&&Math.min(pc(next.midi-note.midi),pc(note.midi-next.midi))===1)allowed.add(pc(note.midi));
   if(['root','octave','landing'].includes(note.role))allowed=new Set([bass(chord)]);
   else if(note.role==='third'&&safe(chord)&&!/sus/.test(chord.quality||''))allowed=new Set([pc(chord.rootPc+(/^(min|minor|m(?!aj)|dim)/.test(chord.quality||'')?3:4))]);
   else if(note.role==='fifth'&&safe(chord))allowed=new Set([pc(chord.rootPc+(/dim|min7b5|m7b5/.test(chord.quality||'')?6:/aug/.test(chord.quality||'')?8:7))]);
   const midi=note.midi===null?null:choose(allowed,note.midi,previous);if(midi!==null)previous=midi;
   out.push({...note,midi,stop:Math.min(note.stop,chord.end),adapted:true,chordNumber:chord.number,chordName:chord.name});
  }
  for(const chord of prepare(clip).segments)landing(out,clip,chord,chord.start,changes(clip).find(t=>Math.abs((t.loop?clip.start:t.at)-chord.start)<.018));
  return normalise(out);
 }
 function study(entry,change=null,clip=null){
  if(change&&clip){const expressive=window.BassExpressiveStudies?.rehearsalStudy(entry,change,clip);if(expressive)return expressive;}
  if(entry.recordedStudy)return entry.recordedStudy;
  if(studyCache.has(entry))return studyCache.get(entry);
  const plan=Q.make(entry.kind,{idea:entry.index,key:0,from:1,to:4,bpm:100});
  const result={interval:plan.target-plan.source,events:plan.bass.filter(n=>n.beat<=4).map(n=>({offset:n.midi-plan.source,beat:n.beat,length:n.length,velocity:n.velocity,confidence:1}))};studyCache.set(entry,result);return result;
 }
 function matchScore(row,clip,selection='all'){
  const prepared=prepare(clip);
  if(!prepared.matches.has(selection)){
   const moves=changes(clip,selection).filter(t=>t.from.signature!==t.to.signature),counts=new Array(12).fill(0);for(const move of moves)counts[move.interval]++;
   prepared.matches.set(selection,{counts,total:moves.length});
  }
  const {counts,total}=prepared.matches.get(selection);if(!total)return 0;
  if(window.BassExpressiveStudies?.handles(row.entry))return .45;
  if(row.kind==='basslines'&&!row.recorded&&window.BassExpressiveStudies?.styleOf('basslines',P.lines.findIndex(line=>line.id===row.sourceId)))return .45;
  const r=row.entry?.recordedStudy;let intervals=[];
  if(r?.sourceKind==='basslines'&&window.BassExpressiveStudies?.styleOf('basslines',P.lines.findIndex(line=>line.id===r.sourceId)))return .45;
  if(row.entry)intervals=[pc(r?r.interval:study(row.entry).interval)];
  else{
   const line=P.lines.find(l=>l.id===row.sourceId),scale=F.scales[line?.mode]||F.scales.major;
   if(line)intervals=line.degrees.slice(1).map((n,i)=>pc(scale[n-1]-scale[line.degrees[i]-1]));
  }
  return intervals.length?counts.reduce((sum,count,interval)=>sum+(intervals.includes(interval)?count:0),0)/total*1.5:0;
 }
 function scope(clip,selection,time){
  if(selection==='all')return true;
  return changes(clip,selection).some(t=>time>=t.from.start&&time<t.at);
 }
 function transitionsFor(clip,placement,selection){
  const rows=changes(clip,selection);if(placement!=='bar'||selection!=='all'||!clip.grid)return rows;
  const {points,meter}=clip.grid;
  for(let i=meter;i<points.length-1;i+=meter){const time=points[i];if(rows.some(r=>Math.abs(r.at-time)<.04))continue;const from=at(clip,time-.02),to=at(clip,time+.02);if(safe(from)&&safe(to))rows.push({id:from.signature+'>'+to.signature,from,to,at:time,interval:pc(bass(to)-bass(from)),label:from.number+'→'+to.number,safe:true});}
  return rows.sort((a,b)=>a.at-b.at);
 }
 function windowFor(entry,change,clip,exact=false){
  const events=study(entry,change,clip).events.filter(n=>n.beat<4),step=stepAt(clip,change.at-.02);
  if(events.length<3)return null;
  const span=4-events[0].beat,last=beat(clip,change.at),available=last-beat(clip,change.from.start);
  const gap=Math.min(...events.slice(1).map((n,i)=>n.beat-events[i].beat));
  if(!(span>0&&gap>0))return null;
  // Give a dense source enough of this chord's existing time to be heard.
  // The landing stays at the song's original change, and the source order
  // and relative rhythm stay intact. Never extend into the previous chord.
  const required=Math.max(events.length/12,.055*span/gap)/step;
  const preferred=Math.max(entry.kind==='runs'?clip.grid.meter:Math.min(2,clip.grid.meter),Math.ceil(required*2)/2);
  const count=exact?available:Math.min(preferred,available),first=last-count,start=exact?change.from.start:beatTime(clip,first),duration=change.at-start;
  const times=events.map(n=>beatTime(clip,first+(n.beat-events[0].beat)*count/span));
  if(exact)times[0]=change.from.start;
  if(count<(entry.kind==='runs'?1.5:.65)||duration<=0||events.length/duration>12||times.some((time,i)=>i&&time-times[i-1]<.055))return null;
  return {events,step,span,duration,start,times};
 }
 function approach(entry,change,clip,previous=35,exact=false){
  const window=windowFor(entry,change,clip,exact);if(!window)return [];
  const s=study(entry,change,clip),{events,step,span,duration,start,times}=window,ratio=duration/span;
  if((clip.quiet||[]).some(r=>r.start<change.at&&r.end>start))return [];
  const origin=choose(new Set([bass(change.from)]),35,previous),target=choose(new Set([bass(change.to)]),origin+Math.max(-12,Math.min(12,s.interval)),origin),key=prepare(clip).key,out=[];
  for(let i=0;i<events.length;i++){
   const note=events[i],time=times[i],gap=(times[i+1]??change.at)-time,phase=beat(clip,time),strong=Math.abs(phase-Math.round(phase))<.075;
   let allowed=strong?chordTones(change.from):passingTones(change.from,key),wanted=origin+note.offset;
   if(i===0)allowed=new Set([bass(change.from)]);
   if(i===events.length-1&&!(s.expressive&&s.technique==='fifth'&&!strong&&gap<step*.65)){
    const neighbours=new Set([...allowed].filter(n=>Math.min(pc(n-bass(change.to)),pc(bass(change.to)-n))<=2));
    if(neighbours.size)allowed=neighbours;
    else if(!strong)allowed=new Set([pc(target-1),pc(target+1)]);
    const originalApproach=pc(s.interval-note.offset);
    if(!strong&&gap<step*.65&&[1,11].includes(originalApproach))allowed.add(pc(target+(originalApproach===1?-1:1)));
    wanted=target+(wanted>target?1:-1);
   }
   if(s.expressive&&!strong&&note.slideOffset===undefined&&gap<step*.65&&i+1<events.length){const next=events[i+1],distance=Math.min(pc(next.offset-note.offset),pc(note.offset-next.offset));if(distance===1&&chordTones(change.from).has(pc(origin+next.offset)))allowed.add(pc(wanted));}
   if(s.expressive&&s.technique==='fifth'&&i===events.length-1&&!strong&&gap<step*.65)allowed=new Set([pc(bass(change.to)+7)]);
   const midi=choose(allowed,wanted,out.at(-1)?.midi??origin),gate=Math.min(gap*(s.expressive?.96:.86),Math.max(.055,note.length*ratio));
   if(gate<.031)return [];
   out.push({time,stop:Math.min(change.at-.007,time+gate),midi,role:entry.kind==='runs'?'run':'fill',accent:Number.isFinite(note.velocity)?clamp((note.velocity-60)/45,0,1):.6,velocity:note.velocity,articulation:note.articulation,slideFrom:note.slideOffset==null?undefined:out.at(-1)?.midi,slideSeconds:note.slideSeconds,confidence:note.confidence,review:note.review,sourceId:s.sourceId,sourceEntry:entry.id,adapted:true,changeId:change.id,phraseId:change.phraseId,changeLabel:change.label,chordNumber:change.from.number,chordName:change.from.name});
  }
  return new Set(out.map(n=>pc(n.midi))).size>=2?out:[];
 }
 function canPlace(entry,clip,selection='all'){
  if(!clip.grid)return false;
  return changes(clip,selection).some(change=>{
   if(change.from.signature===change.to.signature)return false;
   const window=windowFor(entry,change,clip,selection===change.phraseId);return !!window&&!(clip.quiet||[]).some(r=>r.start<change.at&&r.end>window.start);
  });
 }
 function fit(clip,choice,pool=[],placement='ends',selection='all'){
  const hasSong=clip.bassNotes?.length,original=hasSong?clip.bassNotes.map(n=>({...n})):C.fit({...clip,shape:[],fill:'off'});
  const expressive=window.BassExpressiveStudies?.rehearsalBassline(clip,choice);
  let base=choice?.entry?original:expressive?conform(expressive,clip):conform(C.fit({...clip,shape:choice?.shape||[],recorded:!!choice?.recorded,fill:'off'}),clip);
  if(selection!=='all'&&!choice?.entry)base=original.filter(n=>!scope(clip,selection,n.time)).concat(base.filter(n=>scope(clip,selection,n.time))).sort((a,b)=>a.time-b.time);
  if(selection!=='all'&&(!choice?.entry||placement!=='off'))for(const change of changes(clip,selection)){
   landing(base,clip,change.from,change.from.start,change);landing(base,clip,change.to,change.loop?clip.start:change.at,change);
  }
  if(placement==='off'||!clip.grid)return normalise(base);
  const eligible=choice?.entry?[choice]:pool.filter(r=>r.kind==='fills'&&r.style===choice?.style);
  for(const change of transitionsFor(clip,placement,selection)){
   if(placement==='ends'&&change.from.signature===change.to.signature)continue;
   const candidates=eligible.map(row=>({row,score:matchScore(row,clip,change.id)+(row.sourceId===choice?.sourceId?2:row.family===choice?.family?1:0)})).sort((a,b)=>b.score-a.score||b.row.score-a.row.score);
   let added=[];
   for(const {row}of candidates){added=approach(row.entry,change,clip,base.filter(n=>n.time<change.at&&n.midi!==null).at(-1)?.midi,selection===change.phraseId);if(added.length)break;}
   if(!added.length)continue;
   const begin=added[0].time;
   base=base.filter(n=>n.time<begin-.012||n.time>=change.at-.012).map(n=>n.time<begin?{...n,stop:Math.min(n.stop,begin-.006)}:n).concat(added).sort((a,b)=>a.time-b.time);
   landing(base,clip,change.from,change.from.start,change);
   landing(base,clip,change.to,change.loop?clip.start:change.at,change);
  }
  return normalise(base);
 }
 function movement(clip,time){
  const chord=at(clip,time),next=prepare(clip).transitions.find(t=>t.at>time+.012&&t.from===chord);
  return {chord,next,beats:next?(next.at-time)/stepAt(clip,time):null};
 }
 function chordLabel(chord){
  if(!chord)return '';
  const label=/^[♭♯]?[1-7]$/.test(chord.number)?chord.number+' '+names[pc(chord.rootPc)]:chord.name;
  return label+(!safe(chord)?'?':'');
 }
 function noteKind(clip,note){
  const chord=at(clip,note.time),phrase=['fill','run'].includes(note.role)?note.role:null;
  if(note.midi===null)return {kind:'muted',phrase,chord};
  // A note at a chord boundary is not necessarily that chord's landing.
  // Match the actual bass pitch, including inversions, before marking Main.
  if(safe(chord)&&pc(note.midi)===bass(chord))return {kind:'main',phrase,chord};
  if(phrase)return {kind:phrase,phrase,chord};
  if(!safe(chord))return {kind:'unknown',phrase,chord};
  return {kind:chordTones(chord).has(pc(note.midi))?'chord':'passing',phrase,chord};
 }
 return {keyOf,prepare,at,changes,options,phraseOptions,timestamp,progression,degree,chordName,chordTones,passingTones,beat,matchScore,canPlace,conform,approach,fit,movement,chordLabel,noteKind};
})();
