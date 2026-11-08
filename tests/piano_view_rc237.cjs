const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const env={window:{},document:{getElementById:()=>null},Float32Array,Float64Array,Math,JSON,Number,Array};vm.createContext(env);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../ai-source/piano.js'),'utf8'),env);const p=env.window.BassPiano;
assert.equal(p.keyCount(390),24);assert.equal(p.keyCount(800),36);
for(const width of [320,390,650,1024]){const n=p.keyCount(width),r=p.range([{midi:60},{midi:76}],n);assert.equal(r.high-r.low+1,n);}
assert.equal(p.clean([{midi:60,start:0,end:2},{midi:NaN,start:0,end:1},{midi:60,start:-1,end:1}]).length,1);
const joined=p.join([{midi:60,start:19,end:20,confidence:.9},{midi:60,start:20,end:21,confidence:.9,continuation:true}]);assert.equal(joined.length,1);assert.equal(joined[0].end,21);
assert.equal(p.join([{midi:60,start:19,end:20,manual:true},{midi:60,start:20,end:21,continuation:true}]).length,2);
console.log('PASS: keyboard bounds, invalid data rejection, held notes across passages and manual-note preservation');
