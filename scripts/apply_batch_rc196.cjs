// RC196: Patch the existing single-file release, leaving working analysis code intact.
// Includes sequential ZIP processing and no direct paid cloud calls from this patch.
const fs=require('node:fs'), vm=require('node:vm'),assert=require('node:assert/strict');
const path='index.html';
let html=fs.readFileSync(path,'utf8');
const library=fs.readFileSync('library-source/library.js','utf8').trim();
const batch=fs.readFileSync('batch-source/batch.js','utf8').trim();
const swap=(s,a,b,label)=>{
  assert(s.includes(a),'Missing '+label);
  assert.equal(s.indexOf(a),s.lastIndexOf(a),'Ambiguous '+label);
  return s.replace(a,b);
};
const existingStart=html.indexOf('<script id="rc195-library">');
const existingEnd=html.indexOf('</script>',existingStart);
assert(existingStart>=0&&existingEnd>existingStart,'Library inline block missing');
const oldInner=html.slice(existingStart+'<script id="rc195-library">'.length,existingEnd);
html=html.slice(0,existingStart)+'<script id="rc195-library">\n'+library+'\n'+html.slice(existingEnd);
if(!html.includes('id="rc196-batch"')){
  html=swap(html,
    "</script>\n<script>\n(() => {\n  'use strict';\n  const APP_VERSION='RC195';",
    "</script>\n<script id=\"rc196-batch\">\n"+batch+"\n</script>\n<script>\n(() => {\n  'use strict';\n  const APP_VERSION='RC195';",
    'batch entry point');
}
let start=html.indexOf('  async function saveBassStudioProject(');
let end=html.indexOf('\n  async function captureStudyProject(',start);
assert(start>=0&&end>start,'Save function not found');
let code=html.slice(start,end);
if(!code.includes('batchName=null')){
  code=swap(code,'async function saveBassStudioProject(){',
    'async function saveBassStudioProject({batchName=null}={}){','save signature');
  code=swap(code,'if(songImportBusy||aiBusy||projectSaveBusy)return;',
    "if(songImportBusy||aiBusy||projectSaveBusy){if(batchName)throw Error('Wait for the current song to finish.');return;}",
    'save guard');
  code=swap(code,"aiStatus('Analyse the song first, then save it.',0);return;",
    "if(batchName)throw Error('No complete analysis to save.');aiStatus('Analyse the song first, then save it.',0);return;",
    'save analysis guard');
  code=swap(code,
    "const chosen=await BassDialog.open({title:'Save song',label:'Song name',value:defaultBase,accept:'Save song'});",
    "const chosen=batchName||await BassDialog.open({title:'Save song',label:'Song name',value:defaultBase,accept:'Save song'});",
    'batch name');
  code=swap(code,'if(session!==songSession)return;\n      loadedProjectName=projectName;',
    "if(session!==songSession){if(batchName)throw Error('Song changed during save.');return;}\n      loadedProjectName=projectName;",
    'save session');
  const success=code.indexOf('      aiStatus(',code.indexOf('      loadedProjectName=projectName;'));
  assert(success>0,'Save status not found');
  const afterStatus=code.indexOf('\n',success);
  assert(afterStatus>success,'Save status line missing');
  code=code.slice(0,afterStatus+1)+
    '      return {projectName,noteCount:savedNotes.length,sectionCount:Object.keys(sections).length};\n'+
    code.slice(afterStatus+1);
  code=swap(code,
    "if(session===songSession&&err?.name!=='AbortError'){console.error(err);aiStatus(window.BassLibrary.errorText(err),0);}",
    "if(session===songSession&&err?.name!=='AbortError'){console.error(err);aiStatus(window.BassLibrary.errorText(err),0);}\n      if(batchName)throw err;",
    'batch save failure');
  html=html.slice(0,start)+code+html.slice(end);
}
start=html.indexOf('  async function analyseBassWithAI(){');
end=html.indexOf('\n  async function resumeSavedRunPodAnalysis()',start);
assert(start>=0&&end>start,'Cloud analysis function not found');
code=html.slice(start,end);
if(!code.includes('      return result;\n    }catch(err){')){
  code=swap(code,'        100\n      );\n    }catch(err){',
    '        100\n      );\n      return result;\n    }catch(err){','cloud analysis result');
  code=swap(code,'    }finally{\n      if(session!==songSession)return;',
    '      return null;\n    }finally{\n      if(session!==songSession)return;','cloud analysis error');
  html=html.slice(0,start)+code+html.slice(end);
}
const originalHook="  window.BassLibrary.init({open:file=>importBassStudioProject(file,{findSections:false}),isBusy:()=>songImportBusy||aiBusy||projectSaveBusy});";
const batchHook="  window.BassBatch.init({load:file=>loadAudioFile(file),analyse:()=>analyseBassWithAI(),save:name=>saveBassStudioProject({batchName:name}),isBusy:()=>songImportBusy||aiBusy||projectSaveBusy,hasPending:()=>!!readPendingRunPodJob()});";
if(!html.includes(batchHook))html=swap(html,originalHook,originalHook+'\n'+batchHook,'library hooks');
assert(html.includes(library),'Library and inline source must match');
assert(html.includes(batch),'Batch module must be inline for offline PWA');
for(const [i,m] of [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].entries()) {
  try {new vm.Script(m[1],{filename:'inline-'+i+'.js'});}
  catch(e){throw Error('Inline script '+i+' failed syntax check: '+e);}
}
fs.writeFileSync(path,html);
console.log('PASS: RC196 ZIP batch integrated, library and cloud analysis preserved; scripts parse.');
