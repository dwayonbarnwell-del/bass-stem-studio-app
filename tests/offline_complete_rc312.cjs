const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const origin='https://test.local',scope=origin+'/app/',handlers={},files=new Map();let offline=false, installationStatus=503, activated=false;
const normal=k=>new URL(typeof k==='string'?k:k.url,scope).href;
const cache={async addAll(paths){for(const p of paths){assert(fs.existsSync(p.split('?')[0]),p);files.set(normal(p),new Response(fs.readFileSync(p==='./'?'index.html':p.split('?')[0])));}},async match(k){return files.get(normal(k))?.clone()},async put(k,v){files.set(normal(k),v)}};
const ctx={URL,Response,AbortController,setTimeout,clearTimeout,self:{location:{origin},registration:{scope},addEventListener:(n,f)=>handlers[n]=f,skipWaiting:async()=>{activated=true},clients:{claim:async()=>{}}},caches:{open:async()=>cache,keys:async()=>[],delete:async()=>true},fetch:async request=>{if(typeof request==='string'&&request.includes('song-reference/data.js'))return new Response(installationStatus===200?fs.readFileSync('song-reference/data.js'):'Unavailable',{status:installationStatus,headers:{'Content-Type':'application/javascript'}});if(offline)throw Error('Network disconnected');return new Response('network');}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('sw.js','utf8')+';this.paths=APP_SHELL;',ctx);
async function fetchPath(path,mode='cors'){let response;const pending=[];handlers.fetch({request:{url:normal(path),method:'GET',mode},respondWith:p=>response=p,waitUntil:p=>pending.push(p)});const r=await response;await Promise.all(pending);return r;}
(async()=>{let installation;const install=()=>{handlers.install({waitUntil:p=>installation=p});return installation;};
for(const status of [503,206]){installationStatus=status;await assert.rejects(install(),/Incomplete/);assert.equal(activated,false);}
installationStatus=200;await install();assert(activated);
const catalogue=ctx.paths.find(p=>p.includes('song-reference/data.js')),saved=await cache.match(catalogue);
assert.equal(saved.headers.get('Content-Type'),'application/javascript');
assert.deepEqual(Buffer.from(await saved.arrayBuffer()),fs.readFileSync('song-reference/data.js'));
const typeOnly=new Set(['./ear-source/vendor/soundtouch/core/SampleBuffer.js','./ear-source/vendor/soundtouch/core/StretchPipe.js']);
offline=true;for(const p of ctx.paths){const r=await fetchPath(p);assert.equal(r.status,200,p);const bytes=Buffer.from(await r.arrayBuffer()),expected=fs.readFileSync(p==='./'?'index.html':p.split('?')[0]);assert.deepEqual(bytes,expected,p);assert(bytes.byteLength||typeOnly.has(p),p);}
for(const path of ['./?v=RC312','./reopened-song']){const r=await fetchPath(path,'navigate');assert((await r.text()).includes('Bass Stem Studio'));}
assert.equal(await fetchPath('./private-song.json'),undefined,'private audio stays outside shell cache');
offline=false;assert.equal(await(await fetchPath('./?v=RC312','navigate')).text(),'network');
console.log('PASS all '+ctx.paths.length+' shell assets and query/deep navigation without network; online recovery; private songs not intercepted.');})().catch(e=>{console.error(e);process.exitCode=1;});
