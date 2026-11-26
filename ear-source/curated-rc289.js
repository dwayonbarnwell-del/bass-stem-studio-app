/* 110 original practice phrases. The linked public lessons inform techniques, not transcriptions.
 * Phrases are explicitly composed below, not random variations or transposed copies.
 * d = diatonic degree relative to the source chord; s = source semitone; t = target
 * semitone; p = source pentatonic index. The final target arrives at beat 1 of bar 2.
 */
window.BassCuratedStudies=(()=>{
 'use strict';
 const F=window.BassFillCore,P=window.BassPracticeCore;
 const sources={
  gospel:{label:'Technique reference · Daric Bennett: diminished gospel fills',url:'https://daricbennett.com/free-bass-lessons/gospel-fill-lesson/'},
  jazz:{label:'Technique reference · Damian Erskine: connecting chord tones',url:'https://www.notreble.com/buzz/2009/06/24/ask-damian-erskine/'},
  blues:{label:'Technique reference · Mark Smith: blues and chromatic approaches',url:'https://www.talkingbass.net/big-badass-blues-rock-bass-lesson/'},
  pent:{label:'Technique reference · Rich Brown: pentatonic fills',url:'https://www.notreble.com/buzz/2021/10/20/the-brownstone-play-great-fills-and-solos-using-pentatonics/'},
  voice:{label:'Technique reference · Nick Campbell: pentatonic voice leading (course overview)',url:'https://scottsbasslessons.com/courses/pentatonic-voice-leading-with-nick-campbell'},
  funk:{label:'Technique reference · Mark Smith: pentatonic funk phrasing',url:'https://www.talkingbass.net/pentatonic-funk-chops/'}
 };
 const genres=[['contemporary','Contemporary / gospel'],['jazz','Jazz'],['blues','Blues'],['pentatonic','Pentatonic'],['fusion','Funk / fusion']];
 const tiers=['Most amazing','Excellent','Good'];
 const rhythms={
  r6:[2,2+1/3,2+2/3,3,3+1/3,3+2/3],r7:[1.5,2,2.5,2.75,3,3.5,3.75],
  r8:[2,2.25,2.5,2.75,3,3.25,3.5,3.75],r9:Array.from({length:9},(_,i)=>1+i/3),
  r10:Array.from({length:10},(_,i)=>1.5+i/4),r12:Array.from({length:12},(_,i)=>1+i/4),
  f3:[2,3,3.5],f4:[1.5,2.5,3,3.5],f5:[1.5,2,2.75,3.25,3.75],
  f6:[2,2+1/3,2+2/3,3,3+1/3,3+2/3],f7:[1.5,2,2.25,2.75,3,3.5,3.75],
  swing5:[1,1+2/3,2,3,3+2/3],swing6:[1,1+2/3,2,2+2/3,3,3+2/3]
 };
 // Each group is in editorial preference order: melodic interest, pocket, contrast
 // and a clear resolution matter more than speed. Ratings are taste, not difficulty.
 const groups={
 runs:{
 contemporary:[
 ['Cathedral lift','major','r12','d3 d5 d9 d8 d6 d5 d3 d6 d8 t2 t1 t-1','Let the ninth sparkle, then soften the descent.'],
 ['Diminished doorway','major','r9','d5 d8 t-1 t2 t5 t8 t5 t2 t-1','Keep the diminished notes light; the landing releases the tension.','gospel'],
 ['Velvet minor climb','dorian','r10','d1 d3 d5 d7 d9 d10 d8 d6 t2 t-1','Grow into the upper minor colour, then relax into the new root.'],
 ['Praise cross-current','major','r12','d8 d5 d6 d9 d8 d3 d5 d10 d9 d6 t1 t-1','Accent the high answer without rushing the final two notes.'],
 ['Grace-note skyline','major','r8','s3 d3 d5 d9 d8 d6 t2 t-1','Brush the minor third into the major third.'],
 ['Sunday sixths','major','r9','d3 d8 d6 d10 d8 d5 d6 t1 t-1','Make the wide pairs sing as one line.'],
 ['Minor prayer ribbon','minor','r8','d7 d5 d8 d10 d9 d7 t2 t-1','Shape the minor answer with a gentle peak.'],
 ['Diminished switchback','major','r8','t8 t5 t2 t-1 t2 t5 t1 t-1','Use this tension burst just before a strong chord change.','gospel'],
 ['Open-window descent','major','r6','d9 d6 d8 d5 d3 t-1','Leave the root spacious before the triplet answer.'],
 ['Low-to-high amen','major','r7','d1 d5 d10 d8 d6 t2 t-1','Keep the low note firm and the high answer light.'],
 ['Quiet glory','dorian','r6','d3 d6 d9 d7 d5 t-1','Give the natural sixth room to colour the minor sound.']
 ],
 jazz:[
 ['Ninth-floor enclosure','major','r12','d3 d5 d7 d9 d8 d6 d5 d3 t2 t-1 t1 t-1','Connect the ninth to a double enclosure without losing the pulse.'],
 ['Minor eleven weave','dorian','r10','d3 d7 d9 d11 d10 d8 d6 d5 t1 t-1','Hear the minor seventh and eleventh as a connected melody.'],
 ['Bebop folded ladder','mixolydian','r12','d1 d3 d5 d7 s11 d8 d9 d7 d6 d5 t2 t-1','The passing major seventh is brief; keep the dominant colour clear.'],
 ['Thirds into the doorway','major','r9','d7 d5 d9 d6 d10 d8 t2 t-2 t-1','Pair the wide thirds, then close the interval near the landing.'],
 ['Dorian upper structure','dorian','r8','d5 d9 d6 d10 d7 d9 t1 t-1','Balance the upper extensions against the low root.'],
 ['Turnaround in mirrors','mixolydian','r10','d3 d6 d5 d9 d7 d10 d8 t2 t1 t-1','Let the phrase crest before the three-note approach.'],
 ['Soft-shoe chromatics','major','r8','d5 s8 d6 s10 d7 d9 t2 t-1','Place each chromatic colour between stable notes.'],
 ['Seventh-to-third thread','minor','r9','d7 d9 d8 d5 d3 d6 d4 t1 t-1','Keep the minor chord tones prominent through the turn.'],
 ['Blue-hour arpeggio','major','r6','d3 d7 d10 d9 d5 t-1','Play the extended arpeggio evenly, then settle.'],
 ['Compact jazz question','dorian','r7','d6 d3 d5 d9 d7 t2 t-1','Answer the opening sixth with a short enclosure.'],
 ['Late-night resolution','mixolydian','r6','d7 d9 d6 d5 t1 t-1','A compact dominant phrase with a clear final approach.']
 ],
 blues:[
 ['Blue flame climb','mixolydian','r12','d1 s3 d3 d5 s10 d8 s15 d10 d8 d5 t2 t-1','Touch both thirds briefly, then let the top note speak.'],
 ['Midnight double curl','dorian','r9','s10 s7 s6 s5 s3 s5 s6 t2 t-1','Keep the flattened fifth short and the triplets rounded.'],
 ['Church-house blue turn','mixolydian','r10','s3 d3 d6 d8 s10 d5 s6 s5 t1 t-1','Mix major warmth with a short blue-note fall.'],
 ['Smoky octave answer','dorian','r12','s0 s3 s5 s7 s10 s12 s15 s12 s10 s6 t2 t-1','Climb smoothly, then make the answer fall with weight.'],
 ['Shuffle sparks','mixolydian','r9','s7 s6 s5 s3 d3 d6 s10 t2 t-1','Let the repeated triplet groups swing without accelerating.'],
 ['Minor blues boomerang','minor','r8','s12 s7 s10 s6 s5 s3 t1 t-1','Keep the blue fifth as a passing colour.'],
 ['Lowdown sixth bridge','mixolydian','r8','d6 s10 d8 d6 s3 d3 t2 t-1','Answer the sixth with a warm major-third resolution.'],
 ['Crossroad chromatic rise','dorian','r10','s0 s3 s5 s6 s7 s10 s9 s7 t1 t-1','The natural sixth brightens the minor-blues ascent.'],
 ['Blue velvet triplets','minor','r6','s10 s7 s5 s6 s3 t-1','Leave space before this falling triplet reply.'],
 ['Honeyed third turn','mixolydian','r7','s3 d3 d5 d6 s10 t2 t-1','Lean into the major third after the blue pickup.'],
 ['Back-porch tail','dorian','r6','s7 s10 s6 s5 t2 t-1','Use a relaxed attack and make the new root solid.']
 ],
 pentatonic:[
 ['Five-note constellation','major','r12','p0 p2 p5 p3 p6 p4 p7 p5 p3 p4 p2 p1','Join the wide pairs into one arch.'],
 ['Minor pentatonic prism','dorian','r10','p2 p5 p3 p6 p4 p7 p5 p3 p1 p2','Use the octave crossings to shape a rising question.'],
 ['Pentatonic braided descent','major','r12','p8 p5 p7 p4 p6 p3 p5 p2 p4 p1 p3 p2','Descend in overlapping cells with a gentle accent every four notes.'],
 ['Two-register conversation','minor','r9','p0 p4 p2 p6 p3 p7 p5 p2 p1','Make the low and high registers sound like a conversation.'],
 ['Golden sixth spiral','major','r8','p4 p2 p5 p3 p7 p4 p2 p1','Use the sixth as the centre of the melodic turn.'],
 ['Minor glass staircase','minor','r9','p1 p4 p2 p5 p3 p6 p4 p2 p0','Climb with small answers, then descend to the source root.'],
 ['Floating pentatonic ninth','major','r10','p2 p4 p6 p5 p3 p6 p7 p4 p2 p1','Let the high second colour the phrase, then resolve.','voice'],
 ['Broken fifth cascade','dorian','r8','p7 p4 p6 p3 p5 p2 p0 p1','Keep the string crossings even and the last pair quiet.'],
 ['Amber pentatonic turn','major','r6','p2 p5 p4 p6 p3 p1','A compact high-register answer with no chromatic notes.'],
 ['Minor pentatonic commas','minor','r7','p3 p1 p4 p2 p5 p3 p0','Use the uneven spacing to separate the small answers.'],
 ['Five-note homeward path','major','r6','p5 p2 p4 p1 p3 p2','Make the descending pairs lead naturally into the next chord.']
 ],
 fusion:[
 ['Neon octave relay','dorian','r12','d1 d8 d5 d10 d6 d13 d8 d9 d7 d5 t2 t-1','Short lower notes make room for the wide upper answers.'],
 ['Elastic sixteenth curve','mixolydian','r10','d5 d1 d8 d7 d9 d6 d10 d5 t1 t-1','Keep the low interruption short, then stretch the answer upward.'],
 ['Cross-string voltage','major','r12','d3 d8 d5 d10 d6 d9 d5 d8 d3 d6 t2 t-1','Accent the changing peaks without speeding up.'],
 ['Dorian fourth engine','dorian','r9','d1 d4 d7 d3 d6 d9 d5 t1 t-1','Let the fourths open the sound before the close landing.'],
 ['Pocket lightning','mixolydian','r8','d8 d1 d5 d9 d7 d6 t2 t-1','Separate the octave pop from the following melody.'],
 ['Minor nine ricochet','dorian','r10','d3 d9 d5 d10 d7 d8 d6 d3 t1 t-1','Use a smooth fretting hand across the wide minor intervals.'],
 ['Funk pentatonic slingshot','minor','r9','p0 p5 p3 p7 p4 p6 p2 p4 p1','Pull the melody upward, then release into a low answer.'],
 ['Chromatic hinge groove','mixolydian','r8','d5 s8 d6 d8 s10 d9 t2 t-1','Keep the outside note short enough to sound like motion.'],
 ['Octave snapback','major','r6','d8 d3 d10 d5 t2 t-1','Make the wide jumps clean with short note endings.'],
 ['Dorian skip-step','dorian','r7','d1 d6 d3 d8 d5 t1 t-1','Let the rests give this phrase its bounce.'],
 ['Late funk reply','mixolydian','r6','d5 d8 d6 d9 t1 t-1','A light triplet reply after a firm low root.']
 ]},
 fills:{
 contemporary:[
 ['Grace-window flourish','major','f7','d5 d9 d8 d6 d3 t1 t-1','Leave air around the high ninth; lean on the final root.'],
 ['Diminished velvet hinge','major','f6','d5 t8 t5 t2 t-1 t1','A rising diminished tension folds into the landing.','gospel'],
 ['Gospel rising answer','dorian','f7','d3 d6 d9 d8 d5 t2 t-1','Let the natural sixth warm the minor phrase.'],
 ['Praise octave sparkle','major','f5','d8 d10 d6 t2 t-1','Keep the high answer bright and the pickup quiet.'],
 ['Worship ninth sigh','major','f4','d9 d5 d6 t-1','Let the first high note breathe before the answer.'],
 ['Sunday blue grace','major','f6','s3 d3 d6 d5 t1 t-1','Slip from the blue third into the major sound.'],
 ['Minor prayer response','minor','f5','d7 d10 d8 d5 t-1','A small minor-colour answer with a firm destination.'],
 ['Diminished candle turn','major','f5','t5 t2 t-1 t2 t1','Keep the symmetrical shape light and resolve the last semitone.','gospel'],
 ['Gentle gospel sixth','major','f3','d6 d9 d5','A spacious three-note reply before the next root.'],
 ['Open fifth blessing','major','f4','d5 d10 d8 t-1','Answer the fifth an octave higher, then settle.'],
 ['Dorian amen','dorian','f4','d6 d3 d7 t-1','Keep the minor third clear beneath the brighter sixth.']
 ],
 jazz:[
 ['Velvet ninth enclosure','major','swing6','d3 d9 d7 t2 t-1 t1','Let the swung pairs lead into the enclosure.'],
 ['Minor eleven question','dorian','f7','d7 d11 d9 d6 d5 t1 t-1','The upper fourth adds colour before the short chromatic answer.'],
 ['Bebop side-door','mixolydian','swing6','d5 s11 d8 d6 t2 t-1','Keep the passing major seventh short over the dominant chord.'],
 ['Upper-third conversation','major','f7','d7 d10 d9 d5 d6 t2 t-1','Shape the descending reply around the upper third.'],
 ['Dorian sixth whisper','dorian','swing5','d6 d9 d7 t1 t-1','Do not over-accent the chromatic approach.'],
 ['After-hours enclosure','minor','f6','d3 d7 d9 t2 t-2 t-1','Give the minor extension a clear, soft attack.'],
 ['Ninth-to-fifth reply','major','f5','d9 d7 d5 t2 t-1','Let the descending chord tones sound connected.'],
 ['Dominant colour pocket','mixolydian','swing5','d7 d10 d6 t2 t-1','Keep the groove anchored while the melody sits above it.'],
 ['Three-note jazz postcard','major','f3','d7 d9 d3','Make three different chord colours sing as one phrase.'],
 ['Minor upper answer','minor','f4','d10 d7 d5 t1','Let the minor-third colour fall into the fifth.'],
 ['Swung doorstep','mixolydian','f4','d3 d7 t2 t-1','A clear dominant answer with a short final approach.']
 ],
 blues:[
 ['Blue-note velvet curl','mixolydian','swing6','s3 d3 s7 s6 s5 t-1','Move through the blue fifth without stopping on it.'],
 ['Midnight octave moan','dorian','f7','s10 s12 s15 s10 s7 t2 t-1','Give the upper minor third a vocal shape.'],
 ['Honey-and-smoke turn','mixolydian','f6','d6 s10 d8 s3 d3 t-1','Mix the sweet sixth with a short blues inflection.'],
 ['Minor blues hook','minor','f7','s3 s7 s6 s5 s10 t1 t-1','Keep the hook compact and the blue fifth brief.'],
 ['Shuffle blue answer','mixolydian','swing5','s3 d3 s10 t2 t-1','Let the swung third change answer the root.'],
 ['Lowdown upper curl','dorian','f6','s12 s10 s6 s7 s3 t-1','Curl around the fifth, then drop to the minor third.'],
 ['Church blues wink','mixolydian','f5','s10 d6 s3 d3 t-1','The major third is the release after the blue pickup.'],
 ['Blue fifth doorstep','minor','swing5','s5 s6 s7 t2 t-1','Cross the blue fifth in one smooth motion.'],
 ['Three-note blues sigh','dorian','f3','s10 s6 s5','Let the blue note fall into the fourth.'],
 ['Warm major-blues reply','mixolydian','f4','s3 d3 d6 t-1','A gentle third change gives a short fill character.'],
 ['Back-step minor blues','minor','f4','s7 s3 s5 t1','Separate the small answer from the next downbeat.']
 ],
 pentatonic:[
 ['Pentatonic pearl drop','major','f7','p6 p4 p7 p5 p2 p4 p1','A high answer folds into two lower pairs.'],
 ['Minor pentatonic lantern','minor','f6','p1 p5 p3 p6 p4 p2','Let the octave crossing lift the middle of the phrase.'],
 ['Golden pentatonic hinge','major','f7','p2 p5 p3 p6 p4 p1 p2','Keep the shape smooth through the wider middle intervals.'],
 ['Five-note midnight answer','dorian','f5','p7 p4 p6 p2 p3','Answer high, then leave a clear gap before the destination.'],
 ['Floating pentatonic pairs','major','f6','p4 p6 p3 p5 p1 p2','Give each descending pair a soft first note.','voice'],
 ['Minor pentatonic hook','minor','f5','p2 p6 p4 p1 p3','A wide minor hook with a low final answer.'],
 ['Bright fifth ribbon','major','f5','p3 p6 p4 p2 p0','Let the source root close the phrase before the chord moves.'],
 ['Pentatonic dusk turn','dorian','f6','p5 p2 p4 p6 p3 p1','Use the high turn to avoid a plain scale descent.'],
 ['Three-note amber answer','major','f3','p4 p1 p3','A simple sixth-to-second-to-fifth shape with room to breathe.'],
 ['Minor pentatonic stepping stones','minor','f4','p1 p4 p2 p5','Keep each note short enough to leave space.'],
 ['Pentatonic soft landing','major','f4','p6 p3 p5 p2','Let the lower pair calm the high opening.']
 ],
 fusion:[
 ['Neon pocket accent','dorian','f7','d8 d3 d9 d6 d5 t2 t-1','Use a short octave pop before the melodic answer.'],
 ['Elastic octave hinge','mixolydian','f6','d1 d8 d10 d6 t1 t-1','Keep the low-to-high jump tight and controlled.'],
 ['Cross-string sparks','major','f7','d5 d10 d6 d9 d3 t2 t-1','Let the alternating registers create the excitement.'],
 ['Dorian fourth flash','dorian','f6','d4 d7 d3 d6 t1 t-1','Make the fourth shapes clear before the semitone landing.'],
 ['Funk sixth snap','mixolydian','f5','d6 d1 d8 d5 t-1','The short low interruption gives this fill its pocket.'],
 ['Minor nine flicker','dorian','f5','d9 d3 d8 t2 t-1','Give the ninth a light attack and shorten the low reply.'],
 ['Pentatonic funk echo','minor','f6','p5 p0 p4 p6 p2 p3','Echo the high root in the low register, then turn upward.'],
 ['Chromatic pocket switch','mixolydian','f5','d5 s8 d6 t1 t-1','Keep the passing chromatic note lighter than the chord tones.'],
 ['Three-note octave wink','major','f3','d8 d3 d10','A small octave conversation with plenty of space.'],
 ['Dorian string-skip reply','dorian','f4','d5 d10 d6 t-1','Mute the unused strings during the wide jump.'],
 ['Late-night funk punctuation','mixolydian','f4','d8 d6 d9 t-1','Keep the notes short and let the next root carry the weight.']
 ]}
 };
 const entries=[],byIndex={runs:new Map(),fills:new Map()};
 const defaultSource={contemporary:'funk',jazz:'jazz',blues:'blues',pentatonic:'pent',fusion:'funk'};
 for(const kind of ['runs','fills'])for(const [genre] of genres)groups[kind][genre].forEach(([title,mode,rhythm,notes,tip,ref],i)=>{
  const entry={id:'curated-289-'+kind+'-'+genre+'-'+(i+1),kind,genre,title,mode,rhythm,notes:notes.split(' '),tip,
   tier:i<4?0:i<8?1:2,rank:i*genres.length+genres.findIndex(([g])=>g===genre),source:sources[ref||defaultSource[genre]],original:true};
  const list=kind==='runs'?P.runs:F.styles;entry.index=list.length;const row=[title,tip];row.id=entry.id;row.curated=entry;list.push(row);entries.push(entry);byIndex[kind].set(entry.index,entry);
 });
 function register(spec){const entry={...spec,notes:typeof spec.notes==='string'?spec.notes.split(' '):spec.notes,original:true};const list=entry.kind==='runs'?P.runs:F.styles;entry.index=list.length;const row=[entry.title,entry.tip];row.id=entry.id;row.curated=entry;list.push(row);entries.push(entry);byIndex[entry.kind].set(entry.index,entry);return entry;}
 function reindex(){for(const kind of ['runs','fills']){byIndex[kind].clear();(kind==='runs'?P.runs:F.styles).forEach((row,index)=>{if(row.curated){row.curated.index=index;byIndex[kind].set(index,row.curated);}});}}
 const get=(kind,index)=>byIndex[kind]?.get(Number(index));
 const pc=n=>(n%12+12)%12;
 function make(kind,opts={}){
  const entry=get(kind,opts.idea);if(!entry)return null;
  if(entry.recordedStudy)return window.BassCulturalStudies.make(kind,entry,opts);
  const key=pc(Math.round(Number(opts.key)||0)),mode=entry.mode,scale=F.scales[mode];
  const from=Math.max(1,Math.min(7,Math.round(Number(opts.from)||1)));let to=Math.max(1,Math.min(7,Math.round(Number(opts.to)||4)));if(from===to)to=from%7+1;
  const degree=n=>36+key+scale[(n%7+7)%7]+12*Math.floor(n/7),source=degree(from-1);
  let target=degree(to-1);while(target-source>6)target-=12;while(target-source< -6)target+=12;
  const relative=n=>degree(from+n-2),minor=relative(3)-source===3;
  // Five diatonic notes, preserving the selected chord's third and fifth.
  const pentDegrees=minor?[1,3,4,5,7]:[1,2,3,5,6];
  const pitch=token=>{const n=Number(token.slice(1));if(token[0]==='d')return relative(n);if(token[0]==='s')return source+n;if(token[0]==='t')return target+n;return relative(pentDegrees[(n%5+5)%5])+12*Math.floor(n/5);};
  const beats=rhythms[entry.rhythm],bass=[{midi:source,beat:0,length:Math.min(1.35,beats[0]-.15),velocity:87,role:'bass'}];
  entry.notes.forEach((token,i)=>bass.push({midi:pitch(token),beat:beats[i],length:Math.min((beats[i+1]??4)-beats[i],.7)*(entry.gates?.[i]??entry.gate??.8),velocity:entry.accents?.[i]??(entry.genre==='fusion'?82+(i%3===0?9:0):78+(i%3===0?8:0)),role:'bass'}));
  bass.push({midi:target,beat:4,length:2.8,velocity:94,role:'landing'});
  const extended=entry.genre==='jazz',chord=(d,beat)=>[0,2,4,...(extended?[6]:[])].map(i=>({midi:degree(d-1+i)+12,beat,length:3.7,velocity:46,role:'chord'}));
  const chordName=d=>{const root=degree(d-1),third=degree(d+1)-root,fifth=degree(d+3)-root,seventh=degree(d+5)-root;return F.names[pc(root)]+(fifth===6?(extended?'m7♭5':'dim'):third===3?(extended?'m7':'m'):extended?(seventh===11?'maj7':'7'):'');};
  return {kind,key,mode,from,to,idea:entry.index,bpm:Math.max(40,Math.min(220,Number(opts.bpm)||80)),beats:8,bass,chords:[...chord(from,0),...chord(to,4)],source,target,title:entry.title,tip:entry.tip,lesson:entry.source,curated:entry,
   heading:from+' → '+to+' · '+chordName(from)+' → '+chordName(to)+' · '+P.modes[mode][0],fromChord:chordName(from),toChord:chordName(to)};
 }
 const legacyFills=[['contemporary',2],['fusion',2],['contemporary',1],['jazz',1],['fusion',1],['contemporary',1],['jazz',1],['blues',1],['pentatonic',1],['contemporary',2],['contemporary',1],['contemporary',1],['jazz',2],['fusion',2]];
 function metadata(kind,index){
  const e=get(kind,index);if(e)return e;
  const list=kind==='runs'?P.runs:F.styles,row=list[index];if(!row)return null;
  const [genre,tier]=kind==='fills'?legacyFills[index]:[/pentatonic/i.test(row[0])?'pentatonic':/blues/i.test(row[0])?'blues':/chromatic|enclosure|modal|outside/i.test(row[0])?'jazz':/highlife|makossa/i.test(row[0])?'other':/octave/i.test(row[0])?'fusion':'contemporary',index>=8?1:2];
  return {id:String(index),title:row[0],genre,tier,rank:100+index,original:false};
 }
 function compare(kind,a,b){const x=metadata(kind,a),y=metadata(kind,b);return x.tier-y.tier||x.rank-y.rank||a-b;}
 return {entries,genres,tiers,sources,rhythms,get,make,metadata,compare,register,reindex};
})();
