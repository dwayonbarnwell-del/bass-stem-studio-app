const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const slice=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i+1);assert(i>=0&&j>i);return html.slice(i,j);};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const messages=[],button={},target={filename:'My original.json',dir:{name:'Songs'}};
  let writing=false,writes=0,fail=false,release;
  const library={errorText:e=>e.message,async saveAnalysisProject(p,t,{onProgress}){
    assert.equal(t,target);assert.equal(p.analysis.notes[0].midi,35);assert.equal(p.analysis.melody.notes[0].midi,73);
    assert(!writing);writing=true;writes++;onProgress('Saving '+t.filename+' · 50%');
    try{if(release)await release.promise;if(fail)throw Error('Folder disconnected');return {target:t,location:'folder “Songs”'};}
    finally{writing=false;}
  }};
  let melody={notes:[{midi:73,start:0,end:1}],done:[{start:0,end:250}]},cached;
  const c=vm.createContext({window:{BassLibrary:library,BassPiano:{exportData:()=>melody,unfinished:()=>false,restore:v=>{melody=v;}},
      BassPracticeControls:{setSaveStatus:text=>messages.push(text)}},autoWriting:false,projectSaveBusy:false,songSession:1,saveProjectBtn:button,
    songImportBusy:false,aiBusy:false,loadedProjectName:'My original',activeAudioFile:{name:'My original.mp3'},
    detectedChordChanges:[{}],songStructure:{segments:[{}]},sections:{Intro:{}},safeProjectFilename:v=>v,
    rememberLastOpenedSession(){},updateProjectButtons(){},aiStatus(){},setTimeout,clearTimeout,
    structureAudioIdentity:async()=>'track',recoveryStore:async()=>cached,
    captureStudyProject:async()=>({analysis:{notes:[{midi:35}],melody,bassBacking:{version:2}}})});
  vm.runInContext(slice('  let currentProjectTarget=','  async function captureStudyProject()')+
    slice('  let melodySaveTimer=','  window.BassBacking.init('),c);
  c.target=target;vm.runInContext('currentProjectTarget=target;',c);
  release={};release.promise=new Promise(r=>{release.resolve=r;});
  c.queueMelodyProjectSave(true);await wait(0);
  assert.equal(writes,1);assert.equal(button.textContent,'Saving…');assert(!messages.some(m=>m.startsWith('Saved ')));
  await c.saveBassStudioProject();assert.equal(writes,1,'manual tap shares the active save');
  release.resolve();await wait(0);release=null;
  assert.equal(button.textContent,'Saved ✓');assert.match(messages.at(-1),/Saved My original.json to folder “Songs”/);
  fail=true;await c.saveBassStudioProject();
  assert.equal(button.textContent,'Retry save');assert.match(messages.at(-1),/not saved.*disconnected/);assert.equal(c.projectSaveBusy,false);
  fail=false;await c.saveBassStudioProject();assert.equal(button.textContent,'Saved ✓');assert.equal(c.projectSaveBusy,false);
  const realMelody=melody;cached={savedAt:50,melody:{...realMelody,updatedAt:40}};
  assert.equal(await c.restoreSavedMelody(undefined,new Date(100).toISOString(),true),true);
  assert.equal(melody,cached.melody,'a missing line can recover despite a newer project timestamp');
  const edited={notes:[],done:realMelody.done,updatedAt:90};
  assert.equal(await c.restoreSavedMelody(edited,new Date(100).toISOString(),false),false);
  assert.equal(melody,edited,'a newer intentional edit is preserved');
  vm.runInContext(slice('  function mapPracticeMidi(','  function mapFreshCloudMidi('),c);
  assert.equal(c.mapPracticeMidi(null),null);
  assert.equal(c.savedBassPitch({midi:35,cloudMidi:0}),35,'repair legacy missing source pitch');
  assert.equal(c.savedBassPitch({midi:35,cloudMidi:47}),47,'retain genuine recorded pitches');
  assert.equal(c.savedBassPitch({midi:35,cloudMidi:47,manual:true}),35,'keep edited pitches');
  const imported=slice('  async function importBassStudioProject(','  async function importAudioCheckingLibrary');
  assert(imported.indexOf('window.BassPiano.restore(project.analysis.melody)')<imported.indexOf('setPracticeVisualMode(project.settings.practiceView)'));
  assert(imported.indexOf('window.BassLibrary.presentOpened(file)')<imported.indexOf('await backingLoad'));
  assert(/bassNotes:\(\)=>notes/.test(html));
  const piano=fs.readFileSync('ai-source/piano.js','utf8');
  assert(piano.includes("const lineNotes=()=>bassFlow?api.bassNotes():data.notes;"));
  assert(piano.includes("const playbackSound=()=>bassFlow?'bass':'piano';"));
  console.log('PASS automatic/manual saves share one write, visible confirmation after commit, retry after failure, early bass and piano restoration, recovery precedence.');
})().catch(e=>{console.error(e);process.exitCode=1;});
