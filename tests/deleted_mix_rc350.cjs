const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const files=['fills-rc264','practice-rc264b','catalogue-rc269','curated-rc289','groups-rc290','uploaded-data-rc267','lesson-data-rc272','african-data-rc274','recording-phrases','original-studies','reggae-recordings-rc348','world-methods-rc350','uploaded-core-rc267','accompaniment-rc293','catalogue-review-rc347'];
function load(saved=new Map(),fail=false){
 const env={window:{},localStorage:{getItem:key=>saved.get(key)||null,setItem:(key,value)=>{if(fail)throw Error('Full storage');saved.set(key,value);}}};vm.createContext(env);
 for(const file of files)vm.runInContext(fs.readFileSync('ear-source/'+file+'.js','utf8'),env);
 return env.window;
}
const saved=new Map(),w=load(saved),D=w.BassPracticeCatalogue,R=w.BassCatalogueReview,P=w.BassPracticeCore;
const run=P.runs[0].id,other=P.runs[1].id,fill=w.BassFillCore.styles[0].id;
const line=P.lines.find(row=>!row.removedFromPlatform&&P.phrases(row.degrees).length>1);
D.remove('runs',run);D.remove('fills',fill);D.remove('basslines',line.id+'/0');
assert(D.visible('runs',other));assert(D.visible('basslines',line.id+'/1'));
const count=R.removed().length;assert(count>2);D.emptyDeleted();assert.equal(R.removed().length,0);
assert(!D.visible('runs',run));assert(!D.visible('fills',fill));assert(D.visible('runs',other));assert(D.visible('basslines',line.id+'/1'));
assert.throws(()=>D.restore('runs',run));assert.throws(()=>D.restore('basslines',line.id+'/0'));
let reload=load(saved);assert.equal(reload.BassCatalogueReview.removed().length,0);
assert(reload.BassPracticeCatalogue.permanentlyRemoved('runs',run));assert(!reload.BassPracticeCatalogue.visible('basslines',line.id+'/0'));
reload.BassPracticeCatalogue.retire([{kind:'runs',id:run,title:'Reintroduced retirement'}]);assert.equal(reload.BassCatalogueReview.removed().length,0);
reload.BassPracticeCatalogue.remove('runs',other);assert.equal(reload.BassCatalogueReview.removed().length,1);
reload.BassPracticeCatalogue.restore('runs',other);assert(reload.BassPracticeCatalogue.visible('runs',other));
const failed=load(new Map());failed.BassPracticeCatalogue.remove('runs',run);
const before=failed.BassCatalogueReview.removed().length;
const broken=load(new Map([['bass-practice-deletion-state-v2',JSON.stringify({deleted:['runs:'+run],restored:[]})]]),true);
const initial=broken.BassCatalogueReview.removed().length;assert.throws(()=>broken.BassPracticeCatalogue.emptyDeleted());assert.equal(broken.BassCatalogueReview.removed().length,initial);assert(!broken.BassPracticeCatalogue.permanentlyRemoved('runs',run));
// Defaults are checked at the actual transport gain nodes, including an
// additional instrument, rather than only reading the displayed labels.
const env={window:{},Float32Array,Math,Object};vm.createContext(env);vm.runInContext(fs.readFileSync('ear-source/practice-loop-rc292.js','utf8'),env);
function context(){const gains=[];return {currentTime:0,gains,destination:{},createGain(){const node={gain:{value:1,setValueAtTime(value){this.value=value},setTargetAtTime(value){this.value=value},linearRampToValueAtTime(value){this.value=value},cancelScheduledValues(){}},connect(){return this},disconnect(){}};gains.push(node);return node},createBufferSource(){return {connect(){return this},start(){},stop(){},disconnect(){}}}};}
const ctx=context(),buffer={duration:4},rendered={stems:{bass:buffer,drums:buffer,chords:buffer,other:buffer},gain:1,seconds:4,beatSeconds:1};
const transport=env.window.BassPracticeLoop.start(ctx,rendered);assert.equal(ctx.gains[1].gain.value,1);for(const gain of ctx.gains.slice(2))assert.equal(gain.gain.value,.5);
transport.level('bass',.7);assert.equal(ctx.gains[1].gain.value,.7);
console.log(JSON.stringify({passed:true,emptiedItems:count,permanentAfterReload:true,siblingsPreserved:true,storageFailureAtomic:true,actualDefaultGains:[100,50,50,50]}));
