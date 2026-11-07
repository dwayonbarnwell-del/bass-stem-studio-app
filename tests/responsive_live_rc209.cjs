const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const ctx={window:{},Float32Array,Float64Array,Math,Map,Number,Object,Array};vm.createContext(ctx);
for(const file of ['ai-source/worship-live.js','ai-source/responsive-live.js'])vm.runInContext(fs.readFileSync(file,'utf8'),ctx);
const dsp=ctx.window.BassResponsiveLive;
let passed=0;function test(name,fn){fn();passed++;console.log('PASS '+name)}
const frames=fn=>{const n=64,values=new Float32Array(n*88);for(let f=0;f<n;f++)for(const [m,v] of fn(f))values[f*88+m-21]=v;return {frames:n,pitches:88,values}};
function spectrum(midis,{amplitudes=[],harmonics=5}={}){const sr=22050,n=8192,out=new Float32Array(n/2).fill(-110);for(let a=0;a<midis.length;a++)for(let h=1;h<=harmonics;h++){const hz=440*2**((midis[a]-69)/12)*h,x=hz*n/sr,amp=(amplitudes[a]||1)/h**1.2,db=-20+20*Math.log10(amp);for(let i=Math.max(1,Math.floor(x)-2);i<=Math.min(out.length-2,Math.ceil(x)+2);i++){const v=db-10*(i-x)**2;out[i]=Math.max(out[i],v)}}return out}
const names=['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
for(let root=0;root<12;root++)for(const [suffix,steps]of [['',[0,4,7]],['m',[0,3,7]]]){
 test('Spectrum '+names[root]+suffix,()=>assert.equal(dsp.spectrum(spectrum(steps.map(x=>48+root+x)),22050,8192).chord,names[root]+suffix));
 test('Model '+names[root]+suffix,()=>assert.equal(dsp.model(frames(()=>steps.map(x=>[48+root+x,.8]))).chord,names[root]+suffix));
}
test('Silence has no chord',()=>assert.equal(dsp.spectrum(new Float32Array(4096).fill(-Infinity),22050,8192).chord,'—'));
test('Flat noise has no chord',()=>assert.equal(dsp.spectrum(new Float32Array(4096).fill(-30),22050,8192).chord,'—'));
test('Sung harmonics do not create a chord',()=>{for(let note=45;note<85;note++)assert.equal(dsp.spectrum(spectrum([note],{harmonics:12}),22050,8192).chord,'—','note '+note)});
test('Sequential solo melody does not create chords',()=>assert.equal(dsp.model(frames(i=>[[[60,64,67][i%3],.9]])).chord,'—'));
test('Loud isolated peak is not sustained clipping',()=>{const a=new Float32Array(8192).fill(.03);a[2]=1.1;assert.equal(dsp.levels(a).severe,false)});
test('Sustained distortion is flagged',()=>{const a=Float32Array.from({length:8192},(_,i)=>i%80<40?1:-1);assert.equal(dsp.levels(a).severe,true)});
test('First chord arrives without waiting for voice model',()=>{const f=dsp.createFollower();assert.equal(f.update({chord:'C',confidence:.9,source:'spectrum'},0).chord,'—');assert.equal(f.update({chord:'C',confidence:.9,source:'spectrum'},.1).chord,'—');assert.equal(f.update({chord:'C',confidence:.9,source:'spectrum'},.2).chord,'C')});
test('Basic chord changes within 300 ms of consistent evidence',()=>{const f=dsp.createFollower();f.update({chord:'C',confidence:.95,source:'model'},0);for(const t of [.1,.2,.3])f.update({chord:'G',confidence:.9,source:'spectrum'},t);assert.equal(f.update({chord:'G',confidence:.9,source:'spectrum'},.4).chord,'G')});
test('Momentary gap holds marked last chord then clears',()=>{const f=dsp.createFollower();f.update({chord:'C',confidence:.95,source:'model'},0);assert.equal(f.state(.8).chord,'C');assert.equal(f.state(1.2).held,true);assert.equal(f.state(3).chord,'—')});
test('Old events cannot overwrite newer chord',()=>{const f=dsp.createFollower();f.update({chord:'C',confidence:.95,source:'model'},2);assert.equal(f.update({chord:'G',confidence:.95,source:'model'},1).chord,'C')});
test('Exactly three requested modes installed',()=>{const raw=html.match(/<select id="liveVoiceMode">([\s\S]*?)<\/select>/)[1];assert.equal((raw.match(/<option/g)||[]).length,3);for(const label of ['Lead notes (singer or speaker)','Lead singer + band chords','Instruments: basic chords'])assert(raw.includes(label))});
test('Current voice and responsive source match app exactly',()=>{for(const [id,path] of [['rc167-live-script','ai-source/rc171-live.js'],['rc209-responsive-live','ai-source/responsive-live.js']])assert.equal(html.match(new RegExp('<script id="'+id+'">([\\s\\S]*?)</script>'))[1].trim(),fs.readFileSync(path,'utf8').trim())});
console.log('PASS '+passed+' live tests. Synthetic inputs; no paid requests.');
