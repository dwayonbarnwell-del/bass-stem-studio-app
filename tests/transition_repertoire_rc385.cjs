const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx=vm.createContext({window:{},localStorage:{getItem:()=>null}});
for(const [,file] of fs.readFileSync('index.html','utf8').matchAll(/src="\.\/ear-source\/([^"?]+)\?[^"]+"/g)){
 vm.runInContext(fs.readFileSync('ear-source/'+file,'utf8'),ctx,{filename:file});
 if(file==='practice-series-rc373.js')break;
}
const {BassPracticeCore:P,BassPracticeSeries:S,BassStudyGroups:G,BassAccompaniment:H,BassFillCore:F,BassPracticeCatalogue:D}=ctx.window;
const additions=[],old=[],counts={},drums=new Set();
const contour=notes=>notes.map(n=>n.midi-notes[0].midi).join(',');
const rows={basslines:P.lines,runs:P.runs,fills:F.styles};
for(const [kind,items] of Object.entries(rows))for(const [idea,row] of items.entries()){
 if(!D.visible(kind,row.id)||kind!=='basslines'&&!G.visible(kind,idea))continue;
 if(row.id?.startsWith('transition385-')){
  const genre=kind==='basslines'?H.category(row):G.groupOf(kind,idea);
  const group=genre+'/'+kind;
  counts[group]??=[];counts[group].push(S.label(kind,idea,0));
  additions.push({kind,idea,id:row.id});
 }else{
  for(let part=0;part<(kind==='basslines'?P.phrases(row.degrees).length:1);part++){
   old.push({kind,idea,part});
  }
 }
}
assert.equal(additions.length,240);assert.equal(Object.keys(counts).length,12);
for(const labels of Object.values(counts))assert.deepEqual(labels,Array.from({length:20},(_,i)=>'Practice '+(21+i)));
for(let from=1;from<=7;from++)for(let to=1;to<=7;to++){
 if(from===to)continue;
 const seen=new Map();
 const key=(from+to)%12;
 const existing=new Set(old.map(row=>contour(P.make(row.kind,{...row,key,from,to,bpm:90}).bass)));
 for(const {kind,idea,id} of additions){
  if(kind!=='basslines')assert(G.supports(kind,idea,from,to),id);
  const plan=P.make(kind,{idea,from,to,key,bpm:90}),notes=plan.bass;
  const actual=H.resolve(plan).loop;
  assert.equal(actual.id,plan.seriesDrum,id);drums.add(actual.id);
  assert.match(actual.id,/^(owner|correct|supplied)-/);
  assert(notes.every((n,i)=>Number.isFinite(n.midi)&&n.midi>=23&&n.midi<=59&&n.velocity>0&&n.length>0&&n.beat+n.length<=(notes[i+1]?.beat??plan.beats)+.0001),id);
  const target=kind==='basslines'?plan.degrees:[from,to];
  for(const [bar,degree] of target.entries()){
   const root=notes.find(n=>n.beat===bar*4);assert.equal(root.midi%12,(plan.key+F.scales.major[degree-1])%12,id);
  }
  const signature=contour(notes);
  assert(!seen.has(signature),id+' repeats '+seen.get(signature)+' in '+from+' to '+to);seen.set(signature,id);
  assert(!existing.has(signature),id+' repeats an earlier melody for '+from+' to '+to);
 }
}
console.log(additions.length+' distinct studies, 12 menus, 42 chord pairs, '+drums.size+' supplied drum takes.');
