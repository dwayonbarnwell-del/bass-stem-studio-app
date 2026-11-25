const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../ear-source/rehearsal-core.js');
const sampleRate=8000,pcm=new Float32Array(32*sampleRate);
for(let i=8*sampleRate;i<24*sampleRate;i++){
  const t=i/sampleRate,attack=(t-.08)% .5;
  pcm[i]=.08*Math.sin(t*2*Math.PI*196)+.55*Math.sin(t*2*Math.PI*75)*Math.exp(-Math.max(0,attack)*37);
}
const buffer={duration:32,sampleRate,numberOfChannels:1,getChannelData:()=>pcm};
const candidates=C.passages(buffer);
assert(candidates.length&&candidates[0].start>=4&&candidates[0].end<=28,'quiet gaps are not the recommended loop');
assert.equal(C.pulse(buffer,0,7),null);
assert.deepEqual(C.quietRanges(buffer,5,26),[{start:5,end:8},{start:24,end:26}]);
const pulse=C.pulse(buffer,8,24);
assert(pulse&&Math.abs(pulse.bpm-120)<3);
assert(Math.abs(pulse.anchor% .5-.08)<.055,'phase is measured in the recording');

const beatTimes=[.1,.57,1.1,1.57,2.12,2.62,3.17,3.65,4.15];
const grid=C.beatGrid({start:.05,end:4.2,beats:beatTimes,confidence:.9});
assert.deepEqual(grid.points,beatTimes,'saved variable beat timings are preserved');
const manual=C.beatGrid({start:1,end:5,manualBpm:120});
assert.equal(manual.points[0],1);
assert.equal(manual.points.at(-1),5);
const manualChords=C.barChords('C G/B',manual);
assert.equal(manualChords[1].bassPc,11);
assert.throws(()=>C.barChords('C unknown',manual),/Check the chord unknown/);

const context=vm.createContext({window:{},localStorage:{getItem(){return null;}}});
for(const f of ['fills-rc264.js','practice-rc264b.js','catalogue-rc269.js','accompaniment-rc293.js']){
  vm.runInContext(fs.readFileSync('ear-source/'+f,'utf8'),context);
}
const {BassPracticeCore:P,BassAccompaniment:H}=context.window;
for(const style of ['worship','gospel','praise','highlife','makossa','afrobeat','reggae','soukous']){
  const index=P.lines.findIndex(l=>H.identify(l)===style);
  assert(index>=0,style);
  assert(C.pattern(P.lines[index],P,index).length>=3,style);
}
const rhythm=style=>{
  const index=P.lines.findIndex(l=>H.identify(l)===style);
  return C.pattern(P.lines[index],P,index);
};
const options={chords:manualChords,start:1,end:5,grid:manual};
const highlife=C.fit({...options,shape:rhythm('highlife'),fill:'ends'});
const makossa=C.fit({...options,shape:rhythm('makossa'),fill:'off'});
assert.notDeepEqual(highlife.map(n=>n.time),makossa.map(n=>n.time));
assert.equal(highlife.find(n=>Math.abs(n.time-3)<.02).midi%12,11,'inversion guides the landing');
assert.equal(highlife.filter(n=>n.role==='fill').length,6,'fills also lead into the loop restart');
assert(highlife.filter(n=>n.role==='fill').every(n=>n.time>2.5&&n.stop<=3||n.time>4.5&&n.stop<=5));
assert(C.fit({...options,chords:[{...manualChords[0],end:2.5},manualChords[1]],shape:rhythm('makossa')}).filter(n=>n.time>=2.5&&n.time<3).every(n=>n.midi===null),'unknown harmony keeps an unpitched rhythm');
assert(C.fit({...options,grid:null,shape:[]}).every(n=>n.role==='root'));
const quiet=C.fit({...options,shape:rhythm('makossa'),quiet:[{start:2,end:3.5}]});
assert(quiet.every(n=>n.stop<=2||n.time>=3.5),'the guide leaves genuine quiet gaps empty');
assert(highlife.every(n=>(n.midi===null||n.midi>=23&&n.midi<=59)&&n.stop<=5));
console.log('PASS silence, detected pulse, variable timing, tap/manual grid, style library, chord inversions, fills and rests.');

async function playerTest(){
  const items=new Map(),scheduled=[],bands=[],intervals=new Map();
  let now=0,clock=0,songSession=0,mixRequests=0,savedPlans=0,library=false,fretDraw;
  class Control{
    constructor(){this.value='';this.dataset={};this.options=[];this.children=[];this.attrs=new Map();this.style={};this.classList={toggle:(name,on)=>this[name]=on};}
    add(option){this.options.push(option);if(this.options.length===1)this.value=option.value;}
    replaceChildren(...opts){this.options=[];this.children=opts;this.value='';opts.forEach(o=>{if(o.value!==undefined)this.add(o);});}
    append(...children){this.children.push(...children);}
    setAttribute(key,value){this.attrs.set(key,value);}
    getAttribute(key){return this.attrs.get(key);}
    set selectedIndex(i){this.value=this.options[i]?.value||'';}
  }
  const host={hidden:false,dataset:{},querySelector(id){if(!items.has(id))items.set(id,new Control());return items.get(id);}};
  const $=id=>host.querySelector('#'+id);
  function value(id,text){$(id).value=text;}
  const clip={...buffer,duration:4,length:4*sampleRate,getChannelData:()=>pcm.subarray(8*sampleRate,12*sampleRate)};
  const song={title:'Fixture',session:0,buffer:clip,duration:4,chords:[],sections:[]};
  Object.assign(context.window,{BassRehearsalCore:C,BassChordRecovery:{scan:async()=>({added:[]})},
    BassFretFlow:{create:()=>({init({get},host){this.get=get;this.host=host;},draw(time){fretDraw={...this.get(),time,wide:this.host['ff-single-board']};}})},
    BassPracticeAudio:{prepare:async()=>{},muted:(ctx,when)=>{scheduled.push({midi:null,when});return {stop(){}};},tone:(ctx,midi,when)=>{scheduled.push({midi,when});return {stop(){}};}}});
  Object.assign(context,{document:{createElement:()=>new Control()},Option:class{constructor(text,value){this.text=text;this.value=String(value);}},
    requestAnimationFrame:fn=>{const id=++clock;intervals.set(id,()=>{intervals.delete(id);fn();});return id;},cancelAnimationFrame:id=>intervals.delete(id),
    setTimeout,clearTimeout,setInterval:fn=>{intervals.set(++clock,fn);return clock;},clearInterval:id=>intervals.delete(id),
    AudioContext:class{
      get currentTime(){return now;}
      async resume(){}
      createBufferSource(){return {connect(gain){return gain;},start(when,offset){bands.push({node:this,when,offset});},stop(){this.stopped=true;},disconnect(){}};}
      createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){}},connect(){},disconnect(){}};}
    }});
  vm.runInContext(fs.readFileSync('ear-source/rehearsal.js','utf8'),context);
  const panel=context.window.BassRehearsal;
  panel.init(host,{get:()=>({...song}),session:()=>songSession,
    savePhrases:(plan,session)=>{assert.equal(session,song.session);song.rehearsalPhrases=JSON.parse(JSON.stringify(plan));savedPlans++;},
    pickAudio:(input,open)=>open({name:'Imported fixture'}),
    importAudio:async file=>{song.title=file.name;song.session=++songSession;return true;},
    openLibrary:()=>{library=true;},band:async()=>{mixRequests++;return clip;}});
  panel.refresh();
  assert.equal($('rehearsalTitle').textContent,'Fixture');
  assert(!host.innerHTML.includes('Bassline &amp; fill notes'));
  assert(host.innerHTML.includes('aria-pressed="true">Original bass off'));
  assert.equal($('rehearsalPassage').options[0].text,'Full song');
  assert.equal($('rehearsalPassage').value,'0');
  assert.equal(savedPlans,1,'phrase times save automatically');
  panel.refresh();assert.equal(savedPlans,1,'an unchanged song is not written again');
  panel.close();panel.refresh();assert.equal(savedPlans,1,'reopening reuses the stored timeline');
  for(const meter of [3,4]){
   const fixture={...buffer,duration:24,length:24*sampleRate};
   Object.assign(song,{buffer:fixture,duration:24,sections:[{name:'Chorus',start:0,end:24}],meter,confidence:.98,phase:0,beats:Array.from({length:49},(_,i)=>i*.5)});
   panel.refresh();
   const options=$('rehearsalPassage').options.slice(1);
   assert.equal(options.length,2,'one chronological set replaces the overlapping short picks');
   for(const o of options){
    $('rehearsalPassage').value=o.value;$('rehearsalPassage').onchange();
    const seconds=id=>Number($(id).value.slice(2));
    const count=(seconds('rehearsalEnd')-seconds('rehearsalStart'))/(meter*.5);
    assert(Number.isInteger(count)&&count*meter*.5>=10&&count*meter*.5<=15);
   }
  }
  value('rehearsalMusic','37');value('rehearsalGain','80');value('rehearsalStyle','highlife');
  song.notes=[{start:1,end:1.3,midi:36}];panel.refresh();
  assert.equal($('rehearsalPassage').value,'2','background analysis keeps the selected phrase');
  assert.equal($('rehearsalMusic').value,'37');assert.equal($('rehearsalGain').value,'80');
  assert.equal($('rehearsalStyle').value,'highlife','background analysis keeps manual source and levels');
  Object.assign(song,{buffer:clip,duration:4,sections:[],beats:[],confidence:0,meter:4});panel.refresh();
  await $('rehearsalImport').onclick();
  assert.equal($('rehearsalTitle').textContent,'Imported fixture');
  value('rehearsalStart','0:00');value('rehearsalEnd','0:04');value('rehearsalBpm','120');
  $('rehearsalBpm').onchange();value('rehearsalChords','C G/B');value('rehearsalGain','100');
  value('rehearsalView','notes');value('rehearsalStyle','highlife');value('rehearsalFill','bar');
  $('rehearsalGuide').setAttribute('aria-pressed','true');
  $('rehearsalPlay').onclick();await new Promise(resolve=>setImmediate(resolve));
  assert.equal($('rehearsalPlay').textContent,'Pause');
  assert.equal(host.dataset.playing,'true','setup collapses while the loop plays');
  assert.equal(bands.length,1);
  assert.equal(bands[0].node.loopEnd-bands[0].node.loopStart,4);
  assert.equal(mixRequests,1,'separation is used for the default mix');
  assert(scheduled.length);
  const timeline=$('rehearsalTimeline');
  assert.deepEqual(timeline.children.map(column=>column.children[0].textContent),['0:00','0:01','0:02','0:03']);
  assert(timeline.children.every(column=>/^\d+:\d{2}$/.test(column.children[0].textContent)));
  assert(timeline.children.some(column=>column.children.some(note=>note.className==='rehearsal-fill-note')));
  assert(!timeline.children.some(column=>column.children.some(note=>note.active)),'the highlight waits for the audible loop');
  now=.08;for(const run of [...intervals.values()])run();
  assert(timeline.children.some(column=>column.children.some(note=>note.active)));
  value('rehearsalView','fret');$('rehearsalView').onchange();
  assert(fretDraw.notes.some(note=>note.isFill));assert.equal(fretDraw.wide,false);
  value('rehearsalView','fret2');$('rehearsalView').onchange();
  assert.equal(fretDraw.wide,true);
  assert.equal(bands.length,1,'view switches leave the audio clock running');
  const firstPattern=$('rehearsalPattern').value;value('rehearsalStyle','makossa');$('rehearsalStyle').onchange();
  assert.notEqual($('rehearsalPattern').value,firstPattern);
  for(let i=1;i<=53;i++){now=i*.08;for(const run of [...intervals.values()])run();}
  assert.equal(bands.length,1,'the original band continues when the style switches');
  assert(scheduled.some(n=>n.when>=4),'bass continues after the recording loop');
  $('rehearsalMix').onclick();await new Promise(resolve=>setImmediate(resolve));
  assert.equal($('rehearsalMix').getAttribute('aria-pressed'),'false');
  assert.equal(bands.length,2,'restoring original bass switches audio on the running loop');
  assert(bands[0].node.stopped);
  assert(Math.abs(bands[1].offset-(bands[1].when-bands[0].when)%4)<.001,'band switch preserves the loop position');
  assert.equal(mixRequests,1);
  $('rehearsalMix').onclick();await new Promise(resolve=>setImmediate(resolve));
  $('rehearsalPlay').onclick();
  assert.equal(host.dataset.playing,'false');
  assert.equal(fretDraw.highlight,false,'pausing clears the fret highlight');
  $('rehearsalPlay').onclick();await new Promise(resolve=>setImmediate(resolve));
  $('rehearsalPlay').onclick();$('rehearsalPlay').onclick();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(mixRequests,1,'already prepared rehearsal audio is reused');
  await $('rehearsalLibrary').onclick();assert(library&&bands.at(-1).node.stopped);
  song.buffer={...clip,duration:36.137,length:Math.ceil(36.137*sampleRate),getChannelData:()=>new Float32Array(Math.ceil(36.137*sampleRate))};
  song.duration=36.137;song.session=++songSession;
  song.notes=[{start:0,end:.18,midi:37},{start:.5,end:.8,midi:42}];
  panel.refresh();
  assert.equal($('rehearsalPassage').value,'0','new recordings select the full song');
  assert.equal($('rehearsalEnd').value,'0:36.14');
  assert.equal($('rehearsalStyle').value,'auto');
  assert.equal(Number($('rehearsalMusic').value),50);
  assert.equal(Number($('rehearsalGain').value),100);
  $('rehearsalMix').onclick();
  $('rehearsalPlay').onclick();await new Promise(resolve=>setImmediate(resolve));
  assert.equal($('rehearsalPattern').value,'song-bass');
  value('rehearsalView','fret');$('rehearsalView').onchange();
  assert.equal(JSON.stringify(fretDraw.notes.map(n=>[n.midi,n.start,n.end])),JSON.stringify([[37,0,.18],[42,.5,.8]]));
  assert.equal(bands.at(-1).node.loopEnd,36.137,'whole song uses both exact endpoints');
  $('rehearsalPlay').onclick();
  const last=$('rehearsalPassage').options.at(-1);$('rehearsalPassage').value=last.value;$('rehearsalPassage').onchange();
  const lastPhrase=song.rehearsalPhrases.phrases.at(-1);
  $('rehearsalPlay').onclick();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(bands.at(-1).node.loopStart,lastPhrase.start);
  assert.equal(bands.at(-1).node.loopEnd,36.137,'the final phrase retains the exact outro, rather than trimming to an earlier bar');
  panel.close();
  console.log('PASS import, playback and uninterrupted style switching, cached band mix, and Library hand-off.');
}
playerTest().catch(error=>{console.error(error);process.exitCode=1;});

async function backingTest(){
  class AudioBuffer{
    constructor({numberOfChannels,length,sampleRate}){
      Object.assign(this,{numberOfChannels,length,sampleRate,duration:length/sampleRate});
      this.pcm=Array.from({length:numberOfChannels},()=>new Float32Array(length));
    }
    getChannelData(c){return this.pcm[c];}
  }
  const rate=44100,requests=[],master={addEventListener(){}};
  const window={};
  vm.runInNewContext(fs.readFileSync('fretflow-source/backing.js','utf8'),{
    window,AudioBuffer,Audio:class{addEventListener(){}},setTimeout,DOMException
  });
  const backing=window.BassBacking;
  let session=1;
  backing.init({get:()=>({session,master,duration:24}),extract:async(start,end)=>{
    requests.push([start,end]);
    const mix=new AudioBuffer({numberOfChannels:6,length:Math.ceil((end-start)*rate),sampleRate:rate});
    for(let c=0;c<6;c++)mix.getChannelData(c).fill(c<2?.1:c<4?.9:.2);
    return mix;
  }});
  const prepare=(a,b)=>backing.rehearsalBand(a,b,()=>{},()=>false);
  const first=await prepare(2,7);
  assert.equal(first.duration,5);
  assert(Math.abs(first.getChannelData(1)[0]-.3)<.00001,'mix contains music and vocals with no bass stem');
  const adjacent=await prepare(6,12);
  assert.equal(adjacent.duration,6);
  assert.equal(requests.length,2,'overlap reuses the first block');
  const whole=await prepare(0,24);
  assert.equal(whole.duration,24);
  assert.equal(requests.length,3,'whole song reuses both earlier blocks');
  session++;
  await prepare(2,7);
  assert.equal(requests.length,4,'changing songs discards the prior stems');
  console.log('PASS shared bass-free blocks across overlapping passages and full-song loops.');
}
backingTest().catch(error=>{console.error(error);process.exitCode=1;});

async function playbackPriorityTest(){
  const window={},master={paused:false,addEventListener(){}};
  vm.runInNewContext(fs.readFileSync('fretflow-source/backing.js','utf8'),{
    window,setTimeout,Audio:class{addEventListener(){} pause(){}}
  });
  let extracts=0,practising=false;
  window.BassBacking.init({get:()=>({master,session:7,duration:240,loaded:true}),
    update(){},setMuted(){},practiceActive:()=>practising,cacheKey:async()=>'',
    extract:async()=>{extracts++;throw Error('End of fixture');}
  });
  const task=window.BassBacking.prepareForSong();
  const wait=()=>new Promise(resolve=>setTimeout(resolve,250));
  await wait();assert.equal(extracts,0);
  practising=true;master.paused=true;await wait();assert.equal(extracts,0);
  practising=false;await task;assert.equal(extracts,1);
  console.log('PASS background preparation yields during playback and rehearsal, and resumes on pause.');
}
playbackPriorityTest().catch(error=>{console.error(error);process.exitCode=1;});
