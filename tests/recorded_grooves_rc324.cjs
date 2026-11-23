const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../ear-source/rehearsal-core');
const window={},context=vm.createContext({window});
for(const f of ['uploaded-data-rc267','lesson-data-rc272','reggae-data-rc273','african-data-rc274',
 'recording-grids','uploaded-core-rc267','accompaniment-rc293','practice-loop-rc292']){
 vm.runInContext(fs.readFileSync('ear-source/'+f+'.js','utf8'),context);
}
const {BassUploadedCore:U,BassAccompaniment:H,BassPracticeLoop:L}=window;
assert.equal(U.items.length,64);
assert.deepEqual(U.items.filter(c=>!U.loop(c.id)).map(c=>c.id).sort().join(','),'clip-29,clip-46');
assert(!H.groups.some(([id])=>id==='personal'));
let checked=0;
for(const clip of U.items){
 const grid=U.loop(clip.id);
 if(!grid)continue;
 assert(grid.end<=clip.parts[0].end&&grid.start>=0&&grid.beats%4===0);
 assert(grid.lastByte>grid.firstByte&&grid.lastByte-grid.firstByte<100000);
 for(const speed of [25,50,75,100,125]){
  const plan=U.plan(clip.id,'beat',speed);
  assert.equal(plan.beats,grid.beats);
  assert(Math.abs(plan.beats*60/plan.bpm-(grid.end-grid.start)*100/speed)<1e-8);
  assert(plan.bass.length>0);
  assert(plan.bass.every(n=>n.beat>=0&&n.beat+n.length<=plan.beats+1e-8));
  checked++;
 }
}
const grid=C.beatGrid({start:0,end:4,manualBpm:120});
const chords=C.barChords('C G/B',grid);
const shape=[{beat:.5,length:.3,role:'root'},{beat:2.75,length:.4,role:'fifth'}];
const notes=C.fit({chords,start:0,end:4,grid,shape,fill:'off',recorded:true});
assert.deepEqual(notes.map(n=>n.time),[.25,1.375,2.25,3.375]);
assert.deepEqual(notes.map(n=>n.midi%12),[0,7,11,2]);
assert(U.items.some(c=>H.recordedStyle(c)==='makossa'&&U.rehearsalShape(c.id).length));
assert(U.items.some(c=>H.recordedStyle(c)==='soukous'&&U.rehearsalShape(c.id).length));

async function sharedClock(){
 const plan=U.plan('clip-23','beat');
 const {firstByte,lastByte,offset,step,beats}=plan.recording;
 const rate=10000,scheduled=[];
 let reads=0;
 function buffer(channels,length,rate){
  const data=Array.from({length:channels},()=>new Float32Array(length).fill(.4));
  return {numberOfChannels:channels,length,duration:length/rate,getChannelData:c=>data[c],copyToChannel(d,c){data[c].set(d);}};
 }
 context.fetch=async(url,{headers})=>{
  assert.equal(url,plan.audio);assert.equal(headers.Range,'bytes='+firstByte+'-'+lastByte);
  reads++;return {status:206,headers:{get:()=> 'bytes '+firstByte+'-'+lastByte+'/200000'},arrayBuffer:async()=>new ArrayBuffer(10)};
 };
 window.BassSuppliedDrums={render:async(context,loop,frames)=>buffer(2,frames*loop.beats,rate)};
 const audioContext={sampleRate:rate,currentTime:3,createBuffer:buffer,
  decodeAudioData:async()=>buffer(1,Math.ceil((offset+beats*step+.1)*rate),rate),
  createGain:()=>({gain:{setValueAtTime(){}},connect(){}}),
  createBufferSource:()=>({connect(g){return g;},start(when,offset){scheduled.push({when,offset,source:this});}})};
 const options={loop:{beats:32},recorded:true,chords:false};
 const rendered=await L.render(audioContext,plan,options);
 assert.equal(rendered.stems.bass.length,rendered.beatFrames*beats);
 assert.equal(rendered.stems.drums.length,rendered.beatFrames*32);
 assert.equal(rendered.stems.bass.getChannelData(0)[0],0);
 L.start(audioContext,rendered,{when:4});
 assert.equal(scheduled.length,2);
 assert(scheduled.every(s=>s.when===4&&s.offset===0&&s.source.loop));
 await L.render(audioContext,plan,options);
 assert.equal(reads,1,'reuse the downloaded excerpt');
 console.log('PASS '+checked+' timed excerpts at five speeds, rehearsal rests and harmony, synced recording and drums, and excerpt reuse.');
}
sharedClock().catch(error=>{console.error(error);process.exitCode=1;});
