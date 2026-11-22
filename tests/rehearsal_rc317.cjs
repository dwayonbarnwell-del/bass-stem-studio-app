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
assert.equal(highlife.filter(n=>n.role==='fill').length,3);
assert(highlife.filter(n=>n.role==='fill').every(n=>n.time>2.5&&n.stop<=3));
assert.equal(C.fit({...options,chords:[{...manualChords[0],end:2.5},manualChords[1]],shape:rhythm('makossa')}).some(n=>n.time>=2.5&&n.time<3),false);
assert(C.fit({...options,grid:null,shape:[]}).every(n=>n.role==='root'));
const quiet=C.fit({...options,shape:rhythm('makossa'),quiet:[{start:2,end:3.5}]});
assert(quiet.every(n=>n.stop<=2||n.time>=3.5),'the guide leaves genuine quiet gaps empty');
assert(highlife.every(n=>n.midi>=23&&n.midi<=59&&n.stop<=5));
console.log('PASS silence, detected pulse, variable timing, tap/manual grid, style library, chord inversions, fills and rests.');

async function playerTest(){
  const items=new Map(),scheduled=[],bands=[],intervals=new Map();
  let now=0,clock=0,songSession=0,mixRequests=0,library=false;
  class Control{
    constructor(){this.value='';this.dataset={};this.options=[];this.attrs=new Map();}
    add(option){this.options.push(option);if(this.options.length===1)this.value=option.value;}
    replaceChildren(...opts){this.options=[];this.value='';opts.forEach(o=>this.add(o));}
    setAttribute(key,value){this.attrs.set(key,value);}
    getAttribute(key){return this.attrs.get(key);}
    set selectedIndex(i){this.value=this.options[i]?.value||'';}
  }
  const host={hidden:false,querySelector(id){if(!items.has(id))items.set(id,new Control());return items.get(id);}};
  const $=id=>host.querySelector('#'+id);
  function value(id,text){$(id).value=text;}
  const clip={...buffer,duration:4,length:4*sampleRate,getChannelData:()=>pcm.subarray(8*sampleRate,12*sampleRate)};
  const song={title:'Fixture',session:0,buffer:clip,duration:4,chords:[],sections:[]};
  Object.assign(context.window,{BassRehearsalCore:C,BassChordRecovery:{scan:async()=>({added:[]})},
    BassPracticeAudio:{prepare:async()=>{},tone:(ctx,midi,when)=>{scheduled.push({midi,when});return {stop(){}};}}});
  Object.assign(context,{Option:class{constructor(text,value){this.text=text;this.value=String(value);}},
    setInterval:fn=>{intervals.set(++clock,fn);return clock;},clearInterval:id=>intervals.delete(id),
    AudioContext:class{
      get currentTime(){return now;}
      async resume(){}
      createBufferSource(){return {connect(gain){return gain;},start(when,offset){bands.push({node:this,when,offset});},stop(){this.stopped=true;},disconnect(){}};}
      createGain(){return {gain:{},connect(){}};}
    }});
  vm.runInContext(fs.readFileSync('ear-source/rehearsal.js','utf8'),context);
  const panel=context.window.BassRehearsal;
  panel.init(host,{get:()=>({...song}),session:()=>songSession,
    pickAudio:(input,open)=>open({name:'Imported fixture'}),
    importAudio:async file=>{song.title=file.name;song.session=++songSession;return true;},
    openLibrary:()=>{library=true;},band:async()=>{mixRequests++;return clip;}});
  panel.refresh();
  assert.equal($('rehearsalTitle').textContent,'Fixture');
  await $('rehearsalImport').onclick();
  assert.equal($('rehearsalTitle').textContent,'Imported fixture');
  value('rehearsalStart','0:00');value('rehearsalEnd','0:04');value('rehearsalBpm','120');
  value('rehearsalChords','C G/B');value('rehearsalMix','full');value('rehearsalGain','70');
  value('rehearsalStyle','highlife');value('rehearsalFill','ends');
  $('rehearsalGuide').setAttribute('aria-pressed','true');
  $('rehearsalPlay').onclick();await new Promise(resolve=>setImmediate(resolve));
  assert.equal($('rehearsalPlay').textContent,'Pause');
  assert.equal(bands.length,1);
  assert.equal(bands[0].node.loopEnd-bands[0].node.loopStart,4);
  assert(scheduled.length&&/Fill at/.test($('rehearsalNotes').textContent));
  const firstPattern=$('rehearsalPattern').value;value('rehearsalStyle','makossa');$('rehearsalStyle').onchange();
  assert.notEqual($('rehearsalPattern').value,firstPattern);
  for(let i=1;i<=53;i++){now=i*.08;for(const run of [...intervals.values()])run();}
  assert.equal(bands.length,1,'the original band continues when the style switches');
  assert(scheduled.some(n=>n.when>=4),'bass continues after the recording loop');
  $('rehearsalPlay').onclick();
  assert(bands[0].node.stopped);
  value('rehearsalMix','noBass');$('rehearsalPlay').onclick();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(mixRequests,1);
  $('rehearsalPlay').onclick();$('rehearsalPlay').onclick();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(mixRequests,1,'already prepared rehearsal audio is reused');
  $('rehearsalLibrary').onclick();assert(library&&bands.at(-1).node.stopped);
  console.log('PASS import, playback and uninterrupted style switching, cached band mix, and Library hand-off.');
}
playerTest().catch(error=>{console.error(error);process.exitCode=1;});
