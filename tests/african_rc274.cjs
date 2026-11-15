const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const env={window:{}};vm.createContext(env);for(const f of ['uploaded-data-rc267.js','lesson-data-rc272.js','reggae-data-rc273.js','african-data-rc274.js','uploaded-core-rc267.js'])vm.runInContext(fs.readFileSync('ear-source/'+f,'utf8'),env);
const U=env.window.BassUploadedCore,added=U.items.filter(c=>c.group==='african-rc274');assert.equal(U.items.length,72);assert.equal(added.length,10);assert.equal(new Set(U.items.map(c=>c.id)).size,72);assert.equal(new Set(U.items.map(c=>c.sourceSha256)).size,72);
const expected={'recorded-makossa':3,'recorded-congolese':2,'recorded-seben':1,'recorded-african':2,'recorded-zouk':1,'recorded-review':1};let combinations=0,notes=0;
for(const [group,count] of Object.entries(expected))assert.equal(added.filter(c=>c.collection===group).length,count);
for(const c of added){assert(U.groups.some(([id])=>id===c.collection));assert(c.notes.length>0,c.id);assert(c.duration>0);assert(fs.statSync(c.audio.replace(/^\.\//,'')).size>1000);assert.equal(c.parts[0].start,0);assert.equal(c.parts[0].end,c.duration);notes+=c.notes.length;
 c.notes.forEach((n,i)=>{assert(n.start>=0&&n.end>n.start&&n.end<=c.duration+.02,c.id);assert(Number.isInteger(n.midi)&&n.midi>=21&&n.midi<=108);assert(typeof n.review==='boolean');if(i)assert(n.start>=c.notes[i-1].start);});
 for(let part=0;part<c.parts.length;part++)for(const speed of [25,50,100,125])for(const shift of [-12,0,12]){const p=U.plan(c.id,part,speed,shift);assert(p);assert.equal(p.bpm,60*speed/100);assert.equal(p.audio,c.audio);assert(p.beats>0);p.bass.forEach(n=>assert(n.beat>=0&&n.length>0&&n.beat+n.length<=p.beats+.002));combinations++;}
}
const html=fs.readFileSync('index.html','utf8');assert(html.indexOf('african-data-rc274.js')<html.indexOf('uploaded-core-rc267.js'));assert(fs.readFileSync('sw.js','utf8').includes('african-data-rc274.js?v=rc274'));
console.log(`PASS 72 unique recordings; 10 new African-style lessons, ${notes} detected notes, ${combinations} section/speed/transpose combinations and genre mapping.`);
