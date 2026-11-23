/* Display the same timed bass phrases in the song player and rehearsal. */
window.BassPhraseView=(()=>{
 const stamp=t=>Math.floor(t/60)+':'+String(Math.floor(t)%60).padStart(2,'0');
 function group(events,bpm,meter,start,end){
  const beat=60/(bpm>0?bpm:90),bar=beat*(meter>0?meter:4),rows=[];
  let phrase,limit=start;
  for(const n of events.slice().sort((a,b)=>a.start-b.start)){
   if(!Number.isFinite(n.start+n.end)||n.end<=n.start||n.end<=start||n.start>=end)continue;
   const onset=Math.max(start,n.start),stop=Math.min(end,n.end);
   if(!phrase||onset-phrase.end>=Math.min(.65,beat*.8)||onset>=limit){
    const last=phrase?.end??start;
    if(onset-last>=1)rows.push({start:last,end:onset,notes:[]});
    phrase={start:onset,end:stop,notes:[]};rows.push(phrase);
    limit=start+(Math.floor((onset-start)/bar)+2)*bar;
   }
   phrase.notes.push(n);phrase.end=Math.max(phrase.end,stop);
  }
  if(phrase&&end-phrase.end>=1)rows.push({start:phrase.end,end,notes:[]});
  return rows;
 }
 function create(host){
  const select=document.createElement('select'),list=document.createElement('div');
  select.setAttribute('aria-label','Phrase labels');
  select.add(new Option('Scale numbers','numbers'));select.add(new Option('Note names','notes'));
  host.replaceChildren(select,list);
  let rows=[],page=-1,markers=[],data=null,lastTime=0,lastPlaying=false;
  select.onchange=()=>{page=-1;draw(lastTime,lastPlaying);};
  function set(events,bpm,meter,start,end,label){
   if(data===events)return;
   data=events;rows=group(events,bpm,meter,start,end);page=-1;
   set.label=label;
  }
  function draw(time,playing){
   lastTime=time;lastPlaying=playing;
   let lo=0,hi=rows.length;
   while(lo<hi){const mid=(lo+hi)>>>1;if(rows[mid].start<=time)lo=mid+1;else hi=mid;}
   const first=Math.floor(Math.max(0,lo-1)/6)*6;
   if(page!==first){
    page=first;markers=[];list.replaceChildren();
    if(!rows.length)list.textContent='No bass notes in this passage.';
    for(const row of rows.slice(first,first+6)){
     const line=document.createElement('div'),range=document.createElement('time'),chips=document.createElement('div');
     line.className='bass-phrase-row';
     const a=stamp(row.start),b=stamp(row.end);
     range.textContent=a===b?a:a+' – '+b;
     if(!row.notes.length)chips.textContent='Rest';
     for(const note of row.notes){
      const chip=document.createElement('span');
      chip.textContent=note.midi===null?'×':set.label(note,select.value);
      chips.append(chip);markers.push({chip,note});
     }
     line.append(range,chips);list.append(line);
    }
   }
   for(const {chip,note} of markers)chip.classList.toggle('sounding',playing&&note.start<=time&&time<note.end);
  }
  return {set,draw,invalidate(){data=null;page=-1;}};
 }
 return {create,group};
})();
