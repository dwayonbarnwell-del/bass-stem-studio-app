const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const source=html.slice(html.indexOf("  const LAST_OPENED_SESSION="),html.indexOf('  function selectedAnalysisRange()'));
function setup(preferred,rows){
 const saved=new Map(),loaded=[];if(preferred)saved.set('bassStemLastOpenedSessionRC254',JSON.stringify({signature:preferred}));
 const ctx={songImportBusy:false,buffer:null,activeAudioFile:null,pendingResumeBusy:false,songLoadRequest:4,songSession:7,RUNPOD_RECOVERY_STORE:'audio',localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},File:class{constructor(parts,name,options){Object.assign(this,options);this.name=name}},cloudFileSignature:f=>f.signature,recoveryStore:async()=>rows,loadAudioFile:async(f,options)=>{loaded.push({f,options});return true}};
 vm.createContext(ctx);vm.runInContext(source,ctx);return {ctx,loaded,saved};
}
const rows=[{signature:'old-pending',name:'Old.mp3',blob:{},cachedAt:500},{signature:'last-opened',name:'Last.mp3',blob:{},cachedAt:100}];
(async()=>{
 let t=setup('last-opened',rows);assert.equal(await t.ctx.restoreLatestSession(),true);assert.equal(t.loaded[0].f.name,'Last.mp3');assert.equal(t.loaded[0].options.recoveryRestore,true);assert.equal(t.ctx.pendingResumeBusy,false);
 t=setup(null,rows);await t.ctx.restoreLatestSession();assert.equal(t.loaded[0].f.name,'Old.mp3'); // Upgrade fallback, no marker yet.
 t=setup('missing',rows);assert.equal(await t.ctx.restoreLatestSession(),false);assert.equal(t.loaded.length,0); // Never silently switch to an unrelated song.
 t=setup('last-opened',rows);t.ctx.recoveryStore=async()=>{t.ctx.songLoadRequest++;return rows};assert.equal(await t.ctx.restoreLatestSession(),false);assert.equal(t.loaded.length,0);
 for(const key of ['songImportBusy','buffer','activeAudioFile','pendingResumeBusy']){t=setup('last-opened',rows);t.ctx[key]=true;assert.equal(await t.ctx.restoreLatestSession(),false);assert.equal(t.loaded.length,0)}
 t=setup(null,[]);t.ctx.activeAudioFile={name:'New.wav',signature:'new'};t.ctx.buffer={};t.ctx.rememberLastOpenedSession();assert.equal(JSON.parse(t.saved.get('bassStemLastOpenedSessionRC254')).signature,'new');
 const resume=html.slice(html.indexOf('  async function resumeSavedRunPodAnalysis()'),html.indexOf('  function checkSavedAnalysisSoon'));
 const ctx={pendingResumeBusy:false,aiBusy:false,songImportBusy:false,analysisStartPending:false,activeAudioFile:null,readPendingRunPodJob:()=>({signature:'old',parts:[{id:'job'}]}),readLastOpenedSession:()=>({signature:'new'}),storedRunPodKey:()=>{throw Error('An unrelated job must not resume')}};
 vm.createContext(ctx);vm.runInContext(resume,ctx);assert.equal(await ctx.resumeSavedRunPodAnalysis(),false);
 console.log('PASS RC254: last song wins over pending jobs, raw audio restoration, migration fallback, stale imports and missing-audio protection.');
})().catch(e=>{console.error(e);process.exitCode=1});
