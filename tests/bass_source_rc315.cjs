const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const source=html.slice(html.indexOf('  function drawPlaybackFrame('),html.indexOf('  initAnalysisTools();\n  renderBassFretboard();'));
assert(!source.includes('updateDetectedNote('),'playing the original mix must never add bass events');
const start=html.indexOf('  let localBassSession=');
const end=html.indexOf('  let automaticMelodyTimer=',start);
const ctx=vm.createContext({
  window:{},songSession:1,aiBusy:false,offlineAnalysisReady:false,songImportBusy:false,notes:[],
  manualCorrections:[],buffer:{duration:10},ensureCtx(){},ctx:{},console,blob:new Blob(['isolated stem'])
});
vm.runInContext(html.slice(start,end),ctx);
const decoded={duration:10};let reads=0,checks=0;
ctx.ctx.decodeAudioData=async()=>{reads++;return decoded;};
ctx.window.BassNoteEvidence={supportsBass:(buffer,note)=>note.midi===28&&buffer===decoded};
ctx.estimateMissingBass=async (audio,session,eligible,filter)=>{
  checks++;
  assert.equal(audio,decoded);
  assert.notEqual(audio,ctx.buffer);
  assert.equal(session,ctx.songSession);
  assert(eligible());
  assert(filter({midi:28}));assert(!filter({midi:40}));
};
(async()=>{
  await ctx.checkSeparatedBass(null,1);
  await ctx.checkSeparatedBass(ctx.blob,0);
  ctx.notes=[{midi:28,source:'Cloud'}];
  await ctx.checkSeparatedBass(ctx.blob,1);
  ctx.notes=[{midi:28,source:'estimated-bass',manual:true}];
  await ctx.checkSeparatedBass(ctx.blob,1);
  ctx.notes=[];
  ctx.manualCorrections=[{kind:'note',value:null}];
  await ctx.checkSeparatedBass(ctx.blob,1);
  assert.equal(reads,0,'manual changes and trusted notes are left alone');
  ctx.manualCorrections=[];
  await Promise.all([ctx.checkSeparatedBass(ctx.blob,1),ctx.checkSeparatedBass(ctx.blob,1)]);
  assert.equal(reads,1);assert.equal(checks,1);
  ctx.ctx.decodeAudioData=async()=>{ctx.songSession++;return decoded;};
  await ctx.checkSeparatedBass(ctx.blob,1);
  assert.equal(checks,1,'a late decode must not change the new song');
  console.log('PASS separated audio, tone screening, duplicate prevention, edits and old-session protection.');
})().catch(e=>{console.error(e);process.exitCode=1;});
