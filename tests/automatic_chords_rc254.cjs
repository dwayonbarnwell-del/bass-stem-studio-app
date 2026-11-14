const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const file=fs.readFileSync('chord-source/recovery.js','utf8');
const src=file.slice(file.indexOf('let hooks='),file.indexOf("if(typeof window!=="));
function setup(){
 let id=0,scans=0,applied=0,onScan=null;const timers=new Map();
 const state={buffer:{duration:12},session:1,chords:[],busy:false};
 const ctx={console,setTimeout:f=>{timers.set(++id,f);return id},clearTimeout:k=>timers.delete(k),addOnlyMissing:()=>{},scan:async()=>{scans++;if(onScan)await onScan();return {added:[{start:0,end:3}]}}};
 vm.createContext(ctx);vm.runInContext(src+'\nglobalThis.api=api;',ctx);ctx.api.init({getContext:()=>({...state}),apply:async()=>applied++});
 return {state,ctx,timers,get scans(){return scans},get applied(){return applied},set onScan(f){onScan=f},tick:async()=>{const [k,f]=timers.entries().next().value;timers.delete(k);await f()}};
}
(async()=>{
 let t=setup();await t.tick();assert.equal(t.scans,1);assert.equal(t.applied,1);t.ctx.api.queue();assert.equal(t.timers.size,0);
 t=setup();t.state.busy=true;await t.tick();assert.equal(t.scans,0);t.state.busy=false;await t.tick();assert.equal(t.scans,1);
 t=setup();t.onScan=()=>{t.state.session=2;t.ctx.api.queue()};await t.tick();assert.equal(t.applied,0);t.onScan=null;await t.tick();assert.equal(t.applied,1);
 t=setup();t.onScan=()=>{t.state.busy=true};await t.tick();assert.equal(t.applied,0);t.state.busy=false;t.onScan=null;await t.tick();assert.equal(t.applied,1);
 const recovery=require('../chord-source/recovery.js'),manual={start:1,end:2,rootPc:5,quality:'maj',manual:true};
 const tentative={start:0,end:4,rootPc:0,quality:'maj',confidence:.8,source:'on-device-chord-recovery-v1'};
 const rebased=recovery.addOnlyMissing([tentative],[manual],4);assert.equal(rebased.old[0],manual);assert(rebased.added.every(c=>Number.isFinite(c.confidence)&& (c.end<=1||c.start>=2)));
 assert(!/document\.|fetch\s*\(|api\.runpod/.test(file));
 console.log('PASS RC254: automatic scan once per song, busy retries, song-switch cancellation, manual protection and no network or extra card.');
})().catch(e=>{console.error(e);process.exitCode=1});
