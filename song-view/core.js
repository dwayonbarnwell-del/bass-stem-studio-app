/* Full-song display data. Source notes and chord timings are never changed. */
window.BassSongViewCore=(()=>{
 'use strict';
 const valid=v=>v!==null&&v!==''&&Number.isFinite(Number(v));
 const time=t=>Math.floor(Math.max(0,t)/60)+':'+String(Math.floor(Math.max(0,t)%60)).padStart(2,'0');
 function clean(events,duration,notes=false){return (events||[]).filter(e=>valid(e.start)&&Number(e.start)>=0&&Number(e.start)<duration&&(!notes||valid(e.midi))).map(e=>({...e,start:Number(e.start),end:valid(e.end)?Math.min(duration,Number(e.end)):null})).sort((a,b)=>a.start-b.start).map((e,i,all)=>({...e,end:e.end??all[i+1]?.start??duration})).filter(e=>e.end>e.start);}
 function sections(s){
  const duration=Number(s.duration)||0;if(duration<=0)return [];
  let source=Array.isArray(s.sections)?s.sections:Object.entries(s.sections||{}).map(([name,v])=>({name,...v}));
  const sanitise=arr=>(arr||[]).filter(v=>valid(v.start??v.coreStart)&&valid(v.end??v.coreEnd)).map((v,i)=>({id:i,name:String(v.name||v.label||'Section '+(i+1)),start:Math.max(0,Number(v.start??v.coreStart)),end:Math.min(duration,Number(v.end??v.coreEnd))})).filter(v=>v.end>v.start);
  let named=sanitise(source);if(!named.length)named=sanitise(s.parts);
  const boundaries=[...new Set([0,duration,...named.flatMap(v=>[v.start,v.end])])].sort((a,b)=>a-b),out=[];
  for(let i=0;i<boundaries.length-1;i++){const start=boundaries[i],end=boundaries[i+1],match=named.filter(v=>v.start<=start&&v.end>=end).sort((a,b)=>b.start-a.start||(a.end-a.start)-(b.end-b.start))[0],id=match?.id??-1,name=match?.name||'Song';const previous=out.at(-1);if(previous?.sourceId===id&&previous.end===start)previous.end=end;else out.push({id:out.length,sourceId:id,name,start,end});}
  return out;
 }
 function index(events){let max=0;return {events,maxEnd:events.map(e=>max=Math.max(max,e.end))};}
 function active(ix,t){const {events,maxEnd}=ix;let lo=0,hi=events.length;while(lo<hi){const mid=(lo+hi)>>>1;if(events[mid].start<=t)lo=mid+1;else hi=mid;}const out=[];for(let i=lo-1;i>=0&&maxEnd[i]>t;i--)if(events[i].end>t)out.push(i);return out.reverse();}
 function chordRuns(events){
  const runs=[];
  for(const event of events){const last=runs.at(-1),same=last&&valid(last.rootPc)&&valid(event.rootPc)&&Number(last.rootPc)===Number(event.rootPc)&&last.quality===event.quality&&(last.bassPc??null)===(event.bassPc??null)&&!!last.uncertain===!!event.uncertain&&!!last.manual===!!event.manual;
   if(same&&event.start>=last.start&&event.start<=last.end+.001){last.end=Math.max(last.end,event.end);if(valid(last.confidence)&&valid(event.confidence))last.confidence=Math.min(Number(last.confidence),Number(event.confidence));}
   else runs.push({...event});
  }return runs;
 }
 function build(s){const duration=Number(s.duration)||0,notes=clean(s.notes,duration,true),chords=clean(s.chords,duration),parts=sections(s),rows=[];let ni=0,ci=0;
  for(const part of parts){part.rows=[];for(let start=part.start;start<part.end-.0001;start+=4){const end=Math.min(part.end,start+4);while(ni<notes.length&&notes[ni].end<=start)ni++;while(ci<chords.length&&chords[ci].end<=start)ci++;const row={id:rows.length,part:part.id,start,end,notes:[],chords:[]};for(let n=ni;n<notes.length&&notes[n].start<end;n++)if(notes[n].end>start)row.notes.push({...notes[n],start:Math.max(start,notes[n].start),end:Math.min(end,notes[n].end),continued:notes[n].start<start});for(let c=ci;c<chords.length&&chords[c].start<end;c++)if(chords[c].end>start)row.chords.push({...chords[c],start:Math.max(start,chords[c].start),end:Math.min(end,chords[c].end),continued:chords[c].start<start});part.rows.push(row);rows.push(row);}}
  for(const row of rows)row.chords=chordRuns(row.chords);
  return {duration,notes,chords,parts,rows,noteIndex:index(notes),chordIndex:index(chords),rowIndex:index(rows)};
 }
 function repeatRanges(ranges,duration){
  const out=[];
  for(const r of (ranges||[]).filter(r=>valid(r.start)&&valid(r.end)).map(r=>({start:Math.max(0,Number(r.start)),end:Math.min(duration,Number(r.end))})).filter(r=>r.end>r.start).sort((a,b)=>a.start-b.start)){
   const last=out.at(-1);if(last&&r.start<=last.end+.0001)last.end=Math.max(last.end,r.end);else out.push(r);
  }return out;
 }
 function rangeSelected(ranges,start,end){return ranges.some(r=>r.start<=start+.0001&&r.end>=end-.0001);}
 function toggleRange(ranges,start,end,duration){
  const current=repeatRanges(ranges,duration),target=repeatRanges([{start,end}],duration)[0];if(!target)return current;
  if(!rangeSelected(current,target.start,target.end))return repeatRanges([...current,target],duration);
  return current.flatMap(r=>r.end<=target.start||r.start>=target.end?[r]:[{start:r.start,end:target.start},{start:target.end,end:r.end}].filter(r=>r.end>r.start+.0001));
 }
 return {time,clean,sections,index,active,build,repeatRanges,rangeSelected,toggleRange};
})();
