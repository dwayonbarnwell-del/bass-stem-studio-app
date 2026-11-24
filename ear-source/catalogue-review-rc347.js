/* Review musical duplicates without changing saved identities or source indices.
   Removed items stay available for individual restoration on this device. */
window.BassCatalogueReview=(()=>{
 'use strict';
 const P=window.BassPracticeCore,F=window.BassFillCore,D=window.BassPracticeCatalogue,H=window.BassAccompaniment,C=window.BassCuratedStudies;
 const removedGenres=new Set(['afrobeat','highlife','makossa']),retired=[],duplicates=[];
 const rounding=n=>Math.round(n*100000)/100000;
 function signature(plan){
  const events=values=>(values||[]).map(n=>[n.midi,rounding(n.beat),rounding(n.length)]).sort((a,b)=>a[1]-b[1]||a[0]-b[0]);
  return JSON.stringify([rounding(plan.beats),events(plan.bass),events(plan.chords)]);
 }
 const named=(kind,row)=>kind==='basslines'?row.name+' · '+row.degrees.join('–'):row[0];
 function retire(kind,id,title,reason,extra={}){retired.push({kind,id,title,reason,...extra});}
 for(const row of P.lines){
  if(row.id?.startsWith('custom-'))continue;
  const genre=H.identify(row);
  if(removedGenres.has(genre))retire('basslines',row.id,named('basslines',row),'Section removed',{genre});
  else if(genre==='reggae')retire('basslines',row.id,named('basslines',row),'Replaced by uploaded reggae',{genre});
 }
 D.retire(retired);
 const seen=new Map();
 for(const kind of ['basslines','runs','fills']){
  const list=kind==='basslines'?P.lines:kind==='runs'?P.runs:F.styles;
  const indices=list.map((_,i)=>i).sort((a,b)=>kind==='basslines'?0:C.compare(kind,a,b));
  for(const idea of indices){
   const row=list[idea],id=row.id||String(idea);
   if(retired.some(r=>r.kind===kind&&r.id===id))continue;
   const parts=kind==='basslines'?P.phrases(row.degrees).map((_,i)=>i):[0];
   for(const part of parts){
    const itemId=kind==='basslines'&&parts.length>1?id+'/'+part:id;
    const opts={idea,part,key:0,from:1,to:4,bpm:100};
    const basic=signature(P.make(kind,opts)),candidates=seen.get(basic)||[];
    let match;
    for(const prior of candidates){
     // Runs/fills must agree at every chord transition, not just 1 to 4.
     if((kind==='basslines')!==(prior.kind==='basslines'))continue;
     let same=true;
     if(kind!=='basslines')for(let from=1;from<=7&&same;from++)for(let to=1;to<=7&&same;to++)if(from!==to){
      same=signature(P.make(kind,{...opts,from,to}))===signature(P.make(prior.kind,{...prior.opts,from,to}));
     }
     if(same){match=prior;break;}
    }
    if(match){
     const entry={kind,id:itemId,title:named(kind,row)+(parts.length>1?' · part '+(part+1):''),reason:'Duplicate of '+match.title,duplicateOf:{kind:match.kind,id:match.id}};
     duplicates.push(entry);D.retire([entry]);
    }else{
     candidates.push({kind,id:itemId,title:named(kind,row),opts});seen.set(basic,candidates);
    }
   }
  }
 }
 // Earlier consolidated aliases still represent one logical item in Deleted.
 function describe(entry){
  if(entry.title)return entry;
  if(entry.kind==='basslines'){
   const [id,part]=entry.id.split('/'),row=P.lines.find(r=>r.id===id);
   if(row)return {...entry,title:named('basslines',row)+(part===undefined?'':' · part '+(Number(part)+1))};
  }
  if(entry.kind==='runs'||entry.kind==='fills'){
   const row=(entry.kind==='runs'?P.runs:F.styles).find((r,i)=>(r.id||String(i))===entry.id||r.aliasIds?.includes(entry.id));
   if(row)return {...entry,title:row[0]};
  }
  if(entry.kind==='uploaded'){
   const [id,part]=entry.id.split('/'),row=window.BassUploadedCore.find(id);
   if(row)return {...entry,title:(row.originalTitle||row.title)+(part===undefined?'':' · phrase '+(Number(part)+1))};
  }
  return {...entry,title:entry.id};
 }
 function removed(){
  const merged=new Map();
  for(const original of D.removed()){
   const entry=describe(original),rows=entry.kind==='runs'?P.runs:entry.kind==='fills'?F.styles:[];
   const row=rows.find((r,i)=>(r.id||String(i))===entry.id||r.aliasIds?.includes(entry.id));
   const id=row?.id||entry.id,key=entry.kind+':'+id;
   if(!merged.has(key))merged.set(key,{...entry,restoreItems:[]});
   merged.get(key).restoreItems.push({kind:entry.kind,id:entry.id});
  }
  return [...merged.values()].sort((a,b)=>a.kind.localeCompare(b.kind)||a.title.localeCompare(b.title));
 }
 function restore(entry){
  const items=[...entry.restoreItems],hide=[];
  for(const item of entry.restoreItems){
   const [id,part]=item.id.split('/');
   if(part!==undefined&&!D.visible(item.kind,id)){
    const count=item.kind==='uploaded'?(window.BassRecordedPhrases[id]?.length||0):item.kind==='basslines'?P.phrases(P.lines.find(r=>r.id===id)?.degrees||[]).length:0;
    if(count){for(let i=0;i<count;i++)if(String(i)!==part)hide.push({kind:item.kind,id:id+'/'+i});items.push({kind:item.kind,id});}
   }
  }
  D.restoreItems(items,hide);
  for(const item of items)if(item.kind==='uploaded')window.BassUploadedCore.restoreLegacy(item.id.split('/')[0]);
 }
 return {signature,duplicates,retired,removed,restore};
})();
