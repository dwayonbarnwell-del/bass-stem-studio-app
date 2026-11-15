const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
function load(saved=new Map()){const env={window:{},localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)}};vm.createContext(env);for(const f of ['fills-rc264.js','practice-rc264b.js','catalogue-rc269.js'])vm.runInContext(fs.readFileSync('ear-source/'+f,'utf8'),env);return env.window;}
const saved=new Map(),{BassPracticeCore:P,BassPracticeCatalogue:D}=load(saved);let cases=0;
for(const key of Array.from({length:12},(_,i)=>i))for(const mode of Object.keys(P.modes))for(const kind of ['basslines','runs'])for(let idea=0;idea<(kind==='basslines'?P.lines.length:P.runs.length);idea++)for(const [from,to] of kind==='runs'?[[1,4],[6,2],[2,5],[4,3]]:[[1,4]]){
 const plan=P.make(kind,{key,mode,idea,from,to,bpm:80});assert(plan.bass.length>0);
 plan.bass.forEach((n,i)=>{assert(Number.isInteger(n.midi)&&n.midi>=23&&n.midi<=88,JSON.stringify({kind,key,mode,idea,n}));assert(n.beat>=0&&n.length>0&&n.beat+n.length<=plan.beats+.001);if(i)assert(plan.bass[i-1].beat+plan.bass[i-1].length<=n.beat+.001,'overlapping notes');});
 if(kind==='basslines'){assert.equal(plan.beats,P.lines[idea].degrees.length*4);assert.equal(plan.chords.length,P.lines[idea].degrees.length*3);}else{assert.equal(plan.bass.at(-1).beat,4);assert.equal(plan.bass.at(-1).midi,plan.target);}cases++;
}
for(const v of ['6 2 3 6','6 5 4 5 3','1 5 2 4','1 2 6 5','3 4 5 6','1 3 4 5'])assert(P.lines.some(l=>l.degrees.join(' ')===v));
assert.equal(new Set(P.lines.map(l=>l.id)).size,P.lines.length);
const five=P.lines.findIndex(l=>l.degrees.join(' ')==='6 5 4 5 3');assert.equal(P.make('basslines',{idea:five}).beats,20);
for(const [kind,id] of [['basslines',P.lines[0].id],['runs','0'],['fills','0'],['uploaded','clip-23'],['library','song:4000']]){D.remove(kind,id);assert(!D.visible(kind,id));assert(!load(saved).BassPracticeCatalogue.visible(kind,id));}
D.restore();assert.equal(D.deletedCount,0);assert(load(saved).BassPracticeCatalogue.visible('uploaded','clip-23'));
for(const value of ['','1','1 8','1 x 2','1.5 2','12 4'])assert.throws(()=>D.addProgression(value,P.lines[0]));
const i=D.addProgression('6 5 4 5 3',P.lines[0]);assert.equal(P.make('basslines',{idea:i}).beats,20);assert(load(saved).BassPracticeCore.lines.some(l=>l.id===P.lines[i].id));
console.log('PASS '+cases+' arrangements; requested progressions, five-bar timing, delete/restore across five areas and saved custom progressions. '+(P.lines.length-1)+' basslines, '+P.runs.length+' runs.');
