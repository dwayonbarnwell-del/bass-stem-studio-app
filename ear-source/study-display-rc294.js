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
 function clip(row){
  if(!row)return 'Recording';
  if(row.displayName)return row.displayName;
  if(row.originalMix)return row.title.slice(0,12);
  const number=Number(row.id?.slice(5));
  if(number>=23&&number<=32)return 'Bass Lady '+String(number-22).padStart(2,'0');
  if(number>=34&&number<=43){
   const take=row.originalTitle?.match(/(\d+)$/)?.[1];
   return 'Bassmatic '+take;
  }
  const names={
   1:'Groove 01',2:'Groove 02',3:'Open Music 1',5:'Mad Groove 1',6:'Groove 06',7:'Open Music 2',8:'Mad Groove 2',
   9:'Five Styles',10:'Siisi Baidoo',11:'Everyday',12:'Locked',13:'De Weep',14:'Study 14',15:'Open Music 3',16:'Study 16',
   17:'Sweetness',18:'My God',19:'Study 19',20:'Open Music 4',21:'Study 21',22:'Hookin Meh',33:'Bass Lady',
   44:'Ebenezer',46:'Simple Bass',49:'Easy Pattern',52:'Bass Tutor',53:'Bass Lesson',55:'Performance',56:'Bass Cover',
   57:'Rub-a-dub 1',58:'Rub-a-dub 2',59:'Six Rhythms',60:'Groove Study',61:'Techniques',63:'Thumb Style',
   64:'Cameroon 1',65:'Cameroon 2',66:'Cameroon 3',67:'Bass Lesson',68:'Structure',69:'Bass Study',
   70:'Edd Bateman',71:'World Music',72:'Syncopation'
  };
  return names[number]||row.title.slice(0,12);
 }
 function phrase(row,index,count){
  const base=clip(row);
  if(count===1)return base;
  const ending=base.match(/ (\d+)$/);
  const suffix=(ending?' '+ending[1]:'')+'.'+(index+1);
  const stem=ending?base.slice(0,-ending[0].length):base;
  return stem.slice(0,12-suffix.length).trimEnd()+suffix;
 }
 function segments(plan){
  if(!plan?.chords?.length)return[];const map=new Map();
  for(const n of plan.chords){if(!map.has(n.beat))map.set(n.beat,[]);map.get(n.beat).push(n.midi);}
  const entries=[...map].sort((a,b)=>a[0]-b[0]);
  return entries.map(([beat,notes],i)=>{
   const rootPc=pc(notes[0]),intervals=notes.map(n=>pc(n-rootPc)),minor=intervals.includes(3),quality=intervals.includes(6)?(intervals.includes(10)?'m7b5':'dim'):minor?(intervals.includes(10)?'m7':'m'):(intervals.includes(11)?'maj7':intervals.includes(10)?'7':'');
   const degree=plan.kind==='uploaded'?plan.degrees?.[i]:plan.kind==='basslines'?(plan.degrees||window.BassPracticeCore.lines[plan.idea]?.degrees)?.[i]:i===0?plan.from:plan.to;
   return {beat,end:entries[i+1]?.[0]??plan.beats,rootPc,label:(degree?degree+' · ':'')+F.names[rootPc]+quality};
  });
 }
 function active(segments,beat){
  let lo=0,hi=segments.length;
  while(lo<hi){const mid=(lo+hi)>>>1;if(segments[mid].end<=beat)lo=mid+1;else hi=mid;}
  return lo<segments.length&&segments[lo].beat<=beat?lo:-1;
 }
 return {short,label,clip,phrase,segments,active};
})();
