const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const env={window:{},document:{getElementById:()=>null}};vm.createContext(env);
vm.runInContext(fs.readFileSync('ear-source/core-rc261.js','utf8'),env);
vm.runInContext(fs.readFileSync('ear-source/trainer-rc265.js','utf8'),env);
const C=env.window.BassEarTrainingCore,range=env.window.BassEarTrainer.keyboardRange;
assert.deepEqual(Array.from(range(null,'piano')),[60,61,62,63,64,65,66,67,68,69,70,71]);
assert.equal(range(null,'bass')[0],36);
let cases=0;
for(const mode of ['notes','intervals','chords','progressions'])for(const sound of ['piano','bass'])for(let level=1;level<=5;level++)for(let i=0;i<100;i++){
 const q=C.make(mode,level,{sound}),keys=Array.from(range(q,sound));
 assert.equal(keys[0]%12,0);assert.equal(keys.at(-1)%12,11);assert.equal(keys.length%12,0);
 assert(keys.every((n,i)=>Number.isInteger(n)&&(!i||n===keys[i-1]+1)));
 assert([...q.events,...(q.reference||[])].every(n=>keys.includes(n.midi)),'every sounded pitch has an actual key');
 if(mode==='notes')assert.equal(keys.length,12,'preserve the original answer keyboard');
 assert(keys.length<=60);cases++;
}
const compound=range({events:[{midi:72},{midi:96}]});assert.equal(compound.length,36);assert(compound.includes(96),'compound intervals cannot lose the upper note');
const ui=fs.readFileSync('ear-source/study-ui-rc265.js','utf8');assert(!/fillTip|fillModeGuide|fillResources|Online lessons/.test(ui));
const trainer=fs.readFileSync('ear-source/trainer-rc265.js','utf8');assert(trainer.includes('lightEvents(question.events)'));assert(trainer.includes('lightEvents(question.reference)'));
const css=fs.readFileSync('ear-source/trainer-rc265.css','utf8');assert(css.includes('button:active{background:#248bd1'));assert(css.includes('width:var(--ear-white-width'));assert(css.includes('overflow-x:auto'));
console.log(`PASS ${cases} keyboards across all four lessons and five levels; all playback/reference notes covered; blue press styles; descriptions and lesson links removed.`);
