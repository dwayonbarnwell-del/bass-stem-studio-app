/* Encode the Studio's 16-bit stereo WAVs off the playback thread. */
async function loadFlac(){
  if(!self.Flac){
   self.FLAC_SCRIPT_LOCATION=new URL('../vendor/libflac/',self.location.href).href;
   importScripts('../vendor/libflac/libflac.min.wasm.js');
  }
  if(!Flac.isReady())await new Promise(resolve=>Flac.on('ready',resolve));
}
async function decodeFlac(blob,frames){
 await loadFlac();
 const input=new Uint8Array(await blob.arrayBuffer()),chunks=[];
 const decoder=Flac.create_libflac_decoder(true);
 let pos=0,count=0,invalid=false;
 try{
  const read=n=>{
   const buffer=input.subarray(pos,pos+n);pos+=buffer.length;
   return {buffer,readDataLength:buffer.length};
  };
  const write=channels=>{
   if(channels.length!==2||channels[0].length!==channels[1].length){invalid=true;return;}
   const [left,right]=channels,n=left.length/2;
   if(count+n>frames){invalid=true;return;}
   const pcm=new Uint8Array(n*4);
   for(let i=0;i<n;i++){
    pcm[4*i]=left[2*i];pcm[4*i+1]=left[2*i+1];
    pcm[4*i+2]=right[2*i];pcm[4*i+3]=right[2*i+1];
   }
   count+=n;chunks.push(pcm);
  };
  const meta=m=>{if(m.bitsPerSample!==16||m.channels!==2||m.sampleRate!==44100)invalid=true;};
  if(Flac.init_decoder_stream(decoder,read,write,()=>{invalid=true;},meta)!==0||
     !Flac.FLAC__stream_decoder_process_until_end_of_stream(decoder)||
     !Flac.FLAC__stream_decoder_finish(decoder)||invalid||count!==frames)throw Error('Invalid FLAC audio');
  return {blob:new Blob(chunks)};
 }finally{Flac.FLAC__stream_decoder_delete(decoder);}
}
async function encodeStem(blob,format){
 const header=new DataView(await blob.slice(0,44).arrayBuffer());
 const rate=header.getUint32(24,true),frames=(blob.size-44)/4;
 if(header.getUint32(36)!==0x64617461||header.getUint16(20,true)!==1||header.getUint16(22,true)!==2||
    header.getUint16(34,true)!==16||header.getUint32(40,true)!==frames*4||rate!==44100)throw Error('Unsupported WAV');
 const parts=[];
 let encoder;
 if(format==='audio/flac'){
  await loadFlac();
  encoder=Flac.create_libflac_encoder(rate,2,16,5,frames,true);
  if(!encoder)throw Error('FLAC unavailable');
 }else{
  if(!self.lamejs)importScripts('../vendor/lamejs/lame.min.js');
  encoder=new lamejs.Mp3Encoder(2,rate,320);
  // A short sync pulse before the song measures decoder padding on each device.
  const pilot=new Int16Array(4096);pilot[2048]=30000;
  parts.push(encoder.encodeBuffer(pilot,pilot));
 }
 try{
  if(format==='audio/flac'&&Flac.init_encoder_stream(encoder,data=>parts.push(data.slice()))!==0)throw Error('FLAC initialisation failed');
  for(let start=0;start<frames;start+=32768){
   const samples=new Int16Array(await blob.slice(44+4*start,44+4*Math.min(frames,start+32768)).arrayBuffer());
   if(format==='audio/flac'){
    if(!Flac.FLAC__stream_encoder_process_interleaved(encoder,Int32Array.from(samples),samples.length/2))throw Error('FLAC encoding failed');
   }else{
    const left=new Int16Array(samples.length/2),right=new Int16Array(left.length);
    for(let i=0;i<left.length;i++){left[i]=samples[2*i];right[i]=samples[2*i+1];}
    parts.push(encoder.encodeBuffer(left,right));
   }
  }
  if(format==='audio/flac'){
   if(!Flac.FLAC__stream_encoder_finish(encoder))throw Error('FLAC verification failed');
  }else parts.push(encoder.flush());
  return {blob:new Blob(parts,{type:format}),frames,rate};
 }finally{if(format==='audio/flac')Flac.FLAC__stream_encoder_delete(encoder);}
}
self.onmessage=async e=>{try{self.postMessage(e.data.decode?await decodeFlac(e.data.blob,e.data.frames):await encodeStem(e.data.blob,e.data.format));}catch(error){self.postMessage({error:error.message});}};
