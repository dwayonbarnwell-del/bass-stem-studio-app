/* RC236 regression: free on-device chord recovery. No paid tests. */
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.join(__dirname,'..');
const recovery=require('../chord-source/recovery.js');
const sampleRate=11025,length=12*sampleRate,samples=new Float32Array(length);
const chords=[[0,4,7],[5,9,12],[7,11,14],[9,12,16]];
for(let part=0;part<4;part++)for(let i=0;i<3*sampleRate;i++){
 const t=(i+part*3*sampleRate)/sampleRate;
 for(const semis of chords[part]){
  const hz=261.626*2**(semis/12);
  samples[part*3*sampleRate+i]+=.18*Math.sin(2*Math.PI*hz*t)+.05*Math.sin(4*Math.PI*hz*t);
 }
}
const buffer={duration:12,sampleRate,length,numberOfChannels:1,getChannelData:()=>samples};
(async()=>{
 const found=await recovery.scan(buffer);
 assert.deepEqual(found.added.map(c=>c.label),['C','F','G','Am']);
 assert(found.added.every(c=>c.uncertain===true&&c.evidenceVersion==='local-chord-v1'));
 const original={start:3,end:6,rootPc:5,quality:'maj',manual:true,source:'User correction'};
 const withOriginal=await recovery.scan(buffer,{existing:[original]});
 assert(withOriginal.old.includes(original));
 assert(withOriginal.added.every(c=>c.end<=3||c.start>=6));
 const repeated=await recovery.scan(buffer,{existing:[...withOriginal.old,...withOriginal.added]});
 assert.equal(repeated.old.length,1);
 assert.equal(repeated.added.length,3);
 await assert.rejects(recovery.scan(buffer,{stillCurrent:()=>false}),/Song changed/);
 const src=fs.readFileSync(path.join(root,'chord-source/recovery.js'),'utf8');
 assert(!/api\.runpod\.ai|fetch\s*\(|XMLHttpRequest/.test(src));
 const app=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert(app.includes('./chord-source/recovery.js'));
 assert(app.includes('window.BassChordRecovery?.init'));
 assert(app.includes("c.evidenceVersion==='local-chord-v1'"));
 const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
 assert(sw.includes("bass-stem-studio-rc236"));
 assert(sw.includes("'./chord-source/recovery.js'"));
 console.log('PASS RC236: four synthetic chords, manual protection, repeat scan, cancellation, no paid network and app integration.');
})().catch(e=>{console.error(e);process.exitCode=1;});