import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {stretchLoop} from '../ear-source/drum-stretch-rc294.mjs';
const rate=44100,beats=8,beat=rate*.6,source=new Float32Array(beat*beats);
for(let i=0;i<source.length;i++){const t=(i%beat)/rate;source[i]=Math.sin(2*Math.PI*80*t)*Math.exp(-t*40);}
let worst=0;
for(const bpm of [40,60,80,100,137,180,220]){
 const beatFrames=Math.round(rate*60/bpm),frames=beatFrames*beats,[left,right]=stretchLoop([source,source],rate,frames,beats);
 assert.equal(left.length,frames);assert.deepEqual(left,right);
 assert(left.every(Number.isFinite));
 for(let b=0;b<beats;b++){
  const at=b*beatFrames;let peak=0,offset=0;
  for(let d=-Math.round(rate*.09);d<rate*.09;d++){const value=Math.abs(left[(at+d+frames)%frames]);if(value>peak){peak=value;offset=d;}}
  worst=Math.max(worst,Math.abs(offset/rate-.003));
  assert(Math.abs(offset/rate-.003)<.009,'Drum attack must remain on its beat at '+bpm+' BPM');
 }
}
const manifest=JSON.parse(fs.readFileSync('audio/drums-rc294/manifest.json'));
assert.equal(manifest.samples.length,45);assert.equal(new Set(manifest.samples.map(x=>x.id)).size,45);
for(const row of manifest.samples){assert(fs.existsSync(row.url));assert(Math.abs(row.frames/row.sampleRate-32*60/row.bpm)<1/row.sampleRate);if(/(\d+)\s*bpm/i.test(row.sourceName))assert.equal(row.bpm,Number(row.sourceName.match(/(\d+)\s*bpm/i)[1]));}
const memory=new Map(),env={window:{},localStorage:{getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)}};vm.createContext(env);
for(const name of ['fills-rc264','practice-rc264b','catalogue-rc269','curated-rc289','groups-rc290','drum-loops-data-rc294','supplied-drums-rc294','accompaniment-rc293','study-display-rc294'])vm.runInContext(fs.readFileSync('ear-source/'+name+'.js','utf8'),env);
const {BassPracticeCore:P,BassFillCore:F,BassStudyDisplay:N,BassAccompaniment:H,BassSuppliedDrums:B}=env.window;
for(const kind of ['basslines','fills','runs'])for(let idea=0;idea<(kind==='basslines'?P.lines.length:100);idea++){
 const plan=P.make(kind,{idea,from:1,to:4,bpm:220}),choice=H.resolve(plan);
 assert.equal(plan.bpm,220);assert.equal(choice.sound,'piano');assert(B.loops.includes(choice.loop));
 const chords=N.segments(plan);assert(chords.length>=2);assert.equal(chords[0].beat,0);assert.equal(chords.at(-1).end,plan.beats);
 const label=N.label(kind,kind==='basslines'?P.lines[idea]:kind==='runs'?P.runs[idea]:F.styles[idea]);
 assert(label.replace(/\s+[1-7](?:–[1-7])+$/,'').length<=12);
}
assert.equal(H.resolve(P.make('basslines',{idea:0})).loop.genre,'soul');
assert.equal(H.resolve(P.make('basslines',{idea:0}),{sound:'organ'}).sound,'organ');
const ui=fs.readFileSync('ear-source/study-ui-rc267.js','utf8');
assert(!ui.includes('About these studies'));assert(!ui.includes('phrase notes'));assert(!ui.includes('Most amazing'));
console.log(JSON.stringify({pass:true,loops:45,tempoRange:'40–220 BPM',maxAttackErrorMs:Math.round(worst*1000*100)/100,grandPianoDefault:true,conciseNames:true}));
