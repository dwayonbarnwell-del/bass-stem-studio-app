/* Musical groups retain existing study IDs and add specific cultural styles.
 * These are original practice compositions, informed by the named public lessons.
 * Editorial favourites are not claimed to be audience votes or artist endorsements.
 */
window.BassStudyGroups=(()=>{
 'use strict';
 const C=window.BassCuratedStudies,P=window.BassPracticeCore,F=window.BassFillCore,D=window.BassPracticeCatalogue;
 const culturalGroups=[['makossa','Makossa'],['seben','Seben'],['soukous','Soukous'],['zouk','Zouk'],['highlife','Highlife'],['afrobeat','Afrobeat'],['sungura','Sungura'],['mbalax','Mbalax'],['mbaqanga','Mbaqanga'],['soca','Soca'],['african-praise','African praise'],['regional','Regional']];
 const groups=[['gospel','Gospel & Contemporary'],['jazz','Jazz & Chromatic'],['blues','Blues & Pentatonic'],['funk','Funk & Soul'],...culturalGroups];
 const map={contemporary:'gospel',jazz:'jazz',blues:'blues',pentatonic:'blues',fusion:'funk',other:'african',african:'african'};
 // Freeze legacy identities before consolidating an identical musical pattern.
 for(const list of [P.runs,F.styles])list.forEach((row,i)=>{row.id??=String(i);});
 const kept=P.runs.find(row=>row.id==='10'),duplicate=P.runs.findIndex(row=>row.id==='22');
 if(kept&&duplicate>=0){kept.aliasIds=['22'];kept.aliasTitles=[P.runs[duplicate][0]];P.runs.splice(duplicate,1);}
 C.reindex();
 const sources={
  africa:{label:'Technique reference · Edd Bateman: African bass rhythm and melody',url:'https://worldmusicmethod.com/blog/african-bass-unlocking-the-rhythms-of-a-continent'},
  interplay:{label:'Technique reference · Edd Bateman / Niwel Tsumbu: African ensemble interplay',url:'https://worldmusicmethod.com/blog/african-ensemble-guitar-the-art-of-groove-interplay'},
  gospel:{label:'Technique reference · Daric Bennett: live gospel phrasing',url:'https://daricbennett.com/free-bass-lessons/analyzing-my-live-licks-gospel-bass/'},
  triplet:{label:'Technique reference · Mark Smith: triplet techniques used by Miller, Wooten and King',url:'https://www.talkingbass.net/slap-triplets-for-bass-guitar/'},
  jazz:C.sources.jazz,pent:C.sources.pent,blues:C.sources.blues,voice:C.sources.voice
 };
 Object.assign(C.rhythms,{
  // Different attack positions and short gates keep space in the groove.
  r12trip:Array.from({length:12},(_,i)=>2+i/6),af8:[.75,1.25,1.75,2,2.5,3,3.25,3.75],af7:[.75,1.5,2,2.5,3,3.25,3.75],
  af9:[.5,1,1.5,1.75,2.25,2.75,3,3.5,3.75],
  af10:[.5,1,1.25,1.75,2,2.5,2.75,3,3.5,3.75],
  break8:[1,1.5,2,2.25,2.5,3,3.5,3.75],
  burst9:[1.5,1.75,2,2.25,2.5,3,3+1/3,3+2/3,3+5/6],
  jazz8:[1,1+2/3,2,2+1/3,2+2/3,3,3+1/3,3+2/3]
 });
 const additions={runs:[
  ['Highlife firework answer','major','af10','d3 d8 d6 d9 d5 d10 d8 d3 t2 t-1','african','interplay','Keep the offbeat opening buoyant, then join the two upper answers.'],
  ['Soukous dancing staircase','major','r12','d5 d3 d6 d4 d8 d5 d9 d6 d10 d8 t2 t-1','african','africa','Let each short melodic answer interlock with the guitar part.'],
  ['Sungura racing conversation','major','r12','d1 d5 d3 d8 d6 d10 d9 d5 d8 d6 t1 t-1','african','africa','Alternate the low anchors and high replies while keeping the landing steady.'],
  ['Gospel skyward celebration','minor','r12','d3 d5 d8 d7 d10 d9 d6 d8 d5 d3 t2 t-1','contemporary','gospel','Build a clear minor-colour peak; make the final answer sing rather than rush.'],
  ['Jazz comet enclosure','dorian','r10','d7 d10 d9 d5 d8 d6 t3 t2 t1 t-1','jazz','jazz','Connect the upper extensions smoothly before the tight chromatic release.'],
  ['Triplet bass spotlight','mixolydian','r12trip','d8 d1 d5 d9 d3 d10 d6 d8 d5 d7 t2 t-1','fusion','triplet','Accent the octave replies in groups of three; keep the root landing stronger.']
 ],fills:[
  ['Highlife sunshine reply','major','af8','d3 d8 d5 d9 d6 d5 t2 t-1','african','interplay','Leave the early offbeats open so the bright upper answer can dance.'],
  ['Highlife double conversation','major','af7','d5 d10 d6 d9 d3 t1 t-1','african','interplay','Treat the two wide answers as a conversation with the guitar.'],
  ['Makossa octave celebration','mixolydian','af8','d1 d8 d5 d10 d7 d6 t2 t-1','african','africa','Keep the low pulse firm and the octave reply short. Makossa-inspired study.'],
  ['Makossa bright turnaround','major','af9','d5 d8 d3 d6 d9 d5 d10 t1 t-1','african','africa','Use short notes and space between the high replies. Makossa-inspired study.'],
  ['Soukous silver ribbon','major','af8','d3 d6 d4 d8 d5 d9 t2 t-1','african','africa','Weave the thirds around the beat; leave room for the lead guitar.'],
  ['Soukous rising smile','major','af7','d6 d3 d8 d5 d10 t1 t-1','african','africa','Let the two high answers lift the phrase without a louder attack.'],
  ['Sungura nimble answer','major','af9','d1 d5 d8 d3 d6 d10 d8 t2 t-1','african','africa','A percussive low note starts a flowing call and response.'],
  ['Sungura dancing sixths','major','af8','d3 d8 d6 d10 d5 d9 t1 t-1','african','africa','Balance the wider sixth shapes against a clean downbeat.'],
  ['Afrobeat pocket flare','dorian','af7','d1 d5 d8 d6 d3 t2 t-1','african','africa','Keep the first figure clipped; let the final response briefly open the groove.'],
  ['Afrobeat offbeat answer','mixolydian','af8','d5 d1 d8 d7 d6 d9 t1 t-1','african','africa','The low interruption leaves space for the horn or drum accent.'],
  ['Mbalax sparkling reply','major','af9','d1 d8 d5 d3 d9 d6 d10 t2 t-1','african','africa','Keep the offbeat accents light and answer the percussion. Mbalax-inspired study.'],
  ['African praise rising call','major','af7','d3 d9 d5 d10 d6 t2 t-1','african','interplay','Give the syncopated high response a clear melodic contour.'],
  ['Gospel crown flourish','major','break8','d3 d9 d8 d5 d10 d6 t2 t-1','contemporary','gospel','A high ninth opens into a singing upper-third answer.'],
  ['Minor gospel thunder','minor','burst9','d3 d8 d5 d10 d7 d9 d6 t1 t-1','contemporary','gospel','Hold the low root firmly, then let the minor response gather energy.'],
  ['Diminished gospel flash','major','break8','d5 d9 t8 t5 t2 t-1 t2 t1','contemporary','gospel','Keep the tense middle notes short and aim the final semitone at the landing.'],
  ['Praise summit answer','major','burst9','d8 d5 d10 d9 d6 d8 d3 t2 t-1','contemporary','gospel','Separate the broad opening leaps from the quick final turn.'],
  ['Worship soaring ninth','major','af7','d5 d9 d6 d10 d8 t1 t-1','contemporary','voice','Let the ninth carry the melody and keep the last two notes gentle.'],
  ['Gospel velvet encore','dorian','break8','d3 d7 d10 d8 d6 d9 t2 t-1','contemporary','gospel','Build a rounded minor-colour melody before the bright sixth reply.'],
  ['Jazz neon doorway','major','jazz8','d7 d9 d10 d6 d5 t2 t-1 t1','jazz','jazz','Place the high chord tones clearly before the final enclosure.'],
  ['Dorian diamond turn','dorian','break8','d5 d11 d9 d7 d10 d6 t2 t-1','jazz','jazz','Let the eleventh peak connect to the lower sixth rather than sound isolated.'],
  ['Bebop midnight sparkle','mixolydian','jazz8','d3 d7 s11 d9 d8 d6 t1 t-1','jazz','jazz','Touch the passing major seventh lightly over the dominant harmony.'],
  ['Minor ninth skylight','minor','burst9','d7 d10 d9 d5 d8 d3 d6 t2 t-1','jazz','jazz','A wide upper answer relaxes through the minor chord tones.'],
  ['Jazz sixth-to-ninth flare','major','break8','d6 d10 d7 d9 d5 d8 t1 t-1','jazz','voice','Keep the paired upper colours smooth and the landing economical.'],
  ['Blue-fire pentatonic answer','mixolydian','break8','s3 d3 p4 p6 p3 p5 t2 t-1','blues','blues','Let the blue third flick into the major sound before the pentatonic lift.'],
  ['Minor pentatonic shooting star','minor','burst9','p1 p4 p7 p5 p2 p6 p3 p1 p0','pentatonic','pent','Make the wide high note the peak, then answer with falling pairs.'],
  ['Golden pentatonic fanfare','major','break8','p2 p6 p4 p7 p3 p5 p1 p2','pentatonic','pent','Use the sixth and ninth colours to shape a bright, memorable answer.'],
  ['Funk octave spotlight','mixolydian','break8','d8 d1 d10 d5 d9 d6 t2 t-1','fusion','triplet','Short low anchors make the octave replies stand out.'],
  ['Soul velvet switch','major','af7','d3 d6 d10 d5 d8 t2 t-1','fusion','jazz','Sing the high third, then let the smaller answer relax back into the pocket.'],
  ['Fusion triplet flash','dorian','r9','d1 d8 d3 d9 d5 d10 d6 t1 t-1','fusion','triplet','Group the wide intervals into three-note answers; do not race the triplets.'],
  ['Funk champagne snap','minor','break8','p5 p0 p6 p3 p7 p4 p2 p1','fusion','pent','Let the high and low registers trade short, clear accents.'],
  ['Soul-fire chromatic bow','mixolydian','burst9','d3 d8 d6 d9 d5 s8 d6 t1 t-1','fusion','blues','Keep the chromatic curl lighter than the soulful chord-tone opening.']
 ]};
 const added=[];
 for(const kind of ['runs','fills'])additions[kind].forEach(([title,mode,rhythm,notes,genre,ref,tip],i)=>added.push(C.register({id:'curated-290-'+kind+'-'+(i+1),kind,title,mode,rhythm,notes,genre,source:sources[ref],tip,tier:0,rank:-40+i,gate:genre==='fusion'?.6:genre==='african'?.7:.82})));
 const rows=kind=>kind==='runs'?P.runs:F.styles;
 const id=(kind,index)=>rows(kind)[index]?.id;
 const ids=(kind,index)=>[id(kind,index),...(rows(kind)[index]?.aliasIds||[])];
 const visible=(kind,index)=>ids(kind,index).every(key=>D.visible(kind,key))&&window.BassCulturalStudies?.available(C.get(kind,index))!==false;
 function culturalStyle(row){return row?.curated?.culturalStyle||culturalGroups.find(([id])=>new RegExp(id.replace('-','[ -]'),'i').test(row?.[0]||''))?.[0]||'regional';}
 function groupOf(kind,index){const row=rows(kind)[index];if(row.curated)return ['african','other'].includes(row.curated.genre)||row.curated.culturalStyle?culturalStyle(row):map[row.curated.genre];if(/Highlife|Makossa/i.test(row[0]))return culturalStyle(row);if(/Soul|Syncopat|Octave/i.test(row[0]))return'funk';if(/Pentatonic|Blues/i.test(row[0]))return'blues';if(/Jazz|Chromatic|Modal|Enclosure|Outside|Neighbour-note|Upper-register|Descending octave/i.test(row[0]))return'jazz';return'gospel';}
 const label=(kind,index)=>rows(kind)[index][0];
 const aliases=(kind,index)=>rows(kind)[index]?.aliasTitles||[];
 const matching=(kind,group)=>rows(kind).map((_,i)=>i).filter(i=>visible(kind,i)&&groupOf(kind,i)===group).sort((a,b)=>C.compare(kind,a,b));
 const supports=(kind,index,from,to)=>{const study=C.get(kind,index)?.recordedStudy;return !study||study.changes.some(pair=>pair[0]===Number(from)&&pair[1]===Number(to));};
 const available=kind=>groups.filter(([group])=>matching(kind,group).length);
 const isCultural=(kind,index)=>culturalGroups.some(([group])=>group===groupOf(kind,index));
 const migrate=old=>old==='african'||map[old]==='african'?'makossa':groups.some(([id])=>id===old)?old:(map[old]||'gospel');
 return {groups,added,sources,id,ids,visible,groupOf,label,aliases,matching,supports,available,isCultural,migrate,total:kind=>rows(kind).length};
})();
