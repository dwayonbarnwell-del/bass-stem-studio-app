// Optional local transcription. Only model/runtime downloads use the network.
let transcriber;
self.onmessage=async({data})=>{
 try {
  if(!transcriber){
   const {pipeline,env}=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js');
   env.allowLocalModels=false;env.backends.onnx.wasm.numThreads=1;
   transcriber=await pipeline('automatic-speech-recognition','Xenova/whisper-tiny',{
    device:'wasm',dtype:'q8',progress_callback:p=>{if(p.status==='progress')self.postMessage({type:'progress',text:'Downloading lyrics AI…'});}
   });
  }
  self.postMessage({type:'progress',text:'Finding words…'});
  const result=await transcriber(data.audio,{return_timestamps:'word',task:'transcribe',chunk_length_s:30,stride_length_s:5, ...(data.language?{language:data.language}:{})});
  self.postMessage({type:'result',chunks:result.chunks||[]});
 }catch(e){self.postMessage({type:'error',message:String(e.message||e)});}
};
