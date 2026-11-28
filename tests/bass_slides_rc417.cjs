const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const html=fs.readFileSync('index.html','utf8');
function source(start,end){
  const first=html.indexOf(start);
  const last=html.indexOf(end,first);
  assert(first>=0&&last>first);
  return html.slice(first,last);
}
const context={window:{},setTimeout};
vm.runInNewContext(source('window.BassPracticeDSP=','</script>')+
  source('  async function markBassSlides','  async function estimateMissingBass'),context);

async function classify(pitch,manual=false){
  const sampleRate=16000;
  let phase=0;
  const pcm=Float32Array.from({length:8000},(_,i)=>{
    phase+=2*Math.PI*440*2**((pitch(i/sampleRate)-69)/12)/sampleRate;
    return .25*Math.sin(phase)+.08*Math.sin(phase*2);
  });
  const audio={sampleRate,length:pcm.length,numberOfChannels:1,getChannelData:()=>pcm};
  const notes=await context.markBassSlides([{midi:42,start:.20,end:.28,manual}],audio,()=>true);
  return notes[0].slideDirection;
}
(async()=>{
  const moving=t=>42+Math.max(-1,Math.min(1,(t-.24)*20));
  assert.equal(await classify(moving),1);
  assert.equal(await classify(t=>84-moving(t)),-1);
  assert.equal(await classify(moving,true),undefined);
  assert.equal(await classify(()=>42),undefined);
  assert.equal(await classify(t=>42+.22*Math.sin(t*42)),undefined);
  assert.equal(await classify(t=>t<.20?41:t<.28?42:43),undefined);
  assert.equal(await classify(t=>t<.24?41:43),undefined);
  console.log('Bass slides, chromatic steps, manual notes and vibrato passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
