/* RC208: Church-focused lead voice and basic chord evidence. Runs on the device. */
window.BassWorshipLive = (()=>{
 'use strict';
 const labels=['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
 const midiName=m=>labels[((m%12)+12)%12]+(Math.floor(m/12)-1);
 const triads=[];
 for(let root=0;root<12;root++)for(const [suffix,pcs] of [['',[0,4,7]],['m',[0,3,7]]])triads.push({root,label:labels[root]+suffix,pcs:pcs.map(x=>(root+x)%12)});
 const empty=()=>({lead:null,chord:'—',confidence:0,hist:Array(12).fill(0),seconds:0,voiceFrames:0,chordFrames:0});
 function chordRank(chroma){
  const total=chroma.reduce((s,v)=>s+v,0),peak=Math.max(...chroma);
  if(total<.1||peak<.1)return null;
  let best=null,runner=-Infinity;
  for(const c of triads){
   const a=c.pcs.map(p=>chroma[p]),min=Math.min(...a),inside=a.reduce((s,v)=>s+v,0)/total;
   if(min<peak*.18||inside<.52)continue;
   const score=inside+.11*min/peak;
   if(!best||score>best.score){runner=best?.score??-Infinity;best={label:c.label,score,inside};}
   else if(score>runner)runner=score;
  }
  return best&&best.score-runner>=.045?best:null;
 }
 // Pitch candidates come from the existing on-device note model. Continue a singing
 // line rather than picking the loudest piano/choir note in each small frame.
 function bestLead(d,track){
  if(track.length<7)return null;
  // A small Viterbi tracker prefers one continuous singing line and keeps
  // a quieter, sustained note over a louder but fleeting competing sound.
  let previous=[],paths=[];
  for(let frame=0;frame<track.length;frame++){
   const current=[];
   for(const note of track[frame]){
    let best=-Infinity,bestIdx=-1;
    for(let j=0;j<previous.length;j++){
     const distance=Math.abs(track[frame-1][j].midi-note.midi);
     const penalty=distance===0?0:distance<=2?.018:distance<=5?.08:distance<=9?.17:.26;
     const value=previous[j].score-penalty;
     if(value>best){best=value;bestIdx=j;}
    }
    const bonus=note.midi>=52&&note.midi<=85?.025:0;
    current.push({score:(frame?best:0)+.30*note.value+bonus,prev:bestIdx});
   }
   previous=current;paths.push(current);
  }
  let idx=previous.reduce((best,v,i)=>v.score>previous[best].score?i:best,0);
  const trajectory=[];
  for(let f=track.length-1;f>=0;f--){
   trajectory.push({midi:track[f][idx].midi,value:track[f][idx].value});
   idx=paths[f][idx].prev;
   if(idx<0&&f>0)break;
  }
  trajectory.reverse();
  const recent=trajectory.slice(-Math.max(8,Math.ceil(trajectory.length*.4)));
  if(recent.length<6)return null;
  const tally=new Map();let strength=0;
  for(const n of recent){tally.set(n.midi,(tally.get(n.midi)||0)+n.value);strength+=n.value;}
  const grouped=[...tally].sort((a,b)=>b[1]-a[1]);
  const end=recent.at(-1).midi;
  let best=grouped[0]?.[0];
  // A new strong note may be taking over at the end of a phrase.
  const ending=recent.slice(-Math.min(7,recent.length));
  if(ending.filter(n=>n.midi===end).length>=4)best=end;
  const share=(tally.get(best)||0)/Math.max(.1,strength),average=strength/recent.length;
  const confidence=Math.min(1,(share*.75+average*.35)*1.2);
  return confidence>=.37?{midi:best,note:midiName(best),confidence}:null;
 }

 function analyse(d){
  if(!d||!d.values||!Number.isFinite(d.frames)||!Number.isFinite(d.pitches)||d.frames<1)return empty();
  const hist=Array(12).fill(0),votes=new Map(),track=[];
  let voiced=0,chordFrames=0;
  for(let f=0;f<d.frames;f++){
   const row=d.values.subarray(f*d.pitches,(f+1)*d.pitches);
   let peak=0;for(let p=0;p<row.length;p++)if(row[p]>peak)peak=row[p];
   if(peak<.32)continue;
   voiced++;
   const chroma=new Float64Array(12),voice=[];let distinct=0;
   for(let p=0;p<row.length;p++){
    const midi=p+21,v=row[p];
    if(v<Math.max(.26,peak*.30))continue;
    if(midi>=43&&midi<=89&&v>=Math.max(.31,peak*.53))voice.push({midi,value:v});
    if(midi>=40&&midi<=85){
     const pc=midi%12,amount=Math.sqrt(v);
     if(!chroma[pc])distinct++;
     chroma[pc]+=amount;
    }
   }
   voice.sort((a,b)=>b.value-a.value);
   if(voice.length)track.push(voice.slice(0,5));
   if(distinct>=3){
    chordFrames++;
    const candidate=chordRank(chroma);
    if(candidate){
     const vote=votes.get(candidate.label)||{n:0,weight:0};
     vote.n++;vote.weight+=candidate.inside;votes.set(candidate.label,vote);
    }
    for(let j=0;j<12;j++)hist[j]+=chroma[j];
   }
  }
  let chord='—',confidence=0;
  const ranks=[...votes].sort((a,b)=>b[1].weight-a[1].weight);
  if(ranks.length&&chordFrames>=Math.max(4,d.frames*.14)){
   const best=ranks[0],other=ranks[1]?.[1].weight||0;
   confidence=best[1].weight/chordFrames;
   if(best[1].n>=Math.max(4,chordFrames*.45)&&best[1].weight>other*1.2&&confidence>=.42)chord=best[0];
  }
  // Worship rooms often include much stronger bass and piano fundamentals.
  // Follow a supported upper singing line where present; use a lower voice
  // range only when there is no sustained upper line. Do not follow bass notes.
  const upperFrames=track.filter(row=>row.some(n=>n.midi>=60&&n.midi<=88&&n.value>=.34)).length;
  const minVoice=upperFrames>=Math.max(7,track.length*.26)?60:50;
  const singer=track.map(row=>row.filter(n=>n.midi>=minVoice&&n.midi<=88)).filter(row=>row.length);
  return {lead:bestLead(d,singer),chord,confidence,hist,seconds:voiced*256/22050,voiceFrames:voiced,chordFrames};
 }
 // Keep a chord through short gaps, but never invent a new chord from a single frame.
 function createFollower(){
  let chord='—',chordNext='',chordCount=0,chordSeen=0,lead=null,leadSeen=0;
  return {
   update(e,seconds){
    if(e.chord!=='—'){
     if(e.chord===chord){chordCount=0;chordNext='';chordSeen=seconds;}
     else{
      chordCount=e.chord===chordNext?chordCount+1:1;chordNext=e.chord;
      // A clearly supported chord can be shown at once. Otherwise wait for
      // a second matching result, so ordinary choir notes do not cause jumps.
      if(e.confidence>=.86||(chordCount>=2&&e.confidence>=.48)){
       chord=e.chord;chordSeen=seconds;chordNext='';chordCount=0;
      }
     }
    }else{chordNext='';chordCount=0;}
    if(seconds-chordSeen>3.5)chord='—';
    if(e.lead?.confidence>=.38){
     if(!lead||e.lead.midi===lead.midi||e.lead.confidence>=.72||seconds-leadSeen>=.6){lead=e.lead;leadSeen=seconds;}
    }
    if(seconds-leadSeen>1.6)lead=null;
    return {chord,lead};
   },
   clear(){chord='—';chordNext='';chordCount=0;chordSeen=0;lead=null;leadSeen=0;}
  };
 }
 return Object.freeze({analyse,createFollower,midiName,chordRank});
})();
