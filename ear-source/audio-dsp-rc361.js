/* Deterministic mixer maths, shared by the browser and the audio worker. */
(()=>{
 'use strict';
 const names=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
 const keyLabel=(tonic,mode='major')=>Number.isInteger(tonic)?'Key: '+names[(tonic%12+12)%12]+' '+(mode==='minor'?'Min':'Maj'):'Key: ?';
 const shift=(from,to)=>((Number(to)-Number(from)+18)%12+12)%12-6;
 function transposePlan(plan,semitones){
  const notes=rows=>rows?.map(n=>({...n,...(Number.isFinite(n.midi)?{midi:n.midi+semitones}:{}),...(Number.isInteger(n.rootPc)?{rootPc:(n.rootPc+semitones+120)%12}:{})}));
  return {...plan,semitones,tonic:(plan.tonic+semitones+120)%12,bass:notes(plan.bass),chords:notes(plan.chords)};
 }
 function normalisation(buffer,target=.16){
  const size=Math.max(1,Math.round(buffer.sampleRate*.02)),levels=[];let top=0;
  for(let at=0;at<buffer.length;at+=size){let sum=0,count=0;
   for(let c=0;c<buffer.numberOfChannels;c++){const data=buffer.getChannelData(c);for(let i=at;i<Math.min(buffer.length,at+size);i++){const x=Number.isFinite(data[i])?data[i]:0;sum+=x*x;count++;}}
   const rms=Math.sqrt(sum/Math.max(1,count));levels.push(rms);top=Math.max(top,rms);
  }
  if(top<.0001)return 1;
  let energy=0,count=0;for(const rms of levels)if(rms>Math.max(.0001,top*.12)){energy+=rms*rms;count++;}
  return Math.min(8,target/Math.sqrt(energy/Math.max(1,count)));
 }
 const api={names,keyLabel,shift,transposePlan,normalisation};globalThis.BassEarDSP=api;if(typeof module!=='undefined')module.exports=api;
})();
