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
 function create(host,onRepeat=()=>{},selected=()=>null){
  const select=document.createElement('select'),list=document.createElement('div');
  select.setAttribute('aria-label','Phrase labels');
  select.add(new Option('Scale numbers','numbers'));select.add(new Option('Note names','notes'));
  host.replaceChildren(select,list);
  let rows=[],lines=[],data=null,active=-1,pressed=-1,lastTime=0,lastPlaying=false;
  function render(){
   active=pressed=-1;
   lines=rows.map((row,i)=>{
    const line=document.createElement('div'),range=document.createElement('time'),chips=document.createElement('div');
    line.className='bass-phrase-row';
    const a=stamp(row.start),b=stamp(row.end);
    range.textContent=a===b?a:a+' – '+b;
    if(row.notes.length){
     line.tabIndex=0;line.setAttribute('role','button');line.setAttribute('aria-pressed','false');
     line.title='Repeat phrase';line.onclick=()=>{onRepeat(row);draw(lastTime,lastPlaying);};
     line.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();line.click();}};
    }else chips.textContent='Rest';
    for(const note of row.notes){
     const chip=document.createElement('span');
     chip.textContent=note.midi===null?'×':set.label(note,select.value);chips.append(chip);
    }
    line.append(range,chips);return line;
   });
   list.replaceChildren(...lines);
   if(!rows.length)list.textContent='No bass notes in this passage.';
  }
  select.onchange=()=>{render();draw(lastTime,lastPlaying);};
  function set(events,bpm,meter,start,end,label){
   if(data===events)return;
   data=events;rows=group(events,bpm,meter,start,end);set.label=label;render();
  }
  let lastSelection;
  function draw(time,playing){
   lastTime=time;lastPlaying=playing;
   let lo=0,hi=rows.length;
   while(lo<hi){const mid=(lo+hi)>>>1;if(rows[mid].start<=time)lo=mid+1;else hi=mid;}
   const i=lo-1,r=selected();
   if(lastSelection!==r||pressed===-1&&r){
    if(lines[pressed])lines[pressed].setAttribute('aria-pressed','false');
    pressed=r?rows.findIndex(row=>row.start===r.start&&row.end===r.end):-1;
    if(pressed>=0)lines[pressed].setAttribute('aria-pressed','true');
    lastSelection=r;
   }
   if(active!==i){
    if(lines[active])for(const chip of lines[active].querySelectorAll('.sounding'))chip.classList.remove('sounding');
    active=i;
    if(lines[i]){
     const top=lines[i].offsetTop;
     if(top<list.scrollTop||top+lines[i].offsetHeight>list.scrollTop+list.clientHeight)list.scrollTop=top;
    }
   }
   if(i>=0)rows[i].notes.forEach((n,k)=>lines[i].lastElementChild.children[k].classList.toggle('sounding',playing&&n.start<=time&&time<n.end));
  }
  return {set,draw,invalidate(){data=null;}};

 }
 return {create,group};
})();
