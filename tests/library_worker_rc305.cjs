const {Worker,isMainThread,parentPort}=require('node:worker_threads');
const assert=require('node:assert/strict');
const path=require('node:path');
const file=path.resolve(__dirname,'../fretflow-source/practice-stems.js');

if(!isMainThread){
  global.self=globalThis;
  self.postMessage=(value,buffers)=>parentPort.postMessage(value,buffers);
  // Feed a known spectrum through each output channel. The Fourier transforms,
  // overlap handling, stem mixing and message transfers are the production code.
  global.ort={env:{wasm:{}},Tensor:class{constructor(type,data){this.data=data;}dispose(){}},
    InferenceSession:{create:async()=>({inputNames:['input'],outputNames:['output'],async run({input}){
      const bins=2049*120,data=new Float32Array(16*bins);
      for(let part=0;part<4;part++)for(let channel=0;channel<2;channel++){
        const offset=(part*2+channel)*bins*2;
        for(let k=0;k<bins;k++){
          data[offset+2*k]=input.data[(channel*2)*bins+k]*(part+1)/10;
          data[offset+2*k+1]=input.data[(channel*2+1)*bins+k]*(part+1)/10;
        }
      }
      return {output:{data,dispose(){}}};
    }})}};
  require(file);parentPort.on('message',data=>self.onmessage({data}));
}else{
  (async()=>{
    const worker=new Worker(__filename),length=8000;
    const basis=Float32Array.from({length},(_,i)=>.25*Math.sin(i*2*Math.PI*100/44100));
    const samples=[basis.slice(),Float32Array.from(basis,x=>x*.5)];
    let ticks=0,updates=0;const heartbeat=setInterval(()=>ticks++,10);
    try{
      const result=new Promise((resolve,reject)=>{
        worker.on('error',reject);
        worker.on('message',d=>{if(d.error)reject(Error(d.error));else if(d.channels)resolve(d.channels);else updates++;});
      });
      worker.postMessage({samples,stem:'rehearsal',model:'fixture'},samples.map(d=>d.buffer));
      const channels=await result;
      assert.equal(channels.length,6);assert(ticks>1&&updates>0,'the player can process input during preparation');
      const ratios=[.4,.2,.2,.1,.4,.2];
      for(let c=0;c<6;c++){
        assert.equal(channels[c].length,length);
        for(let i=0;i<length;i+=13)assert(Math.abs(channels[c][i]-basis[i]*ratios[c])<.0001);
      }
      console.log('PASS separate worker keeps the player responsive and reconstructs all six correctly timed audio channels.');
    }finally{clearInterval(heartbeat);await worker.terminate();}
  })().catch(e=>{console.error(e);process.exitCode=1;});
}
