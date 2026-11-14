const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const env={window:{},console,Math};vm.createContext(env);vm.runInContext(fs.readFileSync('ear-source/core-rc261.js','utf8'),env);const C=env.window.BassEarTrainingCore;let seed=7;const rng=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};let count=0;
for(const mode of C.modes)for(let level=1;level<=3;level++)for(const sound of ['piano','bass'])for(let i=0;i<80;i++){
 const q=C.make(mode,level,{rng,sound});assert(C.grade(q,q.answer).correct);assert(!C.grade(q,null).correct);assert.equal(q.level,level);
 for(const n of [...q.events,...(q.reference||[])]){assert(n.midi>=21&&n.midi<=108);assert(n.end>n.start&&n.start>=0);assert(n.velocity>0&&n.velocity<=127);}
 if(q.options.length){assert.equal(new Set(q.options).size,q.options.length);assert(q.options.includes(q.answer));for(const x of q.options)assert.equal(C.grade(q,x).correct,x===q.answer);}
 if(mode==='notes'){assert.deepEqual(Array.from(q.events,n=>n.midi),Array.from(q.answer));assert(q.answer.every(m=>q.keyboard.includes(m)));}
 if(mode==='intervals'){const gap=Math.abs(q.events[1].midi-q.events[0].midi);assert.equal(C.intervals[gap],q.answer);}
 if(mode==='chords'){const root=q.events.reduce((a,n)=>Math.min(a,n.midi),Infinity);const pcs=q.events.map(n=>n.midi%12).sort((a,b)=>a-b);const quality=C.qualities.find(x=>x[0]===q.answer);assert(q.events.some(n=>JSON.stringify(quality[1].map(x=>(n.midi+x)%12).sort((a,b)=>a-b))===JSON.stringify(Array.from(pcs))));}
 if(mode==='progressions'){const root=q.reference[0].midi,scale=[0,2,4,5,7,9,11];q.answer.split('–').forEach((d,j)=>assert.equal(q.events[j*4].midi,root+scale[d-1]-12));}
 if(mode==='rhythm'){assert(C.grade(q,q.answer.map(t=>t+17.4)).correct);assert(!C.grade(q,q.answer.map(t=>t*1.4)).correct);assert(!C.grade(q,q.answer.slice(1)).correct);}
 count++;
}
let p=C.empty();for(let i=0;i<25;i++)p=C.record(p,'notes',i%2===0,2);assert.equal(p.modes.notes.total,25);assert.equal(p.modes.notes.correct,13);assert.equal(p.modes.notes.recent.length,20);p=C.restore(JSON.parse(JSON.stringify(p)));assert.equal(p.modes.notes.level,2);assert.equal(C.restore({version:99}).version,1);
const manifest=JSON.parse(fs.readFileSync('ai-source/salamander/manifest.json'));assert.equal(manifest.samples.length,90);let size=0;for(const s of manifest.samples){const bytes=fs.readFileSync('ai-source/salamander/'+s.url);assert.equal(bytes.length,s.bytes);size+=bytes.length;assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),s.sha256);assert.equal(s.channels,2);assert(s.decodedAttackSeconds<=.003);assert(s.peak<1);assert(s.tuningBakedIn);}assert.equal(size,manifest.totalBytes);
const h=fs.readFileSync('index.html','utf8');assert(h.includes(fs.readFileSync('ai-source/piano.js','utf8').trim()));assert(h.includes('window.BassPianoSamples='));assert(h.includes('exportAudio({...r,notes,sound'));assert(h.includes("const APP_VERSION='RC262'"));
console.log('PASS',count,'generated exercises, grading, pitch/chord/progression logic, rhythm offsets/tempo, saved progress and 90 licensed asset hashes.');
