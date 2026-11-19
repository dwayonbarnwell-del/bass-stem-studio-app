const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const scripts=['bass-register-rc292','fills-rc264','practice-rc264b','catalogue-rc269','curated-rc289','groups-rc290','core-rc261','practice-drums-rc292','practice-loop-rc292'];
const e={window:{},localStorage:{getItem:()=>null},setTimeout};vm.createContext(e);for(const f of scripts)vm.runInContext(fs.readFileSync('ear-source/'+f+'.js','utf8'),e);
const {BassRegister:R,BassPracticeCore:P,BassEarTrainingCore:E,BassPracticeDrums:D,BassPracticeLoop:L}=e.window;
let checked=0,low=0,revoiced=0;
for(const kind of ['fills','runs','basslines'])for(let idea=0;idea<(kind==='basslines'?P.lines.length:100);idea++)for(let key=0;key<12;key++)for(let from=1;from<=7;from++)for(let to=1;to<=7;to++){
 if(kind==='basslines'&&(from!==1||to!==1))continue;
 const p=P.make(kind,{idea,key,from,to}),q=R.plan(p);checked++;
 assert(q.bass.every(n=>n.midi>=23&&n.midi<=59));if(q.bass.every(n=>n.midi<=47))low++;if(q.bassRevoiced)revoiced++;
 assert.equal(q.bass.length,p.bass.length);assert.equal(q.chords,p.chords);
 q.bass.forEach((n,i)=>{assert.equal(((n.midi-p.bass[i].midi)%12+12)%12,0);assert.equal(n.beat,p.bass[i].beat);assert.equal(n.length,p.bass[i].length);if(!q.bassRevoiced)assert.equal(n.midi-p.bass[i].midi,q.bassShift);});
}
const legacy={window:{}};vm.createContext(legacy);vm.runInContext(fs.readFileSync('ear-source/core-rc261.js','utf8'),legacy);
const rng=seed=>()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
for(const mode of ['notes','intervals','chords','progressions'])for(let level=1;level<=5;level++)for(let seed=1;seed<=150;seed++){
 const a=legacy.window.BassEarTrainingCore.make(mode,level,{sound:'bass',rng:rng(seed)}),b=E.make(mode,level,{sound:'bass',rng:rng(seed)});
 assert(b.events.every(n=>n.midi>=23&&n.midi<=59));assert((b.keyboard||[]).every(n=>n>=23&&n<=59));
 assert.equal(a.events.length,b.events.length);b.events.forEach((n,i)=>assert.equal(((n.midi-a.events[i].midi)%12+12)%12,0));
 if(mode==='intervals')assert.equal(b.events[1].midi-b.events[0].midi,a.events[1].midi-a.events[0].midi);
 if(mode==='notes'){assert.equal(b.answer.join(),b.events.map(n=>n.midi).join());assert(b.answer.every(n=>b.keyboard.includes(n)));}else assert.equal(a.answer,b.answer);
 const piano=E.make(mode,level,{sound:'piano',rng:rng(seed)}),oldPiano=legacy.window.BassEarTrainingCore.make(mode,level,{sound:'piano',rng:rng(seed)});assert.equal(JSON.stringify(piano),JSON.stringify(oldPiano));
}
for(const [id] of D.grooves)for(const beats of [4,8,20,64]){const a=D.events(beats,id);assert(a.length);assert(a.every(h=>h.beat>=0&&h.beat<beats&&h.velocity>0&&h.velocity<=100&&[1,2].includes(h.variant)));assert.equal(JSON.stringify(a),JSON.stringify(D.events(beats,id)));}
assert(D.events(8,'swing').some(h=>Math.abs(h.beat-(1+2/3))<1e-10));assert.equal(D.events(4,'reggae').filter(h=>h.hit==='kick')[0].beat,2);
const sources=[],gain=()=>({gain:{value:1,setTargetAtTime(){}},connect(){return this;},disconnect(){}}),context={currentTime:10,destination:{},createGain:gain,createBufferSource(){const s={connect(){return this;},disconnect(){},start(t){this.at=t;},stop(){}};sources.push(s);return s;}};
const rendered={stems:{bass:{},chords:{},drums:{}},seconds:Math.round(8*60/137*44100)/44100,gain:.7};
const t=L.start(context,rendered,{repeat:true});assert.equal(sources.length,3);assert(sources.every(s=>s.at===10.08&&s.loop&&s.loopEnd===rendered.seconds&&s.loopStart===0));
t.setRepeat(false);assert(sources.every(s=>!s.loop));t.setRepeat(true);assert(sources.every(s=>s.loop));assert.equal(sources.length,3,'No timer-created repeat sources');t.stop();
console.log(JSON.stringify({pass:true,arrangements:checked,atOrBelowB2:low,widePhrasesRevoiced:revoiced,bassQuestions:3000,pianoQuestionsUnchanged:3000,drumBeats:D.grooves.length,sharedClock:true}));
