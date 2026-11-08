/* RC225. Optional, free LRCLIB timed lyric lookup. Audio is never uploaded. */
(()=>{
'use strict';
const API='https://lrclib.net/api/search';
const CLIENT='Bass Stem Studio RC225 (https://bass-stem-studio-app-z5ja.onrender.com)';
const $=id=>document.getElementById(id);
let panel,notice,results,titleInput,artistInput,searchButton,lastSession=null;
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
function prepare(){
 const info=getInfo();if(!info)return;
 if(lastSession!==info.session){
  lastSession=info.session;stopRequest();clearResults();
  const proposed=String(info.title||'').replace(/\.(mp3|wav|m4a|aac|flac|ogg|opus|mp4|mov|webm|bassstudio)$/i,'').replace(/[_]+/g,' ').trim();
  titleInput.value=proposed;
  artistInput.value=String(info.artist||'').trim();
  setNotice(info.hasAudio?'Search for timed lyrics from the version you are playing.':'Import an audio file first.');
 }
 searchButton.disabled=!info.hasAudio;
}
function showChoices(songs,sessionId,sourceDuration){
 clearResults();
 const matches=songs.filter(r=>r&&typeof r.syncedLyrics==='string'&&r.syncedLyrics.trim()&&!r.instrumental&&Number.isFinite(Number(r.duration)));
 matches.sort((a,b)=>Math.abs(Number(a.duration)-sourceDuration)-Math.abs(Number(b.duration)-sourceDuration));
 if(!matches.length){setNotice('No timed lyrics found. You can still use Detect to find words in your audio.');return;}
 for(const item of matches.slice(0,12)){
  const button=document.createElement('button');button.type='button';button.className='lrclib-result';
  const name=document.createElement('strong');name.textContent=String(item.trackName||'Untitled recording').slice(0,160);
  const details=document.createElement('small');
  const difference=Math.abs(Number(item.duration)-sourceDuration);
  const compare=difference<=Math.max(6,sourceDuration*.025)?' · close timing match':' · check recording length';
  details.textContent=[String(item.artistName||'Artist not listed').slice(0,160),stamp(item.duration)].join(' · ')+compare;
  button.append(name,details);
  button.onclick=()=>{
   const current=getInfo();
   if(!current?.hasAudio||current.session!==sessionId){setNotice('This song has changed. Search again.');clearResults();return;}
   const gap=Math.abs(Number(item.duration)-current.duration);
   if(gap>Math.max(12,current.duration*.05)&&!window.confirm('This version is a different length from your audio. Lyrics may not line up. Use it anyway?'))return;
   const parsed=parseTimed(item.syncedLyrics,current.duration);
   if(!parsed.length){setNotice('This result has no usable timed lyric lines for your audio.');return;}
   if(window.BassLyrics?.importTimedLines?.(parsed,sessionId)){
    clearResults();
    setNotice('Added '+parsed.length+' timed lyric lines. Check the words and chord positions below, then save your song project.');
   }else setNotice('No changes made. Your previous words are still saved.');
  };
  results.append(button);
 }
 results.hidden=false;
 setNotice(matches.length+' timed version'+(matches.length===1?'':'s')+' found. Choose the recording that matches your audio.');
}
async function search(){
 const info=getInfo();
 if(!info?.hasAudio){setNotice('Import an audio file first.');return;}
 if(info.live){setNotice('Stop live audio first.');return;}
 const name=titleInput.value.trim().slice(0,150),artist=artistInput.value.trim().slice(0,150);
 if(!name){setNotice('Enter a song title to search.');return;}
 if(!navigator.onLine){setNotice('Connect to the internet to find lyrics. Your saved songs still work offline.');return;}
 if(searching)return;
 const now=Date.now();
 if(now<nextAllowed){setNotice('Please try again in '+Math.ceil((nextAllowed-now)/1000)+' seconds.');return;}
 if(now-lastRequest<1800){setNotice('Please try again in a moment.');return;}
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
 const heading=document.createElement('summary');heading.textContent='Find timed lyrics (free)';
 const explanation=document.createElement('p');explanation.textContent='Choose lyrics for the recording you have imported. Lines are timed; individual word positions may differ.';
 const fields=document.createElement('div');fields.className='lrclib-fields';
 const song=document.createElement('label');song.textContent='Song title';
 titleInput=document.createElement('input');titleInput.id='lrclibTitle';titleInput.maxLength=150;titleInput.autocomplete='off';song.append(titleInput);
 const performer=document.createElement('label');performer.textContent='Artist (optional)';
 artistInput=document.createElement('input');artistInput.id='lrclibArtist';artistInput.maxLength=150;artistInput.autocomplete='off';performer.append(artistInput);
 fields.append(song,performer);
 searchButton=document.createElement('button');searchButton.type='button';searchButton.id='lrclibFind';searchButton.textContent='Find timed lyrics';
 notice=document.createElement('p');notice.className='lrclib-status';notice.id='lrclibStatus';notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
 results=document.createElement('div');results.id='lrclibResults';results.className='lrclib-results';results.hidden=true;
 const credit=document.createElement('p');credit.className='lrclib-credit';
 credit.append('Lyrics provided by ');
 const source=document.createElement('a');source.href='https://lrclib.net';source.target='_blank';source.rel='noopener noreferrer';source.textContent='LRCLIB';
 credit.append(source,'. Check the version and respect copyright.');
 panel.append(heading,explanation,fields,searchButton,notice,results,credit);
 $('lyricsStatus').after(panel);
 searchButton.addEventListener('click',()=>void search());
 open.addEventListener('click',prepare);
 $('lyricsClose').addEventListener('click',stopRequest);
 dialog.addEventListener('cancel',stopRequest);
}
window.BassLRCLIB={parseTimed};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
else install();
})();
