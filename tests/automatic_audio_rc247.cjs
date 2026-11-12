const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const src=html.slice(html.indexOf('  let automaticAudioTimer'),html.indexOf('  let automaticMelodyTimer'));
function setup(){
 let timers=new Map(),id=0,runs=0,melodies=0,pending=null,fail=false;
 const ctx={songSession:1,buffer:{},activeAudioFile:{},automaticMelodyTimer:0,songImportBusy:false,aiBusy:false,structureBusy:false,projectSaveBusy:false,pendingResumeBusy:false,analysisStartPending:false,offlineAnalysisReady:false,notes:[],storedRunPodKey:()=> 'key',cloudFileSignature:()=> 'song',readPendingRunPodJob:()=>pending,selectSongAnalysisJob:()=>{if(pending?.signature==='other')pending=null;return pending},aiStatus:()=>{},setTimeout:fn=>{timers.set(++id,fn);return id},clearTimeout:i=>timers.delete(i),queueAutomaticMelody:()=>melodies++,analyseBassWithAI:async()=>{runs++;assert.equal(ctx.analysisStartPending,true);if(fail)return null;ctx.offlineAnalysisReady=true;return {count:1}},window:{BassBatch:{isRunning:()=>false},BassPiano:{isBusy:()=>false}}};
 vm.createContext(ctx);vm.runInContext(src,ctx);
 return {ctx,timers,get runs(){return runs},get melodies(){return melodies},set pending(v){pending=v},set fail(v){fail=v},tick:async()=>{const [k,f]=timers.entries().next().value;timers.delete(k);await f()}};
}
(async()=>{
 let t=setup();t.ctx.queueAutomaticAudioAnalysis();await t.tick();assert.equal(t.runs,1);assert.equal(t.melodies,1);assert.equal(t.ctx.analysisStartPending,false);
 for(const field of ['offlineAnalysisReady','notes']){t=setup();t.ctx[field]=field==='notes'?[{}]:true;t.ctx.queueAutomaticAudioAnalysis();await t.tick();assert.equal(t.runs,0);assert.equal(t.melodies,1)}
 for(const flag of ['songImportBusy','aiBusy','structureBusy','projectSaveBusy','pendingResumeBusy','analysisStartPending']){t=setup();t.ctx[flag]=true;t.ctx.queueAutomaticAudioAnalysis();await t.tick();assert.equal(t.runs,0);t.ctx[flag]=false;await t.tick();assert.equal(t.runs,1)}
 for(const pending of [{signature:'song',parts:[{failedStatus:'FAILED'}]},{signature:'song',parts:[{submitting:true}]}]){t=setup();t.pending=pending;t.ctx.queueAutomaticAudioAnalysis();await t.tick();assert.equal(t.runs,0);assert.equal(t.melodies,0)}
 t=setup();t.pending={signature:'other'};t.ctx.queueAutomaticAudioAnalysis();await t.tick();assert.equal(t.runs,1);
 t=setup();t.pending={signature:'song',parts:[{id:'existing'}]};t.ctx.queueAutomaticAudioAnalysis();await t.tick();assert.equal(t.runs,1);
 t=setup();t.ctx.queueAutomaticAudioAnalysis();t.ctx.songSession++;await t.tick();assert.equal(t.runs,0);
 t=setup();t.ctx.storedRunPodKey=()=>'';t.ctx.queueAutomaticAudioAnalysis();await t.tick();assert.equal(t.runs,0);
 t=setup();t.ctx.window.BassBatch.isRunning=()=>true;t.ctx.queueAutomaticAudioAnalysis();await t.tick();assert.equal(t.runs,0);assert.equal(t.timers.size,0);
 t=setup();t.fail=true;t.ctx.queueAutomaticAudioAnalysis();await t.tick();assert.equal(t.runs,1);assert.equal(t.melodies,0);assert.equal(t.timers.size,0);
 t=setup();t.ctx.queueAutomaticAudioAnalysis();t.ctx.queueAutomaticAudioAnalysis();assert.equal(t.timers.size,1);
 assert.match(html,/if\(importSucceeded&&!batchImport&&!recoveryRestore\)\{startImportedSongSections\(\{allowNewJob:false\}\);queueAutomaticAudioAnalysis\(\);\}/);
 console.log('PASS automatic audio: sequencing, saved reuse, locking, pending recovery, failure protection, batch exclusion and stale songs');
})().catch(e=>{console.error(e);process.exitCode=1});
