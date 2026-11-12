const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8'),start=html.indexOf('  async function importAudioCheckingLibrary('),end=html.indexOf('\n  }',start)+4;
let choice='opened',queued=0,loads=0;
const c={offlineAnalysisReady:false,notes:[],aiStatus:()=>{},queueAutomaticAudioAnalysis:()=>queued++,loadAudioFile:async()=>{loads++;return true;},window:{BassLibrary:{checkAudioImport:async()=>choice}}};
vm.createContext(c);vm.runInContext(html.slice(start,end),c);
(async()=>{
 assert(await c.importAudioCheckingLibrary({name:'Miracles.mp3'}));assert.equal(queued,1,'saved draft resumes through the protected automatic runner');assert.equal(loads,0,'saved content is retained');
 c.notes=[{midi:40}];await c.importAudioCheckingLibrary({});assert.equal(queued,1,'existing notes are reused');
 c.notes=[];c.offlineAnalysisReady=true;await c.importAudioCheckingLibrary({});assert.equal(queued,1,'completed analysis is not charged again');
 choice='audio';await c.importAudioCheckingLibrary({});assert.equal(loads,1);
 choice='cancel';assert.equal(await c.importAudioCheckingLibrary({}),false);assert.equal(queued,1);
 console.log('PASS empty library draft resumes, finished results reused, fresh audio loads, cancellation respected');
})().catch(e=>{console.error(e);process.exitCode=1});
