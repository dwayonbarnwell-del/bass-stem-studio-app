const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8'),start=html.indexOf('  function rebuildSimpleTimeline()'),end=html.indexOf('\n  function ',start+10),source=html.slice(start,end);
class Element{
 constructor(){this.children=[];this.dataset={};this.attributes={};this.style={setProperty(){}};this.className='';this.classList={add:n=>this.className+=' '+n,contains:n=>this.className.split(' ').includes(n)};}
 set innerHTML(v){this.children=[];} appendChild(v){this.children.push(v);} setAttribute(k,v){this.attributes[k]=v;} querySelectorAll(){return [];}
}
const ruler=new Element(),lane=new Element(),scroller={clientHeight:360,scrollTop:12};lane.parentElement=new Element();
const selected=new Set([1,4]),ctx={document:{documentElement:{dataset:{fontPx:'14'}},createElement:()=>new Element()},buffer:{duration:6},noteLane:lane,timeRuler:ruler,timelineScroll:scroller,TIMELINE_CELL_SECONDS:1,notes:[],currentScaleContext:{rootPc:0,mode:'major'},detectedChordChanges:[],noteDisplayMode:'notes',numberingConvention:'key',transposeSemitones:0,practiceCells:Array.from({length:6},()=>({width:40,noteColumns:1,chordColumns:1})),practiceDisplayRange:()=>({centre:36}),fitPracticeTimeline(){},updateTimelineGeometry(){},timelineCellWidth:()=>40,timelineCellLeft:i=>i*40,inlineNoteEditor:null,fmtShort:String,isTimelineMajor:()=>false,selectedTimeframes:selected,normaliseTimeframeStart:Number,rebuildChordRuler(){},classifyTimelineNotes:()=>[],window:{BassPlaybackTiming:{index:()=>null}},updateSimpleTimeline(){}};
vm.createContext(ctx);vm.runInContext(source,ctx);
function check(){for(const host of [ruler,lane]){assert.equal(host.children.length,6);for(let i=0;i<6;i++)assert.equal(host.children[i].attributes['aria-pressed'],String(selected.has(i)),'selection must be announced for cell '+i);}}
ctx.rebuildSimpleTimeline();check();ctx.transposeSemitones=2;ctx.currentScaleContext.rootPc=2;ctx.rebuildSimpleTimeline();check();assert.deepEqual([...selected],[1,4]);
console.log('PASS selected repeat cells remain announced after a key-driven timeline rebuild; unselected cells stay false.');
