"""Actual change selection, numbered Note View and continuous guide playback."""
from pathlib import Path
import json,os,threading
support=Path(__file__).with_name('browser_cultural_rc351.py').read_text().split('server=ThreadingHTTPServer',1)[0]
exec(compile(support,str(Path(__file__).with_name('browser_cultural_rc351.py')),'exec'))
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright()as p:
 browser=p.chromium.launch(headless=True,executable_path=os.environ.get('BASS_TEST_BROWSER'),args=['--no-sandbox','--disable-gpu','--autoplay-policy=no-user-gesture-required'])
 page=browser.new_page(viewport={'width':390,'height':850});page.set_default_timeout(90000);errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
 page.goto('http://127.0.0.1:'+str(server.server_port),wait_until='domcontentloaded')
 for button in ['openEarTraining','earSectionRehearsal']:page.locator('#'+button).dispatch_event('click')
 page.evaluate('''async()=>{
  await BassRehearsal.close();const ctx=new AudioContext(),buffer=ctx.createBuffer(2,ctx.sampleRate*8,ctx.sampleRate);
  for(let channel=0;channel<2;channel++){const pcm=buffer.getChannelData(channel);for(let i=0;i<pcm.length;i++){const t=i/ctx.sampleRate;pcm[i]=.06*Math.sin(t*2*Math.PI*196)+.2*Math.sin(t*2*Math.PI*70)*Math.exp(-(t%.5)*35);}}
  const song={buffer,duration:8,title:'1–6–4–5',session:'rc354',keyRoot:0,keyMode:'major',tempo:120,phase:0,confidence:.98,meter:4,beats:Array.from({length:17},(_,i)=>i*.5),chords:[{start:0,end:2,rootPc:0,quality:'maj',manual:true},{start:2,end:4,rootPc:9,quality:'min',manual:true},{start:4,end:6,rootPc:5,quality:'maj',manual:true},{start:6,end:8,rootPc:7,quality:'maj',manual:true}],notes:[]};
  window.harmonySong=song;window.bandStarts=[];window.bandStops=[];window.guideNotes=[];
  const start=AudioBufferSourceNode.prototype.start,stop=AudioBufferSourceNode.prototype.stop;
  AudioBufferSourceNode.prototype.start=function(...args){if(this.loop&&this.buffer===buffer)bandStarts.push(args[0]);return start.apply(this,args);};
  AudioBufferSourceNode.prototype.stop=function(...args){if(this.loop&&this.buffer===buffer)bandStops.push(args);return stop.apply(this,args);};
  const tone=BassPracticeAudio.tone;BassPracticeAudio.tone=(...args)=>{guideNotes.push({midi:args[1],when:args[2],length:args[3]});return tone(...args);};
  BassRehearsal.init(document.getElementById('earRehearsal'),{get:()=>song,session:()=>song.session,band:async()=>buffer,cancelBand:async()=>{},pickAudio:()=>{},openLibrary:()=>{},readBass:async()=>[]});BassRehearsal.refresh();
 }''')
 assert page.locator('#rehearsalFill').input_value()=='ends'
 assert page.locator('#rehearsalChange option').first.inner_text()=='All · 1–6–4–5'
 moves=page.locator('#rehearsalChange optgroup[label="Changes"] option').evaluate_all('(options)=>Object.fromEntries(options.map(o=>[o.textContent.split(" · ")[0],o.value]))')
 assert set(moves)=={'1→6','6→4','4→5','5→1'},moves
 timed=page.locator('#rehearsalChange optgroup[label="Phrases"] option').first
 assert timed.inner_text()=='1→6 · 0:00–0:02';phrase=timed.get_attribute('value')
 page.locator('#rehearsalStyle').select_option('makossa');page.locator('#rehearsalChange').select_option(phrase)
 assert page.locator('#rehearsalSource').inner_text().startswith('1→6 · 0:00–0:02 · ')
 for group in ['Basslines','Runs','Fills']:assert page.locator('#rehearsalPattern optgroup[label="'+group+'"] option').count()>0
 run=page.locator('#rehearsalPattern optgroup[label="Runs"] option').first.get_attribute('value');page.locator('#rehearsalPattern').select_option(run)
 page.locator('#rehearsalPlay').click();page.wait_for_function('bandStarts.length===1&&document.getElementById("rehearsalPlay").textContent==="Pause"')
 assert page.evaluate('guideNotes.some(n=>Math.abs(n.when-bandStarts[0])<.04&&n.midi%12===0)'),'Timed phrase did not start on C'
 assert page.locator('#rehearsalHarmony,#rehearsalProgression,#rehearsalMovementBox').count()==0
 page.wait_for_function('guideNotes.some(n=>Math.abs(n.when-bandStarts[0]-2)<.04&&n.midi%12===9)')
 page.wait_for_function('document.querySelector("#rehearsalTimeline .change-current")?.textContent==="1→6"')
 assert page.locator('#rehearsalTimeline .current-time>time').inner_text()=='0:02'
 assert page.locator('#rehearsalTimeline .change-current').get_attribute('aria-current')=='step'
 assert page.locator('#rehearsalTimeline time').all_text_contents()==['0:00','0:01','0:02','0:03']
 assert page.locator('#rehearsalTimeline .rehearsal-change-label').all_text_contents()==['5→1','1→6']
 assert page.locator('#rehearsalTimeline .rehearsal-landing-note').count()>=2
 assert page.evaluate('guideNotes.some(n=>Math.abs(n.when-bandStarts[0]-2)<.04&&n.midi%12===9)'),'1→6 did not land on A'
 if os.environ.get('BASS_TEST_SCREENSHOT'):page.screenshot(path=os.environ['BASS_TEST_SCREENSHOT'])
 page.locator('#rehearsalChange').select_option(moves['4→5']);assert page.locator('#rehearsalSource').inner_text().startswith('4→5 · ')
 assert page.locator('#rehearsalPattern option:checked').evaluate('(o)=>o.parentElement.label')=='Runs','Changing movement reset the study type'
 page.locator('#rehearsalStyle').select_option('gospel');assert page.locator('#rehearsalPattern option:checked').evaluate('(o)=>o.parentElement.label')=='Runs'
 page.locator('#rehearsalChange').select_option('all')
 bass=page.locator('#rehearsalPattern optgroup[label="Basslines"] option').first.get_attribute('value');page.locator('#rehearsalPattern').select_option(bass)
 page.wait_for_function('guideNotes.some(n=>n.when>=bandStarts[0]+10-.04&&Math.abs(n.when-bandStarts[0]-10)<.04&&n.midi%12===9)')
 assert page.evaluate('bandStarts.length===1&&bandStops.length===0'),'Choices interrupted the band'
 page.locator('#rehearsalPlay').click();assert page.evaluate('bandStops.length===1')
 # Correcting saved harmony must invalidate a cached guide on the next play.
 page.evaluate("harmonySong.chords[1].rootPc=4")
 page.locator('#rehearsalPlay').click();page.wait_for_function('bandStarts.length===2')
 assert page.locator('#rehearsalChange option').evaluate_all('(rows)=>rows.some(o=>o.textContent.startsWith("1→3"))')
 page.wait_for_function('guideNotes.some(n=>Math.abs(n.when-bandStarts[1]-2)<.04&&n.midi%12===4)')
 page.locator('#rehearsalPlay').click();assert page.evaluate('bandStops.length===2')
 assert not errors,errors
 print(json.dumps(dict(passed=True,actualDegreeChanges=list(moves),focused16=True,timedPhraseSelection=True,exactStartAndLanding=True,twoExtraRowsRemoved=True,currentChangeStronglyHighlighted=True,noteTimestampsPreserved=True,actualBassLandingA=True,continuousChangeAndGenreSwitch=True,correctedChordsInvalidateGuide=True)),flush=True)
 browser.close()
server.shutdown()
