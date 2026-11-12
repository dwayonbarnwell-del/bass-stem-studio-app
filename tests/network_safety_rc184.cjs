const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');
function fn(name){const m=new RegExp('  (?:async )?function '+name+'\\(').exec(html);assert(m,name);return html.slice(m.index,html.indexOf('\n  }',m.index)+4);}
const store=new Map(),c={console,AbortController,JSON,Date,Error,songSession:1,assertSongSession:()=>{},aiStatus:()=>{},cloudSleep:async()=>{},setTimeout:()=>1,clearTimeout:()=>{},RUNPOD_PENDING_JOB:'pending',RUNPOD_ENDPOINT:'test',localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},cacheAudioForRecovery:async()=>{},prepareAnalysisPartUpload:async()=>({file:{name:'test.wav'},bitrate:192}),fileToBase64:async()=> 'fake'};
vm.createContext(c);for(const n of ['analysisFailureDetail','validateAnalysisPartResult','runPodFetch','savePendingRunPodJob','submitPendingAnalysisParts'])vm.runInContext(fn(n),c);
(async()=>{
 let calls=0;c.fetch=async()=>{calls++;throw Error('Failed to fetch')};
 await assert.rejects(c.runPodFetch('https://test/run','key',{method:'POST'},8));assert.equal(calls,1,'POST retried');
 calls=0;await assert.rejects(c.runPodFetch('https://test/status/a','key',{method:'GET'},3));assert.equal(calls,3,'GET did not retry');
 calls=0;const p={parts:[{label:'P1'}]};await assert.rejects(c.submitPendingAnalysisParts(p,'key',{},1));assert.equal(calls,1);assert(JSON.parse(store.get('pending')).parts[0].submitting);
 await assert.rejects(c.submitPendingAnalysisParts(JSON.parse(store.get('pending')),'key',{},1),/no confirmed reply/);assert.equal(calls,1,'reload duplicated paid submission');
 c.fetch=async()=>({ok:false,status:401,text:async()=>JSON.stringify({secret:'must not show'})});const rejected={parts:[{label:'P1'}]};await assert.rejects(c.submitPendingAnalysisParts(rejected,'key',{},1),e=>e.httpStatus===401&&!e.message.includes('secret'));assert(!rejected.parts[0].submitting);
 c.fetch=async()=>({ok:true,text:async()=>'<html>bad gateway</html>'});await assert.rejects(c.runPodFetch('https://test/run','key',{method:'POST'}),/unreadable reply/);
 const old=c.localStorage.setItem;c.localStorage.setItem=()=>{throw Error('quota')};calls=0;c.fetch=async()=>{calls++;return {ok:true,text:async()=>'{"id":"j","status":"IN_QUEUE"}'}};
 await assert.rejects(c.submitPendingAnalysisParts({parts:[{label:'P1'}]},'key',{},1),/No new analysis was sent/);assert.equal(calls,0);c.localStorage.setItem=old;
 const good={parts:[{label:'P1'}]};await c.submitPendingAnalysisParts(good,'key',{},1);assert.equal(good.parts[0].id,'j');assert(!good.parts[0].submitting);
 c.fetch=async()=>({ok:true,text:async()=>'{"id":"failed-job","status":"FAILED"}'});const failed={parts:[{label:'P1'}]};await assert.rejects(c.submitPendingAnalysisParts(failed,'key',{},1),/review and retry/);assert.equal(failed.parts[0].failedStatus,'FAILED');
 c.fetch=async()=>{throw Error('Should not retry failed job automatically')};await assert.rejects(c.submitPendingAnalysisParts(failed,'key',{},1),/review and retry/);
 Object.assign(c,{aiBusy:false,songImportBusy:false,buffer:{duration:8},offlineAnalysisReady:true,activeAudioFile:{},selectedAnalysisRange:()=>({start:1,end:3}),cloudFileSignature:()=> 'sig',readPendingRunPodJob:()=>null,getRunPodKey:()=> 'fake',persistAnalysisRecovery:async()=>new Promise(r=>setTimeout(r,5)),makePendingPartGroup:()=>({parts:[]}),ANALYSIS_PART_SECONDS:30,aiAnalyse:{disabled:false},collectPendingAnalysisParts:async()=>[],applySectionAnalysis:async()=>{},clearPendingRunPodJob:()=>{},toolsMessage:()=>{},updatePracticeLayoutState:()=>{}});
 let submissions=0;c.submitPendingAnalysisParts=async()=>{submissions++};vm.runInContext(fn('analyseSelectedRange'),c);await Promise.all([c.analyseSelectedRange(),c.analyseSelectedRange()]);assert.equal(submissions,1,'rapid selected-range clicks duplicated jobs');
 c.setTimeout=f=>{queueMicrotask(f);return 2};c.fetch=async(u,o)=>new Promise((resolve,reject)=>o.signal.addEventListener('abort',()=>reject(Error('aborted'))));
 await assert.rejects(c.runPodFetch('https://test/status/j','key',{method:'GET'},1),/timed out/);
 console.log('PASS: POST single attempt, GET retry, lost-reply/reload duplicate guard, 401 safe retry, sanitised errors, malformed response, storage quota blocks submission, job ID persistence, bounded request timeout.');
})().catch(e=>{console.error(e);process.exitCode=1});
