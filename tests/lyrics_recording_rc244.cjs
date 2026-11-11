const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const root=path.join(__dirname,'..');
class Element{constructor(){this.children=[];this.hidden=false;this.classList={toggle(){}};this.listeners={};this.value='';}append(...x){this.children.push(...x)}replaceChildren(...x){this.children=x}before(){}after(){}setAttribute(){}addEventListener(type,fn,capture){(this.listeners[type]??=[]).push({fn,capture})}remove(){}click(){this.onclick?.()}}
function setup(){
 const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id)};
 let audio={session:1,hasAudio:true,title:'Other song',duration:200},saved=[],calls=[],permit=true;
 const window={BassLyrics:{songInfo:()=>audio,cancel(){},pause:()=>calls.push('pause'),refreshControls(){},importTimedLines:(lines,id)=>{calls.push('import:'+id);return permit},play:id=>calls.push('play:'+id),loadAudio:async()=>false},BassLibrary:{analysisSummary:async()=>({songs:saved}),openForAnalysis:async(location,id)=>{calls.push('open:'+id);audio={...saved.find(s=>s.id===id),hasAudio:true,session:audio.session+1};return true}}};
 const document={readyState:'loading',addEventListener(){},getElementById:id=>id==='lrclibPanel'?null:node(id),createElement:()=>{const e=new Element();Object.defineProperty(e,'id',{set(id){nodes.set(id,e)},get(){return ''}});return e},body:new Element()};
 const context={window,document,console,URL,setTimeout,clearTimeout,AbortController,navigator:{onLine:true}};vm.createContext(context);
 const js=fs.readFileSync(path.join(root,'ai-source/lrclib.js'),'utf8').replace('window.BassLRCLIB={','window.test={install,showPreview,playSelection,matchingRecording,sameTitle,resetPreview,getSelection:()=>selection};window.BassLRCLIB={');vm.runInContext(js,context);window.test.install();
 return {t:window.test,window,node,calls,setAudio:x=>audio=x,setSaved:x=>saved=x,setPermit:x=>permit=x};
}
const song={trackName:'Worthy Is The Lamb',artistName:'Hillsong',duration:180,syncedLyrics:'[00:01]Worthy is the Lamb\n[00:03]Amen'};
(async()=>{
 let c=setup();c.t.showPreview(song);await c.t.playSelection();assert(!c.calls.some(x=>x.startsWith('play:')));assert(!c.calls.some(x=>x.startsWith('import:')));assert.equal(c.node('lrclibStatus').textContent,'Load matching audio');
 assert(c.t.matchingRecording(song,{title:'Worthy Is The Lamb - Hillsong.mp3',duration:181}));assert(!c.t.matchingRecording(song,{title:'Worthy Is The Lamb',duration:300}));assert(!c.t.matchingRecording(song,{title:'Other song',duration:180}));assert(!c.t.matchingRecording(song,{title:'Worthy Is The Lamb',artist:'Another singer',duration:180}));
 c=setup();c.setSaved([{title:song.trackName,duration:180,artist:'Hillsong',location:'device',id:'saved'}]);c.t.showPreview(song);await c.t.playSelection();assert.deepEqual(c.calls.filter(x=>/^(open|import|play):/.test(x)),['open:saved','import:2','play:2']);assert(!c.window.BassLRCLIB.isBrowsing());
 c=setup();c.setAudio({session:4,title:song.trackName,duration:180,hasAudio:true});c.t.showPreview(song);await c.t.playSelection();assert(c.calls.includes('play:4'));
 c=setup();c.setAudio({session:4,title:song.trackName,duration:180,hasAudio:true});c.setPermit(false);c.t.showPreview(song);await c.t.playSelection();assert(!c.calls.includes('play:4'));
 c=setup();c.setSaved([{title:song.trackName,duration:180,id:'one'},{title:song.trackName,duration:180,id:'two'}]);c.t.showPreview(song);await c.t.playSelection();assert(!c.calls.some(x=>x.startsWith('open:')));
 c=setup();let finish;c.window.BassLibrary.analysisSummary=()=>new Promise(r=>finish=r);c.t.showPreview(song);const pending=c.t.playSelection();await c.t.playSelection();c.t.resetPreview();finish({songs:[{title:song.trackName,duration:180,id:'one'}]});await pending;assert(!c.calls.some(x=>x.startsWith('open:')));
 c=setup();c.t.showPreview(song);let blocked=false;c.node('lyricsPlay').listeners.click[0].fn({preventDefault(){},stopImmediatePropagation(){blocked=true}});assert(blocked);
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
 assert(!html.includes('song-tasks.'));assert(!html.includes('BassTaskAnalysis'));assert(!sw.includes('song-tasks.'));
 const layout=fs.readFileSync(path.join(root,'library-source/tools-layout.js'),'utf8');assert(!layout.includes('openToAnalyse'));assert(layout.includes('featured.append(chords,lyrics)'));assert(fs.readFileSync(path.join(root,'library-source/tools-layout.css'),'utf8').includes('repeat(2,minmax(0,1fr))'));
 for(const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){if(!/\bsrc=|application\/ld\+json/.test(m[1]))new vm.Script(m[2]);}
 console.log('PASS: wrong-song playback blocked, saved/current recording matching, duration and artist mismatch, cancellation, ambiguous recordings, stale results, duplicate clicks, feature removal and inline syntax.');
})().catch(e=>{console.error(e);process.exitCode=1});
