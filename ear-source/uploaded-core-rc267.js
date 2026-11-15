/* Bass studies transcribed from the owner's supplied clips. Source audio is not hosted here. */
window.BassUploadedCore=(()=>{
 'use strict';
 const items=window.BassUploadedStudies||[],groups=[['studies','Original studies'],['bass-lady','Bass Lady lessons'],['bassmatics','Bassmatics lessons'],['bass-sounds','Uploaded grooves']];
 const time=t=>Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0');
 function plan(id,part=0,speed=100,transpose=0){
  const clip=items.find(c=>c.id===id);if(!clip)return null;
  const index=Math.max(0,Math.min(clip.parts.length-1,Math.round(Number(part)||0))),range=clip.parts[index];
  const ratio=Math.max(25,Math.min(150,Number(speed)||100)),shift=Math.max(-12,Math.min(12,Math.round(Number(transpose)||0)));
  const bass=clip.notes.filter(n=>n.start<range.end&&n.end>range.start).map(n=>({midi:n.midi+shift,beat:Math.max(0,n.start-range.start),length:Math.min(n.end,range.end)-Math.max(n.start,range.start),velocity:n.velocity||80,role:'bass',review:!!n.review,sourceTime:Math.max(n.start,range.start)})).filter(n=>n.length>.01&&n.midi>=21&&n.midi<=108);
  return {kind:'uploaded',audio:clip.audio,clipId:clip.id,title:clip.title,heading:clip.title,bpm:60*ratio/100,beats:range.end-range.start,bass,chords:[],sourceStart:range.start,sourceEnd:range.end,part:index,speed:ratio,transpose:shift,check:bass.some(n=>n.review),status:time(range.start)+'–'+time(range.end)+' · '+ratio+'% speed · Automatic notes'};
 }
 return {items,groups,plan,time};
})();
