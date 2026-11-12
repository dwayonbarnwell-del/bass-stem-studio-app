'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
function fn(name){const start=html.indexOf('  function '+name+'(');assert(start>=0,name);return html.slice(start,html.indexOf('\n  }',start)+4);}
const c={buffer:{duration:90},audioKeyReady:true,audioKeySections:[],keyCorrections:[],detectedBaseScale:null,detectedScaleContext:null,currentScaleContext:null,transposeSemitones:0,songScale:{textContent:'—'},songScaleWrap:{title:'',classList:{toggle(){}}},populateScaleSelect:()=>{},refreshNoteNumberToggle:()=>{},rebuildSimpleTimeline:()=>{}};
vm.createContext(c);
vm.runInContext(html.slice(html.indexOf('  const SCALE_ROOTS='),html.indexOf('  function compactScaleTextFor('))+fn('parseSongScaleContext')+fn('savedSongScaleContext')+fn('updateSectionKey'),c);
c.audioKeyBuffer=c.buffer;
let checks=0;
const check=(value,expected,label)=>{assert.equal(value,expected,label);checks++;};
function run(t,expected,label){c.updateSectionKey(t);check(c.songScale.textContent,expected,label);}
c.detectedBaseScale=c.parseSongScaleContext('Bb major');
c.audioKeySections=[{start:0,end:30,scale:''},{start:30,end:60,scale:'C major'},{start:60,end:90,scale:''}];
run(0,'Bb Maj','uncertain opening retains song key');
check(c.songScaleWrap.title,'Estimated song key: Bb major','fallback identified as song key');
run(35,'C Maj','confident modulation takes priority');
run(65,'Bb Maj','uncertain section returns to song key');
c.audioKeySections=[];
run(0,'Bb Maj','failed section detection retains song key');
c.transposeSemitones=2;
run(0,'C Maj','transpose applies once to fallback');
c.audioKeySections=[{start:0,end:90,scale:'D minor'}];
run(0,'E Min','modulated minor key transposes correctly');
c.keyCorrections=[{start:0,end:90,scaleText:'F major'}];
run(0,'G Maj','manual correction takes priority');
run(90,'G Maj','song ending retains corrected key');
c.keyCorrections=[];c.audioKeySections=[];c.detectedBaseScale=null;
run(0,'—','unknown song does not inherit previous section key');
c.audioKeyReady=false;
run(0,'—','new unanalysed song stays unknown');
for(const [analysis,expected] of [
 [{scale:'—',baseScale:{rootPc:10,mode:'major',scaleText:'Bb Maj'}},'Bb Maj'],
 [{scale:'',baseScale:{rootPc:2,mode:'minor'}},'D Min'],
 [{scale:'C Maj',baseScale:{rootPc:10,mode:'major'}},'Bb Maj'],
 [{scale:'F# minor'},'F# minor'],
 [{scale:'—'},undefined],
 [{baseScale:{rootPc:99,mode:'bad'},scale:'C major'},'C major']
])check(c.savedSongScaleContext(analysis)?.scaleText,expected,'saved key recovery');
check((html.match(/scale:String\(detectedBaseScale\?\.scaleText\|\|detectedScaleContext\?\.scaleText\|\|'—'\)/g)||[]).length,2,'both exports preserve original song key');
check(html.includes('song_scale:savedScale?.scaleText'),true,'import uses recovered base key');
for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
console.log(`PASS ${checks} song key checks: uncertainty, modulation, correction, transpose and saved key recovery; inline scripts parse.`);
