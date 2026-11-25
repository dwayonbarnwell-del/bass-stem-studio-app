"""Disposable main-Studio fixtures; no service jobs, uploads or user-data deletion."""
from pathlib import Path
import subprocess,sys
root=Path(__file__).resolve().parents[1]
target=Path(sys.argv[1]).resolve()
subprocess.run([sys.executable,str(root/'tests/prepare_rehearsal_preview_rc357.py'),str(target)],check=True)
p=target/'dist/index.html';html=p.read_text()
html=html.replace("    if(!document.getElementById('earTrainerDialog').open)document.getElementById('openEarTraining').click();\n    document.getElementById('earSectionRehearsal').click();", "    document.getElementById('qaResult').textContent='Studio fixture ready';")
html=html.replace("melody:{version:2,notes:[],done:[{start:0,end:duration}],jobs:{}}", "melody:{version:2,notes:Array.from({length:24},(_,i)=>({start:i*.5,end:i*.5+.3,midi:60+[0,2,4,5,7,9,11,12][i%8],velocity:80,confidence:.99,manual:true})),done:[{start:0,end:duration}],jobs:{}}")
html=html.replace("if(duration>60||roles){","if(duration>0){").replace("'Phrase timeline QA'","'Studio RC364 QA'").replace("'Note roles QA'","'Roles RC364 QA'").replace("'Dense notes QA'","'Dense RC364 QA'")
html=html.replace("schemaVersion:2,projectName:name,","schemaVersion:2,savedAt:new Date().toISOString(),projectName:name,").replace("melody:{version:2,notes:Array.from","melody:{version:2,updatedAt:Date.now(),notes:Array.from")
extra=r'''
  qa.insertAdjacentHTML('beforeend','<button id="qaHide">Hide QA</button><button id="qaBad">Bad project</button><button id="qaData">Check data</button><output id="qaDownloads"></output>');
  document.getElementById('qaHide').onclick=()=>{qa.hidden=true;qa.style.display='none';};
  const qaErrors=[];window.addEventListener('error',e=>qaErrors.push(e.message));window.addEventListener('unhandledrejection',e=>qaErrors.push(String(e.reason?.message||e.reason)));
  const qaUrls=new Map(),qaUrl=URL.createObjectURL.bind(URL),qaClick=HTMLAnchorElement.prototype.click;
  URL.createObjectURL=function(blob){const url=qaUrl(blob);qaUrls.set(url,blob);return url;};
  HTMLAnchorElement.prototype.click=function(){
    const blob=qaUrls.get(this.href);if(!this.download||!blob)return qaClick.call(this);
    const name=this.download;void blob.arrayBuffer().then(b=>{const head=String.fromCharCode(...new Uint8Array(b).slice(0,4));document.getElementById('qaDownloads').textContent=name+' '+b.byteLength+' bytes '+head;});
  };
  document.getElementById('qaBad').onclick=async()=>{
    const previous={buffer,songSession,count:notes.length},savedAlert=window.alert;let alertText='';
    window.alert=t=>{alertText=String(t);};
    try{
      const opened=await importBassStudioProject(new File(['{"format":"Wrong"}'],'damaged.bassstudio',{type:'application/json'}));
      if(opened||buffer!==previous.buffer||songSession!==previous.songSession||notes.length!==previous.count)throw Error('Bad project replaced the open song');
      document.getElementById('qaResult').textContent='PASS invalid project kept the open song · '+alertText;
    }catch(e){document.getElementById('qaResult').textContent='FAIL '+e.message;}finally{window.alert=savedAlert;}
  };
  document.getElementById('qaData').onclick=()=>{
    const issues=[...qaErrors];
    if(!buffer||notes.length<10||window.BassPiano.exportData().notes.length!==24)issues.push('Fixture data missing');
    if(document.documentElement.scrollWidth>innerWidth+1)issues.push('Page overflow');
    document.getElementById('qaResult').textContent=issues.length?'FAIL '+issues.join(' | '):'PASS source notes, melody and page bounds; no uncaught errors';
  };
'''
marker='  initAnalysisTools();\n  renderBassFretboard();'
assert marker in html
p.write_text(html.replace(marker,extra+'\n'+marker,1))
(target/'dist/mobile.html').write_text('<!doctype html><meta name="viewport" content="width=device-width"><title>Studio phone QA</title><style>body{margin:0;background:#182331;color:white;font:14px sans-serif}label{padding:8px;display:inline-block}iframe{display:block;border:0;margin:auto;width:390px;height:850px}</style><label>Width <select aria-label="Phone width" onchange="document.querySelector(\'iframe\').style.width=this.value+\'px\'"><option>320</option><option selected>390</option><option>430</option></select></label><label>Height <select aria-label="Phone height" onchange="document.querySelector(\'iframe\').style.height=this.value+\'px\'"><option>430</option><option>600</option><option selected>850</option></select></label><iframe title="Studio phone" src="./"></iframe>')
print('Prepared main Studio browser QA.')
