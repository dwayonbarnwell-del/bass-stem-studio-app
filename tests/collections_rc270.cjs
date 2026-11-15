const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const env={window:{},localStorage:{getItem:()=>null,setItem(){}}};vm.createContext(env);
for(const f of ['fills-rc264.js','practice-rc264b.js','catalogue-rc269.js'])vm.runInContext(fs.readFileSync('ear-source/'+f,'utf8'),env);
const {BassPracticeCore:P,BassPracticeCatalogue:D}=env.window;
const counts={};for(const [id] of D.groups){counts[id]=P.lines.filter(l=>D.inCollection(l,id)).length;assert(counts[id]>0,id);}
for(const l of P.lines){const genre=D.genreOf(l);assert.equal(D.inCollection(l,'studies'),!genre);if(genre)assert(D.inCollection(l,genre));if(l.artist==='marley'||/reggae/i.test(l.name))assert.equal(genre,'reggae');}
assert.equal(P.lines.length,125);assert.equal(P.runs.length,40);assert.equal(counts.reggae,9);assert.equal(counts.makossa,4);assert.equal(counts.highlife,9);assert(counts.worship>0);assert(counts.praise>0);
const original=P.lines.find(l=>l.degrees.join(' ')==='6 2 3 6');assert(D.inCollection(original,'studies'));
const customIndex=D.addProgression('6 5 4 5 3',P.lines.find(l=>D.genreOf(l)==='reggae'));assert(D.inCollection(P.lines[customIndex],'studies'),'new custom progression remains selected in Original studies');
console.log('PASS genre grouping, unchanged catalogue and custom progression visibility. '+JSON.stringify(counts));
