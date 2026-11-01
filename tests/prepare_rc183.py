from pathlib import Path
import sys
root=Path(__file__).resolve().parent.parent
html=(root/'index.html').read_text()
fixture=r'''
  // Test-only entry point. Never included in the release HTML.
  const qaButton=document.createElement('button');qaButton.id='qa183';qaButton.textContent='Run RC183 checks';
  const qaResult=document.createElement('pre');qaResult.id='qa183Result';qaResult.setAttribute('role','status');
  document.body.prepend(qaButton,qaResult);
  qaButton.onclick=async()=>{
    const checks=[];const check=(condition,label)=>{if(!condition)throw Error(label);checks.push(label);};
    const oldFetch=window.fetch,oldIdentity=structureAudioIdentity;let requests=0;
    // Preview uses HTTP; production HTTPS supplies Web Crypto.
    structureAudioIdentity=async()=>'rc183-fixture-audio';
    window.fetch=(url,options)=>{if(String(url).includes('runpod')){requests++;return Promise.reject(Error('Paid requests disabled in tests'));}return oldFetch(url,options);};
    qaButton.disabled=true;
    try{
      ensureCtx();const b=ctx.createBuffer(1,8*8000,8000),audio=arrayBufferToBase64(await wavBlob(b).arrayBuffer());
      const project={format:'Bass Stem Studio Project',schemaVersion:2,projectName:'RC183 practice fixture',source:{name:'rc183.wav',type:'audio/wav',duration:8,audioBase64:audio},analysis:{notes:[],structure:{segments:[{name:'Verse',start:0,end:4,uncertain:true},{name:'Chorus',start:4,end:8}]},chords:[]},settings:{sections:{Verse:{start:0,end:3.5},Chorus:{start:4,end:8}},selectedSections:['Verse'],repeatRanges:{Verse:{start:1,end:3}},selectedSection:'Verse'}};
      const open=p=>importBassStudioProject(new File([JSON.stringify(p)],'fixture.bassstudio',{type:'application/json'}));
      check(await open(project),'Section-only project opens');check(!saveProjectBtn.disabled,'Section-only save enabled');
      check(sections.Verse.end===3.5,'Corrected boundaries restored');check(repeatRangeOverrides.get('Verse').start===1,'Repeat adjustment restored');
      renameSongSection('Verse','Bridge','bridge');
      check(songStructure.segments[0].uncertain===false,'Corrected label confirmed');check(selectedSections.has('Bridge'),'Selection follows corrected label');
      check(repeatRangeOverrides.has('Bridge')&&!repeatRangeOverrides.has('Verse'),'Repeat adjustment follows label');
      const captured=await captureStudyProject();check(captured.analysis.structure.segments[0].name==='Bridge','Saved map retains label');check(captured.settings.sections.Bridge.end===3.5,'Saved map retains adjusted range');
      check(await open(captured),'Edited section-only project reopens');
      await rememberImportedSections(songSession,activeAudioFile);
      const cached=cachedSongStructure(structureAudioId);check(cached.ranges.Bridge.end===3.5,'Reopened project cached by audio content');
      check(cached.repeatRanges.Bridge.start===1,'Cached repeat choice retained');
      const bad=JSON.parse(JSON.stringify(captured));bad.analysis.structure.segments[1].end=80;
      check(!(await open(bad)),'Invalid sections rejected');check(sections.Bridge.end===3.5,'Invalid import preserves current work');
      const sample=ctx.createBuffer(1,5*22050,22050),samples=sample.getChannelData(0),reference=[{midi:23,start:.4,end:1.1},{midi:40,start:1.8,end:2.5},{midi:43,start:3.2,end:3.9}];
      for(const n of reference){const hz=440*Math.pow(2,(n.midi-69)/12);for(let i=Math.ceil(n.start*22050);i<n.end*22050;i++){const t=i/22050,envelope=Math.min(1,(t-n.start)/.02,(n.end-t)/.02);samples[i]=.2*envelope*Math.sin(2*Math.PI*hz*t);}}
      const detected=await BassFeedback.transcribe(sample,0,5);const feedback=BassFeedback.score(reference,detected);
      check(feedback.matched===3,'Synthetic solo bass notes matched to reference, including low B');
      let cancelled=false;try{await BassFeedback.transcribe(sample,0,5,()=>true);}catch{cancelled=true;}check(cancelled,'Local recording analysis cancels');
      const notesProject=JSON.parse(JSON.stringify(captured));notesProject.analysis.notes=[{midi:36,start:0,end:.5},{midi:39,start:1,end:1.5},{midi:43,start:2,end:2.5}];
      const feedbackProject=JSON.parse(JSON.stringify(captured));feedbackProject.analysis.notes=reference.map(n=>({...n,confidence:.95}));
      check(await open(feedbackProject),'Reference project opens for recording feedback');
      const transfer=new DataTransfer();transfer.items.add(new File([await wavBlob(sample).arrayBuffer()],'solo-fixture.wav',{type:'audio/wav'}));$('compareFile1').files=transfer.files;$('compareFile1').dispatchEvent(new Event('change'));
      $('compareMode').value='song';$('compareStart0').value='0';$('compareStart1').value='0';$('compareLength').value='5';
      await $('compareGo').onclick();check($('compareResult').textContent.includes('3/3 notes matched'),'Compare panel runs reference feedback end to end');
      await BassStudyStore.put('list:rc183-fixture',{id:'rc183-fixture',title:'RC183 check',kind:'setlist',songs:[{id:'test',title:'Test song',key:'Eb major',bpm:92,duration:8,project:new Blob([JSON.stringify(notesProject)],{type:'application/json'})}]});
      check(requests===0,'No section upload or paid analysis on project restore');
      qaResult.textContent='PASS '+checks.length+' checks\n'+checks.join('\n');
    }catch(error){qaResult.textContent='FAIL '+error.stack;}finally{window.fetch=oldFetch;structureAudioIdentity=oldIdentity;qaButton.disabled=false;}
  };
'''
marker='  initAnalysisTools();\n  renderBassFretboard();'
assert marker in html
html=html.replace(marker,fixture+marker)
# Keep this disposable preview mobile-sized without changing the release layout.
html=html.replace('</head>','<style>body{max-width:430px!important;margin-inline:auto!important}#qa183Result{white-space:pre-wrap;max-width:420px}</style></head>')
target=Path(sys.argv[1]) if len(sys.argv)>1 else root/'qa/index.html'
target.write_text(html)
print(target)
