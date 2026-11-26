// A retired pitch worklet must return false without processing another block.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
let Processor, processed=0;
const script=fs.readFileSync('ear-source/pitch-worklet-rc361.js','utf8').replace(/^import .*?;\n/,'');
vm.runInNewContext(script,{
 AudioWorkletProcessor:class{constructor(){this.port={};}},
 PitchEngine:class{process(){processed++;}},
 sampleRate:48000,
 registerProcessor:(_,implementation)=>{Processor=implementation;}
});
for(let i=0;i<50;i++){
 const node=new Processor({parameterData:{semitones:2}});
 assert.equal(node.process([[]],[[]],{semitones:[2]}),true);
 node.port.onmessage({data:'stop'});
 assert.equal(node.process([[]],[[]],{semitones:[2]}),false);
}
assert.equal(processed,50);
