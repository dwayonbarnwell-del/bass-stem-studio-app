const assert=require('node:assert/strict');
const C=require('../ear-source/rehearsal-core.js');

function fixture(duration,tempo=120,meter=4){
 const step=60/tempo;
 return {duration,tempo,meter,phase:0,confidence:.98,beats:Array.from({length:Math.floor(duration/step)+1},(_,i)=>i*step),chords:[],notes:[],sections:[]};
}
function coverage(song,plan){
 assert(C.validPhrasePlan(plan,song));
 assert.equal(plan.phrases[0].start,0);
 assert.equal(plan.phrases.at(-1).end,song.duration);
 const seen=new Set();
 for(let i=0;i<plan.phrases.length;i++){
  const p=plan.phrases[i];
  assert(p.end>p.start&&p.end<=song.duration);
  assert.equal(p.start,i?plan.phrases[i-1].end:0,'gap or overlap in the timeline');
  assert(!seen.has(p.start));seen.add(p.start);
  assert(p.end-p.start<=22,'unnecessarily long phrase');
  const grid=C.phraseGrid(plan,p);
  if(grid)assert(grid.points.every(t=>t>=p.start-.006&&t<=p.end+.006),'phrase grid leaks into another range');
 }
 const copy=JSON.parse(JSON.stringify(plan));
 assert.strictEqual(C.phrasePlan(song,copy),copy,'saved times are reused after a JSON round trip');
 assert.equal(plan.phrases.reduce((n,p)=>n+p.end-p.start,0).toFixed(4),song.duration.toFixed(4));
}
let checks=0;
for(const tempo of [60,90,117,180])for(const meter of [3,4,6])for(const duration of [.9,6,8,11,15,18,24,32,64,475.544]){
 const song=fixture(duration,tempo,meter),original=JSON.stringify(song),plan=C.phrasePlan(song);
 coverage(song,plan);assert.equal(JSON.stringify(song),original,'song analysis was changed');checks++;
}
// A repeating four-chord phrase at 120 BPM closes after 16 seconds. Prefer
// that turnaround over a rigid 12-second cut halfway through the progression.
const cycle=fixture(64);
cycle.chords=Array.from({length:32},(_,i)=>({start:i*2,end:(i+1)*2,rootPc:[0,5,7,5][i%4],quality:'maj'}));
assert.deepEqual(C.phrasePlan(cycle).phrases.map(p=>[p.start,p.end]),[[0,16],[16,32],[32,48],[48,64]]);
// Existing section edges, pickups, variable beats, held notes and the exact
// fractional outro must survive. No extra overlapping candidate set is added.
const song=fixture(475.544,117);
song.beats=song.beats.map((t,i)=>t+.19+(i%2?.025:0)).filter(t=>t<=song.duration);
song.sections=[{name:'Outro',start:451.23,end:song.duration},{name:'Chorus',start:113.41,end:225.92},{name:'Intro',start:0,end:29.12},{name:'Verse',start:29.12,end:113.41},{name:'Chorus',start:113.41,end:225.92}];
song.notes=[{start:0,end:2.3,midi:36},{start:28.9,end:29.12,midi:43},{start:473,end:475.5,midi:36}];
const plan=C.phrasePlan(song);coverage(song,plan);
for(const edge of [29.12,113.41,225.92,451.23])assert(plan.phrases.some(p=>p.end===edge),'a known section edge was lost');
assert(plan.phrases.length<50,'the long-song menu still contains excessive short picks');
assert(plan.phrases.some(p=>p.section==='Intro')&&plan.phrases.some(p=>p.section==='Outro'));
// The complete recording remains covered even when no trustworthy timing or
// notes exist. Quiet introductions and endings must not be filtered out.
const silent={duration:41.387,sampleRate:1000,numberOfChannels:1,getChannelData:()=>new Float32Array(41387)};
const unknown={duration:silent.duration,buffer:silent,sections:[],chords:[],notes:[]};
const fallback=C.phrasePlan(unknown);coverage(unknown,fallback);assert.equal(fallback.grid,null);
assert(fallback.phrases.every(p=>p.end-p.start>=10&&p.end-p.start<=15));
// Reject stale/corrupt saved partitions. A changed analysis can refine the
// choices, but a cached plan must never omit or duplicate a section of audio.
for(const damage of [p=>p.phrases[1].start+=.1,p=>p.phrases[0].end=NaN,p=>p.phrases.at(-1).end-=1,p=>p.grid.points[1]=Infinity]){
 const broken=JSON.parse(JSON.stringify(plan));damage(broken);
 assert(!C.validPhrasePlan(broken,song));coverage(song,C.phrasePlan(song,broken));
}
song.sections[0].name='Ending';assert(!C.validPhrasePlan(plan,song));
assert.equal(C.phrasePlan({duration:0}),null);
console.log(JSON.stringify({passed:true,coverageCases:checks,complete475SecondTimeline:true,natural16SecondTurnarounds:true,sectionsAndFractionalOutroPreserved:true,savedTimelineRoundTrip:true,stalePlansRejected:true,noGapsOverlapsOrMissingRests:true}));
