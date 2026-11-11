/* RC225. Optional, free LRCLIB timed lyric lookup. Audio is never uploaded. */
(()=>{
'use strict';
const API='https://lrclib.net/api/search';
const CLIENT='Bass Stem Studio RC225 (https://bass-stem-studio-app-z5ja.onrender.com)';
const $=id=>document.getElementById(id);
let panel,notice,results,titleInput,artistInput,searchButton,lastSession=null;
let browsing=false,selection=null,linkBusy=false,selectionToken=0,preview,loadButton,loadedButton;
let requestId=0,lastRequest=0,nextAllowed=0,controller=null,searching=false;
const getInfo=()=>window.BassLyrics?.songInfo?.()||null;
const stamp=n=>{
 const seconds=Math.max(0,Math.round(Number(n)||0));
 return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
};
function parseTimed(lrc,duration){
 if(typeof lrc!=='string'||!lrc.trim()||!Number.isFinite(duration)||duration<=0)return [];
 const match=lrc.match(/^\[offset:\s*([+-]?\d+)\s*\]/im);
 const offset=match?Math.max(-60,Math.min(60,Number(match[1])/1000)):0;
 const tags=/\[(\d{1,3}):([0-5]\d)(?:\.(\d{1,3}))?\]/g;
 const events=[];
 for(const raw of lrc.split(/\r?\n/).slice(0,2000)){
  const times=[...raw.matchAll(tags)];
  if(!times.length)continue;
  const text=raw.replace(tags,'').trim().slice(0,120);
  for(const t of times){
   const fraction=t[3]?Number(t[3])/Math.pow(10,t[3].length):0;
   const start=Number(t[1])*60+Number(t[2])+fraction+offset;
   if(Number.isFinite(start)&&start>=0&&start<duration)events.push({start,text});
  }
 }
 events.sort((a,b)=>a.start-b.start);
 const rows=[];
 for(let i=0;i<events.length;i++){
  const e=events[i];
  if(!e.text)continue;
  let next=duration;
  for(let j=i+1;j<events.length;j++)if(events[j].start>e.start+.015){next=events[j].start;break;}
  const end=Math.min(duration,e.start+10,next);
  if(end>e.start+.015&&!rows.some(r=>Math.abs(r.start-e.start)<.015&&r.text===e.text))
   rows.push({text:e.text,start:e.start,end});
  if(rows.length>=2500)break;
 }
 return rows;
}
function setNotice(message){if(notice)notice.textContent=message;}
function clearResults(){if(results){results.replaceChildren();results.hidden=true;}}
function stopRequest(){
 requestId++;
 controller?.abort();controller=null;
 searching=false;
 if(searchButton)searchButton.disabled=false;
}
const normal=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function titleKeys(value,artist=''){
 const name=String(value||'').replace(/\.(?:bassstudio|bssproject|json|mp3|m4a|wav|aac|flac|ogg|opus|mp4|mov|webm)$/i,'')
  .replace(/\s*[([](?:official[^)\]]*|lyrics?|audio|video)[)\]]/gi,'');
 const performer=normal(artist);
 return [name,...name.split(/\s*[:|–—]\s*|\s+-\s*|\s*-\s+/)].map(normal).map(k=>{
  if(performer&&k.startsWith(performer+' '))k=k.slice(performer.length+1);
  if(performer&&k.endsWith(' '+performer))k=k.slice(0,-performer.length-1);
  return k;
 }).filter(k=>k&&k!==performer);
}
function sameTitle(record,audio){
 const wanted=titleKeys(record.trackName,record.artistName);
 const actual=[audio.title,audio.sourceName,audio.filename].flatMap(v=>titleKeys(v,audio.artist));
 return wanted.some(k=>actual.includes(k));
}
function matchingRecording(record,audio){
 if(!sameTitle(record,audio))return false;
 if(record.artistName&&audio.artist&&normal(record.artistName)!==normal(audio.artist))return false;
 const length=Number(record.duration),duration=Number(audio.duration);
 return length>0&&duration>0&&Math.abs(length-duration)<=Math.max(6,length*.025);
}
function updateView(){
 const dialog=$('lyricsDialog');if(!dialog)return;
 dialog.classList.toggle('lyrics-browsing',browsing);
 const info=getInfo();
 if(loadedButton)loadedButton.hidden=!browsing||!info?.hasAudio;
 if(loadButton){loadButton.hidden=!selection;loadButton.disabled=linkBusy;}
 window.BassLyrics?.refreshControls?.();
}
function showPreview(item){
 selection=item;browsing=true;selectionToken++;window.BassLyrics.cancel();window.BassLyrics.pause();
 preview.replaceChildren();
 const name=document.createElement('h3');name.textContent=item.trackName+' · '+item.artistName;preview.append(name);
 for(const line of parseTimed(item.syncedLyrics,Number(item.duration))){
  const p=document.createElement('p');p.textContent=line.text;preview.append(p);
 }
 preview.hidden=false;updateView();setNotice('Matching audio needed');
}
function resetPreview(){
 browsing=false;selection=null;selectionToken++;if(preview){preview.replaceChildren();preview.hidden=true;}updateView();
}
function prepare(){
 const info=getInfo();if(!info)return;
 if(lastSession!==info.session){
  lastSession=info.session;stopRequest();clearResults();resetPreview();
  const proposed=String(info.title||'').replace(/\.(mp3|wav|m4a|aac|flac|ogg|opus|mp4|mov|webm|bassstudio)$/i,'').replace(/[_]+/g,' ').trim();
  titleInput.value=proposed.split(/\s+[-–]\s*/)[0].trim()||proposed;
  artistInput.value=String(info.artist||'').trim();
 }
 searchButton.disabled=false;updateView();
 setNotice(info.hasAudio?'Loaded: '+info.title:'Find a song');
}
async function bindAndPlay(item,token){
 const current=getInfo();
 if(token!==selectionToken||!current?.hasAudio||!matchingRecording(item,current))return false;
 const lines=parseTimed(item.syncedLyrics,current.duration);
 if(!lines.length||!window.BassLyrics.importTimedLines(lines,current.session)){setNotice('Playback cancelled');return false;}
 if(token!==selectionToken||getInfo()?.session!==current.session)return false;
 resetPreview();clearResults();lastSession=current.session;
 setNotice('Playing matching audio');window.BassLyrics.play(current.session);return true;
}
async function playSelection(){
 if(linkBusy||!selection)return;
 const item=selection,token=selectionToken,initial=getInfo()?.session;
 linkBusy=true;updateView();window.BassLyrics.pause();
 try{
  if(matchingRecording(item,getInfo()||{})){await bindAndPlay(item,token);return;}
  setNotice('Checking saved audio');
  const library=await window.BassLibrary.analysisSummary();
  if(token!==selectionToken||getInfo()?.session!==initial)return;
  const candidates=(library.songs||[]).filter(song=>matchingRecording(item,song));
  // Never guess between recordings with the same title and similar duration.
  if(candidates.length===1){
   if(await window.BassLibrary.openForAnalysis(candidates[0].location,candidates[0].id)){
    if(await bindAndPlay(item,token))return;
   }
  }
  setNotice(candidates.length>1?'Choose matching audio':library.reconnect?'Reconnect library folder':'Load matching audio');
 }catch{setNotice('Load matching audio');}
 finally{linkBusy=false;updateView();}
}
function pickAudio(){
 if(linkBusy||!selection)return;
 const item=selection,token=selectionToken;
 const input=document.createElement('input');input.type='file';input.accept='audio/*,video/*';input.hidden=true;
 input.oncancel=()=>input.remove();
 input.onchange=async()=>{
  const file=input.files?.[0];input.remove();if(!file||token!==selectionToken)return;
  if(!sameTitle(item,{title:file.name})){setNotice('Song name differs');return;}
  linkBusy=true;updateView();window.BassLyrics.pause();
  try{
   if(await window.BassLyrics.loadAudio(file)){
    if(token!==selectionToken)return;
    if(!matchingRecording(item,getInfo()||{})){setNotice('Recording length differs');return;}
    await bindAndPlay(item,token);
   }
  }catch{setNotice('Could not load');}
  finally{linkBusy=false;updateView();}
 };
 document.body.append(input);input.click();
}
function showChoices(songs,sessionId,sourceDuration){
 clearResults();
 const matches=songs.filter(r=>r&&typeof r.syncedLyrics==='string'&&r.syncedLyrics.trim()&&!r.instrumental&&Number.isFinite(Number(r.duration)));
 matches.sort((a,b)=>Math.abs(Number(a.duration)-sourceDuration)-Math.abs(Number(b.duration)-sourceDuration));
 if(!matches.length){setNotice('No lyrics found');return;}
 for(const item of matches.slice(0,12)){
  const button=document.createElement('button');button.type='button';button.className='lrclib-result';
  const name=document.createElement('strong');name.textContent=String(item.trackName||'Untitled recording').slice(0,160);
  const details=document.createElement('small');
  const difference=Math.abs(Number(item.duration)-sourceDuration);
  const compare=difference<=Math.max(6,sourceDuration*.025)?' · close timing match':' · check recording length';
  details.textContent=[String(item.artistName||'Artist not listed').slice(0,160),stamp(item.duration)].join(' · ')+compare;
  button.append(name,details);
  button.onclick=()=>{showPreview(item);clearResults();};
  results.append(button);
 }
 results.hidden=false;
 setNotice(matches.length+' timed version'+(matches.length===1?'':'s')+' found. Choose the recording that matches your audio.');
}
async function search(){
 const info=getInfo();
 if(info.live){setNotice('Stop live audio first.');return;}
 const name=titleInput.value.trim().slice(0,150),artist=artistInput.value.trim().slice(0,150);
 if(!name){setNotice('Enter a song title to search.');return;}
 if(!navigator.onLine){setNotice('Connect to the internet to find lyrics. Your saved songs still work offline.');return;}
 if(searching)return;
 const now=Date.now();
 if(now<nextAllowed){setNotice('Please try again in '+Math.ceil((nextAllowed-now)/1000)+' seconds.');return;}
 if(now-lastRequest<1800){setNotice('Please try again in a moment.');return;}
 window.BassLyrics.pause();browsing=true;selection=null;selectionToken++;preview.hidden=true;updateView();
 const token=++requestId,sessionId=info.session;
 lastRequest=now;searching=true;searchButton.disabled=true;clearResults();setNotice('Searching timed lyrics…');
 controller=new AbortController();
 const limit=setTimeout(()=>controller?.abort(),14000);
 try{
  const url=new URL(API);url.searchParams.set('track_name',name);
  if(artist)url.searchParams.set('artist_name',artist);
  const response=await fetch(url.toString(),{
   method:'GET',headers:{Accept:'application/json','Lrclib-Client':CLIENT},signal:controller.signal,cache:'no-store'
  });
  if(token!==requestId||getInfo()?.session!==sessionId)return;
  if(response.status===429){
   const header=response.headers.get('Retry-After')||'60';
   let delay=Number(header);
   if(!Number.isFinite(delay))delay=(Date.parse(header)-Date.now())/1000;
   delay=Number.isFinite(delay)?Math.min(3600,Math.max(2,delay)):60;
   nextAllowed=Date.now()+delay*1000;
   setNotice('Lyrics service is busy. Try again in '+Math.ceil(delay)+' seconds.');return;
  }
  if(!response.ok)throw Error('lookup unavailable');
  const songs=await response.json();
  if(token===requestId&&getInfo()?.session===sessionId){
   if(!Array.isArray(songs))throw Error('unexpected reply');
   showChoices(songs,sessionId,info.duration);
  }
 }catch(e){
  if(token===requestId)setNotice(e?.name==='AbortError'?'Search timed out. Try again.':'Lyrics service unavailable. Your saved song is unchanged.');
 }finally{
  clearTimeout(limit);
  if(token===requestId){searching=false;searchButton.disabled=false;controller=null;}
 }
}
function install(){
 if(!window.BassLyrics?.importTimedLines||!window.BassLyrics?.songInfo)return;
 const dialog=$('lyricsDialog'),open=$('openLyrics');
 if(!dialog||!open||$('lrclibPanel'))return;
 panel=document.createElement('details');panel.id='lrclibPanel';panel.className='lrclib-panel';
 const heading=document.createElement('summary');heading.textContent='Find song lyrics';
 const explanation=document.createElement('p');explanation.textContent='Play uses a matching recording from your library or an audio file you load. Lyrics search does not supply audio.';
 const fields=document.createElement('div');fields.className='lrclib-fields';
 const song=document.createElement('label');song.textContent='Song title';
 titleInput=document.createElement('input');titleInput.id='lrclibTitle';titleInput.maxLength=150;titleInput.autocomplete='off';song.append(titleInput);
 const performer=document.createElement('label');performer.textContent='Artist (optional)';
 artistInput=document.createElement('input');artistInput.id='lrclibArtist';artistInput.maxLength=150;artistInput.autocomplete='off';performer.append(artistInput);
 fields.append(song,performer);
 searchButton=document.createElement('button');searchButton.type='button';searchButton.id='lrclibFind';searchButton.textContent='Find lyrics';
 notice=document.createElement('p');notice.className='lrclib-status';notice.id='lrclibStatus';notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
 results=document.createElement('div');results.id='lrclibResults';results.className='lrclib-results';results.hidden=true;
 const credit=document.createElement('p');credit.className='lrclib-credit';
 credit.append('Lyrics provided by ');
 const source=document.createElement('a');source.href='https://lrclib.net';source.target='_blank';source.rel='noopener noreferrer';source.textContent='LRCLIB';
 credit.append(source,'. Choose the same recording for matching timings.');
 preview=document.createElement('div');preview.id='lyricsSearchPreview';preview.hidden=true;
 loadButton=document.createElement('button');loadButton.type='button';loadButton.textContent='Load audio';loadButton.hidden=true;loadButton.onclick=pickAudio;
 loadedButton=document.createElement('button');loadedButton.type='button';loadedButton.textContent='Loaded song';loadedButton.hidden=true;
 loadedButton.onclick=()=>{resetPreview();clearResults();setNotice('Loaded: '+(getInfo()?.title||''));};
 panel.append(heading,explanation,fields,searchButton,notice,results,loadButton,loadedButton,credit);
 $('lyricsWords').before(preview);
 const editing=()=>{stopRequest();browsing=true;selection=null;selectionToken++;preview.hidden=true;clearResults();window.BassLyrics.pause();updateView();setNotice('Choose a song');};
 titleInput.addEventListener('input',editing);artistInput.addEventListener('input',editing);
 $('lyricsPlay').addEventListener('click',event=>{
  if(!browsing)return;
  event.preventDefault();event.stopImmediatePropagation();void playSelection();
 },true);
 dialog.addEventListener('close',()=>{stopRequest();selectionToken++;});
 ($('lyricsSticky')||$('lyricsStatus')).after(panel);
 searchButton.addEventListener('click',()=>void search());
 open.addEventListener('click',prepare);
 $('lyricsClose').addEventListener('click',stopRequest);
 dialog.addEventListener('cancel',stopRequest);
}
window.BassLRCLIB={parseTimed,isBrowsing:()=>browsing,hasSelection:()=>!!selection&&!linkBusy};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
else install();
})();
