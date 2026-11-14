const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),ctx={window:{},Blob,File,URL,Float32Array,Float64Array,setTimeout};vm.createContext(ctx);
for(const id of ['rc172-dsp'])vm.runInContext(html.match(new RegExp('<script id="'+id+'">([\\s\\S]*?)</script>'))[1],ctx);
const dsp=ctx.window.BassPracticeDSP;
for(const sr of [22050,44100,48000])for(const hz of [41.2034,65.4064,110,220,440,880])for(const cents of [-20,0,20]){const actual=hz*2**(cents/1200),x=new Float32Array(Math.round(sr*.19));for(let i=0;i<x.length;i++)x[i]=.2*Math.sin(2*Math.PI*actual*i/sr)+.07*Math.sin(4*Math.PI*actual*i/sr);const p=dsp.pitch(x,sr);assert(p,'pitch exists '+sr+' '+hz);assert(Math.abs(1200*Math.log2(p.hz/actual))<5,'frequency accurate '+sr+' '+hz);}
assert.equal(dsp.pitch(new Float32Array(4096),22050),null);const clipped=new Float32Array(4096).fill(1);assert.equal(dsp.pitch(clipped,22050),null);
assert.deepEqual(JSON.parse(JSON.stringify(dsp.snapRange(.91,2.12,[0,.5,1,1.5,2,2.5,3],3))),{start:1,end:2});assert.throws(()=>dsp.snapRange(0,1,[],5));assert.equal(Math.round(dsp.timing(2.53,2,120).ms),30);assert.equal(dsp.timing(1,2,120),null);assert.equal(Math.round(dsp.timing(2.53,2,120,.03).ms),0);
console.log('PASS: 54 tuning cases, silence/clipping, beat snapping and timing offsets.');
