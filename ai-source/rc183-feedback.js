window.BassFeedback=(()=>{
 function score(reference,played,tolerance=.3){
  const clean=rows=>rows.filter(n=>Number.isInteger(n.midi)&&Number.isFinite(n.start)&&Number.isFinite(n.end)&&n.end>n.start).slice().sort((a,b)=>a.start-b.start);
  const a=clean(reference),b=clean(played);if(!a.length||!b.length)throw Error('Not enough clear notes to compare. Use a solo bass recording.');
  if(a.length>1500||b.length>1500)throw Error('Choose a shorter passage.');
  const width=b.length+1,trace=new Uint8Array((a.length+1)*width);let prev=Float32Array.from({length:width},(_,j)=>j),next=new Float32Array(width);
  for(let j=1;j<width;j++)trace[j]=2;
  for(let i=1;i<=a.length;i++){
   next[0]=i;trace[i*width]=1;
   for(let j=1;j<width;j++){
    const dt=Math.abs(a[i-1].start-b[j-1].start),pair=dt>tolerance?Infinity:prev[j-1]+(a[i-1].midi===b[j-1].midi?0:1)+dt/tolerance*.5;
    const missed=prev[j]+1,extra=next[j-1]+1;
    if(pair<=missed&&pair<=extra){next[j]=pair;trace[i*width+j]=0;}else if(missed<=extra){next[j]=missed;trace[i*width+j]=1;}else{next[j]=extra;trace[i*width+j]=2;}
   }
   [prev,next]=[next,prev];
  }
  const rows=[];let i=a.length,j=b.length;
  while(i||j){const direction=trace[i*width+j];if(i&&j&&direction===0){const ref=a[--i],got=b[--j];rows.push({kind:ref.midi===got.midi?'matched':'different',start:ref.start,end:ref.end,expected:ref.midi,played:got.midi,ms:Math.round((got.start-ref.start)*1000)});}else if(i&&(!j||direction===1)){const ref=a[--i];rows.push({kind:'not detected',start:ref.start,end:ref.end,expected:ref.midi});}else{const got=b[--j];rows.push({kind:'extra',start:got.start,end:got.end,played:got.midi});}}
  rows.reverse();const matched=rows.filter(r=>r.kind==='matched'),errors=matched.map(r=>Math.abs(r.ms)).sort((a,b)=>a-b);
  return {rows,total:a.length,matched:matched.length,different:rows.filter(r=>r.kind==='different').length,missed:rows.filter(r=>r.kind==='not detected').length,extra:rows.filter(r=>r.kind==='extra').length,timing:errors.length?errors[Math.floor(errors.length/2)]:null};
 }
 async function transcribe(buffer,start,length,cancelled=()=>false){
  if(!Number.isFinite(start+length)||start<0||length<1||length>60||start+length>buffer.duration+.05)throw Error('The selected passage must fit inside the recording.');
  const sr=22050,off=new OfflineAudioContext(1,Math.ceil(length*sr),sr),src=off.createBufferSource();src.buffer=buffer;src.connect(off.destination);src.start(0,start,length);
  const rendered=await off.startRendering(),x=rendered.getChannelData(0),out=[];let last=null,candidate=null,count=0;
  for(let i=0;i+4096<=x.length;i+=441){
   if(cancelled())throw Error('Cancelled.');
   const p=BassPracticeDSP.pitch(x.subarray(i,i+4096),sr,28),t=i/sr;
   if(!p||p.midi<23||p.midi>84){candidate=null;count=0;last=null;}
   else{
    if(candidate?.midi===p.midi)count++;else{candidate={midi:p.midi,start:t};count=1;}
    if(count>=3){if(last&&last.midi===p.midi&&t-last.end<.08)last.end=t+.02;else{last={midi:p.midi,start:candidate.start,end:t+.02};out.push(last);}}
   }
   if(i%(441*15)===0)await new Promise(r=>setTimeout(r,0));
  }
  return out.filter(n=>n.end-n.start>=.06);
 }
 function passages(result,start,duration){
  const ranges=[];
  for(const row of result.rows.filter(r=>r.kind!=='matched'||Math.abs(r.ms)>100)){
   const a=Math.max(0,start+row.start-1),b=Math.min(duration,start+row.end+1),last=ranges.at(-1);
   if(last&&a<=last.end)last.end=Math.max(last.end,b);else ranges.push({name:'Recording review '+(ranges.length+1),start:a,end:b});
  }
  return ranges.slice(0,3);
 }
 function reviewPlans(history,duration){
  const groups=[];
  for(const entry of (Array.isArray(history)?history:[]).slice(-10)){
   const seen=new Set();
   for(const range of Array.isArray(entry.passages)?entry.passages:[]){
    if(!Number.isFinite(range.start+range.end)||range.start<0||range.end<=range.start||range.end>duration)continue;
    let group=groups.find(g=>Math.min(g.end,range.end)-Math.max(g.start,range.start)>0);
    if(!group){group={start:range.start,end:range.end,count:0};groups.push(group);}
    if(!seen.has(group)){group.count++;seen.add(group);}
   }
  }
  return groups.sort((a,b)=>b.count-a.count||a.start-b.start).slice(0,3).sort((a,b)=>a.start-b.start).map((r,i)=>({name:'Recording review '+(i+1),start:r.start,end:r.end}));
 }
 return {score,transcribe,passages,reviewPlans};
})();
