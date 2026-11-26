/* Short display names never replace stable study IDs or musical data. */
window.BassStudyDisplay=(()=>{
 const pc=n=>(n%12+12)%12,F=window.BassFillCore;
 const genres=/\b(gospel|worship|reggae|praise|highlife|makossa|seben|soukous|zouk|woro|ariaria|afrobeat|soca|sungura|mbalax|mbaqanga|african|jazz|blues|soul|funk|pentatonic|chromatic)\b/gi;
 function fitName(text,limit=12){
  text=String(text||'Pattern').replace(/\s+/g,' ').trim();if(text.length<=limit)return text;
  const code=text.match(/\s+(\d+(?:\.\d+)*)$/);
  if(code&&code[1].length<limit-2)return suffix(text.slice(0,-code[0].length),' '+code[1],limit);
  const words=text.split(' ');let value='';
  for(const word of words){if((value+' '+word).trim().length>limit)break;value=(value+' '+word).trim();}
  const abbreviated=({World:'Wld',Bmatics:'Bmat',Practice:'Prac',Groove:'Grv',Pattern:'Pat',Diminished:'Dim',Conversation:'Talk',Turnaround:'Turn'})[words[0]]||'Pattern';
  return value||(abbreviated.length<=limit?abbreviated:limit>=3?'Pat':'P');
 }
 function suffix(text,ending,limit=12){return fitName(text,Math.max(1,limit-ending.length))+ending;}
 function sourceName(family,code){
  const name=({'Bass Lady':'B Lady',Bassmatics:'Bmatics','World Methods':'World','Practice bassline':'Practice','Practice studies':'Practice','Recorded bass':'Take','Reggae recordings':'Take'})[family]||(/^Practice/.test(family)?'Practice':'Take');
  const compact=code.length+name.length+1<=12?name:({'B Lady':'Lady',Bmatics:'Bmat',Practice:'Prac'})[name]||name;
  return suffix(compact,' '+code);
 }
 const sourceFamilies={'bass-lady':'Bass Lady',bassmatics:'Bassmatics','world-method':'World Methods'};
 let sourceCount=-1;const sourceNumbers=new Map();
 function recordingNumber(row){
  const rows=window.BassUploadedCore?.items||[];
  if(sourceCount!==rows.length){
   const counts=new Map();sourceNumbers.clear();
   for(const item of rows){const family=item.sourceFamily||sourceFamilies[item.group]||(item.group==='reggae'?'Reggae recordings':'Recorded bass'),number=Number(item.id.match(/^(?:lady|matics)-(\d+)$/)?.[1])||(counts.get(family)||0)+1;counts.set(family,Math.max(number,counts.get(family)||0));sourceNumbers.set(item.id,number);}
   sourceCount=rows.length;
  }
  return sourceNumbers.get(row.id)||1;
 }
 function menu(text){return ({'Gospel & Contemporary':'Gospel/Cont.','Jazz & Chromatic':'Jazz/Chrom.','Blues & Pentatonic':'Blues/Pent.','Funk & Soul':'Funk/Soul','Funk / soul':'Funk/Soul','Soukous / seben':'Souk./Seben','Soukous & Seben':'Souk./Seben','Soukous & seben':'Souk./Seben','Funk & fusion':'Funk/Fusion','African praise':'Afr. Praise','World Methods':'World Method','Practice patterns':'Practice'})[text]||fitName(text);}
 function names(rows,caption){const used=new Set();return new Map(rows.map((row,index)=>{const base=short(caption(row));let value=base;if(used.has(value))value=suffix(base,' '+(index+1));while(used.has(value))value=suffix(base,' '+(index+1)+'.'+used.size.toString(36));used.add(value);return [row,value];}));}
 function short(text){
  text=String(text||'Study').replace(/\s*·.*$/,'').replace(/\b(original|style|study|inspired|bassline|bass|lesson)\b/gi,'').replace(genres,'').replace(/R\s*&\s*B/gi,'').replace(/Chord-tone/gi,'Chord').replace(/Diminished/gi,'Dim').replace(/Minor/gi,'Min').replace(/Major/gi,'Maj').replace(/\s+/g,' ').trim();
  if(/^\d+(?:\.\d+)*$/.test(text))text='Groove '+text;
  return fitName(text||'Pattern');
 }
 const labelCache=new Map();
 function label(kind,row){
  const P=window.BassPracticeCore,Q=window.BassCuratedStudies,U=window.BassUploadedCore;
  const rows=kind==='basslines'?P.lines:kind==='runs'?P.runs:F.styles;
  if(labelCache.get(kind)?.length!==rows.length){
   const used=new Set(),labels=new Map();
   for(const [index,item]of rows.entries()){
    const entry=kind==='basslines'?null:Q?.get(kind,index),recording=entry?.recordedStudy,source=recording&&U?.find(recording.sourceId);
    let name=kind==='basslines'?item.artist==='marley'?'Barrett':short(item.name):short(item[0]);
    if(source){
     const peers=Q.entries.filter(e=>e.kind===kind&&e.recordedStudy?.sourceKind===recording.sourceKind&&e.recordedStudy?.sourceId===recording.sourceId&&e.recordedStudy?.sourcePart===recording.sourcePart);
     name=suffix(phrase(source,recording.sourcePart||0,window.BassRecordedPhrases?.[source.id]?.length||1),'.'+(peers.indexOf(entry)+1));
    }else if(recording?.sourceKind==='basslines'){
     const peers=Q.entries.filter(e=>e.kind===kind&&e.recordedStudy?.sourceKind==='basslines'&&e.recordedStudy?.sourceId===recording.sourceId&&e.recordedStudy?.sourcePart===recording.sourcePart);
     const number=P.lines.findIndex(x=>x.id===recording.sourceId)+1;
     name=sourceName('Practice',String(number||index+1).padStart(2,'0')+(recording.sourcePart?'.'+(recording.sourcePart+1):'')+'.'+(peers.indexOf(entry)+1));
    }
    if(!source&&/^Pattern(?:\s*\d+)?$/.test(name))name=sourceName('Practice',String(index+1).padStart(2,'0'));
    let caption=name;if(used.has(caption))caption=suffix(name,' '+(index+1));
    while(used.has(caption))caption=suffix(name,' '+(index+1)+'.'+used.size.toString(36));
    used.add(caption);labels.set(item,caption);
   }
   labelCache.set(kind,{length:rows.length,labels});
  }
  return labelCache.get(kind).labels.get(row)||short(row?.name||row?.[0]);
 }
 function originalClip(row){
  if(!row)return 'Recording';
  if(row.displayName)return row.displayName;
  if(row.originalMix)return row.title;
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
  return names[number]||row.title;
 }
 function clip(row){
  const family=row?.sourceFamily||sourceFamilies[row?.group];
  if(['Bass Lady','Bassmatics','World Methods'].includes(family))return sourceName(family,String(recordingNumber(row)).padStart(2,'0'));
  const caption=originalClip(row).replace(/World Methods?/gi,'World').replace(/Bass Lady/gi,'B Lady').replace(/Bassmatics?/gi,'Bmatics');
  return fitName(caption.replace(genres,'').replace(/\s+/g,' ').trim().replace(/^(\d+(?:\.\d+)*)$/,'Groove $1')||'Recording');
 }
 function phrase(row,index,count){
  const base=clip(row);
  if(count===1)return base;
  const ending=base.match(/ (\d+)$/);
  const suffix=(ending?' '+ending[1]:'')+'.'+(index+1);
  const stem=ending?base.slice(0,-ending[0].length):base;
  return fitName(stem,12-suffix.length)+suffix;
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
 const collator=new Intl.Collator('en-GB',{numeric:true,sensitivity:'base'});
 function sortMenu(menu){
  const selected=menu.value;
  for(const group of menu.querySelectorAll('optgroup'))sortMenu(group);
  const children=[...menu.children],pinned=new Set(['auto','roots','song-bass']);
  const label=node=>node.label||node.textContent;
  children.sort((a,b)=>Number(pinned.has(b.value))-Number(pinned.has(a.value))||collator.compare(label(a),label(b)));
  menu.append(...children);
  if(selected!==undefined)menu.value=selected;
 }
 return {sortMenu,short,label,clip,phrase,segments,active,menu,fitName,suffix,sourceName,names,recordingNumber};
})();
