const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');
for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
function fn(name){const start=html.indexOf('  async function '+name+'(');const end=html.indexOf('\n  }',start)+4;return html.slice(start,end);}
(async()=>{
let downloaded,release;const ranges={Verse:{start:0,end:10}};
const c={console,Blob,Uint8Array,Number,String,Math,Date,JSON,Map,Set,setTimeout:()=>{},
 songImportBusy:false,aiBusy:false,projectSaveBusy:false,buffer:{duration:10,sampleRate:8000,numberOfChannels:1},activeAudioFile:{name:'song.wav',size:1,type:'audio/wav',arrayBuffer:async()=>new ArrayBuffer(1)},offlineAnalysisReady:true,notes:[{midi:36,start:0,end:1}],loadedProjectName:'song',objectName:'song',songSession:1,
 window:{prompt:()=> 'song'},saveProjectBtn:{},structureBusy:true,structurePromise:new Promise(r=>release=r),songStructure:null,aiStatus:()=>{},arrayBufferToBase64:()=> 'AA==',safeProjectFilename:x=>x,midiName:()=> 'C2',scaleDegreeLabel:()=> '1',transposeSemitones:0,PROJECT_SCHEMA_VERSION:2,APP_VERSION:'RC164',copyAnalysis:x=>JSON.parse(JSON.stringify(x)),analysisHistory:[],manualCorrections:[],keyCorrections:[],audioKeySections:[],audioKeyReady:false,detectedBaseScale:null,detectedScaleContext:null,songScale:{textContent:'C Maj'},currentTempoBpm:()=>120,noteDisplayMode:'notes',numberingConvention:'key',analysisParts:[],bassStemReady:false,noBassReady:false,currentRehearsalVersion:null,detectedBeatTimes:[],detectedBeatsPerBar:4,detectedDownbeatPhase:0,beatGridConfidence:0,detectedChordChanges:[],origVol:{value:70},bassVol:{value:70},metronomeVol:{value:70},tempo:{value:100},TIMELINE_CELL_SECONDS:1,practiceVisualMode:'timeline',bassViewStringCount:5,bassPracticeMuted:false,metronomeEnabled:false,sections:ranges,repeatRangeOverrides:new Map([['Verse',{start:2,end:8}]]),selectedSections:new Set(['Verse']),selectedSection:'Verse',URL:{createObjectURL:b=>(downloaded=b,'blob:test'),revokeObjectURL:()=>{}},document:{createElement:()=>({click(){},remove(){}}),body:{appendChild(){}}},updateProjectButtons:()=>{}};
vm.createContext(c);vm.runInContext(fn('saveBassStudioProject'),c);
const pending=c.saveBassStudioProject();await Promise.resolve();assert.equal(downloaded,undefined,'must wait for detection');
c.songStructure={segments:[{name:'Verse',start:0,end:10}]};release(true);await pending;
const saved=JSON.parse(await downloaded.text());assert.deepEqual(saved.analysis.structure,c.songStructure);assert.deepEqual(saved.settings.sections,ranges);assert.deepEqual(saved.settings.repeatRanges,{Verse:{start:2,end:8}});assert.deepEqual(saved.settings.selectedSections,['Verse']);assert.equal(c.projectSaveBusy,false);

const lyricFixture=[{text:'Sing',start:1,end:2,chord:'C'}];c.window.BassLyrics={exportData:()=>lyricFixture};c.notes=[];c.offlineAnalysisReady=false;c.structureBusy=false;downloaded=null;
await c.saveBassStudioProject();const lyricProject=JSON.parse(await downloaded.text());assert.deepEqual(lyricProject.analysis.lyrics,lyricFixture);assert.deepEqual(lyricProject.analysis.notes,[]);
c.window.BassLyrics={exportData:()=>[]};downloaded=null;
await c.saveBassStudioProject();const sectionProject=JSON.parse(await downloaded.text());assert.deepEqual(sectionProject.analysis.structure,c.songStructure);assert.equal(sectionProject.analysis.notes.length,0);
let picks=[],audio=0,project=0,fallback=0;
Object.assign(c,{fileInput:{click(){fallback++}},projectFileInput:{click(){fallback++}},loadAudioFile:async()=>audio++,importBassStudioProject:async()=>project++});
c.window.BassMedia={picker:[{description:'Audio and video',accept:{'audio/*':['.mp3','.m4a','.caf'],'video/*':['.mov','.mp4']}}]};
c.window.showOpenFilePicker=async options=>{picks.push(options);return[{getFile:async()=>({})}]};vm.runInContext(fn('chooseImportFile'),c);
await c.chooseImportFile('audio');await c.chooseImportFile('project');await c.chooseImportFile('audio');
assert.equal(picks[0].id,picks[2].id);assert.notEqual(picks[0].id,picks[1].id);assert.equal(audio,2);assert.equal(project,1);
c.window.showOpenFilePicker=async()=>{throw Object.assign(new Error(),{name:'AbortError'})};await c.chooseImportFile('audio');assert.equal(fallback,0);
delete c.window.showOpenFilePicker;await c.chooseImportFile('project');assert.equal(fallback,1);
console.log('PASS: script syntax; actual save waits for pending sections; saved section metadata, ranges, repeat adjustments, selection and lyrics-only projects; independent picker IDs, routing, cancellation and fallback.');
})();
