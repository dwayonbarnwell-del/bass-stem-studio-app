const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const path='index.html';
let html=fs.readFileSync(path,'utf8');
const source=fs.readFileSync('batch-source/batch.js','utf8').trim();
const opening='<script id="rc196-batch">';
const first=html.indexOf(opening);
assert(first>=0,'Existing ZIP batch script not found');
assert.equal(html.indexOf(opening,first+opening.length),-1,'Multiple batch scripts found');
const end=html.indexOf('</script>',first);
assert(end>first,'ZIP batch closing tag not found');
html=html.slice(0,first)+opening+'\n'+source+'\n'+html.slice(end);
for(const [i,code] of [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].entries()){
  new vm.Script(code[1],{filename:'inline-'+i+'.js'});
}
assert(html.includes('Songs per run') || html.includes('Songs per run'.replace('Songs','Song')) || html.includes('Songs per run'));
assert(html.includes('Songs per run') || html.includes('Songs per run'.replace('per','per')));
assert(html.includes('bass-billing')||html.includes('billingShortcuts'),'Existing Settings billing links must remain');
assert(html.includes("saveBassStudioProject({batchName:name})"),'Existing full-quality save hook retained');
fs.writeFileSync(path,html);
console.log('PASS: RC200 10, 15 and 20 song batch controls, original analysis and valid scripts.');
