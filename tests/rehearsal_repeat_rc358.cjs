const assert=require('node:assert/strict');
const R=require('../ear-source/rehearsal-core.js').repeat;
function buffer(channels,length,sampleRate){
 const pcm=Array.from({length:channels},()=>new Float32Array(length));
 return {numberOfChannels:channels,length,sampleRate,duration:length/sampleRate,getChannelData:c=>pcm[c]};
}
const context={createBuffer:buffer},source=buffer(2,12137,1000);
for(let c=0;c<2;c++)for(let i=0;i<source.length;i++)source.getChannelData(c)[i]=i/1000+c*20;
const clip={start:0,end:12.137},tracks={source,offset:0,end:12.137};
assert.deepEqual(R.ranges(clip,new Set([7,0,2,1])),[{start:0,end:3},{start:7,end:8}]);
const ranges=R.ranges(clip,new Set([7,0,2,1,12])),before=Array.from(source.getChannelData(0));
const loop=R.pack(context,tracks,clip,ranges);
assert.equal(loop.seconds,4.137);assert.equal(loop.source.length,4137);
assert.equal(loop.source.numberOfChannels,2);
assert(Math.abs(loop.source.getChannelData(0)[500]-.5)<1e-6);
assert(Math.abs(loop.source.getChannelData(0)[3500]-7.5)<1e-6);
assert(Math.abs(loop.source.getChannelData(1)[4050]-32.05)<1e-5);
assert.deepEqual(Array.from(source.getChannelData(0)),before,'joining sections modified the original recording');
assert.equal(loop.map.length,3,'separate selections were filled with unwanted music');
assert.equal(R.position(loop,3),7);assert.equal(R.position(loop,4),12);
assert(Math.abs(R.position(loop,4.05)-12.05)<1e-9);
assert.equal(R.position(loop,loop.seconds),0,'the final selected section does not return to the first');
assert.equal(R.phase(loop,4),3,'an excluded position should advance to the next chosen section');
for(const phase of [0,.25,2.75,3,3.8,4,4.1])assert(Math.abs(R.phase(loop,R.position(loop,phase))-phase)<1e-9);
const notes=[{time:0,stop:.4,midi:36},{time:1,stop:1.4,midi:38},{time:4,stop:4.4,midi:40},{time:7,stop:7.4,midi:43},{time:12,stop:12.137,midi:36}];
const original=JSON.stringify(notes),guide=R.notes(notes,loop);
assert.deepEqual(guide.map(n=>n.midi),[36,38,43,36]);
assert.deepEqual(guide.map(n=>n.time),[0,1,3,4]);
assert.equal(guide.at(-1).stop,loop.seconds);
assert.equal(JSON.stringify(notes),original,'repeat changed the original bass timeline');
const sustained=R.notes([{time:.8,stop:4.2,midi:36}],R.pack(context,tracks,clip,[{start:1,end:2},{start:4,end:5}]));
assert.deepEqual(sustained.map(n=>[n.time,n.stop]),[[0,1],[1,1.2000000000000002]],'notes crossing a selection must be clipped at each selected range');
// A bass-removed source starts at zero, while the original source starts at
// the clip's song timestamp. Both mappings must play the same chosen seconds.
const part={start:4,end:12.137},removed=buffer(1,8137,1000);
for(let i=0;i<removed.length;i++)removed.getChannelData(0)[i]=i/1000+4;
const selected=R.ranges(part,[4,7,12]);
const originalBand=R.pack(context,tracks,part,selected);
// Original tracks for this clip have an absolute offset of four seconds.
const correctedBand=R.pack(context,{...tracks,offset:4},part,selected);
const removedBand=R.pack(context,{source:removed,offset:0,end:removed.duration},part,selected);
assert.notEqual(originalBand.source.getChannelData(0)[500],removedBand.source.getChannelData(0)[500]);
assert.deepEqual(correctedBand.map.map(r=>[r.start,r.end,r.offset,r.duration]),removedBand.map.map(r=>[r.start,r.end,r.offset,r.duration]));
assert.deepEqual(Array.from(correctedBand.source.getChannelData(0)),Array.from(removedBand.source.getChannelData(0)));
const whole=R.pack(context,tracks,clip,R.ranges(clip));
assert.strictEqual(whole.source,source,'the whole recording should not be copied unnecessarily');
assert.equal(whole.start,0);assert.equal(whole.end,12.137);
const phrase=R.pack(context,tracks,clip,R.ranges(clip,[],{start:2.25,end:5.75}));
assert.equal(phrase.start,2.25);assert.equal(phrase.end,5.75);
assert.deepEqual(R.ranges({start:.25,end:3.137},[0,1,3]),[{start:.25,end:2},{start:3,end:3.137}]);
console.log(JSON.stringify({passed:true,chronologicalNonAdjacentRepeat:true,adjacentCellsMerged:true,stereoAudioAndGuideSameClock:true,noAddedGap:true,sourceTimelineHighlightsMapped:true,partialEndingKept:true,bassRemovedAndOriginalOffsetsMatch:true,originalAudioAndNotesUnchanged:true}));
