// RC198: apply only batch/library UI source updates to the existing app.
// Integration checks use generated ZIP fixtures and never contact RunPod.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let html=fs.readFileSync('index.html','utf8');
for(const [id,path] of [['rc195-library','library-source/library.js'],['rc196-batch','batch-source/batch.js']]){
 const tag='<script id="'+id+'">',start=html.indexOf(tag),end=html.indexOf('</script>',start);
 assert(start>=0&&end>start,'Missing source block '+id);
 const content=fs.readFileSync(path,'utf8').trim();
 html=html.slice(0,start)+tag+'\n'+content+'\n'+html.slice(end);
}
const before="  const APP_VERSION='RC197';",after="  const APP_VERSION='RC198';";
assert(html.includes(before),'Expected RC197 baseline');
html=html.replace(before,after);
assert(html.includes("checkBatchRunPodConnection"),'Read-only API check must be retained');
assert(html.includes("saveBassStudioProject({batchName:name})"),'Existing analysis and save hooks must be retained');
for(const [i,m] of [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].entries()){
  try{new vm.Script(m[1],{filename:'inline-'+i+'.js'});}
  catch(err){throw Error('Inline script '+i+' is invalid: '+err.message);}
}
fs.writeFileSync('index.html',html);
console.log('PASS: RC198 uses the current working app, maintains analysis, and validates all inline scripts.');
