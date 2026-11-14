const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const e={window:{},document:{getElementById:()=>null},Math,console};vm.createContext(e);
for(const f of ['ear-source/core-rc260.js','ear-source/fills.js','ai-source/piano.js'])vm.runInContext(fs.readFileSync(f,'utf8'),e);
const F=e.window.BassFillCore,C=e.window.BassEarTrainingCore,P=e.window.BassPiano,pc=m=>(m%12+12)%12;
let checked=0;
for(const mode of ['major','minor'])for(let key=0;key<12;key++)for(let from=1;from<=7;from++)for(let to=1;to<=7;to++){
 if(from===to)continue;const unique=new Set(),scale=mode==='major'?[0,2,4,5,7,9,11]:[0,2,3,5,7,8,10];
 for(let idea=0;idea<6;idea++){
  const p=F.make({mode,key,from,to,idea,bpm:80});
  assert.equal(pc(p.source),pc(key+scale[from-1]));assert.equal(pc(p.target),pc(key+scale[to-1]));
  assert.equal(p.bass[0].beat,0);assert.equal(p.bass[0].midi,p.source);assert.equal(p.bass.at(-1).beat,4);assert.equal(p.bass.at(-1).midi,p.target);
  for(const [i,n] of p.bass.entries()){assert(n.midi>=24&&n.midi<=72);assert(n.length>0&&n.beat+n.length<=8);if(i<p.bass.length-1)assert(n.beat+n.length<=p.bass[i+1].beat+.0001);}
  for(const [d,beat] of [[from,0],[to,4]]){const actual=Array.from(p.chords.filter(n=>n.beat===beat),n=>pc(n.midi)).sort((a,b)=>a-b);const expected=[0,2,4].map(k=>pc(key+scale[(d-1+k)%7])).sort((a,b)=>a-b);assert.deepEqual(actual,expected);}
  unique.add(JSON.stringify(p.bass.map(n=>[n.midi,n.beat,n.length])));checked++;
 }
 assert.equal(unique.size,6,`six different ideas for ${mode} ${key}: ${from} to ${to}`);
}
for(const sound of ['piano','bass'])for(let level=1;level<=3;level++)for(let i=0;i<150;i++){
 const q=C.make('notes',level,{sound});assert.equal(q.keyboard[0]%12,0);assert.equal(q.keyboard.at(-1)%12,11);assert.equal(q.keyboard.length,12);assert(q.answer.every(n=>q.keyboard.includes(n)));
}
for(const pitches of [[60,67],[59,60],[52,75],[36,84]])for(const shift of [-3,0,5]){
 const notes=pitches.map(midi=>({midi,start:0,end:3})),keys=Array.from(P.fitKeys(notes,0,4,350,shift));
 assert.equal(keys.at(-1)%12,0);assert.equal(keys[0]%12,11);assert.equal(keys.length%12,0);assert(pitches.every(m=>keys.includes(m+shift)));
}
const html=fs.readFileSync('index.html','utf8');let scripts=0;
for(const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){
 const src=m[1].match(/src="\.\/([^"?]+)/);if(src)assert(fs.existsSync(src[1]),src[1]);else if(m[2].trim()){new vm.Script(m[2]);scripts++;}
}
for(const dead of ['rc173-store','rc183-feedback','rc172-coach','window.BassLiveDSP'])assert(!html.includes(dead));
assert(html.includes(fs.readFileSync('ai-source/piano.js','utf8').trim()));assert(html.includes(fs.readFileSync('ai-source/rc171-live.js','utf8').trim()));
console.log(`PASS ${checked} fill arrangements: 42 changes × 6 ideas × 24 keys/scales; target roots, chord notes, timing, variety; fixed C–B keyboards; ${scripts} inline scripts compile; active sources match.`);
