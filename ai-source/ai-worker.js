import * as tf from '@tensorflow/tfjs';
import {setWasmPaths,setThreadsCount} from '@tensorflow/tfjs-backend-wasm';
let model;
const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
self.onmessage=async ({data:d})=>{
 try{
  if(d.type==='init'){
   const paths={};for(const [name,base64] of Object.entries(d.assets.wasm))paths[name]=URL.createObjectURL(new Blob([bytes(base64)],{type:'application/wasm'}));
   setThreadsCount(1);setWasmPaths(paths);await tf.setBackend('wasm');await tf.ready();
   const manifest=d.assets.model.weightsManifest;
   model=await tf.loadGraphModel(tf.io.fromMemory({modelTopology:d.assets.model.modelTopology,weightSpecs:manifest.flatMap(g=>g.weights),weightData:bytes(d.assets.weights).buffer}));
   const warm=tf.tidy(()=>model.execute(tf.zeros([1,43844,1]),'Identity_1'));await warm.data();warm.dispose();
   self.postMessage({type:'ready',backend:tf.getBackend()});
  }else if(d.type==='audio'){
   const started=performance.now();
   const out=tf.tidy(()=>model.execute(tf.tensor(d.samples,[1,43844,1]),'Identity_1'));
   const values=await out.data(),frames=out.shape[1],pitches=out.shape[2];out.dispose();
   // Ignore uncertain model edges; preserve per-frame coexistence of notes.
   const first=Math.max(15,frames-65),last=frames-15;
   const selected=values.slice(first*pitches,last*pitches);
   self.postMessage({type:'notes',values:selected,frames:last-first,pitches,start:d.end-(43844-first*256)/22050,end:d.end-(43844-last*256)/22050,ms:performance.now()-started,tensors:tf.memory().numTensors},[selected.buffer]);
  }
 }catch(e){self.postMessage({type:'error',message:e.message});}
};
