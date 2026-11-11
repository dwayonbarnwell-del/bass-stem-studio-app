window.BassLyrics=(()=>{
 let api,words=[],session=-1,worker=null,workerURL='',busy=false,run=0,pendingReject=null,timeout=null,selected=-1,highlight=-1,lastChordSignature='';
 const $=id=>document.getElementById(id);
 function clean(items,duration=Infinity){return (Array.isArray(items)?items:[]).slice(0,30000).filter(w=>w&&typeof w.text==='string'&&typeof w.start==='number'&&typeof w.end==='number'&&Number.isFinite(w.start)&&Number.isFinite(w.end)&&w.start>=0&&w.end>w.start&&w.start<duration).map(w=>({text:w.text.trim().slice(0,120),start:w.start,end:Math.min(duration,w.end),...(typeof w.chord==='string'?{chord:w.chord.slice(0,24)}:{})})).filter(w=>w.text).sort((a,b)=>a.start-b.start);}
 function assign(words,chords){
  const out=words.map(w=>({...w,autoChord:''}));
  for(const c of chords||[]){
   if(!c||!Number.isFinite(c.start)||!Number.isFinite(c.end)||c.end<=c.start||!c.label||c.label==='—')continue;
   let idx=out.findIndex(w=>w.start<=c.start&&w.end>c.start);
   if(idx<0)idx=out.findIndex(w=>w.start>=c.start&&w.start<c.end&&w.start-c.start<=1);
   if(idx>=0){const v=String(c.label).slice(0,24)+(c.uncertain&&!String(c.label).includes('?')?' ?':'');if(!out[idx].autoChord.split(' / ').includes(v))out[idx].autoChord+=(out[idx].autoChord?' / ':'')+v;}
  }
  return out;
 }
 function current(){const s=api.get();if(session!==s.session){cancel();session=s.session;words=[];selected=-1;}return s;}
 function status(text){$('lyricsStatus').textContent=text;}
 function chordKey(chords){return (chords||[]).map(c=>String(c.start)+':'+String(c.end)+':'+String(c.label)).join('|');}
 function controls(){
  const s=api.get(),chords=Array.isArray(s.chords)?s.chords:[];
  $('lyricsDetect').disabled=busy||!s.buffer;
  $('lyricsPlay').disabled=window.BassLRCLIB?.isBrowsing?.()?!window.BassLRCLIB.hasSelection():!s.buffer;
  $('lyricsPause').disabled=!s.buffer;
  $('lyricsCancel').disabled=!busy;
  $('lyricsExport').disabled=!words.length;
  $('lyricsApply').disabled=busy||selected<0;
  const summary=$('lyricsChordSummary'),action=$('lyricsChordAction');
  if(summary)summary.textContent=!s.buffer?'':chords.length?'Chords found. They appear above the words.':'No chords yet. Analyse the song to show them.';
  if(action){action.hidden=!s.buffer||!!chords.length;action.disabled=busy;}
 }
 function cancel(){run++;busy=false;clearTimeout(timeout);worker?.terminate();worker=null;if(workerURL)URL.revokeObjectURL(workerURL);workerURL='';pendingReject?.(new Error('cancelled'));pendingReject=null;if(api)controls();}
 function render(){
  const s=current(),area=$('lyricsWords');area.replaceChildren();highlight=-1;
  lastChordSignature=chordKey(s.chords);
  const aligned=assign(words,s.chords);
  let line=null,last=null,lineSize=0;
  aligned.forEach((w,i)=>{
   const wholeLine=w.text.split(/\s+/).filter(Boolean).length>=4;
   const gap=last&&w.start-last.end>1.35;
   if(!line||wholeLine||gap||lineSize>=8||(last&&/[.!?]$/.test(last.text)&&lineSize>=3)){
    line=document.createElement('div');line.className='lyrics-line';area.append(line);lineSize=0;
   }
   const b=document.createElement('button');b.type='button';b.className='lyric-word';b.dataset.index=i;
   const c=document.createElement('strong');c.textContent=w.chord??w.autoChord;
   const t=document.createElement('span');t.textContent=w.text;b.append(c,t);
   b.setAttribute('aria-label',w.text+', '+w.start.toFixed(2)+' seconds'+(c.textContent?', '+c.textContent:''));
   b.onclick=()=>{selected=i;$('lyricsText').value=w.text;$('lyricsTime').value=w.start.toFixed(2);$('lyricsEnd').value=w.end.toFixed(2);$('lyricsChord').value=w.chord??w.autoChord;$('lyricsEdit').hidden=false;api.seek(w.start);controls();};
   line.append(b);last=w;lineSize++;
   if(wholeLine){line=null;lineSize=0;}
  });
  controls();
 }
 async function resample(buffer,start,end){
  const rate=16000,len=Math.max(1,Math.ceil((end-start)*rate));
  const ctx=new OfflineAudioContext(1,len,rate),source=ctx.createBufferSource();source.buffer=buffer;source.connect(ctx.destination);source.start(0,start,end-start);
  const rendered=await ctx.startRendering();return rendered.getChannelData(0).slice();
 }
 function infer(audio,language){return new Promise((resolve,reject)=>{
  pendingReject=reject;clearTimeout(timeout);timeout=setTimeout(()=>{reject(new Error('timeout'));cancel();status('Finding words stopped. Please try again.');},300000);
  worker.onmessage=({data})=>{if(data.type==='progress'){status('Getting ready to find words…');return;}clearTimeout(timeout);pendingReject=null;if(data.type==='error')reject(new Error(data.message));else resolve(data.chunks);};
  worker.onerror=()=>{clearTimeout(timeout);pendingReject=null;reject(new Error('worker'));};worker.postMessage({audio,language},[audio.buffer]);
 });}
 async function detect(){
  const s=current();if(busy||!s.buffer)return;
  if(s.live){status('Stop Live Audio first.');return;}
  const start=0,end=s.buffer.duration;
  if(!(end>0)){status('Import a song first.');return;}
  if(words.some(w=>w.start<end&&w.end>start)&&!confirm('Replace lyrics in this section?'))return;
  cancel();const token=run;busy=true;selected=-1;$('lyricsEdit').hidden=true;controls();status('Finding words for the whole song…');
  workerURL=URL.createObjectURL(new Blob([window.BASS_LYRICS_WORKER],{type:'text/javascript'}));worker=new Worker(workerURL,{type:'module'});
  const language='english';
  try {
   for(let core=start;core<end;core+=20){
    const coreEnd=Math.min(end,core+20),a=Math.max(0,core-3),b=Math.min(s.buffer.duration,coreEnd+3);
    const audio=await resample(s.buffer,a,b);if(token!==run||api.get().session!==s.session)break;
    let rms=0;for(const n of audio)rms+=n*n;rms=Math.sqrt(rms/audio.length);
    const chunks=rms>.002?await infer(audio,language):[];
    if(token!==run||api.get().session!==s.session)break;
    const additions=clean(chunks.map(c=>({text:c.text,start:typeof c.timestamp?.[0]==='number'?a+c.timestamp[0]:NaN,end:typeof c.timestamp?.[1]==='number'?a+c.timestamp[1]:NaN})),s.buffer.duration).filter(w=>w.start>=core&&w.start<coreEnd);
    words=clean([...words.filter(w=>w.start<core||w.start>=coreEnd),...additions],s.buffer.duration);render();api.changed?.();
    status('Finding words: '+Math.round((coreEnd-start)/(end-start)*100)+'%');
   }
   if(token===run&&api.get().session===s.session)status(words.length?'Words ready. Play the song to check them.':'No clear words found. Try Find song lyrics above.');
  }catch(e){if(token===run)status('Could not find words. Check your connection and try again.');}
  finally{if(token===run){cancel();render();}}
 }
 function exportData(){if(!api)return [];current();return words.map(w=>({...w}));}
 function restore(data){if(!api)return;const s=current();cancel();words=clean(data,s.buffer?.duration);render();}
 
 // RC225: Import user-selected LRCLIB timed lyric lines. Keep all previous words unless confirmed.
 function songInfo(){
  const s=current();
  return {session:s.session,hasAudio:!!s.buffer,live:!!s.live,duration:s.buffer?.duration||0,title:String(s.title||''),artist:String(s.artist||'')};
 }
 function importTimedLines(items,expectedSession){
  const s=current();
  if(!s.buffer||s.live||busy||s.session!==expectedSession)return false;
  const next=clean(items,s.buffer.duration);
  if(!next.length)return false;
  if(words.length&&!window.confirm('Replace the current words with these timed lyrics? Your existing word edits will be replaced.'))return false;
  cancel();words=next;selected=-1;highlight=-1;
  $('lyricsEdit').hidden=true;
  render();api.changed?.();
  status('Timed lines added. Chords are matched to line times, not exact words. Save the song project to keep the lyrics.');
  return true;
 }
function init(hooks){
  api=hooks;
  $('openLyrics').onclick=()=>{current();render();$('lyricsEdit').hidden=true;$('lyricsDialog').showModal();$('lyricsDialog').scrollTop=0;status(!api.get().buffer?'Import audio first.':words.length?'Press Play to follow the words.':'Play the song or choose Find all words.');};
  $('lyricsDetect').onclick=detect;$('lyricsCancel').onclick=()=>{cancel();status('Stopped. Completed words kept.');};
  $('lyricsClose').onclick=()=>{cancel();$('lyricsDialog').close();};$('lyricsDialog').addEventListener('cancel',e=>{e.preventDefault();$('lyricsClose').click();});
  $('lyricsApply').onclick=()=>{if(busy||selected<0)return;const s=current(),w=words[selected],start=Number($('lyricsTime').value),end=Number($('lyricsEnd').value),text=$('lyricsText').value.trim();if(!w||!text||!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end>s.buffer.duration){status('Check the word and times.');return;}words[selected]={text:text.slice(0,120),start,end,chord:$('lyricsChord').value.trim().slice(0,24)};words=clean(words,s.buffer.duration);selected=-1;$('lyricsEdit').hidden=true;render();api.changed?.();status('Correction saved in this song.');};
  $('lyricsExport').onclick=()=>{const aligned=assign(words,current().chords),quote=v=>'"'+String(v).replace(/"/g,'""')+'"',csv=['Start,End,Word,Chord',...aligned.map(w=>[w.start.toFixed(3),w.end.toFixed(3),quote(w.text),quote(w.chord??w.autoChord)].join(','))].join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='Bass_Studio_Lyrics.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);};
  setInterval(()=>{
   if(!$('lyricsDialog').open)return;
   const s=current();
   if(chordKey(s.chords)!==lastChordSignature)render();
   const i=words.findIndex(w=>s.time>=w.start&&s.time<w.end);
   if(i!==highlight){
    $('lyricsWords').querySelector('.current')?.classList.remove('current');
    $('lyricsWords').querySelector('[data-index="'+i+'"]')?.classList.add('current');
    highlight=i;
   }
  },250);
  $('lyricsPlay').onclick=()=>api.play();$('lyricsPause').onclick=()=>api.pause();
  $('lyricsChordAction').onclick=()=>{
   if(busy){status('Stop finding words first.');return;}
   $('lyricsDialog').close();
   const analyse=document.getElementById('aiAnalyse');
   if(analyse){analyse.scrollIntoView({block:'center',behavior:'smooth'});analyse.focus({preventScroll:true});}
  };
  window.addEventListener('pagehide',cancel);controls();
 }
 return {init,exportData,restore,clean,assign,cancel,songInfo,importTimedLines,
  pause:()=>api?.pause(),
  play:expected=>{if(current().session!==expected)return false;api.play();return true;},
  loadAudio:file=>api.importAudio(file),refreshControls:controls};
})();
