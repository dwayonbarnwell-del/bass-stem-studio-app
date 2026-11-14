/* RC256: presentation timing only. Never quantise or rewrite detected events. */
window.BassPlaybackTiming=(()=>{
 const seconds=value=>Number.isFinite(Number(value))?Math.max(0,Math.min(1,Number(value))):0;
 function outputDelay(context,processing=0){
  if(!context||context.state!=='running')return 0;
  return seconds(context.outputLatency)+seconds(context.baseLatency)+seconds(processing);
 }
 function position(time,{playing=false,rate=1,floor=0,delay=0}={}){
  const at=Math.max(0,Number(time)||0);
  if(!playing)return at;
  return Math.max(Math.min(at,Math.max(0,Number(floor)||0)),at-seconds(delay)*Math.max(.25,Number(rate)||1));
 }
 function index(items,startOf=item=>item.start,endOf=item=>item.end){
  const rows=items.map(item=>({item,start:startOf(item),end:endOf(item)})).filter(r=>Number.isFinite(r.start+r.end)&&r.end>r.start).sort((a,b)=>a.start-b.start);
  let latest=-Infinity;const ends=rows.map(r=>(latest=Math.max(latest,r.end)));
  return {at(time){
   let lo=0,hi=rows.length;
   while(lo<hi){const mid=(lo+hi)>>>1;if(rows[mid].start<=time)lo=mid+1;else hi=mid;}
   for(let i=lo-1;i>=0&&ends[i]>time;i--)if(time<rows[i].end)return rows[i].item;
   return null;
  }};
 }
 return {outputDelay,position,index};
})();
