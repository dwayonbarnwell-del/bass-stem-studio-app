// RC197. Apply only batch, library and read-only RunPod connection changes.
// Automated checks use mocks only: no live analysis or service billing.
// Rechecked test-harness value comparisons for isolated JavaScript contexts.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const path='index.html',old=fs.readFileSync(path,'utf8');
let html=old;
const library=fs.readFileSync('library-source/library.js','utf8').trim();
const batch=fs.readFileSync('batch-source/batch.js','utf8').trim();
function replaceOnce(from,to,description){
  assert(html.includes(from),'Missing '+description);
  assert.equal(html.indexOf(from),html.lastIndexOf(from),'Ambiguous '+description);
  html=html.replace(from,to);
}
function replaceInline(id,content){
  const tag='<script id="'+id+'">';
  const a=html.indexOf(tag),b=html.indexOf('</script>',a);
  assert(a>=0&&b>a,'Missing inline '+id);
  html=html.slice(0,a)+tag+'\n'+content+'\n'+html.slice(b);
}
replaceInline('rc195-library',library);
replaceInline('rc196-batch',batch);
const oldHook="  window.BassBatch.init({load:file=>loadAudioFile(file),analyse:()=>analyseBassWithAI(),save:name=>saveBassStudioProject({batchName:name}),isBusy:()=>songImportBusy||aiBusy||projectSaveBusy,hasPending:()=>!!readPendingRunPodJob()});";
const newHook="  // GET /health checks connection without submitting a paid analysis.\n  async function checkBatchRunPodConnection(){\n    const key=await getRunPodKey();\n    if(!key)throw Error('No RunPod API key was entered. Use Connect analysis in the app.');\n    const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),15000);\n    try{\n      const response=await fetch('https://api.runpod.ai/v2/'+RUNPOD_ENDPOINT+'/health',{\n        method:'GET',headers:{'Authorization':'Bearer '+key,'Accept':'application/json'},\n        cache:'no-store',signal:controller.signal\n      });\n      if(response.status===401||response.status===403)throw Error('RunPod rejected the saved API key (HTTP '+response.status+'). Update the API key in the app.');\n      if(!response.ok)throw Error('RunPod returned HTTP '+response.status+'. Check your RunPod endpoint.');\n      const health=await response.json();\n      return {workers:health.workers||{},jobs:health.jobs||{}};\n    }catch(err){\n      if(err?.name==='AbortError')throw Error('RunPod did not respond within 15 seconds. Try checking again.');\n      if(err instanceof TypeError)throw Error('Could not reach RunPod. Check your internet connection or RunPod service status.');\n      throw err;\n    }finally{clearTimeout(timer);}\n  }\n  window.BassBatch.init({\n    load:file=>loadAudioFile(file),\n    analyse:()=>analyseBassWithAI(),\n    save:name=>saveBassStudioProject({batchName:name}),\n    hasCompletedBass:()=>!!(offlineAnalysisReady&&notes.length&&analysisParts.length&&analysisParts.every(p=>!!p.bassBase64)),\n    checkConnection:()=>checkBatchRunPodConnection(),\n    isBusy:()=>songImportBusy||aiBusy||projectSaveBusy,\n    hasPending:()=>!!readPendingRunPodJob()\n  });";
replaceOnce(oldHook,newHook,'batch hooks');
replaceOnce("  const APP_VERSION='RC195';","  const APP_VERSION='RC197';",'app version');
for(const [i,m] of [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].entries()){
  try{new vm.Script(m[1],{filename:'inline-'+i+'.js'});}
  catch(err){throw Error('Inline '+i+' failed: '+err.message);}
}
assert(html.includes(library)&&html.includes(batch),'Embedded source must match maintained files');
fs.writeFileSync(path,html);
console.log('PASS: RC197 built from current app; read-only health check; existing UI and analysis preserved.');
