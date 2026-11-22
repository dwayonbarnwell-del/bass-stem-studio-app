window.BassFretFlow=(()=>{
 function create(){
 'use strict';
 const C=window.BassFretFlowCore,ns='http://www.w3.org/2000/svg';
 let api,panel,rows=[],cache={},signature='',lastBoard='',nodes={},resize;
 function svg(tag,attrs={},text){const e=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,String(v));if(text!==undefined)e.textContent=text;return e;}
 function add(parent,tag,attrs,text){const e=svg(tag,attrs,text);parent.append(e);return e;}
 function line(p,x,y,x2,y2,stroke,width=1){return add(p,'line',{x1:x,y1:y,x2,y2,stroke,'stroke-width':width});}
 function label(p,x,y,text,fill='#aeb8c9',size=12){return add(p,'text',{x,y,fill,'font-size':size,'text-anchor':'middle','dominant-baseline':'central'},text);}
 function marker(p,x,y,row,active=false,small=false){
  const c=C.colour(row.midi),open=!small&&row.position.fret===0;
  const radius=small?5:Math.max(5,Math.min(active?13:10,(nodes.mapGeometry.step-4)/2,(nodes.mapGeometry.gap-5)/2));
  const r=open?12:radius,g=add(p,'g',{'data-midi':row.midi,'data-fret':row.position.fret,'data-string':row.position.string,'data-x':x,'data-y':y,'data-radius':r,class:active?'ff-active-note':'ff-preview-note'});
  if(active){
   add(g,'circle',{cx:x,cy:y,r:r+4,fill:c,opacity:.15});
   if(panel.id==='rehearsalFret'&&!small)add(g,'circle',{class:'ff-rehearsal-ring',cx:x,cy:y,r:r+3,fill:'none',stroke:c,'stroke-width':1.5});
  }
  add(g,'circle',{cx:x,cy:y,r,fill:open?'none':active?c:'#151c26',stroke:c,'stroke-width':active?2:1.4,'stroke-dasharray':row.source.isFill||Number(row.source.confidence)<.7?'3 2':''});
  if(!small&&!open)label(g,x,y,C.name(row.midi),active?'#10231a':c,Math.min(active?14:11,r*1.2));
  add(g,'title',{},`${C.pitch(row.midi)} · string ${C.name(row.position.open)} · fret ${row.position.fret}`);
 }
 function makeNeck(count){
  const p=nodes.neck;p.replaceChildren();p.setAttribute('viewBox','0 0 110 650');p.setAttribute('preserveAspectRatio','none');
  const woodId=panel.id+'-wood',defs=add(p,'defs'),wood=add(defs,'linearGradient',{id:woodId});
  for(const[o,c]of [['0%','#28140d'],['35%','#593424'],['55%','#2b1a14'],['100%','#483024']])add(wood,'stop',{offset:o,'stop-color':c});
  add(p,'path',{d:'M 20 18 L 90 18 L 104 644 L 6 644 Z',fill:'url(#'+woodId+')',stroke:'#a5967d','stroke-width':2});
  for(let i=0;i<20;i++)line(p,20+i*3.7,20,7+i*5,644,i%3?'#b6956530':'#0a080850',.7);
  const y=f=>26+C.fretWire(f)/C.fretWire(24)*610;
  add(p,'rect',{x:18,y:21,width:74,height:8,fill:'#e0d8c8',rx:1});
  for(let f=1;f<=24;f++){const yy=y(f),w=70+26*(yy-26)/610;line(p,55-w/2,yy,55+w/2,yy,'#d8d1bd',1.7);}
  for(const f of [3,5,7,9,12,15,17,19,21,24]){const yy=26+C.fretCentre(f)/C.fretWire(24)*610;for(const x of f%12===0?[42,68]:[55])add(p,'circle',{cx:x,cy:yy,r:3.8,fill:'#e1dcca',opacity:.8});}
  const strings=C.tuning(count);strings.forEach((m,i)=>{const a=24+i*62/(count-1),b=12+i*86/(count-1);line(p,a,19,b,646,'#181716',4-i*.35);line(p,a+1,19,b+1,646,'#c3c5bc',2.5-i*.26);});
  nodes.neckNotes=add(p,'g');
 }
 function makeMap(count,first,frets){
  const p=nodes.map,w=Math.max(140,p.clientWidth),h=Math.max(120,p.clientHeight),left=30,right=w-18,top=34,step=(h-top-10)/frets,gap=(right-left)/(count-1),x=i=>left+i*gap;
  nodes.mapGeometry={x,top,step,gap,first,frets};p.replaceChildren();p.setAttribute('viewBox',`0 0 ${w} ${h}`);p.setAttribute('preserveAspectRatio','none');
  const strings=C.tuning(count);
  for(let f=0;f<=frets;f++)line(p,left-8,top+f*step,right+8,top+f*step,f===0?'#f1e3bb':'#b6a27b',f===0?3:1.4);
  for(let f=1;f<=frets;f++){const fret=first+f-1,yy=top+(f-.5)*step;label(p,11,yy,fret,'#aab6c6',11);if([3,5,7,9,12,15,17,19,21,24].includes(fret))for(const xx of fret%12===0?[w*.47,w*.73]:[w*.6])add(p,'circle',{cx:xx,cy:yy,r:3,fill:'#e9e3d5',opacity:.2});}
  strings.forEach((m,i)=>{const xx=x(i);line(p,xx,top,xx,h-10,'#d7d9d5',2.7-i*.25);add(p,'circle',{cx:xx,cy:16,r:9,fill:C.colour(m)});label(p,xx,16,C.name(m),'#17211b',11);});
  nodes.mapLinks=add(p,'g',{'aria-hidden':'true'});nodes.mapNotes=add(p,'g');
 }
 function neckPoint(row,count){const y=26+C.fretCentre(row.position.fret)/C.fretWire(24)*610,x=24+row.position.string*62/(count-1)+(y-26)/610*(-12+row.position.string*24/(count-1));return {x,y};}
 function connectors(primary,next,count){
  nodes.connector.replaceChildren();nodes.mapLinks.replaceChildren();if(!primary?.position)return;
  const geo=nodes.mapGeometry,point=n=>({x:geo.x(n.position.string),y:n.position.fret===0?16:geo.top+(n.position.fret-geo.first+.5)*geo.step});
  const onPage=n=>n?.position&&(n.position.fret===0||n.position.fret>=geo.first&&n.position.fret<geo.first+geo.frets);
  if(!onPage(primary))return;
  const colour=C.colour(primary.midi),map=point(primary),neck=neckPoint(primary,count),stage=nodes.stage.getBoundingClientRect(),nr=nodes.neck.getBoundingClientRect(),mr=nodes.map.getBoundingClientRect();
  const x1=nr.left-stage.left+neck.x/110*nr.width+5,y1=nr.top-stage.top+neck.y/650*nr.height,x2=mr.left-stage.left+map.x-16,y2=mr.top-stage.top+map.y,mid=(x1+x2)/2;
  nodes.connector.setAttribute('viewBox',`0 0 ${stage.width} ${stage.height}`);
  if(!panel.classList.contains('ff-single-board'))add(nodes.connector,'path',{d:`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`,fill:'none',stroke:colour,'stroke-width':1.5,'stroke-dasharray':'3 4',opacity:.75,'data-midi':primary.midi,class:'ff-neck-connection'});
  if(onPage(next)&&(next.position.string!==primary.position.string||next.position.fret!==primary.position.fret)){const end=point(next);line(nodes.mapLinks,map.x,map.y,end.x,end.y,colour,1.4).setAttribute('stroke-dasharray','3 4');}
 }
 function prepare(s){
  const k=cache;
  if(k.notes!==s.notes||k.count!==s.strings||k.shift!==s.transpose||k.session!==s.session){rows=C.plan(s.notes,s.strings,s.transpose);cache={notes:s.notes,count:s.strings,shift:s.transpose,session:s.session};signature='';lastBoard='';}
 }
 function draw(t){
  if(!api||panel.hidden)return;const s=api.get();prepare(s);const time=Number.isFinite(t)?t:s.time;
  const active=s.highlight===false?[]:C.active(rows,time),primary=active.at(-1),future=C.nearby(rows,time,2,3).filter(n=>!active.includes(n)).sort((a,b)=>Math.abs(a.start-time)-Math.abs(b.start-time)),focus=primary||future.find(n=>n.start>time);
  const frets=12,first=1+Math.floor(Math.max(0,(focus?.position?.fret||1)-1)/frets)*frets,key=s.strings+':'+first+':'+frets+':'+nodes.map.clientWidth+':'+nodes.map.clientHeight;
  if(lastBoard!==key){makeNeck(s.strings);makeMap(s.strings,first,frets);lastBoard=key;signature='';}
  const sign=active.map(n=>n.id).join(',')+'|'+future.map(n=>n.id).join(',')+'|'+key;
  if(sign!==signature){
   signature=sign;nodes.mapNotes.replaceChildren();nodes.neckNotes.replaceChildren();
   const geo=nodes.mapGeometry,xx=geo.x,yy=f=>f===0?16:geo.top+(f-first+.5)*geo.step,seen=new Set(),shown=[];
   // One marker per exact string/fret, with active notes taking priority.
   for(const n of [...active.slice().reverse(),...future])if(n.position){
    const p=n.position,id=p.string+':'+p.fret,isActive=active.includes(n);if(seen.has(id))continue;seen.add(id);
    if(!isActive&&shown.filter(v=>!active.includes(v)).length>=6)continue;
    shown.push(n);
   }
   for(const n of shown.slice().reverse()){const p=n.position,isActive=active.includes(n);
    if(p.fret===0||(p.fret>=first&&p.fret<first+frets))marker(nodes.mapNotes,xx(p.string),yy(p.fret),n,isActive);
    if(isActive){const point=neckPoint(n,s.strings);marker(nodes.neckNotes,point.x,point.y,n,true,true);}
   }
   connectors(primary,shown.filter(n=>n.start>time).sort((a,b)=>a.start-b.start)[0],s.strings);
   nodes.note.textContent=primary?C.pitch(primary.midi):'—';nodes.note.style.color=primary?C.colour(primary.midi):'';
   nodes.position.textContent=primary?(primary.position?`${C.name(primary.position.open)} string · ${primary.position.fret===0?'open':'fret '+primary.position.fret}`:`Outside ${s.strings}-string range`):!s.loaded?'Open an analysed song':!rows.length?'No analysed bass notes':'Rest';
   nodes.position.title=primary?.source.isFill?'Suggested fill':primary&&Number(primary.source.confidence)<.7?'Low-confidence note: check against the recording':'';
  }
  if(panel.id==='rehearsalFret'&&primary){
   const ring=nodes.mapNotes.lastElementChild?.querySelector('.ff-rehearsal-ring');
   if(ring){
    const phase=Math.min(1,Math.max(0,(time-primary.start)/.18));
    ring.style.setProperty('--ff-ring-scale',String(1+.27*phase));
    ring.style.setProperty('--ff-ring-opacity',String(1-.45*phase));
   }
  }
  nodes.song.textContent=s.title+(s.bpm?' · '+Math.round(s.bpm*s.speed/100)+' BPM':'')+' · '+s.speed+'%';

 }
 function init(hooks,host=document.getElementById('fretFlowPanel')){api=hooks;panel=host;panel.innerHTML='<div class="ff-song"></div><div class="ff-stage"><svg class="ff-connector" aria-hidden="true"></svg><div class="ff-neck-wrap"><svg class="ff-neck" role="img" aria-label="Bass neck with current note"></svg></div><div class="ff-main"><div class="ff-readout"><strong class="ff-note">—</strong><span class="ff-position"></span></div><svg class="ff-map" role="img" aria-label="FretFlow note map, low strings on the left"></svg></div></div>';
  for(const[name,cls]of Object.entries({song:'.ff-song',neck:'.ff-neck',map:'.ff-map',stage:'.ff-stage',connector:'.ff-connector',note:'.ff-note',position:'.ff-position'}))nodes[name]=panel.querySelector(cls);
  resize=new ResizeObserver(()=>{draw();});resize.observe(panel);if(panel.id==='fretFlowPanel'){resize.observe(document.querySelector('.practice-view-head'));resize.observe(document.getElementById('playBtn'));}
 }
 function invalidate(){cache={};signature='';draw();}
 return {init,draw,invalidate};
 }
 return {...create(),create,showControls:show=>window.BassPracticeControls?.showControls(show)};
})();
