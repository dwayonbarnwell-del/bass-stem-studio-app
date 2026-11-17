 await test('manual scroll and focused row survive seek and repeat refreshes',async()=>{
  const p=await svFixture(),b=ctx.createBuffer(1,16000*90,16000);
  p.source.duration=90;p.source.audioBase64=arrayBufferToBase64(await wavBlob(b).arrayBuffer());
  p.analysis.parts=[{label:'P1',coreStart:0,coreEnd:90,audioStart:0,audioEnd:90}];
  p.analysis.notes=Array.from({length:90},(_,i)=>({midi:36+i%5,start:i,end:i+.8,confidence:.99}));
  p.analysis.chords=[{rootPc:0,quality:'maj',start:0,end:90,manual:true,evidenceVersion:'user-correction-v1',confidence:1}];
  p.settings.sections={};check(await svImport(p),'long song did not open');pause();window.BassSongView.draw();
  if($('songViewFollow').getAttribute('aria-pressed')==='true')$('songViewFollow').click();
  const scroller=$('songViewSections');scroller.scrollTop=300;
  const top=scroller.scrollTop,button=scroller.querySelectorAll('.song-view-time')[5];
  button.focus({preventScroll:true});check(document.activeElement===button,'row could not be focused: disabled='+button.disabled);seekTo(48);window.BassSongView.draw();
  check(Math.abs(scroller.scrollTop-top)<2,'Follow off scroll moved from '+top+' to '+scroller.scrollTop);
  check(document.activeElement===button,'playback refresh removed the focused row: connected='+button.isConnected+', active='+document.activeElement?.id);
  window.BassSongView.invalidate();check(Math.abs(scroller.scrollTop-top)<2,'analysis refresh reset manual scroll');
  notes=notes.map(n=>({...n}));window.BassSongView.invalidate();
  check(Math.abs(scroller.scrollTop-top)<2,'new analysis reset manual scroll');
  $('songViewWhole').click();check(scroller.scrollTop<2,'Whole song did not return to the beginning');
 });
 await test('adjacent identical chords use one chip with continuous highlighting',async()=>{
  const p=await svFixture();p.analysis.chords=[0,1,2,3].map(start=>({rootPc:0,quality:'maj',start,end:start+1,manual:true,evidenceVersion:'user-correction-v1',confidence:1}));
  check(await svImport(p),'chord fixture did not open');pause();
  const row=document.querySelector('.song-view-row');
  check(row.querySelectorAll('.song-view-chord').length===1,'one held chord is repeated in the row');
  for(const t of [.5,1.5,2.5,3.5]){window.BassSongView.draw(t);check(row.querySelectorAll('.song-view-chord.sounding').length===1,'chord highlight lost at '+t);}
  check(detectedChordChanges.length===4,'source chord events were changed');
 });
 await test('missing bass data is not described as a confirmed rest',async()=>{
  await fresh();notes=[];window.BassSongView.invalidate();
  check(!$('songViewSections').textContent.includes('Rest /'),'unknown bass gaps were called rests');
  check($('songViewSections').textContent.includes('No bass notes detected'),'missing notes are not clearly labelled');
 });
