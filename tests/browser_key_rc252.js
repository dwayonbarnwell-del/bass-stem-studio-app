await test('uncertain section retains detected song scale',async()=>{
 const p=clone();p.analysis.scale='Bb major';p.analysis.baseScale={rootPc:10,mode:'major',scaleText:'Bb Maj'};
 p.analysis.keySections=[{start:0,end:8,scale:''}];p.analysis.keyReady=true;p.settings.transposeSemitones=0;
 check(await load(p),'fixture import');updateSectionKey(1);
 check(songScale.textContent==='Bb Maj'&&!scaleSelect.disabled,'song key blank');
 check(songScaleWrap.title.includes('song key'),'fallback not identified');
});
await test('saved blank scale recovers original key and transposition',async()=>{
 const p=clone();p.analysis.scale='—';p.analysis.baseScale={rootPc:10,mode:'major',scaleText:'Bb Maj'};
 p.analysis.keySections=[{start:0,end:8,scale:''}];p.analysis.keyReady=true;
 check(await load(p),'fixture import');updateSectionKey(1);
 check(songScale.textContent==='C Maj'&&scaleSelect.value==='0','saved transposition not restored');
 const saved=await captureStudyProject();check(saved.analysis.scale==='Bb Maj','original key not saved');
 check(await load(saved),'round trip failed');updateSectionKey(1);check(songScale.textContent==='C Maj','key shifted twice');
});
await test('section modulation and manual key correction retain priority',async()=>{
 audioKeySections=[{start:0,end:4,scale:'D minor'},{start:4,end:8,scale:''}];
 updateSectionKey(1);check(songScale.textContent==='E Min','section modulation lost');
 keyCorrections=[{start:0,end:4,scaleText:'F major'}];updateSectionKey(1);check(songScale.textContent==='G Maj','manual correction lost');
 updateSectionKey(5);check(songScale.textContent==='C Maj','uncertain passage lost song key');
});
await test('next song cannot inherit previous song key',async()=>{await fresh();updateSectionKey(1);check(songScale.textContent==='—'&&scaleSelect.disabled,'previous key leaked');});
await test('no duplicate page element IDs',()=>{const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);check(new Set(ids).size===ids.length,'duplicate element ID');});
await test('main page fits its viewport',()=>check(document.documentElement.scrollWidth<=innerWidth+2,'page wider than viewport'));
