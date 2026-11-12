const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const src=html.slice(html.indexOf('  function loadExternalScript('),html.indexOf('  function chooseAnalysisMp3Bitrate('));
function setup(){
  const scripts=[],timers=new Map();let id=0;
  const ctx={window:{},lameEncoderLoadPromise:null,setTimeout:(fn,ms)=>{assert.equal(ms,30000);timers.set(++id,fn);return id},clearTimeout:key=>timers.delete(key),document:{createElement:()=>({remove(){this.removed=true}}),head:{appendChild:s=>scripts.push(s)}}};
  vm.createContext(ctx);vm.runInContext(src,ctx);return {ctx,scripts,timers};
}
(async()=>{
  let t=setup(),p=t.ctx.ensureLargeSongEncoder();
  const rejected=assert.rejects(p,/timed out/);
  t.timers.values().next().value();await rejected;
  assert.equal(t.scripts[0].removed,true);assert.equal(t.timers.size,0);
  assert.equal(t.ctx.lameEncoderLoadPromise,null);
  p=t.ctx.ensureLargeSongEncoder();assert.equal(t.scripts.length,2);
  t.ctx.window.lamejs={Mp3Encoder:function(){}};t.scripts[1].onload();
  assert.equal(await p,t.ctx.window.lamejs);assert.equal(t.timers.size,0);
  t=setup();p=t.ctx.ensureLargeSongEncoder();const failed=assert.rejects(p,/Could not load/);t.scripts[0].onerror();await failed;
  assert.equal(t.timers.size,0);assert.equal(t.ctx.lameEncoderLoadPromise,null);
  t=setup();p=t.ctx.ensureLargeSongEncoder();const malformed=assert.rejects(p,/Could not prepare/);t.scripts[0].onload();await malformed;
  assert.equal(t.ctx.lameEncoderLoadPromise,null);
  console.log('PASS encoder loading: stalled connection, cleanup, retry, success, network error and invalid script');
})().catch(e=>{console.error(e);process.exitCode=1});
