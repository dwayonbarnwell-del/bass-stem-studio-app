"""Local-only real Web Audio QA; never add fixture controls to the release."""
from pathlib import Path
import subprocess
import sys

root=Path(__file__).resolve().parents[1]
target=Path(sys.argv[1]).resolve()
subprocess.run([sys.executable,str(root/'tests/prepare_rehearsal_preview_rc357.py'),str(target)],check=True)
p=target/'dist/index.html'
html=p.read_text().replace("'rehearsal-qa.bassstudio'","'expressive-qa-rc365.bassstudio'").replace('if(duration>60||roles){','if(duration>0){')
html=html.replace("melody:{version:2,notes:[],done:","melody:{version:2,updatedAt:Date.now(),notes:[],done:")
marker='  initAnalysisTools();\n  renderBassFretboard();'
fixture=r'''
  const qaExpressive=document.createElement('button'),qaExpressiveOut=document.createElement('output');
  qaExpressive.id='qaExpressive';qaExpressive.textContent='Check expressive audio';qaExpressiveOut.id='qaExpressiveResult';document.getElementById('qaControls').append(qaExpressive,qaExpressiveOut);
  qaExpressive.onclick=async()=>{
   qaExpressive.disabled=true;qaExpressiveOut.textContent='Rendering';
   try{
    const audioContext=new AudioContext({sampleRate:32000}),P=window.BassPracticeCore,E=window.BassExpressiveStudies,L=window.BassPracticeLoop,results=[];
    const plans=E.entries.map((e,i)=>P.make(e.kind,{idea:e.index,key:i%12,from:i%7+1,to:(i+3)%7+1,bpm:78})).concat(P.lines.filter(l=>l.expressive).map(l=>P.make('basslines',{idea:P.lines.indexOf(l),key:0,bpm:84})));
    for(const plan of plans){
     const fitted=window.BassRegister.plan(plan),rendered=await L.render(audioContext,fitted,{drums:false,chords:false}),buffer=rendered.stems.bass,data=buffer.getChannelData(0);let sum=0,peak=0;
     for(const sample of data){if(!Number.isFinite(sample))throw Error('Non-finite waveform');sum+=sample*sample;peak=Math.max(peak,Math.abs(sample));}
     const rms=Math.sqrt(sum/data.length);if(rms<.003||peak>1)throw Error('Waveform level '+plan.title+' '+rms+' '+peak);
     results.push({title:plan.title,rms:+rms.toFixed(4),peak:+peak.toFixed(4),seconds:buffer.duration});qaExpressiveOut.textContent='Rendered '+results.length+'/'+plans.length;
    }
    // Independent waveform checks: dynamics and articulation must affect sound.
    const instrument=window.BassFingeredBass;await instrument.prepare(audioContext,{notes:[{midi:36},{midi:38}]});
    const tone=async(velocity,expression={})=>{const c=new OfflineAudioContext(1,32000,32000);instrument.tone(c,38,.05,.7,0,velocity,.7,expression);return (await c.startRendering()).getChannelData(0);};
    const soft=await tone(64),hard=await tone(104),plain=await tone(88),slide=await tone(88,{slideFrom:36,slideSeconds:.045,articulation:'legato'});
    const delta=(a,b)=>Math.sqrt(a.reduce((sum,x,i)=>sum+(x-b[i])**2,0)/a.length),velocityDelta=delta(soft,hard),slideDelta=delta(plain,slide);
    if(velocityDelta<.005||slideDelta<.001)throw Error('Expression did not reach sampled audio');
    const silent=new OfflineAudioContext(1,8000,32000),silence=await silent.startRendering();if(silence.getChannelData(0).some(x=>x!==0))throw Error('Silent buffer was not silent');
    await audioContext.close();qaExpressiveOut.textContent=JSON.stringify({passed:true,rendered:results.length,minRms:Math.min(...results.map(r=>r.rms)),maxPeak:Math.max(...results.map(r=>r.peak)),velocityDelta:+velocityDelta.toFixed(5),slideDelta:+slideDelta.toFixed(5),sampleRate:32000});
   }catch(error){qaExpressiveOut.textContent=JSON.stringify({passed:false,error:error.message});}finally{qaExpressive.disabled=false;}
  };
'''
p.write_text(html.replace(marker,fixture+'\n'+marker,1))
(target/'dist/mobile.html').write_text('''<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#09121d;color:white}iframe{border:0;width:390px;height:850px;max-width:100vw}button{padding:6px}</style></head><body><button onclick="document.querySelector('iframe').style.width='320px'">320</button><button onclick="document.querySelector('iframe').style.width='390px'">390</button><button onclick="document.querySelector('iframe').style.width='430px'">430</button><iframe title="Phone preview" src="./index.html"></iframe></body></html>''')
print('Prepared expressive browser QA outside the release.')
