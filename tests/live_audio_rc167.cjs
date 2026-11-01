const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');
const code=html.match(/<script id="rc167-live-script">([\s\S]*?)<\/script>/)[1];
const c={window:{},Float64Array,Math,Object};vm.createContext(c);vm.runInContext(code,c);
const dsp=c.window.BassLiveDSP;
function chroma(pcs){const a=new Float64Array(12);for(const pc of pcs)a[pc]=1;return a;}
for(let root=0;root<12;root++){
 const name=['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'][root];
 for(const [suffix,pcs] of [['',[0,4,7]],['m',[0,3,7]],['7',[0,4,7,10]],['maj7',[0,4,7,11]],['m7',[0,3,7,10]],['dim',[0,3,6]]])assert.equal(dsp.classify(chroma(pcs.map(p=>(p+root)%12))).label,name+suffix);
}
assert.equal(dsp.classify(chroma([])).kind,'quiet');
assert.equal(dsp.classify(chroma([0])).kind,'notes');
assert.equal(dsp.classify(chroma([0,7])).kind,'notes');
assert.equal(dsp.classify(new Float64Array(12).fill(1)).kind,'unclear');
assert.equal(dsp.classify(chroma([0,4,8])).kind,'unclear','symmetric augmented chord must not invent a root');
function spectrum(midis,sr){const n=8192,db=new Float32Array(n/2).fill(-110);for(const midi of midis){const f=440*2**((midi-69)/12);for(let h=1;h<=5;h++){const bin=f*h*n/sr;for(let i=Math.max(1,Math.floor(bin)-2);i<=Math.ceil(bin)+2&&i<db.length;i++){const v=-18-20*Math.log10(h)-10*(i-bin)**2;db[i]=Math.max(db[i],v);}}}return db;}
for(const sr of [44100,48000])for(const [midis,label] of [[[48,52,55],'C'],[[45,48,52],'Am'],[[55,59,62,65],'G7']]){
 const result=dsp.classify(dsp.spectrumChroma(spectrum(midis,sr),sr,8192));assert.equal(result.label,label,JSON.stringify({sr,midis,result}));
}
assert.notEqual(dsp.classify(dsp.spectrumChroma(spectrum([48],48000),48000,8192)).kind,'chord','single harmonic note is not a full chord');
console.log('PASS: 72 major/minor/seventh/diminished templates; ambiguous, silent, single-note and noise rejection; harmonic spectra at 44.1/48 kHz.');
