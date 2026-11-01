/* Persistent, ordered recording chunks. A new take atomically replaces the old one. */
window.BassRecovery=(()=>{
 let dbPromise,queue=Promise.resolve();
 function db(){return dbPromise ||= new Promise((resolve,reject)=>{const r=indexedDB.open('BassStudioRecordings',1);r.onupgradeneeded=()=>r.result.createObjectStore('take');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
 function run(mode,fn){return db().then(d=>new Promise((resolve,reject)=>{const t=d.transaction('take',mode),s=t.objectStore('take');let result;fn(s,v=>result=v);t.oncomplete=()=>resolve(result);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||Error('Storage interrupted'));}));}
 function enqueue(fn){const p=queue.then(fn);queue=p.catch(()=>{});return p;}
 return {
  begin:meta=>enqueue(()=>run('readwrite',s=>{s.clear();s.put(meta,'meta');})),
  chunk:(index,blob,name)=>enqueue(()=>run('readwrite',s=>{const r=s.get('meta');r.onsuccess=()=>{if(r.result?.name===name)s.put(blob,index);else s.transaction.abort();};})),
  finish:meta=>enqueue(()=>run('readwrite',s=>{const r=s.get('meta');r.onsuccess=()=>{if(r.result?.name===meta.name)s.put(meta,'meta');else s.transaction.abort();};})),
  restore:()=>enqueue(()=>run('readonly',(s,done)=>{const chunks=[],r=s.openCursor();let meta;r.onsuccess=()=>{const c=r.result;if(c){if(c.key==='meta')meta=c.value;else chunks.push(c.value);c.continue();}else done(meta&&chunks.length?{...meta,blob:new Blob(chunks,{type:meta.mime||chunks[0].type})}:null);};})),
  clear:()=>enqueue(()=>run('readwrite',s=>s.clear()))
 };
})();
window.BassMidi=notes=>{
 const vlq=n=>{let a=[n&127];while(n>>=7)a.unshift((n&127)|128);return a;};
 const events=[];for(const n of notes){if(n.end-n.start<.08)continue;let m=n.midi-12;while(m<28)m+=12;while(m>67)m-=12;events.push({t:Math.round(n.start*960),b:[0x90,m,90]},{t:Math.round(n.end*960),b:[0x80,m,0]});}
 events.sort((a,b)=>a.t-b.t||a.b[0]-b.b[0]);let last=0,track=[0,0xff,0x51,3,7,0xa1,0x20,0,0xc0,33];for(const e of events){track.push(...vlq(e.t-last),...e.b);last=e.t;}track.push(0,0xff,0x2f,0);const len=track.length;return new Blob([new Uint8Array([77,84,104,100,0,0,0,6,0,0,0,1,1,224,77,84,114,107,(len>>>24)&255,(len>>>16)&255,(len>>>8)&255,len&255,...track])],{type:'audio/midi'});
};
