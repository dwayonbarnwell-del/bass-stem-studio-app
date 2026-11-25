const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync('ai-source/piano.js','utf8'),html=fs.readFileSync('index.html','utf8');
assert.equal(html.match(/<script id="rc239-piano-preview">([\s\S]*?)<\/script>/)[1].trim(),src.trim());
class Element{
 constructor(){this.value='';this.hidden=false;this.open=false;this.children=[];this.style={setProperty(){}};this.attributes={};}
 setAttribute(k,v){this.attributes[k]=v;} append(...items){this.children.push(...items);} remove(){} close(){this.open=false;}
 click(){if(this.download)downloads.push({name:this.download,blob:urls.get(this.href)});}
}
const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);},downloads=[],urls=new Map(),body=new Element();
let serial=0,request,hold,session=1,prints=0;
const state={buffer:{},duration:12,transpose:2,busy:false,playing:false,time:0,session:1,title:'Fixture.wav',repeatRanges:[{start:1,end:2},{start:4,end:5}],chords:[{start:0,end:12,label:'D'}]};
const bass=[{midi:23,start:0,end:3,manual:true},{midi:28,start:4,end:6,manual:true},{midi:35,start:8,end:10}],melody=[{midi:72,start:0,end:3}],original=JSON.stringify({bass,melody});
const env={window:{addEventListener(){},print(){prints++;}},document:{getElementById:get,createElement:()=>new Element(),body},Blob,URL:{createObjectURL:b=>{const u='blob:'+ ++serial;urls.set(u,b);return u;},revokeObjectURL(){}},setTimeout:()=>0,clearTimeout(){},requestAnimationFrame:()=>0,cancelAnimationFrame(){}};
vm.createContext(env);vm.runInContext(fs.readFileSync('ai-source/piano-audio.js','utf8'),env);
env.window.BassPianoAudio.exportAudio=async options=>{request=options;if(hold)await hold;return new Blob([options.format==='wav'?'RIFF':'MP3'],{type:options.format==='wav'?'audio/wav':'audio/mpeg'});};
const instrumented=src.replace(' return {outputLatency:', ' return {__test:{set(hooks,value,bass){api=hooks;data=value;bassFlow=bass;},exportRange,exportFile,printSheet},outputLatency:');assert.notEqual(instrumented,src);
vm.runInContext(instrumented,env);const piano=env.window.BassPiano,test=piano.__test,api={get:()=>({...state,session}),bassNotes:()=>bass,pause(){},encoder(){throw Error('Unexpected encoder request');}};
get('pianoViewPanel').hidden=true;get('pianoExportScope').value='selection';get('pianoExportDialog').open=true;
const saved={version:2,notes:melody,done:[{start:0,end:12}],jobs:{}};test.set(api,saved,true);
const plain=v=>JSON.parse(JSON.stringify(v));
(async()=>{
 const r=test.exportRange();assert.equal(r.end,2);assert.deepEqual(plain(r.notes.map(n=>[n.midi,n.start,n.end,n.originalStart])),[[23,0,1,1],[28,1,2,4]]);
 piano.render();assert.equal(get('pianoExport').disabled,false);assert.equal(get('pianoMidi').disabled,false);assert.equal(get('pianoExportTitle').textContent,'Export bass');
 await test.exportFile('mid');const midi=new Uint8Array(await downloads.at(-1).blob.arrayBuffer());assert.equal(downloads.at(-1).name,'Fixture - bass-flow.mid');assert.equal(String.fromCharCode(...midi.slice(0,4)),'MThd');assert(midi.some((v,i)=>v===0xc0&&midi[i+1]===33));assert(midi.some((v,i)=>v===0x90&&midi[i+1]===25));assert(midi.some((v,i)=>v===0x90&&midi[i+1]===30));assert(!midi.some((v,i)=>v===0x90&&midi[i+1]===74));
 for(const format of ['wav','mp3']){await test.exportFile(format);assert.equal(request.sound,'bass');assert.deepEqual(plain(request.notes.map(n=>[n.midi,n.start,n.end])),[[25,0,1],[30,1,2]]);assert.equal(downloads.at(-1).name,'Fixture - bass-flow.'+format);}
 test.printSheet();assert.equal(prints,1);const sheet=body.children.at(-1);assert(sheet.children[0].textContent.includes('Bass notes'));const rows=sheet.children[2].children[1].children;assert.equal(rows.length,2);assert.equal(rows[0].children[0].textContent,'0:01.00');assert.equal(rows[0].children[1].textContent,'C♯1');assert.equal(rows[1].children[0].textContent,'0:04.00');
 get('pianoExportScope').value='whole';const full=test.exportRange();assert.deepEqual(plain(full.notes.map(n=>n.midi)),[23,28,35]);assert.equal(full.end,12);
 let release;hold=new Promise(resolve=>release=resolve);const count=downloads.length,exporting=test.exportFile('wav');session++;release();await exporting;hold=null;assert.equal(downloads.length,count,'a different song cancels the pending download');
 state.transpose=-5;await test.exportFile('mid');const low=new Uint8Array(await downloads.at(-1).blob.arrayBuffer());assert(low.some((v,i)=>v===0x90&&low[i+1]===18),'downward key changes retain bass below the piano range');state.transpose=2;
 test.set(api,saved,false);get('pianoExportDialog').open=true;get('pianoExportScope').value='selection';await test.exportFile('mid');assert.equal(downloads.at(-1).name,'Fixture - melody.mid');const vocal=new Uint8Array(await downloads.at(-1).blob.arrayBuffer());assert(vocal.some((v,i)=>v===0xc0&&vocal[i+1]===0));assert(vocal.some((v,i)=>v===0x90&&vocal[i+1]===74));
 test.set(api,{...saved,notes:[]},true);piano.render();assert.equal(get('pianoExport').disabled,false,'bass export works without vocal melody');
 test.set({...api,bassNotes:()=>[]},saved,true);piano.render();assert.equal(get('pianoExport').disabled,true,'no bass data cannot export the vocal melody instead');
 assert.equal(JSON.stringify({bass,melody}),original);console.log('PASS Bass flow MIDI/WAV/MP3/print dispatch, low B, displayed key, whole song, non-adjacent clipped repeats, filenames, cancellation, melody isolation and unchanged source notes.');
})().catch(e=>{console.error(e);process.exitCode=1;});
