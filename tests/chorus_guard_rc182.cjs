const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const predicate=html.match(/Object\.entries\(sections\)\.filter\(\(\[name,s\]\)=>[^;]+/)[0];
const context={sections:{'Chorus unset':{start:null,end:null},'Chorus valid':{start:10,end:20},'Chorus reversed':{start:20,end:10},'Chorus outside':{start:20,end:80},Verse:{start:0,end:10}},buffer:{duration:60}};
assert.equal(vm.runInNewContext(predicate,context).map(x=>x[0]).join(','),'Chorus valid');
context.buffer=null;assert.equal(vm.runInNewContext(predicate,context).length,0);
console.log('PASS chorus repeat rejects unset, reversed, out-of-song and unloaded ranges.');
