const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),cp=require('child_process');
const scripts=['fills-rc264.js','practice-rc264b.js','catalogue-rc269.js','curated-rc289.js','groups-rc290.js'];
function load(before=false,saved=new Map()){const e={window:{},localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)}};vm.createContext(e);for(const file of scripts){const path='ear-source/'+file;vm.runInContext(before?cp.execFileSync('git',['show','fa7dd25ffacca3250f4e98bd12215c97849d3095:'+path],{encoding:'utf8'}):fs.readFileSync(path,'utf8'),e);}return e.window;}
const before=load(true),after=load(),P=after.BassPracticeCore,D=after.BassPracticeCatalogue;
const progressions=w=>[...new Set(w.BassPracticeCore.lines.map(l=>l.degrees.join('-')))].sort();
assert.equal(before.BassPracticeCore.lines.length,125);assert.equal(P.lines.length,107);assert.equal(progressions(after).length,70);assert.deepEqual(progressions(after),progressions(before));
const forbidden=l=>['motown','disco','slap','funk'].includes(l.feel)||['jamerson','edwards','miller'].includes(l.artist)||/motown|disco|octave funk|octave engine|funk motion/i.test(l.name);
assert(!P.lines.some(forbidden));assert(!D.groups.some(([id])=>['jamerson','edwards','miller'].includes(id)));
assert.equal(new Set(P.lines.map(l=>l.id)).size,P.lines.length);
for(const line of P.lines){const prior=before.BassPracticeCore.lines.find(l=>l.id===line.id);assert(prior);assert.equal(line.degrees.join('-'),prior.degrees.join('-'));if(!forbidden(prior)){const a=before.BassPracticeCore.make('basslines',{idea:before.BassPracticeCore.lines.indexOf(prior)}),b=P.make('basslines',{idea:P.lines.indexOf(line)});assert.equal(JSON.stringify(a.bass),JSON.stringify(b.bass));assert.equal(JSON.stringify(a.chords),JSON.stringify(b.chords));}}
// The user's 100 runs and 100 fills, including Funk & Soul, are unchanged.
for(const kind of ['runs','fills'])for(let idea=0;idea<100;idea++)assert.equal(JSON.stringify(P.make(kind,{idea})),JSON.stringify(before.BassPracticeCore.make(kind,{idea})));
for(let first=1;first<=7;first++)for(let second=1;second<=7;second++){const i=D.addProgression(first+' '+second,P.lines[0]),plan=P.make('basslines',{idea:i});assert.equal(plan.beats,8);assert.equal(P.lines[i].degrees.join('-'),first+'-'+second);}
const long='7 7 1 2 3 4 5 6 7 6 5 4 3 2 1 1',i=D.addProgression(long,P.lines[0]);assert.equal(P.make('basslines',{idea:i}).beats,64);
for(const feel of ['motown','disco','slap','funk']){
 const stored={id:'custom-'+feel,name:'My Sunday sequence',degrees:[6,5,4,5,3],feel,shape:[[0,0,.1],[.25,7,.1]],source:{label:'Old source',url:'https://example.com'}};
 const saved=new Map([['bass-practice-custom-v1',JSON.stringify([stored])],['bass-practice-deleted-v1',JSON.stringify(['basslines:custom-'+feel])]]),w=load(false,saved),line=w.BassPracticeCore.lines.find(l=>l.id===stored.id);
 assert.equal(line.name,stored.name);assert.equal(line.degrees.join('-'),'6-5-4-5-3');assert(!forbidden(line));assert(!line.shape&&!line.source);assert(!w.BassPracticeCatalogue.visible('basslines',line.id));
 assert.equal(saved.get('bass-practice-custom-v1'),JSON.stringify([stored]),'Do not rewrite saved user data on load');
 const index=w.BassPracticeCatalogue.addProgression('1 4 6 5',stored);assert(!forbidden(w.BassPracticeCore.lines[index]));assert(!w.BassPracticeCore.lines[index].shape);
}
console.log('PASS: unwanted bassline styles removed; all 70 existing progressions preserved; all 49 two-chord combinations and a 16-chord sequence supported; custom saves/deletions retained; all 200 runs/fills unchanged.');
