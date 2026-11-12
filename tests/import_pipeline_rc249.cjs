const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {File}=require('node:buffer');
const html=fs.readFileSync('index.html','utf8');
function fn(name){const m=new RegExp('  (?:async )?function '+name+'\\(').exec(html);assert(m,name);return html.slice(m.index,html.indexOf('\n  }',m.index)+4)}
function pipeline(){
 const storage=new Map(),results=new Map(),events=[],held=[];let pending=null;
 const file={name:'new.mp3',size:100,lastModified:1};
 const c={RUNPOD_ENDPOINT:"test-endpoint",console:{error(){}},Date,Error,JSON,Math,File,Blob,songSession:1,buffer:{duration:360},activeAudioFile:file,fileInput:{},aiBusy:false,songImportBusy:false,offlineAnalysisReady:false,notes:[],songStructure:null,savedSectionRanges:null,
  assertSongSession:s=>assert.equal(s,1),cloudFileSignature:f=>f.name,storedRunPodKey:()=> 'test',getRunPodKey:async()=> 'test',cloudSleep:async()=>{},aiAnalyse:{setAttribute(){},removeAttribute(){}},aiStatus:()=>{},updatePracticeLayoutState:()=>{},queueAutomaticMelody:()=>events.push('melody queued'),window:{BassBatch:{isRunning:()=>false}},
  readPendingRunPodJob:()=>pending,savePendingRunPodJob:p=>pending=p,clearPendingRunPodJob:()=>pending=null,
  holdBatchPendingJob:()=>{held.push(pending);pending=null},activateBatchHeldJob:s=>{pending=held.find(x=>x.signature===s)||null},removeBatchHeldJob:s=>{const i=held.findIndex(x=>x.signature===s);if(i>=0)held.splice(i,1)},
  makePendingPartGroup:()=>({signature:file.name,quality:'accuracy',parts:[{index:0,label:'P1'},{index:1,label:'P2'}]}),cacheAudioForRecovery:async()=>{},prepareAnalysisPartUpload:async(f,p)=>({file:{name:p.label},bitrate:256}),fileToBase64:async f=>f.name,
  recoveryStore:async(_,op)=>op({get:id=>results.get(id),put:r=>results.set(r.id,r)}),toolsMessage:()=>{},persistAnalysisRecovery:async()=>{},forgetRunPodKey:()=>{},
  runPodFetch:async(url,key,opt)=>{if(opt.method==='POST'){const p=JSON.parse(opt.body).input;events.push('POST '+p.filename);return {id:p.filename,status:'IN_QUEUE'}}const id=url.split('/').pop();events.push('GET '+id);return {id,status:'COMPLETED',output:{ok:true,notes:[{midi:36,start:0,end:1}],chords:[{root_pc:0,quality:'maj',start:0,end:1}]}}},
  applySegmentedRunPodResults:async(p,rows)=>{assert.equal(rows.length,2);assert(rows.every(x=>x.output.notes.length&&x.output.chords.length));c.offlineAnalysisReady=true;return {count:2,partCount:2,bassStemReady:true}}
 };
 vm.createContext(c);for(const n of ['analysisFailureDetail','validateAnalysisPartResult','selectSongAnalysisJob','submitPendingAnalysisParts','collectPendingAnalysisParts','analyseBassWithAI'])vm.runInContext(fn(n),c);
 return {c,events,results,held,set pending(v){pending=v},get pending(){return pending}};
}
(async()=>{
 let t=pipeline();t.pending={signature:'older.mp3',parts:[{id:'old',submitting:false}]};
 let r=await t.c.analyseBassWithAI();assert.equal(r.count,2);assert.deepEqual(t.events,['POST P1','GET P1','POST P2','GET P2','melody queued']);assert.equal(t.held[0].parts[0].id,'old');assert.equal(t.results.size,2);assert.equal(t.pending,null);
 console.log('PASS: old job preserved, new MP3 processed, each part collected before next upload, melody queued');
 t=pipeline();t.held.push({signature:'new.mp3',parts:[{index:0,label:'P1',id:'P1'},{index:1,label:'P2',id:'P2'}]});await t.c.analyseBassWithAI();assert(!t.events.some(x=>x.startsWith('POST')));assert.equal(t.held.length,0);
 console.log('PASS: reopening interrupted song collects original IDs without duplicate paid jobs');
 t=pipeline();t.c.runPodFetch=async()=>{throw Error('connection lost')};r=await t.c.analyseBassWithAI();assert.equal(r,null);assert(t.pending.parts[0].submitting);assert.equal(t.c.aiBusy,false);assert(!t.events.includes('melody queued'));
 console.log('PASS: lost upload reply remains protected and UI unlocks');
 const e=[],c={songSession:1,songStructure:null,structureError:'',window:{BassPiano:{unfinished:()=>true,analyse:async()=>e.push('melody')}},storedRunPodKey:()=> 'test',assertSongSession:()=>{},saveMelodyRecovery:async()=>e.push('melody stored'),persistAnalysisRecovery:async()=>e.push('bass stored'),ensureSongStructure:async()=>{e.push('sections failed');throw Error('sections unavailable')}};
 vm.createContext(c);vm.runInContext(fn('completeBatchSong'),c);assert(await c.completeBatchSong({allowNewSections:true}));assert.deepEqual(e,['melody','melody stored','sections failed','bass stored']);
 console.log('PASS: ZIP runs melody and retains musical results when sections fail');
 // Load the actual distributed encoder, not a stub. A useful MP3 must contain bytes.
 const enc={};vm.createContext(enc);vm.runInContext(fs.readFileSync('vendor/lamejs/lame.min.js','utf8'),enc);const mp3=new enc.lamejs.Mp3Encoder(1,44100,192),pcm=new Int16Array(44100),chunks=[];for(let i=0;i<pcm.length;i++)pcm[i]=Math.round(5000*Math.sin(i*2*Math.PI*110/44100));for(let i=0;i<pcm.length;i+=1152)chunks.push(Buffer.from(mp3.encodeBuffer(pcm.subarray(i,i+1152))));chunks.push(Buffer.from(mp3.flush()));const bytes=Buffer.concat(chunks);assert(bytes.length>20000);fs.writeFileSync('/tmp/rc249-encoder-check.mp3',bytes);
 console.log('PASS: bundled encoder processes actual PCM to MP3');
})().catch(e=>{console.error(e);process.exitCode=1});
