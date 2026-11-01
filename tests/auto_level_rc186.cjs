const fs=require('fs'),vm=require('vm'),assert=require('assert');const html=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');const code=html.match(/<script id="rc186-level">([\s\S]*?)<\/script>/)[1],sandbox={window:{}};vm.createContext(sandbox);vm.runInContext(code,sandbox);const Engine=sandbox.window.BassAutoLevel.LevelEngine;
let checks=0;function ok(v,s){assert(v,s);checks++;}
for(const rate of [44100,48000,96000]){
 const e=new Engine(rate);let peak=0,quietStart=0,quietEnd=0;
 for(let b=0;b<Math.ceil(rate*12/128);b++){const l=new Float32Array(128),r=new Float32Array(128),a=[new Float32Array(128),new Float32Array(128)];for(let i=0;i<128;i++){let t=(b*128+i)/rate;let x=t<5?.02*Math.sin(2*Math.PI*110*t):t<7?5*Math.sin(2*Math.PI*80*t):t<9?0:Math.sin(2*Math.PI*440*t);l[i]=x;r[i]=x*.5;}e.process([l,r],a);for(let i=0;i<128;i++){peak=Math.max(peak,Math.abs(a[0][i]));ok(Number.isFinite(a[0][i]),'finite');ok(Math.abs(a[1][i]-a[0][i]*.5)<1e-6,'stereo balance preserved');if(b*128/rate>8&&b*128/rate<8.8)ok(a[0][i]===0,'silence stays silent');}if(b===Math.floor(rate*.5/128))quietStart=Math.max(...a[0].map(Math.abs));if(b===Math.floor(rate*4.8/128))quietEnd=Math.max(...a[0].map(Math.abs));}
 ok(peak<=10**(-1/20)+1e-6,'ceiling for loud transitions');ok(quietEnd>quietStart*1.5,'quiet audio raised');
 // Consecutive impulses and invalid input cannot escape the ceiling.
 const pulse=new Engine(rate);for(let b=0;b<100;b++){const l=Float32Array.from({length:128},(_,i)=>i%23===0?100:i%7===0?NaN:0),out=[new Float32Array(128),new Float32Array(128)];pulse.process([l],out);ok(out.every(ch=>ch.every(v=>Number.isFinite(v)&&Math.abs(v)<=.891252)),'impulse bounded');}
}
console.log('PASS automatic levels: three sample rates, quiet audio, overload transitions, stereo balance, silence and impulses.');
