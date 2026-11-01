window.BassAudioLink=(()=>{
 const limit=100*1024*1024;
 function parse(value){let u;try{u=new URL(value);}catch{throw Error('Paste a full HTTPS audio link.');}if(u.protocol!=='https:'||u.username||u.password)throw Error('Use an HTTPS link without a username or password.');if(/(^|\.)(youtube\.com|youtu\.be|spotify\.com|music\.apple\.com)$/.test(u.hostname))throw Error('Use a direct audio-file link, not a streaming page.');return u;}
 async function fetchAudio(value,signal,progress=()=>{}){
  const url=parse(value),r=await fetch(url.href,{signal,mode:'cors',credentials:'omit',referrerPolicy:'no-referrer'});
  if(!r.ok)throw Error('The audio link is unavailable.');const mime=(r.headers.get('content-type')||'').split(';')[0],size=Number(r.headers.get('content-length'));
  if(/text\/|application\/(json|xml|xhtml)/i.test(mime))throw Error('This link opens a page. Use a direct audio-file link.');if(size>limit)throw Error('This file is over 100 MB. Download it and use Import.');
  const chunks=[];let total=0;const reader=r.body?.getReader();if(!reader)throw Error('This browser cannot download the link. Use Import.');
  try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>limit)throw Error('This file is over 100 MB. Download it and use Import.');chunks.push(value);progress(total,size);}}finally{await reader.cancel().catch(()=>{});}
  if(!total)throw Error('The audio file is empty.');let name;try{name=decodeURIComponent(url.pathname.split('/').pop());}catch{}name=(name||'Online_audio').replace(/[^\w. -]/g,'_').slice(0,120);
  return new File(chunks,name,{type:mime||'application/octet-stream'});
 }
 function init({load,isBusy,session}){const $=id=>document.getElementById(id),dialog=$('audioLinkDialog'),state=$('audioLinkStatus');let controller,busy=false,loading=false;
  function sync(){$('audioLinkLoad').disabled=busy;$('audioLinkURL').disabled=busy;$('audioLinkClose').disabled=loading;$('audioLinkCancel').disabled=!busy||loading;}
  $('openAudioLink').onclick=()=>{dialog.showModal();};
  $('audioLinkLoad').onclick=async()=>{if(busy)return;if(isBusy()){state.textContent='Wait for the current import or analysis.';return;}busy=true;controller=new AbortController();const initial=session();sync();const timer=setTimeout(()=>controller.abort(),120000);state.textContent='Downloading audio…';
   try{const file=await fetchAudio($('audioLinkURL').value.trim(),controller.signal,(n,size)=>{state.textContent=size?'Downloading: '+Math.min(100,Math.round(n/size*100))+'%':'Downloading: '+(n/1048576).toFixed(1)+' MB';});if(controller.signal.aborted)throw new DOMException('Cancelled','AbortError');if(session()!==initial||isBusy())throw Error('Song changed. Open the link again.');loading=true;sync();state.textContent='Opening audio…';const ok=await load(file);state.textContent=ok?'Audio loaded. Use Analyse Bass for chords.':'Could not read this audio. Try an MP3 or WAV link.';if(ok)dialog.close();}
   catch(e){state.textContent=e.name==='AbortError'?'Download cancelled or timed out.':e instanceof TypeError?'This website blocked the download or could not be reached. Download the file and use Import.':e.message;}
   finally{clearTimeout(timer);busy=false;loading=false;controller=null;sync();}
  };
  $('audioLinkCancel').onclick=()=>controller?.abort();$('audioLinkClose').onclick=()=>{controller?.abort();dialog.close();};dialog.oncancel=e=>{e.preventDefault();if(!loading)$('audioLinkClose').click();};sync();
 }
 return {init,parse,fetchAudio};
})();
