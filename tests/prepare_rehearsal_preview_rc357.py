"""Prepare the real application with local-only controls for browser QA.

The generated preview is outside the repository. No fixture controls are shipped.
"""
from pathlib import Path
import os, shutil, sys

root=Path(__file__).resolve().parents[1]
target=Path(sys.argv[1]).resolve()
dist=target/'dist';dist.mkdir(parents=True,exist_ok=True)
names=['ear-source','ear-assets','audio','ai-source','ai-assets-rc201.js','fretflow-source','library-source','song-reference','song-view','chord-source','vendor','icons','manifest.webmanifest','sw.js','guide.html']
for name in names:
 source=root/name
 if not source.exists():continue
 paths=source.rglob('*') if source.is_dir() else [source]
 for path in paths:
  if not path.is_file():continue
  out=dist/path.relative_to(root);out.parent.mkdir(parents=True,exist_ok=True)
  if out.exists():out.unlink()
  os.link(path,out)

fixture=r'''
  const qa=document.createElement('div');qa.id='qaControls';
  qa.style='position:fixed;bottom:0;left:0;right:0;z-index:999999;background:#102434;color:white;padding:4px;font:13px sans-serif;display:flex;flex-wrap:wrap;gap:4px';
  qa.innerHTML='<button id="qaShort">Load 32s</button><button id="qaLong">Load 7:55</button><button id="qaDense">Dense song</button><button id="qaRoles">Note roles</button><button id="qaVerify">Check save</button><button id="qaReopen">Reopen saved</button><output id="qaResult">Local rehearsal QA</output><output id="qaVerified"></output><output id="qaLoop"></output>';
  document.body.append(qa);
  let qaStarts=0;const qaStart=AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start=function(...args){
    if(this.loop){qaStarts++;document.getElementById('qaLoop').textContent='Loop '+(this.loopEnd-this.loopStart).toFixed(3)+'s · '+qaStarts+' starts';}
    return qaStart.apply(this,args);
  };
  let qaSaved=null;
  const qaSave=window.BassLibrary.saveAnalysisProject;
  window.BassLibrary.saveAnalysisProject=async function(project,...args){
    const result=await qaSave.call(this,project,...args);qaSaved=JSON.parse(JSON.stringify(project));
    document.getElementById('qaResult').textContent='Saved '+(project.analysis.rehearsalPhrases?.phrases.length||0)+' phrases';return result;
  };
  const qaOpen=async(project)=>{
    await window.BassRehearsal.close();
    const opened=await importBassStudioProject(new File([JSON.stringify(project)],'rehearsal-qa.bassstudio',{type:'application/json'}),{practiceOnly:true});
    if(!opened)throw Error(document.getElementById('aiState').textContent||'Fixture could not open');
    if(!document.getElementById('earTrainerDialog').open)document.getElementById('openEarTraining').click();
    document.getElementById('earSectionRehearsal').click();
  };
  async function qaLoad(duration,dense=false,roles=false){
    document.getElementById('qaResult').textContent='Loading fixture';ensureCtx();
    const audio=ctx.createBuffer(1,Math.round(duration*8000),8000),step=60/117,noteStep=dense?.11:step,chordStep=dense?.45:step*4;
    const pcm=audio.getChannelData(0);for(let i=0;i<pcm.length;i++)pcm[i]=.025*Math.sin(i/8000*Math.PI*2*(roles?82:dense?84:80));
    duration=audio.duration;
    const chords=roles?[[0,2,0,'maj'],[2,4,0,'maj7'],[4,8,5,'maj'],[8,duration,7,'maj']].map(([start,end,rootPc,quality])=>({start,end,rootPc,quality,manual:true,confidence:.99,evidence_version:'chord-timeline-v4'})):Array.from({length:Math.ceil(duration/chordStep)},(_,i)=>({start:i*chordStep,end:Math.min(duration,(i+1)*chordStep),rootPc:[0,5,7,5][i%4],quality:'maj',manual:true,confidence:.99,evidence_version:'chord-timeline-v4'}));
    const notes=roles?[[0,41],[.5,43],[1,36],[2,40],[2.5,36],[3,42],[4,41],[5,45],[6,40],[7.5,42],[8,43],[9,47]].map(([start,midi])=>({start,end:start+.3,midi,confidence:.95,manual:true})):Array.from({length:Math.floor(duration/noteStep)},(_,i)=>({start:i*noteStep,end:Math.min(duration,i*noteStep+Math.min(.3,noteStep*.8)),midi:dense?36+[0,2,4,7,9][i%5]:24+[0,5,7,5][Math.floor(i/4)%4],confidence:.95,manual:true}));
    const name=roles?'Note roles QA':dense?'Dense notes QA':'Phrase timeline QA';
    const project={format:'Bass Stem Studio Project',schemaVersion:2,projectName:name,
      source:{name:name+'.wav',type:'audio/wav',duration,audioBase64:arrayBufferToBase64(await wavBlob(audio).arrayBuffer())},
      analysis:{ready:true,scale:'C major',tempoBpm:117,beatGridConfidence:.98,beatsPerBar:4,downbeatPhase:0,melody:{version:2,notes:[],done:[{start:0,end:duration}],jobs:{}},
        beatTimes:Array.from({length:Math.floor(duration/step)+1},(_,i)=>i*step),chords,
        notes,
        structure:{segments:[{name:'Intro',start:0,end:Math.min(16,duration)},{name:'Chorus',start:16,end:duration}].filter(s=>s.end>s.start)}},settings:{}};
    await qaOpen(project);
  }
  document.getElementById('qaShort').onclick=()=>qaLoad(32.137).catch(e=>document.getElementById('qaResult').textContent=e.message);
  document.getElementById('qaLong').onclick=()=>qaLoad(475.544).catch(e=>document.getElementById('qaResult').textContent=e.message);
  document.getElementById('qaDense').onclick=()=>qaLoad(12.137,true).catch(e=>document.getElementById('qaResult').textContent=e.message);
  document.getElementById('qaRoles').onclick=()=>qaLoad(12.137,false,true).catch(e=>document.getElementById('qaResult').textContent=e.message);
  document.getElementById('qaVerify').onclick=()=>{
    const plan=qaSaved?.analysis?.rehearsalPhrases;
    if(!plan){document.getElementById('qaVerified').textContent='Waiting for automatic save';return;}
    let end=0;for(const phrase of plan.phrases){if(phrase.start!==end||phrase.end<=phrase.start)throw Error('Timeline gap/overlap');end=phrase.end;}
    if(end!==buffer.duration||!qaSaved?.analysis?.rehearsalPhrases)throw Error('Timeline was not saved');
    if(JSON.stringify(savedRehearsalPhrases)!==JSON.stringify(plan))throw Error('Saved timeline differs');
    document.getElementById('qaVerified').textContent='PASS · '+plan.phrases.length+' saved phrases · '+end+'s';
  };
  document.getElementById('qaReopen').onclick=()=>qaSaved&&qaOpen(qaSaved);
'''
html=(root/'index.html').read_text()
marker='  initAnalysisTools();\n  renderBassFretboard();'
assert marker in html
(dist/'index.html').write_text(html.replace(marker,fixture+'\n'+marker,1))
manifest=target/'.openai/hosting.json';manifest.parent.mkdir(exist_ok=True)
manifest.write_text('{"static":{"directory":"dist"}}')
print('Prepared local rehearsal browser QA.')
