const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const env={window:{},document:{getElementById:()=>null}};vm.createContext(env);
vm.runInContext(fs.readFileSync('ear-source/bass-register-rc292.js','utf8'),env);
vm.runInContext(fs.readFileSync('ear-source/core-rc261.js','utf8'),env);
vm.runInContext(fs.readFileSync('ear-source/trainer-rc266.js','utf8'),env);
const C=env.window.BassEarTrainingCore,range=env.window.BassEarTrainer.keyboardRange;
assert.deepEqual(Array.from(range(null,'piano')),[60,61,62,63,64,65,66,67,68,69,70,71]);
assert.equal(range(null,'bass')[0],36);
let cases=0;
for(const mode of ['notes','intervals','chords','progressions'])for(const sound of ['piano','bass'])for(let level=1;level<=5;level++)for(let i=0;i<100;i++){
 const q=C.make(mode,level,{sound}),keys=Array.from(range(q,sound));
 assert(keys[0]%12===0||(sound==='bass'&&keys[0]===23));assert.equal(keys.at(-1)%12,11);assert(keys.length%12===0||(sound==='bass'&&keys[0]===23));
 assert(keys.every((n,i)=>Number.isInteger(n)&&(!i||n===keys[i-1]+1)));
 assert([...q.events,...(q.reference||[])].every(n=>keys.includes(n.midi)),'every sounded pitch has an actual key');
 if(mode==='notes')assert.equal(keys.length,12,'preserve the original answer keyboard');
 assert(keys.length<=60);cases++;
}
const compound=range({events:[{midi:72},{midi:96}]});assert.equal(compound.length,36);assert(compound.includes(96),'compound intervals cannot lose the upper note');
const ui=fs.readFileSync('ear-source/study-ui-rc267.js','utf8');assert(!/fillTip|fillModeGuide|fillResources|Online lessons/.test(ui));
const trainer=fs.readFileSync('ear-source/trainer-rc266.js','utf8');assert(trainer.includes('if(answerVisible())lightEvents(question.events)'));assert(trainer.includes('if(answerVisible())lightEvents(question.reference)'));assert(!trainer.includes('earSectionRhythm'));assert(!trainer.includes('data-playback="questions"'));assert(!ui.includes('fillMode'));
const css=fs.readFileSync('ear-source/trainer-rc267.css','utf8');assert(css.includes('button:active{background:#248bd1'));assert(css.includes('width:var(--ear-white-width'));assert(css.includes('overflow-x:auto'));
console.log(`PASS ${cases} keyboards across all four lessons and five levels; all playback/reference notes covered; blue press styles; descriptions and lesson links removed.`);

const app=fs.readFileSync('index.html','utf8');
const earSetup=app.match(/^  window\.BassEarTrainer\.init\(\{[\s\S]+?^  \}\);/m)?.[0];
assert(earSetup,'Ear Training is wired into the main app');
const mic={disabled:true},pianoMic={disabled:true};
let hooks;
vm.runInNewContext(earSetup,{
 window:{BassEarTrainer:{init:value=>{hooks=value;}},BassPiano:{isBusy:()=>true}},
 aiBusy:true,songImportBusy:true,$:id=>({liveStop:mic,pianoLiveStop:pianoMic})[id]
});
assert.equal(hooks.busy(),false,'background song and piano work must not block Ear Training');
assert.equal(hooks.songBusy(),true,'switching songs still waits for the current song work');
mic.disabled=false;
assert.equal(hooks.busy(),true,'keep the live audio recording guard');
mic.disabled=true;
pianoMic.disabled=false;
assert.equal(hooks.busy(),true,'keep the live piano recording guard');
console.log('PASS Ear Training stays available during background song preparation.');
