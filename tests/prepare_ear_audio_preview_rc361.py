"""Add local-only native-node audits after preparing the rehearsal preview."""
from pathlib import Path
import sys

target=Path(sys.argv[1]).resolve()/'dist'/'index.html'
html=target.read_text()
marker='  initAnalysisTools();\n  renderBassFretboard();'
assert marker in html
fixture=r'''
  const qaAudioButton=document.createElement('button'),qaAudioResult=document.createElement('output');
  qaAudioButton.id='qaAudioAudit';qaAudioButton.textContent='Audio audit';qaAudioResult.id='qaAudioResult';
  const qaAuditBox=document.createElement('div');qaAuditBox.id='qaAuditBox';qaAuditBox.style='position:absolute;bottom:0;left:0;right:0;z-index:9999;background:#102434;font:11px monospace;max-height:90px;overflow:auto;flex-shrink:0';qaAuditBox.append(qaAudioButton,qaAudioResult);document.getElementById('qaControls').append(qaAuditBox);const qaAuditObserver=new MutationObserver(()=>{const dialog=document.getElementById('earTrainerDialog');if(dialog){dialog.append(qaAuditBox);qaAuditObserver.disconnect();}});qaAuditObserver.observe(document.body,{childList:true,subtree:true});
  let qaAudioRender,qaAudioTransport,qaAudioGains=[],qaRoutes=[];const qaMergers=[];
  const qaRender=window.BassPracticeLoop.render;
  window.BassPracticeLoop.render=async function(...args){const result=await qaRender.apply(this,args);qaAudioRender=result;return result;};
  const qaStartTransport=window.BassPracticeLoop.start;
  window.BassPracticeLoop.start=function(context,rendered,...args){
    const create=context.createGain,created=[];context.createGain=function(...args){const node=create.apply(this,args);created.push(node);return node;};
    try{qaAudioTransport=qaStartTransport.call(this,context,rendered,...args);qaAudioGains=Object.keys(rendered.stems).map((part,i)=>({part,node:created.slice(-Object.keys(rendered.stems).length)[i]}));return qaAudioTransport;}
    finally{context.createGain=create;}
  };
  const qaMixer=window.BassEarAudio.mixer;
  window.BassEarAudio.mixer=function(context,...args){const route=qaMixer.call(this,context,...args),analyser=context.createAnalyser();analyser.fftSize=2048;route.master.connect(analyser);qaRoutes.push({...route,analyser});return route;};
  const qaMerger=AudioContext.prototype.createChannelMerger;
  AudioContext.prototype.createChannelMerger=function(...args){const merger=qaMerger.apply(this,args),connect=merger.connect;merger.connect=function(target,...args){if(target instanceof GainNode)qaMergers.push(target);return connect.call(this,target,...args);};return merger;};
  qaAudioButton.onclick=()=>{
    const rms=buffer=>{let power=0;for(let c=0;c<buffer.numberOfChannels;c++){const data=buffer.getChannelData(c);for(const value of data)power+=value*value;}return Math.sqrt(power/(buffer.length*buffer.numberOfChannels));};
    const current=qaRoutes.at(-1),samples=new Float32Array(2048);current?.analyser.getFloatTimeDomainData(samples);
    qaAudioResult.textContent=JSON.stringify({
      stems:qaAudioRender&&Object.fromEntries(Object.entries(qaAudioRender.stems).map(([part,buffer])=>[part,Math.round(rms(buffer)*10000)/10000])),
      levels:Object.fromEntries(qaAudioGains.map(({part,node})=>[part,Math.round(node.gain.value*10000)/10000])),
      bandLevels:qaMergers.slice(-4).map(node=>Math.round(node.gain.value*10000)/10000),
      normalisation:qaAudioRender?.levels,pitch:qaAudioRender?.semitones||0,seconds:qaAudioRender?.seconds,latency:current?.latency,
      outputRms:Math.sqrt(samples.reduce((sum,x)=>sum+x*x,0)/samples.length),outputPeak:Math.max(...samples.map(Math.abs))
    });
  };
'''
target.write_text(html.replace(marker,fixture+'\n'+marker,1))
print('Prepared native audio-node audit controls outside the release.')
