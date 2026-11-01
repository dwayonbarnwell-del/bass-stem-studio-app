window.BassRhythm=(()=>{
 let cancel=()=>{};
 function init(api){
  const $=id=>document.getElementById(id),dialog=$('rhythmDialog'),status=$('rhythmStatus'),player=$('rhythmPlayer');let busy=false,token=0,audio=null,wav=null,url='',recognition;
  const save=(blob,name)=>{const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000);};
  function sync(){$('rhythmExtract').disabled=busy;$('rhythmSave').disabled=busy||!audio;$('rhythmWav').disabled=busy||!audio;$('rhythmImport').disabled=busy;$('rhythmCancel').disabled=!busy;}
  function reset(){++token;player.pause();player.removeAttribute('src');player.hidden=true;audio=null;wav=null;if(url)URL.revokeObjectURL(url);url='';sync();}
  cancel=()=>{reset();recognition?.abort();};
  function setAudio(b){audio=b;const count=b.length,channels=b.numberOfChannels,bytes=new ArrayBuffer(44+count*channels*2),v=new DataView(bytes);const str=(p,s)=>{for(let i=0;i<s.length;i++)v.setUint8(p+i,s.charCodeAt(i));};str(0,'RIFF');v.setUint32(4,bytes.byteLength-8,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,channels,true);v.setUint32(24,b.sampleRate,true);v.setUint32(28,b.sampleRate*channels*2,true);v.setUint16(32,channels*2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,bytes.byteLength-44,true);for(let i=0;i<count;i++)for(let c=0;c<channels;c++){const x=Math.max(-1,Math.min(1,b.getChannelData(c)[i]));v.setInt16(44+(i*channels+c)*2,Math.round(x*(x<0?32768:32767)),true);}if(url)URL.revokeObjectURL(url);wav=new Blob([bytes],{type:'audio/wav'});url=URL.createObjectURL(wav);player.src=url;player.loop=true;player.hidden=false;sync();}
  $('openRhythm').onclick=()=>{const s=api.get();$('rhythmFrom').value=s.start.toFixed(2);$('rhythmTo').value=s.end.toFixed(2);dialog.showModal();};
  $('rhythmExtract').onclick=async()=>{const a=Number($('rhythmFrom').value),b=Number($('rhythmTo').value),s=api.get();if(!s.buffer||a<0||!Number.isFinite(a+b)||b-a<.5||b>s.buffer.duration+.01||b-a>30){status.textContent='Choose 0.5–30 seconds within the song.';return;}
    reset();const mine=token;busy=true;sync();api.pause();status.textContent='Loading drum separation…';
    try{const result=await api.extract(a,b,p=>status.textContent='Separating drums: '+p+'%',()=>mine!==token);if(mine===token){setAudio(result);status.textContent='Drum loop ready. Some bleed may remain.';}}
    catch(e){status.textContent=String(e.message||e);}finally{busy=false;sync();}
  };
  $('rhythmCancel').onclick=()=>{++token;status.textContent='Cancelling…';};
  $('rhythmSave').onclick=async()=>{if(!audio)return;const b=audio;busy=true;sync();try{save(await api.encode(b),'Bass_Studio_Rhythm_Loop.mp3');status.textContent='MP3 download started.';}catch(e){status.textContent='Export failed. '+e.message;}finally{busy=false;sync();}};
  $('rhythmWav').onclick=()=>{if(wav)save(wav,'Bass_Studio_Rhythm_Loop.wav');};
  $('rhythmImport').onchange=async e=>{const file=e.target.files[0];if(!file)return;if(file.size>30*1024*1024){status.textContent='Choose a loop smaller than 30 MB.';return;}busy=true;sync();const mine=++token;let c;try{c=new AudioContext();const b=await c.decodeAudioData(await file.arrayBuffer());if(b.duration>30)throw Error('Choose a drum loop up to 30 seconds.');if(mine===token){setAudio(b);status.textContent='Imported drum loop.';}}catch(e){status.textContent=e.message;}finally{await c?.close();busy=false;sync();e.target.value='';}};
  player.onplay=()=>api.pause();
  $('rhythmClose').onclick=()=>{++token;player.pause();recognition?.abort();dialog.close();};dialog.oncancel=e=>{e.preventDefault();$('rhythmClose').click();};
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  $('voiceCommand').disabled=!SR;
  $('voiceCommand').onclick=()=>{recognition?.abort();api.pause();player.pause();recognition=new SR();recognition.lang='en-GB';recognition.interimResults=false;recognition.maxAlternatives=1;$('commandStatus').textContent='Listening…';recognition.onresult=e=>{$('commandStatus').textContent=api.command(e.results[0][0].transcript);};recognition.onerror=()=>{$('commandStatus').textContent='Voice unavailable. Type a command below.';};recognition.onend=()=>{if($('commandStatus').textContent==='Listening…')$('commandStatus').textContent='No command heard. Try again.';};try{recognition.start();}catch(e){$('commandStatus').textContent='Voice unavailable. Type a command below.';}};
  $('runCommand').onclick=()=>{$('commandStatus').textContent=api.command($('commandText').value);};sync();
 }
 return {init,cancel:()=>cancel()};
})();
