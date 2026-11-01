window.BassMedia=(()=>{
 const audioExt=['mp3','wav','wave','m4a','m4b','aac','aif','aiff','aifc','caf','flac','ogg','oga','opus','wma'],videoExt=['mp4','m4v','mov','webm','mkv','avi','mpeg','mpg','3gp','3g2','ogv','wmv'];
 const ext=f=>String(f.name||'').split('.').pop().toLowerCase(),video=f=>/^video\//i.test(f.type)||videoExt.includes(ext(f));
 const picker=[{description:'Audio and video',accept:{'audio/*':audioExt.map(x=>'.'+x),'video/*':videoExt.map(x=>'.'+x)}}];
 const limit=128*1048576,maxPCM=256*1048576;let active=null;
 const abort=()=>new DOMException('Import cancelled.','AbortError');
 function wav(buffer){const channels=Math.min(2,buffer.numberOfChannels),frames=buffer.length,bytes=frames*channels*2;if(bytes>maxPCM)throw Error('This audio is too long to convert on this device. Use a shorter file.');const out=new ArrayBuffer(44+bytes),v=new DataView(out),write=(p,s)=>{for(let i=0;i<s.length;i++)v.setUint8(p+i,s.charCodeAt(i));};write(0,'RIFF');v.setUint32(4,36+bytes,true);write(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,channels,true);v.setUint32(24,buffer.sampleRate,true);v.setUint32(28,buffer.sampleRate*channels*2,true);v.setUint16(32,channels*2,true);v.setUint16(34,16,true);write(36,'data');v.setUint32(40,bytes,true);const data=Array.from({length:channels},(_,i)=>buffer.getChannelData(i));let peak=1;for(const x of data)for(const n of x)if(Number.isFinite(n))peak=Math.max(peak,Math.abs(n));const gain=1/peak;let k=44;for(let i=0;i<frames;i++)for(const x of data){const n=Number.isFinite(x[i])?x[i]*gain:0;v.setInt16(k,Math.round(n<0?n*32768:n*32767),true);k+=2;}return new Blob([out],{type:'audio/wav'});}
 function workerMain(){
  self.onmessage=async({data})=>{let ff;try{
   self.postMessage({stage:'Loading converter · internet required…'});
   const base='https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core';
   importScripts(base+'.js');ff=await createFFmpegCore({mainScriptUrlOrBlob:base+'.js#'+btoa(JSON.stringify({wasmURL:base+'.wasm'}))});
   ff.setLogger(()=>{});ff.FS.mkdir('/media');ff.FS.mount(ff.FS.filesystems.WORKERFS,{files:[data.file]},'/media');const input='/media/'+data.file.name;
   ff.setTimeout(30000);ff.ffprobe('-v','error','-show_streams','-show_format','-of','json','-o','probe.json',input);/* This pinned core leaves ret=-1 on successful ffprobe. Validate its JSON too. */if(ff.ret>0)throw Error('Could not read this file. It may be damaged or protected.');ff.reset();
   let info;try{info=JSON.parse(ff.FS.readFile('probe.json',{encoding:'utf8'}));if(!Array.isArray(info.streams))throw Error();}catch{throw Error('Could not read this file. It may be damaged or protected.');}const track=info.streams.find(s=>s.codec_type==='audio');if(!track)throw Error('This video has no audio track.');
   const duration=Number(track.duration||info.format?.duration),channels=Math.min(2,Math.max(1,Number(track.channels)||2));if(!Number.isFinite(duration)||duration<=0)throw Error('Could not read the audio duration. Try exporting it as M4A or WAV.');
   if(duration>1200||duration*44100*channels*4>256*1048576)throw Error('This file is too long for on-device conversion. Use a shorter file.');
   ff.setProgress(({progress})=>self.postMessage({stage:'Extracting audio…',progress:Math.max(0,Math.min(99,Math.round(progress*100)))}));self.postMessage({stage:'Extracting audio…'});ff.setTimeout(180000);
   ff.exec('-v','error','-i',input,'-map','0:a:0','-vn','-ac',String(channels),'-ar','44100','-c:a','pcm_f32le','-f','wav','out.wav');if(ff.ret!==0)throw Error('Could not extract the audio. Try exporting it as M4A or WAV.');
   const output=ff.FS.readFile('out.wav');self.postMessage({bytes:output.buffer,duration},[output.buffer]);
  }catch(e){self.postMessage({error:!ff?'Converter unavailable. Connect to the internet, or use MP3, M4A or WAV.':e instanceof Error?e.message:'Could not convert this file.'});}};
 }
 function convert(file,job,progress){return new Promise((resolve,reject)=>{const url=URL.createObjectURL(new Blob(['('+workerMain.toString()+')()'],{type:'text/javascript'}));let worker;const done=(error,value)=>{clearTimeout(timer);worker?.terminate();URL.revokeObjectURL(url);job.stop=null;error?reject(error):resolve(value);};const timer=setTimeout(()=>done(Error('Conversion timed out. Try a shorter file.')),240000);job.stop=()=>done(abort());try{worker=new Worker(url);worker.onerror=()=>done(Error('Converter unavailable. Connect to the internet, or use MP3, M4A or WAV.'));worker.onmessage=({data})=>{if(data.error)done(Error(data.error));else if(data.bytes)done(null,data);else progress(data.stage+(Number.isFinite(data.progress)?' '+data.progress+'%':''));};worker.postMessage({file:new File([file],'input.'+ext(file),{type:file.type})});}catch(e){done(e);}});}
 async function prepare(file,ctx,{signal,progress=()=>{}}={}){
  if(!file?.size)throw Error('This file is empty.');const kind=ext(file);if(!audioExt.includes(kind)&&!videoExt.includes(kind)&&!/^audio\/|^video\//i.test(file.type)&&file.type&&file.type!=='application/octet-stream')throw Error('Choose an audio or video file.');
  if(video(file)&&file.size>limit)throw Error('Choose a video below 128 MB, or export its audio first.');
  const job={cancelled:false,stop:null};const cancel=()=>{job.cancelled=true;job.stop?.();};if(signal?.aborted)throw abort();signal?.addEventListener('abort',cancel,{once:true});const check=()=>{if(job.cancelled)throw abort();};
  try{progress(video(file)?'Reading video audio…':'Opening audio…');let buffer,converted=false;
   try{const bytes=await file.arrayBuffer();check();buffer=await ctx.decodeAudioData(bytes);}catch(e){check();if(file.size>limit)throw Error('This format needs conversion. Use a file below 128 MB.');const result=await convert(file,job,progress);check();buffer=await ctx.decodeAudioData(result.bytes);if(buffer.duration+0.2<result.duration)throw Error('The audio extraction was incomplete. Your open song is unchanged.');converted=true;}
   check();if(!buffer?.length)throw Error('This file has no readable audio.');
   if(video(file)||converted||buffer.numberOfChannels>2||['aif','aiff','aifc','caf','wma','m4b'].includes(kind)){
    if(buffer.numberOfChannels>2){if(buffer.length*8>maxPCM)throw Error('This audio is too long to convert on this device. Use a shorter file.');const Offline=window.OfflineAudioContext||window.webkitOfflineAudioContext;const mix=new Offline(2,buffer.length,buffer.sampleRate),source=mix.createBufferSource();source.buffer=buffer;source.connect(mix.destination);source.start();buffer=await mix.startRendering();check();}
    progress('Preparing rehearsal audio…');const audio=wav(buffer);check();const name=String(file.name||'Imported media').replace(/\.[^.]*$/,'')+'_audio.wav';const extracted=new File([audio],name,{type:'audio/wav',lastModified:file.lastModified});
    // Decode the exact playback bytes so analysis and playback have the same samples.
    buffer=await ctx.decodeAudioData(await extracted.arrayBuffer());check();return {file:extracted,buffer,converted:true};
   }
   return {file,buffer,converted:false};
  }finally{signal?.removeEventListener('abort',cancel);}
 }
 function init(){const d=document.getElementById('mediaImportDialog'),cancel=document.getElementById('mediaImportCancel');cancel.onclick=()=>{active?.abort();document.getElementById('mediaImportState').textContent='Cancelling…';};d.oncancel=e=>{e.preventDefault();cancel.click();};}
 async function open(file,ctx,options={}){active?.abort();const controller=new AbortController();active=controller;const d=document.getElementById('mediaImportDialog');if(!d.open)d.showModal();try{return await prepare(file,ctx,{...options,signal:controller.signal,progress:text=>{if(active===controller)document.getElementById('mediaImportState').textContent=text;options.progress?.(text);}});}finally{if(active===controller){active=null;d.close();}}}
 return {init,open,prepare,wav,picker,audioExt,videoExt,video,cancel:()=>active?.abort()};
})();
