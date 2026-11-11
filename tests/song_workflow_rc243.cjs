const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const tick=()=>new Promise(r=>setImmediate(r));
async function navigation(){
 const win=new EventTarget();let pos=0,states=[{}];
 const history={get state(){return states[pos]},pushState(s){states=states.slice(0,pos+1);states.push(s);pos++},back(){if(pos){pos--;setImmediate(()=>win.dispatchEvent(new Event('popstate')));}}};
 class Dialog extends EventTarget{showModal(){this.open=true;}close(){if(!this.open)return;this.open=false;setImmediate(()=>this.dispatchEvent(new Event('close')));}}
 vm.runInNewContext(read('library-source/navigation.js'),{window:win,HTMLDialogElement:Dialog,history,queueMicrotask,Event});
 const parent=new Dialog(),child=new Dialog();parent.showModal();child.showModal();assert.equal(pos,1);
 history.back();await tick();assert.equal(child.open,false);assert.equal(parent.open,true);assert.equal(pos,1);
 let page='edit';parent.addEventListener('cancel',e=>{if(page!=='list'){e.preventDefault();page=page==='edit'?'overview':'list';}});
 history.back();await tick();assert.equal(page,'overview');assert(parent.open);
 history.back();await tick();assert.equal(page,'list');assert(parent.open);
 history.back();await tick();assert.equal(parent.open,false);assert.equal(pos,0);
 parent.showModal();parent.close();await tick();await tick();assert.equal(pos,0);
 parent.showModal();child.showModal();child.close();await tick();assert(parent.open);assert.equal(pos,1);parent.close();await tick();await tick();assert.equal(pos,0);
}
async function discovery(){
 let saved=[{title:'Way Maker',hasBassAnalysis:false,hasChordAnalysis:false},{title:'Saved song',hasBassAnalysis:true,hasChordAnalysis:true}];
 const window={BassLibrary:{analysisSummary:async()=>({songs:saved})},BassChordLibrary:{missingProgressions:async()=>[{id:1,title:'Unfinished chart'}],playlistSongs:async()=>[{title:'Unfinished chart'},{title:'Complete chart',aliases:['Alternative title']}]}};
 const context={window,document:{getElementById:()=>null,readyState:'loading',addEventListener(){}},localStorage:{getItem:()=>null},setTimeout,clearTimeout};
 vm.createContext(context);
 const code=read('library-source/song-tasks.js').replace('window.BassSongTasks={','window.__test={loadPending,activeSuggestions,titleKey,setSuggestions:v=>suggestions=v};window.BassSongTasks={');
 vm.runInContext(code,context);const t=window.__test;
 t.setSuggestions(['Way Maker (Live)','Saved song','Unfinished chart','Complete chart','Alternative title','New song'].map(title=>({title,artist:'Artist'})));
 assert.equal(t.activeSuggestions().length,0,'no stale suggestions before playlist check');await t.loadPending();assert.deepEqual(Array.from(t.activeSuggestions(),s=>s.title),['New song']);
 saved.push({title:'New song'});await t.loadPending();assert.equal(t.activeSuggestions().length,0,'newly imported songs excluded immediately');
}
async function analysis(){
 const html=read('index.html'),start=html.indexOf('  let taskAnalysisBusy=false;'),end=html.indexOf('  window.BassTaskAnalysis=',start);
 const source=html.slice(start,end)+'\nthis.run=analyseTaskSong;';
 function setup({complete=false,withBass=false,confirm=true,result={count:5}}={}){
  const calls=[];const c={songSession:1,aiBusy:false,songImportBusy:false,projectSaveBusy:false,pendingResumeBusy:false,analysisStartPending:false,offlineAnalysisReady:complete||withBass,notes:complete||withBass?[{}]:[],detectedChordChanges:complete?[{}]:[],
   BassDialog:{confirm:async()=>{calls.push('confirm');return confirm;}},reviewInterruptedUploads:async()=>{calls.push('review');return true;},analyseBassWithAI:async()=>{calls.push('analyse');return result;},captureStudyProject:async()=>({analysis:{}}),window:{BassLibrary:{saveMelodyProject:async()=>{calls.push('save');}}},aiStatus(){}};
  vm.createContext(c);vm.runInContext(source,c);return {c,calls};
 }
 let t=setup();assert(await t.c.run(async()=>true));assert.deepEqual(t.calls,['review','analyse','save']);
 t=setup({complete:true});assert(await t.c.run(async()=>true));assert.deepEqual(t.calls,['save']);
 t=setup({withBass:true,confirm:false});assert.equal(await t.c.run(async()=>true),false);assert.deepEqual(t.calls,['confirm']);
 t=setup({result:null});assert.equal(await t.c.run(async()=>true),false);assert.deepEqual(t.calls,['review','analyse']);
 t=setup();assert.equal(await t.c.run(async()=>false),false);assert.deepEqual(t.calls,[]);
 t=setup();let release;const first=t.c.run(()=>new Promise(r=>release=r));await assert.rejects(t.c.run(async()=>true),/Wait/);release(true);await first;assert.equal(t.calls.filter(c=>c==='analyse').length,1);
}
(async()=>{await navigation();await discovery();await analysis();console.log('PASS: nested dialogs, Back through editor/overview/list, modal close history; whole-playlist exclusion and live variants; import/analysis/save, cached reuse, cancellation, failed jobs and duplicate-click protection. No service calls.');})().catch(e=>{console.error(e);process.exitCode=1;});
