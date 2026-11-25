const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
async function smallReadRecovery(){
 const timers=new Map();let seq=0;
 const c={DOMException,Blob,crypto:require('node:crypto').webcrypto,setTimeout(fn){timers.set(++seq,fn);return seq;},clearTimeout:id=>timers.delete(id)};
 vm.createContext(c);vm.runInContext(fs.readFileSync('library-source/project-json.js','utf8'),c);
 const controller=new AbortController();controller.abort();
 await assert.rejects(c.BassProjectJSON.read({size:4,text:async()=>'{"ok":true}'},{signal:controller.signal}),{name:'AbortError'});
 const stalled=c.BassProjectJSON.read({size:4,text:()=>new Promise(()=>{})});
 for(const fn of [...timers.values()])fn();await assert.rejects(stalled,/stopped responding/);assert.equal(timers.size,0);
 assert.equal((await c.BassProjectJSON.read(new Blob(['{"ok":true}']))).ok,true);
 console.log('PASS small project reads honour cancellation, time out and recover.');
}
async function streamReadRecovery(timeout=false){
 const timers=new Map();let seq=0,cancelled=false,released=false;
 const reader={read:()=>new Promise(()=>{}),cancel:()=>{cancelled=true;return new Promise(()=>{});},releaseLock:()=>{released=true;}};
 const c={DOMException,Blob,TextDecoderStream,crypto:require('node:crypto').webcrypto,setTimeout(fn){timers.set(++seq,fn);return seq;},clearTimeout:id=>timers.delete(id)};
 vm.createContext(c);vm.runInContext(fs.readFileSync('library-source/project-json.js','utf8'),c);
 const controller=new AbortController(),file={size:20*1024*1024,stream:()=>({pipeThrough:()=>({getReader:()=>reader})})};
 const task=c.BassProjectJSON.read(file,{signal:controller.signal});
 if(timeout){for(const fn of [...timers.values()])fn();await assert.rejects(task,/stopped responding/);}else{controller.abort();await assert.rejects(task,{name:'AbortError'});}assert(cancelled);assert(released);assert.equal(timers.size,0);
 console.log('PASS stalled large-file streams '+(timeout?'time out':'cancel')+' and release without awaiting a stalled cancellation.');
}
async function pianoCacheRecovery(kind){
 const manifest=JSON.parse(fs.readFileSync('ai-source/salamander/manifest.json','utf8')),note={midi:60,velocity:80};
 const descriptor=manifest.samples.filter(s=>note.velocity>=s.velocityMin&&note.velocity<=s.velocityMax).reduce((a,b)=>Math.abs(b.rootMidi-note.midi)<Math.abs(a.rootMidi-note.midi)?b:a);
 const base='./ai-source/salamander/',stored=new Map([[base+'manifest.json',new Response(kind==='manifest'?'{bad json':JSON.stringify(manifest))]]);let requests=0,deleted=0;
 if(kind==='sample')stored.set(base+descriptor.url,new Response(new Uint8Array([255])));
 const env={window:{},Map,Response,caches:{open:async()=>({match:async p=>stored.get(p)?.clone(),put:async(p,v)=>stored.set(p,v.clone()),delete:async p=>{deleted++;return stored.delete(p);}})},fetch:async p=>{requests++;return p.endsWith('.json')?new Response(JSON.stringify(manifest)):new Response(new Uint8Array([1]));}};
 const context={decodeAudioData:async bytes=>{if(new Uint8Array(bytes)[0]===255)throw Error('Invalid cached sample');return {numberOfChannels:2,length:32,sampleRate:44100,getChannelData:()=>new Float32Array(32)};}};
 vm.runInNewContext(fs.readFileSync('ai-source/sampled-piano.js','utf8'),env);
 await env.window.BassGrandPiano.prepare('piano',context,{notes:[note]});assert(deleted>=1,'corrupt cached data must be removed');assert(requests>=1);
 const before=requests;await env.window.BassGrandPiano.prepare('piano',context,{notes:[note]});assert.equal(requests,before);
 console.log('PASS corrupt piano '+kind+' is replaced and healthy decoded data is reused.');
}
async function pianoFreshRecovery(){
 const manifest=JSON.parse(fs.readFileSync('ai-source/salamander/manifest.json','utf8'));let manifestCalls=0,sampleCalls=0;const saved=new Map();
 const c={window:{},Response,caches:{open:async()=>({match:async p=>saved.get(p)?.clone(),put:async(p,r)=>saved.set(p,r.clone()),delete:async p=>saved.delete(p)})},fetch:async p=>p.endsWith('.json')?new Response(JSON.stringify(++manifestCalls===1?{samples:[]}:manifest)):new Response(new Uint8Array([++sampleCalls===1?255:1]))};
 const context={decodeAudioData:async bytes=>{if(new Uint8Array(bytes)[0]===255)throw Error('Invalid fresh sample');return {numberOfChannels:2,length:32,sampleRate:44100,getChannelData:()=>new Float32Array(32)};}};
 vm.runInNewContext(fs.readFileSync('ai-source/sampled-piano.js','utf8'),c);const prepare=()=>c.window.BassGrandPiano.prepare('piano',context,{notes:[{midi:60,velocity:80}]});
 await assert.rejects(prepare(),/need updating/);assert.equal(saved.size,0,'invalid manifest is not cached');
 await assert.rejects(prepare(),/Invalid fresh sample/);assert.equal(saved.size,1,'invalid audio is not cached');
 await prepare();assert.equal(saved.size,2);assert.equal(manifestCalls,2);assert.equal(sampleCalls,2);
 console.log('PASS invalid network piano data is never cached and a fresh attempt recovers.');
}
async function bounded(label,check){let timer;try{return await Promise.race([check(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+': did not settle')),1500);})]);}finally{clearTimeout(timer);}}
Promise.allSettled([bounded('small reads',smallReadRecovery),bounded('stream reads',streamReadRecovery),bounded('stream timeout',()=>streamReadRecovery(true)),bounded('fresh cache',pianoFreshRecovery),bounded('manifest cache',()=>pianoCacheRecovery('manifest')),bounded('sample cache',()=>pianoCacheRecovery('sample'))]).then(results=>{for(const r of results)if(r.status==='rejected'){console.error('FAIL '+r.reason.message);process.exitCode=1;}});
