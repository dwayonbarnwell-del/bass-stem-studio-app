/* Short display names never replace stable study IDs or musical data. */
window.BassStudyDisplay=(()=>{
 const pc=n=>(n%12+12)%12,F=window.BassFillCore;
 function short(text){
  text=String(text||'Study').replace(/\s*·.*$/,'').replace(/\b(original|style|study|inspired|bassline|bass|lesson)\b/gi,'').replace(/\b(gospel|worship|reggae|praise|highlife|makossa|pentatonic|chromatic)\b/gi,'').replace(/\s+/g,' ').trim();
  if(!text)text='Pattern';return text.length<=12?text:text.slice(0,12).trim();
 }
 function label(kind,row){
  if(kind==='basslines'){
   let name=row.artist==='marley'?'AstonBarrett':short(row.name);const progression=row.degrees.join('–');
   const same=window.BassPracticeCore.lines.filter(x=>(x.artist==='marley'?'AstonBarrett':short(x.name))===name&&x.degrees.join('–')===progression);
   if(same.length>1){const suffix=' '+(same.indexOf(row)+1);name=name.slice(0,12-suffix.length).trim()+suffix;}
   return name+' '+progression;
  }
  return short(row?.[0]);
 }
 const clip=row=>short(row?.title||row?.originalTitle||'Recording');
 function segments(plan){
  if(!plan?.chords?.length)return[];const map=new Map();
  for(const n of plan.chords){if(!map.has(n.beat))map.set(n.beat,[]);map.get(n.beat).push(n.midi);}
  const entries=[...map].sort((a,b)=>a[0]-b[0]);
  return entries.map(([beat,notes],i)=>{
   const rootPc=pc(notes[0]),intervals=notes.map(n=>pc(n-rootPc)),minor=intervals.includes(3),quality=intervals.includes(6)?(intervals.includes(10)?'m7b5':'dim'):minor?(intervals.includes(10)?'m7':'m'):(intervals.includes(11)?'maj7':intervals.includes(10)?'7':'');
   const degree=plan.kind==='basslines'?window.BassPracticeCore.lines[plan.idea]?.degrees[i]:i===0?plan.from:plan.to;
   return {beat,end:entries[i+1]?.[0]??plan.beats,rootPc,label:(degree?degree+' · ':'')+F.names[rootPc]+quality};
  });
 }
 const active=(segments,beat)=>segments.findIndex(s=>beat>=s.beat&&beat<s.end);
 return {short,label,clip,segments,active};
})();
