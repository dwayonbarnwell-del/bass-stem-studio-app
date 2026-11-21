const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),buttons=[];
const host={replaceChildren(){buttons.length=0;},append(button){buttons.push(button);}};
const project=process.argv[2]?JSON.parse(fs.readFileSync(process.argv[2])):null;
const duration=project?.source.duration||180;
const chords=project?.analysis.chords||Array.from({length:180},(_,i)=>({rootPc:(i>>3)%3,start:i,end:i+1}));
const state={window:{},sections:{},songSession:1,buffer:{duration},detectedChordChanges:chords,
 detectedBeatTimes:project?.analysis.beatTimes||[],detectedBeatsPerBar:project?.analysis.beatsPerBar||4,
 detectedDownbeatPhase:project?.analysis.downbeatPhase||0,currentTempoBpm:()=>project?.analysis.tempoBpm||120,
 $:()=>host,document:{createElement:()=>({setAttribute(k,v){this[k]=v;}})},timeframeLoopMode:false,multiSectionMode:false,loopEnabled:false};
vm.createContext(state);vm.runInContext(fs.readFileSync('song-view/core.js','utf8'),state);
vm.runInContext(html.slice(html.indexOf('  var practiceEstimateCache;'),html.indexOf('  function renderSectionControls()')),state);
state.songViewRepeat=ranges=>{state.timeframeLoopMode=!!ranges.length;state.timeframeQueue=ranges;state.drawPracticeSections();};
state.drawPracticeSections();assert.equal(host.hidden,false);assert.equal(buttons[0].textContent,'Intro');
let verse=()=>buttons.find(b=>b.textContent==='Vr 1');assert(verse());assert(buttons.some(b=>b.textContent==='Ch 1'));assert(buttons.every(b=>!/^(P\d+)$/.test(b.textContent)));
verse().onclick();assert.equal(verse()['aria-pressed'],'true');verse().onclick();assert.equal(verse()['aria-pressed'],'false');
state.sections={'Verse 1':{start:0,end:22},'Bridge':{start:22,end:duration}};state.drawPracticeSections();
assert.deepEqual(buttons.map(b=>b.textContent),['Vr 1','Br.']);buttons[1].onclick();assert.equal(state.timeframeQueue[0].start,22);
console.log('PASS section row, offline legacy project, saved boundaries, repeat and deselect');
