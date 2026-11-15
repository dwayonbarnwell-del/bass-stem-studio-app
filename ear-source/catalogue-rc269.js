/* Original practice compositions. Linked lessons explain techniques; their recordings and transcriptions are not copied. */
window.BassPracticeCatalogue=(()=>{
 'use strict';
 const P=window.BassPracticeCore;
 const sources={
 reggae:{label:'Bob Marley & The Wailers · Aston Barrett lesson',url:'https://reverb.com/news/learn-to-play-the-bass-techniques-of-bob-marley-and-the-wailers-aston-barrett'},
 motown:{label:'James Jamerson · sixteenth-note lesson',url:'https://reverb.com/en-hr/news/learn-to-play-james-jamerson-style-16th-note-grooves'},
 disco:{label:'Bernard Edwards · technique course (subscription)',url:'https://www.basslinepublishing.com/video-course/bernard-edwards/'},
 slap:{label:'Marcus Miller · slap lesson',url:'https://www.notreble.com/buzz/2024/05/26/marcus-miller-slap-bass-breakdown/'},
 runs:{label:'Rich Brown · pentatonic fills lesson',url:'https://www.notreble.com/buzz/2021/10/20/the-brownstone-play-great-fills-and-solos-using-pentatonics/'},
 gospel:{label:'No Treble · bass lick lessons',url:'https://www.notreble.com/lessons/bass-lick-series/'},
 africa:{label:'African bass · World Music Method course',url:'https://worldmusicmethod.com/learn-african-bass/'}
 };
 const genres=[['reggae','Reggae'],['makossa','Makossa'],['highlife','Highlife'],['afrobeat','Afrobeat'],['soukous','Soukous'],['mbalax','Mbalax'],['mbaqanga','Mbaqanga']];
 const groups=[['studies','Original studies'],...genres,['jamerson','James Jamerson · style studies'],['edwards','Bernard Edwards · style studies'],['miller','Marcus Miller · style studies']];
 P.lines.forEach((l,i)=>{l.id='line-'+i;l.african=/highlife|makossa/i.test(l.name);});
 const progressions={
  6:['6 2 3 6','6 5 4 5 3','6 2 5 1','6 4 2 5','6 3 4 5','6 5 4 3','6 2 4 5','6 4 1 3','6 3 2 5','6 5 1 4','6 2 5 1 4 3','6 4 5 3'],
  2:['2 5 1 6','2 3 6 5','2 4 1 5','2 6 4 5','2 5 3 6','2 4 5 1','2 3 4 5','2 6 3 6','2 5 1 4','2 4 6 5'],
  4:['4 5 3 6','4 1 2 5','4 6 2 5','4 5 1 6','4 3 2 5','4 1 5 6','4 2 3 6','4 5 6 3','4 2 5 1','4 3 6 2 5'],
  1:['1 5 2 4','1 2 6 5','1 3 4 5','1 4 2 5','1 6 4 5','1 3 6 2 5','1 2 3 4','1 5 4 6','1 4 6 2 5','1 6 2 3'],
  3:['3 4 5 6','3 6 2 5','3 6 4 5','3 4 1 5','3 2 5 1','3 6 2 5 1'],
  5:['5 6 4 1','5 4 1 6','5 3 6 2','5 1 4 2']
 };
 const grooves=['church','anthem','pocket','sixths','walk','funk'];
 for(const start of [6,2,4,1,3,5])progressions[start].forEach((pattern,i)=>P.lines.push({id:'progression-'+pattern.replaceAll(' ','-'),name:['Gospel flow','Worship lift','Soul pocket','Melodic answer','Walking link','Funk motion'][i%6],degrees:pattern.split(' ').map(Number),feel:grooves[i%6],tip:'Original study. Keep each landing clear; practise the pickup slowly.'}));
 const rhythm={
  oneDrop:[[.5,0,.6],[1.5,2,.3],[2,4,.6],[3,2,.28],[3+2/3,0,.25]],
  reggaeTriplet:[[0,0,.7],[1.5,4,.4],[2.5,0,.3],[3,2,.23],[3+1/3,4,.23],[3+2/3,2,.23]],
  reggaeAnswer:[[.5,0,.65],[1.5,0,.25],[2.5,4,.3],[3,2,.25],[3.5,4,.3]],
  motown:[[0,0,.6],[.75,2,.18],[1.25,4,.35],[2,7,.35],[2.75,4,.18],[3,2,.18],[3.25,'n-2',.18],[3.5,'n-1',.3]],
  disco:[[0,0,.25],[.5,7,.22],[1,4,.25],[1.75,2,.18],[2,0,.22],[2.5,7,.22],[3,4,.18],[3.25,'n+1',.18],[3.5,'n-1',.3]],
  slap:[[0,0,.18],[.5,7,.18],[1.25,0,.18],[1.75,7,.18],[2,4,.18],[2.75,7,.18],[3.25,'n+2',.18],[3.5,'n+1',.18],[3.75,'n-1',.18]],
  highlifeA:[[0,0,.35],[.75,2,.25],[1.25,4,.3],[2,7,.3],[2.75,4,.25],[3.25,2,.25],[3.75,'n-1',.18]],
  highlifeB:[[0,0,.25],[.5,4,.25],[1.25,2,.25],[1.75,4,.18],[2.5,7,.25],[3,4,.18],[3.25,2,.18],[3.5,'n-1',.3]],
  makossaA:[[0,0,.25],[.75,4,.25],[1.5,7,.25],[2.25,2,.25],[2.75,4,.18],[3,7,.18],[3.25,'n-2',.18],[3.5,'n-1',.3]],
  makossaB:[[0,0,.2],[.5,7,.2],[1.25,4,.2],[1.75,2,.2],[2.5,0,.2],[3,4,.18],[3.25,2,.18],[3.5,'n-1',.3]],
  afrobeat:[[0,0,.4],[.75,0,.18],[1.5,2,.25],[2.25,4,.25],[3,0,.25],[3.5,2,.3]],
  soukous:[[0,0,.2],[.5,2,.2],[1,4,.2],[1.5,7,.2],[2.25,4,.2],[2.75,2,.18],[3.25,'n-2',.18],[3.5,'n-1',.3]],
  mbalax:[[0,0,.25],[.75,4,.18],[1.25,7,.18],[2,0,.25],[2.75,2,.18],[3.25,4,.18],[3.75,'n-1',.18]],
  mbaqanga:[[0,0,.35],[.5,4,.3],[1.5,7,.3],[2,2,.3],[2.75,4,.2],[3.5,'n-1',.3]]
 };
 const artists=[
 ['marley','Reggae',sources.reggae,['oneDrop','reggaeTriplet','reggaeAnswer'],['1 4 5 4','6 4 1 5','2 5 1 6','1 5 1 4','4 1 5 1','6 2 3 6']],
 ['jamerson','Motown',sources.motown,['motown'],['1 6 2 5','6 2 5 1','2 5 3 6','4 1 2 5','1 3 4 5','3 6 2 5']],
 ['edwards','Disco',sources.disco,['disco'],['1 4 6 5','6 5 4 5 3','2 4 1 5','4 5 3 6','1 5 2 4','3 4 5 6']],
 ['miller','Octave funk',sources.slap,['slap'],['1 6 4 5','6 2 3 6','2 5 1 6','4 2 5 1','1 2 6 5','3 6 4 5']]
 ];
 for(const [artist,name,source,shapes,patterns] of artists)patterns.forEach((v,i)=>P.lines.push({id:artist+'-'+i,artist,name:({marley:'Aston Barrett style',jamerson:'James Jamerson style',edwards:'Bernard Edwards style',miller:'Marcus Miller style'})[artist]+' · '+name+' · '+['Pocket','Answer','Lift','Turnaround','Bounce','Homecoming'][i],degrees:v.split(' ').map(Number),feel:shapes[i%shapes.length],shape:rhythm[shapes[i%shapes.length]],source,tip:'Original '+name.toLowerCase()+' style study, not a song transcription. '+(artist==='miller'?'Note playback demonstrates rhythm and pitches; use your own slap technique.':'Use the linked lesson for the artist’s own examples.')}));
 const african=[
 ['Ghanaian highlife','highlifeA',['1 5 1 5','6 2 5 1','2 5 1 4','4 1 2 5']],
 ['Ghanaian highlife · answer','highlifeB',['1 4 5 1','6 4 2 5','2 4 1 5','4 5 3 6']],
 ['Makossa','makossaA',['1 5 4 5','6 2 3 6','2 5 1 6','4 1 5 1']],
 ['Nigerian praise · makossa-inspired','makossaB',['1 4 5 1','6 5 4 5 3','2 4 5 1','4 5 6 1']],
 ['Nigerian Afrobeat-inspired','afrobeat',['1 4 1 4','6 2 6 2','2 5 2 5','4 1 4 5']],
 ['Congolese soukous-inspired','soukous',['1 4 5 1','6 2 5 1','2 5 1 4','4 1 5 1']],
 ['Senegalese mbalax-inspired','mbalax',['1 4 5 4','6 2 3 6','2 4 5 1','4 5 1 6']],
 ['South African mbaqanga-inspired','mbaqanga',['1 4 1 5','6 4 1 5','2 5 1 4','4 1 5 1']]
 ];
 for(const [name,feel,patterns] of african)patterns.forEach((v,i)=>P.lines.push({id:'africa-'+feel+'-'+i,name,feel,african:true,shape:rhythm[feel],degrees:v.split(' ').map(Number),source:sources.africa,tip:'Original '+name.toLowerCase()+' practice study. Keep the repeated groove steady and the pickup light.'}));
 const runShapes=[
 ['Pentatonic rolling fours',[0,1,2,3,1,2,3,4,2,3,4,5],'pent'],['Pentatonic falling pairs',[6,4,5,3,4,2,3,1],'pent'],['Pentatonic skip and return',[0,2,1,3,2,4,3,5],'pent'],['Pentatonic upper answer',[7,5,6,4,5,3,2,1],'pent'],
 ['Gospel six-note spiral',[-3,-1,0,2,1,-1],'scale'],['Gospel rising thirds',[-5,-3,-4,-2,-3,-1,0,1],'scale'],['Gospel descending thirds',[5,3,4,2,3,1,2,-1],'scale'],['Gospel double turnaround',[2,1,-1,0,3,2,1,-1],'scale'],
 ['Chromatic double approach',[5,4,3,2,1,-2,-1,1],'chromatic'],['Upper enclosure cascade',[7,6,5,4,3,1,-1,1],'chromatic'],['Lower enclosure climb',[-7,-5,-4,-3,-2,1,-1,1],'chromatic'],['Outside and home',[2,-1,1,-2,3,2,1,-1],'chromatic'],
 ['Modal thirds chain',[-6,-4,-5,-3,-4,-2,-3,-1],'scale'],['Modal fourths lift',[-7,-4,-6,-3,-5,-2,-4,-1],'scale'],['Upper-register waterfall',[7,6,4,5,3,4,2,1],'scale'],['Descending octave ribbon',[7,4,6,3,5,2,4,-1],'scale'],
 ['Triplet question and answer',[-4,-2,0,2,1,-1,-3,-1,1,3,2,-1],'scale'],['Sixteenth climbing cells',[-5,-4,-2,-3,-2,0,1,-1],'scale'],['Highlife third-pair pickup',[-3,-1,-2,0,-1,1,2,-1],'scale'],['Makossa octave pickup',[-7,0,-5,2,-3,4,1,-1],'scale'],
 ['Soul chord-tone ribbon',[-7,-5,-3,0,2,4,1,-1],'scale'],['Blues tension release',[-7,-6,-5,-2,-5,-4,1,-1],'chromatic'],['Long gospel ascent',[-7,-6,-5,-4,-3,-2,-1,0,2,1,0,-1],'scale'],['Long pentatonic answer',[-5,-3,-4,-2,-3,-1,0,2,1,3,2,1],'pent']
 ];
 for(const [name,steps,type] of runShapes){const run=[name,'Original exercise. Start slowly; make the target chord clear on beat 1.'];run.steps=steps;run.type=type;run.source=type==='pent'?sources.runs:sources.gospel;P.runs.push(run);}
 // IDs never depend on display sorting. Deleting hides a study only on this device.
 const storageKey='bass-practice-deleted-v1',customKey='bass-practice-custom-v1';let deleted=new Set(),custom=[];
 try{const saved=JSON.parse(localStorage.getItem(storageKey)||'[]');if(Array.isArray(saved))deleted=new Set(saved.filter(v=>typeof v==='string'));}catch{}
 try{const saved=JSON.parse(localStorage.getItem(customKey)||'[]');if(Array.isArray(saved))custom=saved.filter(l=>typeof l.id==='string'&&l.id.startsWith('custom-')&&Array.isArray(l.degrees)&&l.degrees.length>=2&&l.degrees.length<=16&&l.degrees.every(n=>Number.isInteger(n)&&n>=1&&n<=7));P.lines.push(...custom);}catch{}
 function genreOf(line){if(line.id?.startsWith('custom-'))return null;if(line.artist==='marley'||/reggae/i.test(line.name))return 'reggae';return genres.find(([id])=>new RegExp(id,'i').test(line.name))?.[0]||null;}
 function inCollection(line,group){const genre=genreOf(line);return group==='studies'?!genre:genres.some(([id])=>id===group)?genre===group:line.artist===group;}
 const lineLabel=l=>l.name.replace(/\s*·\s*[1-7](?:[–-][1-7])+$/,'')+' · '+l.degrees.join('–');
 const key=(kind,id)=>kind+':'+id;
 const visible=(kind,id)=>!deleted.has(key(kind,id));
 function remove(kind,id){const next=new Set(deleted);next.add(key(kind,id));localStorage.setItem(storageKey,JSON.stringify([...next]));deleted=next;}
 function restore(){localStorage.setItem(storageKey,'[]');deleted.clear();}
 function addProgression(text,template){const parts=text.trim().split(/[\s,–>→-]+/);if(parts.length<2||parts.length>16||parts.some(x=>! /^[1-7]$/.test(x)))throw Error('Enter 2–16 numbers from 1 to 7.');const l={...template,id:'custom-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),name:'My progression',artist:undefined,degrees:parts.map(Number)};const next=[...custom,l];localStorage.setItem(customKey,JSON.stringify(next));custom=next;P.lines.push(l);return P.lines.length-1;}
 return {groups,sources,genreOf,inCollection,lineLabel,visible,remove,restore,addProgression,get deletedCount(){return deleted.size;}};
})();
