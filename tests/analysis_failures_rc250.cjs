const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
function fn(name){const m=new RegExp('  (?:async )?function '+name+'\\(').exec(html);assert(m,name);return html.slice(m.index,html.indexOf('\n  }',m.index)+4);}
const messages=[],cache=new Map();let writes=0,requests=0,response;
const c={console,Error,String,Array,Math,Date,Number,JSON,songSession:1,songLoadRequest:1,RUNPOD_ENDPOINT:'test',
 activeAudioFile:{},cloudFileSignature:()=> 'song',assertSongSession:()=>{},aiStatus:()=>{},
 savePendingRunPodJob:()=>writes++,toolsMessage:m=>messages.push(m),
 recoveryStore:async(store,op)=>op({get:id=>cache.get(id),put:r=>cache.set(r.id,r)}),
 runPodFetch:async()=>{requests++;return response;},
 renderTimelinePartTabs:()=>{},clamp:x=>x,restoreAnalysisSnapshot:s=>{c.notes=s.notes;c.detectedChordChanges=s.chords;},
 currentTime:()=>0,updateAudioParams:()=>{},refreshEditedAnalysis:()=>{},window:{BassPiano:{exportData:()=>({notes:[]})}}
};
vm.createContext(c);for(const n of ['analysisFailureDetail','validateAnalysisPartResult','collectPendingAnalysisParts','restoreDeviceAnalysis'])vm.runInContext(fn(n),c);
(async()=>{
 let part={id:'one',label:'P1',index:0},pending={signature:'song',parts:[part]};
 response={status:'FAILED',error:'CUDA out of memory'};
 await assert.rejects(c.collectPendingAnalysisParts(pending,'key'),/CUDA out of memory/);
 assert.equal(part.failedStatus,'FAILED');assert.equal(part.failureMessage,'CUDA out of memory');assert(!cache.has('one'));
 part={id:'two',label:'P2',index:0};pending.parts=[part];
 cache.set('two',{signature:'song',data:{status:'COMPLETED',output:{ok:false,error:'Model unavailable'}}});
 const before=requests;await assert.rejects(c.collectPendingAnalysisParts(pending,'key'),/Model unavailable/);
 assert.equal(requests,before);assert.equal(part.failedStatus,'INVALID_RESULT');
 cache.set('two',{signature:'song',data:{status:'COMPLETED',output:{ok:true,notes:[]}}});
 assert.equal((await c.collectPendingAnalysisParts(pending,'key')).length,1,'silent individual part remains valid');
 assert(!c.analysisFailureDetail({error:'Bearer secret123 rpa_123456 https://private.example/token'}).includes('secret123'));
 cache.set('song',{state:{notes:[],chords:[]},parts:[]});
 assert.equal(await c.restoreDeviceAnalysis(),false);assert.equal(messages.at(-1),'Audio restored. Analysis is unfinished.');
 cache.set('song',{state:{notes:[{midi:40}],chords:[]},parts:[]});
 assert.equal(await c.restoreDeviceAnalysis(),true);assert.equal(messages.at(-1),'Saved analysis restored.');
 assert(writes>=2);
 console.log('PASS worker error preserved, bad cached output recoverable, silent part accepted, secrets redacted, empty recovery truthful');
})().catch(e=>{console.error(e);process.exitCode=1});
