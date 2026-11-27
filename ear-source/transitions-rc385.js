// Each row contains a title, fill, run and bassline. Numbers follow the current
// chord's scale degrees. Letters approach the next root in semitones.
window.BassTransitionScores=(()=>{
 const repertoire={
  worship:`Lift and settle|3568UL|2356589UL|15163L
Choir reply|8653VL|5865352VU|18352U
Held third|3256WL|3235686WL|13585L
Climb in thirds|2435UL|2435468UL|15253U
Quiet answer|6532VL|8656532VL|16583V
Fifth pickup|5325PL|2358532PL|15326L
Late octave|5986UL|3589695UL|18536U
Amen turn|6385WL|6532356WL|15632L
Breath and rise|2353VL|5232358VL|13156V
Upper neighbour|9865UL|6898653UL|15385U
Praise response|5863PL|3586356PL|15856L
Step and skip|3546VL|2354658VL|13652V
Low answer|5323WL|8653523WL|15138L
Choir climb|5689UL|3535689UL|16358U
Soft enclosure|6525VL|9865253VL|18565L
Open fifth|5285PL|5325856PL|15285V
Lift after four|6896WL|3568965WL|15689U
Descending grace|8536UL|9868536UL|18365L
Turn and hold|3652VL|5365235VL|13562V
Homeward call|5832WL|6853256WL|15832L`,
  rnb:`Behind the snare|3976UL|3579765UL|17539L
Low answer|7523VL|9753235VL|15372V
Ninth curl|8975WU|5897573WU|18957U
Late reply|6365PL|3635675PL|16395L
Soft drag|5b35VL|85b3565VL|15b35V
Split octave|8186UL|5818697UL|18176U
Seventh fall|7653WL|9765352WL|17563L
Pocket echo|3935VU|5393576VU|13935V
Blue slide|5b68UL|35b6897UL|158b6L
Upper answer|9786PL|5978675PL|19758U
Short then long|5357VL|3537576VL|15357V
Ninth answer|6953WL|3695375WL|16953L
Delayed fifth|5752UL|7575236UL|15752U
Clipped reply|3239VL|5323976VL|13295L
Step under|6795WL|5679597WL|16795V
Velvet climb|3597UL|2359798UL|13597U
Rest and pull|8527PL|9852753PL|18527L
Falling pairs|9675VL|9767653VL|19675V
Broken third|3736WU|5373657WU|13763U
Last word|9532UL|7953235UL|19532L`,
  soul:`Walking reply|3456UL|2345653UL|13565L
Backbeat answer|5653VL|8565352VL|15165U
Thirds up|3243WL|3243546WL|13246V
Motown turn|6553PL|8655356PL|15653L
Low to high|2586UL|3258653UL|12586U
Blue pickup|6b58VL|53b5653VL|13b56V
Long and short|5632WL|3563256WL|15623L
Stepwise return|6543UL|8654323UL|16543U
Octave answer|8356VL|5835656VL|18356L
Push into four|2365PL|5236532PL|12365V
Rising sixth|3658UL|5365865UL|13658U
Third on two|3135WL|5313565WL|13135L
Lower turn|5236VL|6523653VL|15236V
Held answer|8532WU|6853235WU|18532U
Up and around|4586PL|3458653PL|14586L
Short reply|6263UL|5626356UL|16263U
Fifth walk|5435VL|6543532VL|15435V
Choir pocket|3685WL|5368532WL|13685L
Turnaround|6843UL|5684356UL|16843U
Deep landing|3526VL|6352653VL|13526V`,
  funk:`Octave jab|8185PL|1818583PL|18158L
Sixteenth push|1518VL|5151815VL|11518U
Choke and answer|5851UL|8581518UL|15851V
Blue snap|1b45WL|51b4545WL|11b45L
Cross accent|5158PL|1518585PL|15185U
Broken octave|8513VL|1851351VL|18513V
Low punch|1135UL|5113535UL|11135L
Kick reply|1581WL|5158185WL|15181U
Fourth to fifth|4548PL|1454851PL|14548V
Offbeat hook|8583VL|5185835VL|18583L
Double tap|5518UL|1551815UL|15518U
Octave chase|8198WL|1819895WL|18198V
Short blue turn|b451PL|5b45185PL|1b451L
Staggered fifth|5183VL|8518351VL|15183U
Two low taps|1185UL|5118583UL|11185V
Upstroke answer|6358WL|8635851WL|16358L
Reverse octave|8151PL|5815185PL|18151U
Clipped sixth|6158VL|5615815VL|16158V
Backbeat stab|3581UL|8358185UL|13581L
Downbeat return|8515WL|1851518WL|18515U`,
 };
 // Twelfths of a beat support straight sixteenths and triplets on the same clock.
 const grids={
  fills:['9 18 24 30 39 45','18 24 27 33 40 44','12 21 30 36 42 45','6 12 21 27 36 42','15 21 30 33 42 45','12 18 26 32 40 44','9 21 27 36 39 45','18 24 32 36 40 44','6 15 24 33 39 45','12 18 24 30 36 45'],
  runs:['6 12 15 21 24 30 36 42 45','9 15 18 24 27 33 39 42 45','12 16 20 24 30 33 36 40 44','3 9 18 21 27 30 36 42 45','6 15 21 24 30 34 38 42 46','12 15 18 24 28 32 36 42 45','3 12 18 21 24 30 33 39 45','6 12 20 24 28 32 36 40 44','9 12 18 24 27 30 36 39 45','6 9 15 21 24 32 36 40 44'],
  basslines:['0 9 18 24 33 45','0 15 21 30 39 45','0 6 18 27 36 42','0 12 21 24 33 42','0 9 24 30 39 45','0 8 16 24 36 44','0 6 15 24 30 42','0 12 18 27 39 45','0 9 15 24 36 42','0 15 24 33 36 45']
 };
 const offbeatDelay={worship:.006,rnb:.038,soul:.022,funk:-.009};
 const drumTakes={
  worship:['owner-bigbass-verse01','owner-theworld-chorus03','owner-crispy-verse07','owner-theworld-verse01','owner-halftime-verse05','owner-purepop-verse06','owner-theworld-chorus04'],
  rnb:['owner-halftime-verse01','supplied-soul-9faa03e7d5','owner-bigbass-verse05','owner-halftime-chorus03','correct-soul-299e7df856','owner-crispy-verse04','owner-halftime-verse05'],
  soul:['correct-soul-299e7df856','owner-crispy-verse03','owner-bigbass-verse01','supplied-soul-9faa03e7d5','owner-theworld-verse01','owner-crispy-verse06','owner-bigbass-chorus04'],
  funk:['owner-bigbass-chorus04','correct-funk-2d1f3c8df3','owner-clyde-verse02','supplied-funk-8e0bca088d','owner-clyde-verse07','owner-crispy-verse03','owner-clyde-chorus05','owner-bigbass-verse05']
 };
 const progressions=['1451','1625','2645','1564','4156','6251','2514','5361','1645','4635','1462','2651','6415','3625','5164','1425','6524','4261','2541','6145'];
 const approach={U:2,L:-1,V:1,W:-2,P:7,b:3};
 const connectors=['3UL','5WL','2VU','6PL','3WU','5VL','2WL'];
 function phrase(genre,kind,pitches,index,bar=0){
  const genreIndex=Object.keys(repertoire).indexOf(genre);
  const pattern=grids[kind][(index+genreIndex*3+bar*3)%grids[kind].length];
  const times=pattern.split(' ').map(Number);
  // A later answer can anticipate the snare or leave the entire second beat open.
  if(index>=10)times[1]+=(index%2?1:-1)*Math.min(3,(times[2]-times[1])/2,(times[1]-times[0])/2);
  const tones=[...pitches];
  // Some lines leave a hole after the accent. Others lean into it with a grace note.
  const shape=(index+genreIndex+bar)%5;
  if(shape===1&&kind!=='fills'){times.splice(2,1);tones.splice(2,1);}
  if(shape===3&&times[3]-times[2]>=3){
   times.splice(3,0,times[3]-1.5);
   tones.splice(3,0,tones[3]==='5'?'4':'5');
  }
  const beats=times.map(t=>t/12+(t%12?offbeatDelay[genre]:0));
  return tones.map((token,i)=>{
   const beat=beats[i],gap=(beats[i+1]??4)-beat;
   const repeat=i>0&&tones[i-1]===token;
   const accent=i===0||i===2+(index+bar)%3;
   const clipped=repeat||genre==='funk'&&(i+index+bar)%3!==0;
   const linked=!clipped&&!accent&&(genre==='rnb'||genre==='worship'||i%3===1);
   const pitch=token==='b'?'s3':token in approach?'t'+approach[token]:'d'+token;
   return {pitch,beat,length:gap*(clipped?.41:linked?.94:accent?.77:.64),
    velocity:repeat&&!accent?58:accent?99-(index%4):linked?74+(i%3)*3:83+(i%3)*2,
    articulation:linked?'legato':clipped?'detached':'held',
    slide:linked&&(genre==='rnb'||genre==='soul')&&(i+index)%4===0};
  });
 }
 // Each cell spans two bars of 6/8. A tick is an eighth note and a
 // practice beat is a dotted crotchet: 0, 3, 6 and 9 are the four foot taps.
 const praiseRows=[
  ['Bell reply','3968UL','23568965L','15186L','1454'],
  ['Choir lift','8563VL','86535236U','18356U','1625'],
  ['Low pickup','5263WL','53236853L','12563L','2645'],
  ['Cross accent','6835PL','36853682L','15863V','1564'],
  ['Amen turn','3526VU','63526583U','13652L','4156'],
  ['Fifth answer','5286UL','85286532L','15286U','6251'],
  ['Offbeat call','9365WL','59365238L','19365L','2514'],
  ['Broken thirds','2436VL','32436589L','12436V','5361'],
  ['Two taps','1136UL','51136582L','11836U','1645'],
  ['Turn to four','6583WL','86583562L','16583L','4635'],
  ['High reply','8956PL','68956532U','18956U','1462'],
  ['Step below','4326VL','54326358L','14326V','2651'],
  ['Lift and rest','3689UL','53689865L','13689L','6415'],
  ['Octave call','8153WL','58153562U','18153U','3625'],
  ['Third answer','6352VU','86352368L','16352V','5164'],
  ['Short return','5852PL','35852365U','15852L','1425'],
  ['Rolling sixth','6863VL','56863529L','16863U','6524'],
  ['Low echo','2325WL','52325689L','12325V','4261'],
  ['Choir answer','8539UL','68539562U','18539L','2541'],
  ['Home call','5269VL','35683852L','15638U','6145']
 ];
 const praiseTicks={
  fills:[[3,5,6,8,10,11],[2,4,6,7,9,11],[1,3,5,8,9,11],[4,5,7,8,10,11],[2,3,6,8,9,10]],
  runs:[[1,2,3,5,6,7,8,10,11],[2,3,4,5,6,8,9,10,11],[1,3,4,5,7,8,9,10,11],[1,2,4,5,6,7,9,10,11],[2,3,4,6,7,8,9,10,11]],
  basslines:[[0,2,3,6,8,11],[0,3,5,7,9,11],[0,1,4,6,9,10],[0,2,5,6,8,10],[0,3,4,7,9,11]]
 };
 const praiseDrums=['03ac420111e9','4a435d28886d','af1e5aec2faf','197f8b14de2a','97ce47eed1bf','52d18f2be7c9','61681489185e','2a2d094a0819','39772272ab49','5a99f464bfb9','bc1fc0646602','733595a3bb4a'];
 function praiseBar(kind,melody,index){
  const ticks=praiseTicks[kind][index%5];
  return [...melody].map((token,i)=>{
   const at=ticks[i],gap=((ticks[i+1]??12)-at)/3,accent=at%3===0;
   const late=accent?0:(index%3+1)*.004;
   return {pitch:token in approach?'t'+approach[token]:'d'+token,beat:at/3+late,
    length:(gap-late)*(accent?.83:token===melody[i-1]?.48:.74),velocity:accent?96:at%3===2?83:71,
    articulation:accent?'held':'detached'};
  });
 }
 function praiseStudies(){
  const studies=[];
  praiseRows.forEach(([title,fill,run,line,changes],i)=>{
   for(const [k,[kind,melody]] of Object.entries({fills:fill,runs:run,basslines:line}).entries()){
    const notes=praiseBar(kind,melody,i+k),score={id:'praise68-'+kind+'-'+(i+1),genre:'nigerian68',kind,title,notes,
     seriesDrum:i%4===0||i%4===2?'praise68-kit-'+((Math.floor(i/2)+k)%4+1):'fl-'+praiseDrums[(i+k*3)%praiseDrums.length]};
    if(kind==='basslines'){
     const reply='1'+line[3]+line[1]+run[4]+fill.slice(-2);
     const bridge='1'+run[2]+line[4]+line[1]+run.slice(-2);
     const cadence='1'+fill[1]+line[2]+run[5]+fill.slice(-2);
     score.bars=[notes,...[reply,bridge,cadence].map((bar,j)=>praiseBar(kind,bar,i+j+3))];
     score.answer=score.bars[1];score.degrees=[...changes].map(Number);
    }
    studies.push(score);
   }
  });
  return studies;
 }
 function entries(){
  const result=[];
  for(const [genre,text] of Object.entries(repertoire)){
   text.split('\n').forEach((row,i)=>{
    const [name,fill,run,line]=row.split('|');
    for(const [k,[kind,pitches]] of Object.entries({fills:fill,runs:run,basslines:line}).entries()){
     const notes=phrase(genre,kind,pitches,i);
     const score={genre,kind,title:name,notes,id:'transition385-'+genre+'-'+kind+'-'+(i+1),
      seriesDrum:drumTakes[genre][(i+k*3)%drumTakes[genre].length]};
     if(kind==='basslines'){
      const tail=connectors[(i+Object.keys(repertoire).indexOf(genre))%connectors.length];
      const answer='1'+pitches[3]+pitches[1]+tail;
      const bridge='1'+pitches[2]+pitches[4]+pitches[1]+tail.slice(-2);
      const cadence='1'+pitches[4]+pitches[3]+connectors[(i+3)%connectors.length];
      score.bars=[notes,phrase(genre,kind,answer,i,1),phrase(genre,kind,bridge,i,2),phrase(genre,kind,cadence,i,3)];
      score.answer=score.bars[1];
      score.degrees=[...progressions[(i+k*Object.keys(repertoire).indexOf(genre))%progressions.length]].map(Number);
     }
     result.push(score);
    }
   });
  }
  return result.concat(praiseStudies());
 }
 return {entries};
})();
