const assert=require('assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path');
const c={window:{},console};vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../ai-source/rc183-feedback.js'),'utf8'),c);
const f=c.window.BassFeedback,n=(midi,start)=>({midi,start,end:start+.4});
let r=f.score([n(35,0),n(40,1),n(43,2)],[n(35,.05),n(40,1.06),n(43,2.03)]);assert.equal(r.matched,3);assert.equal(r.missed,0);assert.equal(r.timing,50);
r=f.score([n(35,0),n(40,1),n(43,2),n(45,3)],[n(35,.02),n(41,1.03),n(45,3),n(48,4)]);assert.equal(r.matched,2);assert.equal(r.different,1);assert.equal(r.missed,1);assert.equal(r.extra,1);
assert.equal(r.rows.find(x=>x.kind==='not detected').expected,43);
assert.throws(()=>f.score([n(35,0)],[]),/Not enough/);
r=f.score([n(35,0),n(35,1)],[n(35,1)]);assert.equal(r.matched,1);assert.equal(r.missed,1);
const ranges=f.passages(r,10,12);assert(ranges.every(p=>p.start>=0&&p.end<=12&&p.end>p.start));
vm.runInContext(fs.readFileSync(path.join(__dirname,'../ai-source/rc172-dsp.js'),'utf8'),c);
for(const midi of [23,28,35,40,55]){const sr=22050,hz=440*Math.pow(2,(midi-69)/12),x=Float32Array.from({length:4096},(_,i)=>.2*Math.sin(2*Math.PI*hz*i/sr));const p=c.window.BassPracticeDSP.pitch(x,sr,28);assert(p,'detect '+midi);assert.equal(p.midi,midi);}
console.log('PASS: reference alignment handles timing, wrong/missing/extra/repeated notes, empty input and bounded practice passages; synthetic B0 through G3 pitch detection.');
const reviews=f.reviewPlans([{passages:[{start:5,end:8}]},{passages:[{start:5.2,end:8},{start:15,end:18}]},{passages:[{start:5,end:8},{start:-1,end:99}]}],20);assert.equal(reviews[0].start,5);assert.equal(reviews.length,2);assert.equal(f.reviewPlans(null,20).length,0);console.log('PASS: recurring recording difficulties produce bounded practice suggestions.');
