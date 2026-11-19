/* Bass studies transcribed from the owner's supplied clips. Source audio is not hosted here. */
window.BassUploadedCore=(()=>{
 'use strict';
 const items=[...(window.BassUploadedStudies||[]),...(window.BassLessonStudies||[]),...(window.BassReggaeStudies||[]),...(window.BassAfricanStudies||[])].filter(c=>c.id!=='clip-04'&&!/open the eyes of my heart|holy forever|worship.*easy bass lesson|african praise.*bass study|african praise.*winner man/i.test(c.title||'')).map(c=>({...c})),groups=[['studies','Original studies'],['recorded-worship','Worship · recordings'],['recorded-reggae','Reggae · recordings'],['recorded-makossa','Makossa · recordings'],['recorded-soukous','Soukous · Bass Lady recording'],['recorded-seben','Seben · recordings'],['recorded-praise','African Praise · recordings'],['recorded-nigerian','Nigerian styles · mixed recordings'],['recorded-soca','Soca · recordings'],['recorded-congolese','Congolese · lessons'],['recorded-african','African styles · lessons'],['recorded-zouk','Zouk · lessons'],['recorded-review','Other recordings · genre to review']];
 for(const c of items){
  c.originalTitle=c.title;
  if(c.collection)continue;
  if(c.group==='bass-lady'){c.collection=/makossa/i.test(c.title)?'recorded-makossa':'recorded-soukous';c.title=c.title.replace('Bass Lady - ','').replace(/^(Makossa|Soukous)(.*)$/,'$1 · Bass Lady$2');}
  else if(c.group==='bassmatics'){c.collection='recorded-seben';c.title=c.title.replace('Bassmatics - Seben','Seben · Bassmatics');}
  else if(/African praise/i.test(c.title)){c.collection='recorded-praise';c.title='African Praise · bass study';}
  else if(/Five Nigerian/i.test(c.title)){c.collection='recorded-nigerian';c.title='Nigerian bass styles · five-style demonstration';}
  else if(/Soca/i.test(c.title)){c.collection='recorded-soca';c.title='Soca · Hookin Meh cover';}
  else {c.collection='recorded-review';c.title=c.title.replace(/^Uploaded groove /,'Bass recording ').replace(/^Groove - /,'Bass study · ').replace(/grooves/gi,'bass studies').replace(/groove/gi,'bass study');if(/subscribers|overload|locked|weep|mad bass|^Bass recording/i.test(c.title))c.title='Bass study · '+c.id.replace('clip-','Recording ');}
 }

 const time=t=>Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0');
 function plan(id,part=0,speed=100,transpose=0){
  const clip=items.find(c=>c.id===id);if(!clip)return null;
  const index=Math.max(0,Math.min(clip.parts.length-1,Math.round(Number(part)||0))),range=clip.parts[index];
  const ratio=Math.max(25,Math.min(150,Number(speed)||100)),shift=Math.max(-12,Math.min(12,Math.round(Number(transpose)||0)));
  const bass=clip.notes.filter(n=>n.start<range.end&&n.end>range.start).map(n=>({midi:n.midi+shift,beat:Math.max(0,n.start-range.start),length:Math.min(n.end,range.end)-Math.max(n.start,range.start),velocity:n.velocity||80,role:'bass',review:!!n.review,sourceTime:Math.max(n.start,range.start)})).filter(n=>n.length>.01&&n.midi>=21&&n.midi<=108);
  return {kind:'uploaded',tip:clip.collection==='recorded-review'?'Genre not yet confirmed.':'',audio:clip.audio,clipId:clip.id,title:clip.title,heading:clip.title,bpm:60*ratio/100,beats:range.end-range.start,bass,chords:[],sourceStart:range.start,sourceEnd:range.end,part:index,speed:ratio,transpose:shift,check:bass.some(n=>n.review),status:time(range.start)+'–'+time(range.end)+' · '+ratio+'% speed · Automatic notes'};
 }
 return {items,groups,plan,time};
})();
