/* On-device, read-only analysis catalogue. Audio never enters this database. */
window.BassLibraryFills=(()=>{
 'use strict';
 const T=window.BassTransitionCore,$=id=>document.getElementById(id);
 let api,catalogue={songs:[]},favourites=new Set(),page=0,busy=false,cancelled=false,loaded=false,dbPromise;
 const time=t=>Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0');
 function database(){return dbPromise??=new Promise((resolve,reject)=>{const r=indexedDB.open('bass-transition-library-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('catalogue');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
 async function storage(value){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('catalogue',value?'readwrite':'readonly'),s=tx.objectStore('catalogue'),r=value?s.put(value,'saved'):s.get('saved');tx.oncomplete=()=>resolve(r.result);tx.onerror=tx.onabort=()=>reject(tx.error);});}
 function message(s){$('myFillStatus').textContent=s;}
 function render(){
  const query=$('myFillSearch').value.toLowerCase().trim(),from=$('myFillFrom').value,to=$('myFillTo').value,only=$('myFillFavourites').getAttribute('aria-pressed')==='true';
  const all=catalogue.songs.flatMap(s=>s.items||[]),items=all.filter(r=>(!from||r.from===from)&&(!to||r.to===to)&&(!only||favourites.has(r.id))&&(!query||[r.title,r.key,r.section,r.fromChord,r.toChord].join(' ').toLowerCase().includes(query)));
  page=Math.min(page,Math.max(0,Math.ceil(items.length/8)-1));$('myFillResults').replaceChildren();
  $('myFillCount').textContent=items.length+' fills · '+catalogue.songs.length+' songs';
  for(const r of items.slice(page*8,page*8+8)){
   const card=document.createElement('article'),title=document.createElement('h3'),detail=document.createElement('p'),actions=document.createElement('div');card.className='my-fill-card';actions.className='my-fill-actions';
   title.textContent=r.from+' → '+r.to+' · '+r.title;detail.textContent=time(r.change)+' · '+r.fromChord+' → '+r.toChord+' · '+r.key+(r.section?' · '+r.section:'')+(r.modulates?' · Key change':'')+(r.check?' · Check notes':'');
   const play=document.createElement('button');play.type='button';play.textContent='Practise';play.onclick=()=>api.select(r);
   const fav=document.createElement('button');fav.type='button';fav.textContent=favourites.has(r.id)?'Saved':'Save';fav.setAttribute('aria-pressed',String(favourites.has(r.id)));fav.setAttribute('aria-label','Save fill from '+r.title+' at '+time(r.change));fav.onclick=()=>{if(favourites.has(r.id))favourites.delete(r.id);else favourites.add(r.id);try{localStorage.setItem('bass-fill-favourites-v1',JSON.stringify([...favourites]));}catch{message('Favourite could not be saved');}render();};
   actions.append(play,fav);card.append(title,detail,actions);$('myFillResults').append(card);
  }
  if(!items.length){const p=document.createElement('p');p.textContent=all.length?'No matching fills.':'Scan your saved songs to find moving bass notes around chord changes.';$('myFillResults').append(p);}
  $('myFillPage').textContent=(items.length?page+1:0)+' / '+Math.ceil(items.length/8);$('myFillPrev').disabled=page===0;$('myFillNext').disabled=(page+1)*8>=items.length;
  $('myFillScan').textContent=busy?'Stop scan':'Scan library';
 }
 async function scan(){
  if(busy){cancelled=true;message('Stopping scan');return;}
  busy=true;cancelled=false;render();message('Checking saved songs');
  try{
   const list=await window.BassLibrary.practiceProjects(),old=new Map(catalogue.songs.map(s=>[s.id,s])),songs=[];let missing=0,failed=0,index=0;
   const issues=[];
   for(const meta of list.songs){
    if(cancelled)break;message('Scanning '+(++index)+' / '+list.songs.length);
    const saved=old.get(meta.id);
    if(saved?.stamp===meta.stamp&&saved.version===1){songs.push(saved);if(!saved.items.length)missing++;continue;}
    try{const p=await window.BassLibrary.practiceProject(meta.id),result=T.extract(p,meta);songs.push({...meta,version:1,...result});if(!result.items.length)missing++;}
    catch(e){failed++;issues.push(meta.title+': '+(e.message||'Could not read song'));if(saved)songs.push(saved);}
    // Release each parsed audio project before continuing and allow cancellation.
    await new Promise(resolve=>setTimeout(resolve,0));
   }
   if(cancelled){message('Scan stopped. Previous results kept.');return;}
   // A disconnected folder is incomplete evidence: retain its previous entries.
   if(list.reconnect){const seen=new Set(songs.map(s=>s.id));for(const saved of catalogue.songs)if(!seen.has(saved.id))songs.push(saved);}
   catalogue={songs,scannedAt:Date.now()};page=0;let persisted=true;try{await storage(catalogue);}catch{persisted=false;}
   message('Found '+songs.reduce((n,s)=>n+s.items.length,0)+' fills. '+missing+' songs without usable fills.'+(failed?' '+failed+' could not be read.':'')+(list.reconnect?' Reconnect your folder for the remaining songs.':'')+(!persisted?' Results could not be saved.':''));
   $('myFillIssues').textContent=issues.join('\n');$('myFillIssues').parentElement.hidden=!issues.length;render();
  }catch(e){message(e.message||'Could not scan library');}
  finally{busy=false;render();}
 }
 async function show(){if(!loaded){loaded=true;try{catalogue=await storage()||{songs:[]};}catch{message('Saved catalogue unavailable');}try{favourites=new Set(JSON.parse(localStorage.getItem('bass-fill-favourites-v1')||'[]'));}catch{}render();if(!catalogue.songs.length)void scan();}}
 function init(panel,hooks){
  api=hooks;panel.innerHTML=`<p>Find fills in the saved analysis on this device. No new audio analysis.</p><div class="my-fill-actions"><button id="myFillScan" type="button">Scan library</button><button id="myFillFavourites" type="button" aria-pressed="false">Favourites</button></div><div class="fill-settings"><select id="myFillFrom" aria-label="Filter starting degree"><option value="">From: all</option></select><select id="myFillTo" aria-label="Filter target degree"><option value="">To: all</option></select></div><input id="myFillSearch" type="search" placeholder="Song, key or section" aria-label="Search saved fills"><p id="myFillStatus" role="status"></p><p id="myFillCount"></p><div id="myFillResults"></div><div class="my-fill-pages"><button id="myFillPrev" type="button">Previous</button><span id="myFillPage"></span><button id="myFillNext" type="button">Next</button></div><details hidden><summary>Scan details</summary><p id="myFillIssues"></p></details>`;
  for(const id of ['myFillFrom','myFillTo'])for(const d of ['1','♭2','2','♭3','3','4','♯4','♭5','5','♭6','6','♭7','7','?']){const o=document.createElement('option');o.value=d;o.textContent=d==='?'?'Unknown':d;$(id).append(o);}
  $('myFillScan').onclick=()=>void scan();$('myFillFavourites').onclick=()=>{$('myFillFavourites').setAttribute('aria-pressed',String($('myFillFavourites').getAttribute('aria-pressed')!=='true'));page=0;render();};
  for(const id of ['myFillFrom','myFillTo'])$(id).onchange=()=>{page=0;render();};$('myFillSearch').oninput=()=>{page=0;render();};$('myFillPrev').onclick=()=>{page--;render();};$('myFillNext').onclick=()=>{page++;render();};
  render();
 }
 return {init,show,cancel:()=>{cancelled=true;},time};
})();
