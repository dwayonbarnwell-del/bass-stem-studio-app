/* FretFlow: exact MIDI pitches; suggested fingering in standard bass tuning. */
(function(root){
 'use strict';
 const tunings={4:[28,33,38,43],5:[23,28,33,38,43],6:[23,28,33,38,43,48]};
 const names=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
 const colours=['#aa83ff','#bc96ff','#ef6acb','#ff91cf','#ff7769','#ffb44b','#e5cb53','#f5d45f','#b5d864','#60dda0','#68c9dd','#80a9ff'];
 const tuning=n=>(tunings[n]||tunings[5]).slice();
 const name=m=>names[((m%12)+12)%12];
 const pitch=m=>name(m)+(Math.floor(m/12)-1);
 const colour=m=>colours[((m%12)+12)%12];
 function candidates(midi,count){return tuning(count).flatMap((open,string)=>Number.isInteger(midi)&&midi>=open&&midi<=open+24?[{string,fret:midi-open,open}]:[]);}
 function plan(notes,count=5,transpose=0){
  const shift=Number.isInteger(transpose)?transpose:0;
  const rows=(notes||[]).filter(n=>n&&Number.isInteger(n.midi)&&Number.isFinite(n.start)&&Number.isFinite(n.end)&&n.start>=0&&n.end>n.start)
   .map((n,i)=>({source:n,id:i,start:n.start,end:n.end,midi:n.midi+shift,position:null})).sort((a,b)=>a.start-b.start||a.id-b.id);
  let phrase=[];
  function finish(){
   if(!phrase.length)return;
   const layers=[];
   for(let i=0;i<phrase.length;i++){
    const layer=candidates(phrase[i].midi,count).map(p=>({...p,cost:Infinity,previous:0}));
    if(!i)for(const p of layer)p.cost=p.fret===0?1:Math.abs(p.fret-5)*.12;
    else for(const p of layer)for(let j=0;j<layers[i-1].length;j++){
     const b=layers[i-1][j],move=p.fret&&b.fret?Math.max(0,Math.abs(p.fret-b.fret)-3):.25;
     const score=b.cost+move*1.8+Math.abs(p.string-b.string)*.7+Math.abs(p.fret-5)*.12+(phrase[i].midi===phrase[i-1].midi&&p.string!==b.string?2:0);
     if(score<p.cost){p.cost=score;p.previous=j;}
    }
    layers.push(layer);
   }
   let j=layers.at(-1).reduce((best,p,i,a)=>p.cost<a[best].cost?i:best,0);
   for(let i=layers.length-1;i>=0;i--){const p=layers[i][j];phrase[i].position={string:p.string,fret:p.fret,open:p.open};j=p.previous;}
   phrase=[];
  }
  for(const row of rows){
   if(!candidates(row.midi,count).length){finish();continue;}
   if(phrase.length&&(row.start-phrase.at(-1).end>1.5||Math.abs(row.midi-phrase.at(-1).midi)>12||phrase.length>=96))finish();
   phrase.push(row);
  }
  finish();
  let max=0;for(const row of rows){max=Math.max(max,row.end);row.until=max;}
  return rows;
 }
 function nearby(rows,time,past=2,future=4){
  let lo=0,hi=rows.length;while(lo<hi){const m=(lo+hi)>>>1;if(rows[m].until<=time-past)lo=m+1;else hi=m;}
  const out=[];for(let i=lo;i<rows.length&&rows[i].start<time+future;i++)if(rows[i].end>time-past)out.push(rows[i]);return out;
 }
 const active=(rows,time)=>nearby(rows,time,0,.000001).filter(n=>n.start<=time&&time<n.end);
 // Position between the adjacent fret wires, using equal-temperament spacing.
 const fretWire=f=>1-Math.pow(2,-f/12);
 const fretCentre=f=>f===0?-.017:(fretWire(f-1)+fretWire(f))/2;
 const api={tuning,name,pitch,colour,candidates,plan,nearby,active,fretWire,fretCentre};
 if(typeof module!=='undefined')module.exports=api;else root.BassFretFlowCore=api;
})(typeof window==='undefined'?globalThis:window);
