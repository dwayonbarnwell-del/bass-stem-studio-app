/* RC228: saved-song worklist and LRCLIB discovery. No audio upload or paid analysis. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const STORE='bassStemNextSongsRC228',CAP=100;
const CLIENT='Bass Stem Studio RC228 (https://bass-stem-studio-app-z5ja.onrender.com)';
const SEEDS=[
 'Sinach','Nathaniel Bassey','Dunsin Oyekan','Mercy Chinwo','Joe Mettle',
 'Ada Ehi','Moses Bliss','Frank Edwards','Tim Godfrey','Eben','Judikay',
 'Victoria Orenze','Onos Ariyo','Minister GUC','Theophilus Sunday',
 'Don Moen','Ron Kenoly','CeCe Winans','Kirk Franklin','Travis Greene',
 'Tasha Cobbs Leonard','Maverick City Music','Elevation Worship','Hillsong Worship',
 'Bethel Music','Israel Houghton','William McDowell','Fred Hammond',
 'Jonathan McReynolds','Marvin Sapp','Hezekiah Walker','Matt Redman',
 'Chris Tomlin','Jesus Culture','Darlene Zschech','Planetshakers','CityAlight',
 'Sovereign Grace Music','Phil Thompson','Todd Dulaney','Zacardi Cortez',
 'Jekalyn Carr','William Murphy','Gaither Vocal Band','Casting Crowns',
 'Brandon Lake','Cory Asbury','Lauren Daigle','Hillsong UNITED',
 'worship','gospel','praise','Holy Spirit','Hallelujah','Hosanna',
 'grace','Jesus','God is good','The Lord','glory'
];
let dialog=null,featured=null,tab='pending',pending=[],suggestions=[],dismissed=new Set();
let cursor=0,visiblePending=30,visibleDiscover=30,searching=false,pausedUntil=0,requestSerial=0,networkController=null;
let loadingPending=false,pendingRefreshQueued=false,folderWarning=false,loadIssues=0,ready=false,loadToken=0,completedSaved=[],networkError='';
const normal=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function titleKey(value){
 return normal(String(value||'').replace(/\.(mp3|m4a|wav|flac|aac|ogg|mp4|bassstudio)$/i,'').split(/\s+[-–]\s+/)[0]);
}
const trackKey=s=>normal(s.title)+'|'+normal(s.artist);
function saveState(){
 try{localStorage.setItem(STORE,JSON.stringify({
  suggestions:suggestions.slice(0,280),dismissed:[...dismissed].slice(-2500),cursor,pausedUntil
 }));}catch{}
}
function restoreState(){
 try{
  const state=JSON.parse(localStorage.getItem(STORE)||'null');
  if(!state||typeof state!=='object')return;
  suggestions=(Array.isArray(state.suggestions)?state.suggestions:[]).filter(s=>s&&s.title&&s.artist).slice(0,280);
  dismissed=new Set((Array.isArray(state.dismissed)?state.dismissed:[]).filter(v=>typeof v==='string').slice(-2500));
  cursor=Math.max(0,Math.min(SEEDS.length,Number(state.cursor)||0));
  pausedUntil=Math.max(0,Number(state.pausedUntil)||0);
 }catch{}
}
function elem(tag,cl,value){
 const node=document.createElement(tag);if(cl)node.className=cl;if(value!==undefined)node.textContent=String(value);
 return node;
}
function active(){return !!dialog?.open&&tab==='discover'}
function activeSuggestions(){const done=finishedTitleSet();return suggestions.filter(s=>!dismissed.has(trackKey(s))&&!done.has(titleKey(s.title))).slice(0,CAP);}
function count(){return activeSuggestions().length}
function displayStatus(s){const n=$('btStatus');if(n)n.textContent=s;}
function finishedTitleSet(){
 const saved=completedSaved;
 return new Set(saved.flatMap(r=>[titleKey(r.title),titleKey(r.sourceName)].filter(Boolean)));
}
async function loadPending(){
 if(loadingPending){pendingRefreshQueued=true;return;}
 const token=++loadToken;loadingPending=true;displayStatus('Checking saved songs…');
 try{
  const [inLibrary,missing]=await Promise.all([
   window.BassLibrary.analysisSummary(),window.BassChordLibrary.missingProgressions()
  ]);
  if(token!==loadToken)return;
  folderWarning=inLibrary.reconnect;loadIssues=inLibrary.issues;
  const saved=inLibrary.songs||[];
  const complete=saved.filter(s=>s.hasChordAnalysis&&s.hasBassAnalysis);
  completedSaved=complete.map(s=>({title:s.title,sourceName:s.sourceName}));
  const completedNames=finishedTitleSet();
  const rows=[];
  const unfinished=saved.filter(s=>!(s.hasChordAnalysis&&s.hasBassAnalysis));
  for(const s of unfinished){
   rows.push({kind:'saved',id:s.location+':'+s.id,location:s.location,filename:s.id,
    title:s.title||s.filename,artist:s.artist||'',
    detail:!s.hasChordAnalysis&&!s.hasBassAnalysis?'Bass and chords still needed':
     !s.hasChordAnalysis?'Chords still needed':'Bass notes still needed'});
  }
  const savedNames=new Set(saved.flatMap(s=>[titleKey(s.title),titleKey(s.sourceName)].filter(Boolean)));
  const referenceCounts=new Map();
  for(const c of missing||[]){
   const k=titleKey(c.title);referenceCounts.set(k,(referenceCounts.get(k)||0)+1);
  }
  for(const c of missing||[]){
   const k=titleKey(c.title);
   if(!k||savedNames.has(k)&&!completedNames.has(k))continue;
   if(completedNames.has(k)&&referenceCounts.get(k)===1)continue;
   rows.push({kind:'chart',id:'chart:'+c.id,refId:c.id,title:c.title,artist:c.artist||'',
    detail:c.notes?'Progression missing · notes kept':'Progression missing'});
  }
  pending=rows.sort((a,b)=>a.title.localeCompare(b.title,'en'));
  visiblePending=30;
  render();
 }catch(err){displayStatus('Could not check your saved songs. Open Library to check folder access.');}
 finally{loadingPending=false;if(pendingRefreshQueued){pendingRefreshQueued=false;void loadPending();}}
}
function buildCard(item){
 const li=elem('li');
 const detail=elem('div','bt-detail'),name=elem('strong','',item.title);
 const desc=elem('small','',[item.artist,item.detail].filter(Boolean).join(' · '));
 detail.append(name,desc);
 const actions=elem('div','bt-actions');
 if(item.kind==='saved'){
  const open=elem('button','bt-primary','Open saved');
  open.onclick=async()=>{
   if(!dialog?.open)return;
   dialog.close();
   try{await window.BassLibrary.openForAnalysis(item.location,item.filename);}
   catch(e){window.alert('Could not open this saved song. Open Library to check its location.');}
  };
  actions.append(open);
 }else{
  const importAudio=elem('button','bt-primary','Import audio');
  importAudio.onclick=()=>{
   dialog.close();
   $('importBtn')?.click();
  };
  const openChart=elem('button','','Open chart');
  openChart.onclick=()=>{dialog.close();void window.BassChordLibrary.openSongById(item.refId);};
  actions.append(importAudio,openChart);
 }
 li.append(detail,actions);return li;
}
function suggestionCard(song){
 const li=elem('li'),info=elem('div','bt-detail');
 info.append(elem('strong','',song.title),elem('small','',song.artist+(song.synced?' · Timed lyrics':' · Lyrics available')));
 const actions=elem('div','bt-actions');
 const open=elem('a','bt-button','Find recording');open.href='https://www.youtube.com/results?search_query='+encodeURIComponent(song.title+' '+song.artist+' official audio');
 open.target='_blank';open.rel='noopener noreferrer';
 const hide=elem('button','bt-hide','Hide');
 hide.onclick=()=>{
  dismissed.add(trackKey(song));saveState();render();
  if(active())void fillSuggestions();
 };
 actions.append(open,hide);li.append(info,actions);return li;
}
function render(){
 if(!dialog)return;
 $('btPendingTab').setAttribute('aria-selected',String(tab==='pending'));
 $('btDiscoverTab').setAttribute('aria-selected',String(tab==='discover'));
 $('btPendingPane').hidden=tab!=='pending';$('btDiscoverPane').hidden=tab!=='discover';
 if(tab==='pending'){
  const needle=normal($('btFilter').value);
  const list=pending.filter(r=>!needle||normal([r.title,r.artist,r.detail].join(' ')).includes(needle));
  $('btCount').textContent=list.length+' to finish';
  const root=$('btPendingList');root.replaceChildren();
  for(const item of list.slice(0,visiblePending))root.append(buildCard(item));
  $('btShowPending').hidden=list.length<=visiblePending;
  $('btEmptyPending').hidden=list.length!==0;
  const alert=$('btFolderAlert');
  alert.hidden=!folderWarning&&!loadIssues;
  if(folderWarning)alert.textContent='Your saved folder needs reconnecting in Library. Those songs have not been checked.';
  else if(loadIssues)alert.textContent='Some saved files could not be read. Check Library.';
  displayStatus('');
 }else{
  const usable=activeSuggestions();
  const q=normal($('btDiscoverFilter').value);
  const filtered=usable.filter(s=>!q||normal([s.title,s.artist].join(' ')).includes(q));
  $('btDiscoverCount').textContent=usable.length+' of '+CAP+' suggestions';
  const root=$('btDiscoverList');root.replaceChildren();
  for(const song of filtered.slice(0,visibleDiscover))root.append(suggestionCard(song));
  $('btShowDiscover').hidden=filtered.length<=visibleDiscover;
  $('btDiscoverEmpty').hidden=filtered.length>0;
  $('btFindMore').disabled=searching||count()>=CAP||Date.now()<pausedUntil||cursor>=SEEDS.length;
  if(!searching)displayStatus(Date.now()<pausedUntil?'Song search is temporarily limited. Try again later.':
   !navigator.onLine?'Connect to the internet for more suggestions.':
   networkError?networkError:
   cursor>=SEEDS.length&&usable.length<CAP?'No more different matches found for these searches.':'');
 }
}
function wait(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
async function fillSuggestions(){
 if(searching||!active()||count()>=CAP||Date.now()<pausedUntil||!navigator.onLine)return;
 searching=true;const gen=++requestSerial;
 let queries=0;networkError='';
 try{
  while(active()&&gen===requestSerial&&count()<CAP&&cursor<SEEDS.length&&queries<17){
   const q=SEEDS[cursor++];queries++;saveState();
   displayStatus('Finding songs… '+count()+' of '+CAP);
   networkController=new AbortController();
   const abort=setTimeout(()=>networkController?.abort(),12000);
   let data=null;
   try{
    let response=await fetch('https://lrclib.net/api/v2/search?q='+encodeURIComponent(q),{
     headers:{Accept:'application/json','Lrclib-Client':CLIENT},signal:networkController.signal,cache:'no-store'
    });
    // The v2 endpoint is beta. Use the stable v1 search if unavailable.
    if([404,405,501].includes(response.status)){
      response=await fetch('https://lrclib.net/api/search?q='+encodeURIComponent(q),{
       headers:{Accept:'application/json','Lrclib-Client':CLIENT},signal:networkController.signal,cache:'no-store'
      });


    }
    if(response.status===429){
      const header=response.headers.get('Retry-After')||'120';
      let seconds=Number(header);
      if(!Number.isFinite(seconds))seconds=(Date.parse(header)-Date.now())/1000;
      seconds=Number.isFinite(seconds)?Math.min(3600,Math.max(10,seconds)):120;
      pausedUntil=Date.now()+seconds*1000;cursor=Math.max(0,cursor-1);saveState();
      break;
    }
    if(!response.ok){if(response.status>=500){cursor=Math.max(0,cursor-1);networkError='Song search is unavailable. Please try again later.';break;}continue;}
    data=await response.json();
   }catch(err){cursor=Math.max(0,cursor-1);networkError='Could not reach the lyrics service. Please try again.';break;}
   finally{clearTimeout(abort);networkController=null;}
   if(!Array.isArray(data)){cursor=Math.max(0,cursor-1);networkError='Unexpected song search reply. Please try again.';break;}
   const known=new Set(suggestions.map(trackKey));
   const done=finishedTitleSet();
   for(const record of data){
    const title=String(record?.trackName||'').trim().slice(0,180);
    const artist=String(record?.artistName||'').trim().slice(0,160);
    if(!title||!artist||record.instrumental)continue;
    const synced=!!(record.hasSyncedLyrics||record.syncedLyrics);
    const plain=!!(record.hasPlainLyrics||record.plainLyrics);
    if(!synced&&!plain)continue;
    const item={id:Number(record.id)||0,title,artist,synced};
    const key=trackKey(item);
    if(known.has(key)||dismissed.has(key)||done.has(titleKey(title)))continue;
    known.add(key);suggestions.push(item);
   }
   // Preserve a small reserve for future removals; never download audio/lyrics here.
   suggestions=suggestions.slice(-280);
   saveState();render();
   await wait(600);
  }
 }finally{
  if(gen===requestSerial){searching=false;networkController=null;saveState();render();}
 }
}
function setTab(name){
 tab=name;render();
 if(tab==='pending')void loadPending();
 else void fillSuggestions();
}
function setup(){
 if(dialog)return;
 dialog=elem('dialog');dialog.id='bassTasksDialog';dialog.setAttribute('aria-labelledby','btTitle');
 const head=elem('div','bt-head'),heading=elem('h2','','To import & analyse');heading.id='btTitle';
 const close=elem('button','','Close');close.type='button';close.onclick=()=>dialog.close();head.append(heading,close);
 const tabs=elem('div','bt-tabs'),pendingBtn=elem('button','','To analyse'),discoverBtn=elem('button','','Explore 100 songs');
 pendingBtn.id='btPendingTab';discoverBtn.id='btDiscoverTab';
 pendingBtn.setAttribute('role','tab');discoverBtn.setAttribute('role','tab');
 tabs.setAttribute('role','tablist');tabs.append(pendingBtn,discoverBtn);
 const pendingPane=elem('section');pendingPane.id='btPendingPane';
 const instructions=elem('p','','Analyse and save each song once. Completed songs leave this list.');
 const control=elem('div','bt-controls'),filter=elem('input');filter.id='btFilter';filter.placeholder='Search songs';filter.type='search';filter.autocomplete='off';
 const refresh=elem('button','','Refresh list');refresh.type='button';refresh.onclick=()=>void loadPending();
 control.append(filter,refresh);
 const countBox=elem('p');countBox.id='btCount';
 const alert=elem('p','bt-muted');alert.id='btFolderAlert';alert.hidden=true;
 const list=elem('ul','bt-list');list.id='btPendingList';
 const empty=elem('p','','No unfinished songs found in the library checked.');empty.id='btEmptyPending';empty.hidden=true;
 const morePending=elem('button','','Show more');morePending.id='btShowPending';
 pendingPane.append(instructions,control,countBox,alert,list,empty,morePending);
 const explorePane=elem('section');explorePane.id='btDiscoverPane';explorePane.hidden=true;
 const explain=elem('p','','Explore songs with lyrics on LRCLIB. Find recordings separately. This is not a ranked chart.');
 const controls=elem('div','bt-controls'),exploreFilter=elem('input');exploreFilter.type='search';exploreFilter.id='btDiscoverFilter';exploreFilter.placeholder='Search suggestions';exploreFilter.autocomplete='off';
 const refill=elem('button','','Find more');refill.id='btFindMore';refill.type='button';
 controls.append(exploreFilter,refill);
 const nextCount=elem('p');nextCount.id='btDiscoverCount';
 const nextList=elem('ul','bt-list');nextList.id='btDiscoverList';
 const emptyNext=elem('p','','No suggestions available yet.');emptyNext.id='btDiscoverEmpty';
 const moreNext=elem('button','','Show more');moreNext.id='btShowDiscover';
 explorePane.append(explain,controls,nextCount,nextList,emptyNext,moreNext);
 const status=elem('p','bt-muted');status.id='btStatus';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 dialog.append(head,tabs,pendingPane,explorePane,status);
 document.body.append(dialog);
 pendingBtn.onclick=()=>setTab('pending');discoverBtn.onclick=()=>setTab('discover');
 filter.oninput=()=>{visiblePending=30;render();};
 exploreFilter.oninput=()=>{visibleDiscover=30;render();};
 morePending.onclick=()=>{visiblePending+=30;render();};
 moreNext.onclick=()=>{visibleDiscover+=30;render();};
 refill.onclick=()=>void fillSuggestions();
 dialog.addEventListener('close',()=>{
  if(networkController){requestSerial++;networkController.abort();networkController=null;searching=false;}
 });
 dialog.addEventListener('cancel',()=>{});
}
function open(){
 setup();if(!dialog.open)dialog.showModal();
 tab='pending';render();void loadPending();
}
function install(){
 const host=$('moreTools'),tools=$('extraTools'),chords=$('openSongChords'),lyrics=$('openLyrics');
 if(!host||!tools||!chords||!lyrics||$('openToAnalyse'))return;
 featured=elem('div','bs-featured-tools');
 featured.setAttribute('aria-label','Featured music tools');
 const button=elem('button','','To analyse');button.id='openToAnalyse';button.type='button';button.onclick=open;
 featured.append(chords,lyrics,button);
 host.insertBefore(featured,tools);
 // Seven remaining tools, arranged in three balanced rows (2 + 2 + 3).
 // Move existing buttons; never clone or replace their event handlers.
 const remaining=Array.from(tools.children).filter(el=>el.tagName==='BUTTON');
 const otherNodes=Array.from(tools.children).filter(el=>el.tagName!=='BUTTON');
 if(remaining.length===7){
  const sizes=[2,2,3],rows=[];let pos=0;
  for(const size of sizes){
   const row=elem('div','bs-other-row');
   for(const button of remaining.slice(pos,pos+size))row.append(button);
   rows.push(row);pos+=size;
  }
  tools.replaceChildren(...rows,...otherNodes);
 }
 restoreState();
 window.addEventListener('bass-stem:project-saved',()=>{if(dialog?.open)void loadPending();});
 window.addEventListener('bass-stem:chord-reference-changed',()=>{if(dialog?.open)void loadPending();});
}
window.BassSongTasks={open,getPending:()=>pending.map(r=>({...r})),getDiscoverCount:()=>count()};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
else install();
})();
