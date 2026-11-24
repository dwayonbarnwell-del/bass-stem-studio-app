"""Real mobile controls, recorded mixers and uninterrupted rehearsal sources."""
from pathlib import Path
import os,json,threading

# Reuse the existing sparse-checkout HTTP handler without running its tests.
support=Path(__file__).with_name('browser_cultural_rc351.py').read_text().split("server=ThreadingHTTPServer",1)[0]
exec(compile(support,str(Path(__file__).with_name('browser_cultural_rc351.py')),'exec'))
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright()as p:
 browser=p.chromium.launch(headless=True,executable_path=os.environ.get('BASS_TEST_BROWSER'),args=['--no-sandbox','--disable-gpu','--autoplay-policy=no-user-gesture-required'])
 page=browser.new_page(viewport={'width':390,'height':850});page.set_default_timeout(120000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:'+str(server.server_port),wait_until='domcontentloaded')
 for button in ['openEarTraining','earSectionBasslines']:page.locator('#'+button).dispatch_event('click')
 colours=page.evaluate("()=>['Basslines','Runs','MyFills','Rehearsal'].map(id=>getComputedStyle(document.getElementById('earSection'+id)).backgroundImage)")
 assert len(set(colours))==4,colours
 assert page.evaluate("()=>['woro','highlife','ariaria','bass-lady','bassmatics','world-method'].every(id=>[...document.getElementById('fillCollection').options].some(o=>o.value===id))")
 page.locator('#fillCollection').select_option('woro')
 assert page.evaluate("()=>document.getElementById('fillIdea').options.length>0&&[...document.getElementById('fillIdea').options].every(o=>!o.text.includes('Y2Mate'))")
 for id,value in [('fillBassVolume','100'),('fillDrumVolume','50'),('fillKeyVolume','50')]:assert page.locator('#'+id).input_value()==value
 page.evaluate('''()=>{
  window.mixRuns=[];const original=BassPracticeLoop.start;
  BassPracticeLoop.start=(ctx,rendered,opts)=>{const transport=original(ctx,rendered,opts);mixRuns.push({stems:Object.keys(rendered.stems),gains:[opts.bass,opts.drums,opts.chords],estimated:rendered.estimatedMix});return transport;};
 }''')
 page.locator('#fillPlay').click();page.wait_for_function('mixRuns.length===1')
 assert page.evaluate('mixRuns[0].estimated&&JSON.stringify(mixRuns[0].gains)==="[1,0.5,0.5]"&&mixRuns[0].stems.length===3')
 page.locator('#fillPlay').click()
 # All new cultural groups offer every directed degree change through the UI.
 changes=page.evaluate('''()=>{
  const $=id=>document.getElementById(id),select=(id,v)=>{$(id).value=String(v);$(id).dispatchEvent(new Event('change',{bubbles:true}));};let checked=0;
  for(const section of ['Runs','MyFills']){ $('earSection'+section).click();
   for(const style of ['woro','highlife','ariaria','makossa','seben','soukous','zouk']){
    select('fillGroup',style);
    for(let from=1;from<=7;from++)for(let to=1;to<=7;to++)if(from!==to){select('fillFrom',from);select('fillTo',to);if(!$('fillIdea').options.length||$('fillTo').selectedOptions[0].disabled)throw Error('Missing '+style+' '+from+'→'+to);checked++;}
   }
  }return checked;
 }''')
 assert changes==588
 page.locator('#earSectionRehearsal').dispatch_event('click')
 page.evaluate('''async()=>{
  await BassRehearsal.close();
  const context=new AudioContext(),buffer=context.createBuffer(2,context.sampleRate*8,context.sampleRate);
  for(let ch=0;ch<2;ch++){const pcm=buffer.getChannelData(ch);for(let i=0;i<pcm.length;i++){const t=i/context.sampleRate;pcm[i]=.06*Math.sin(2*Math.PI*196*t)+.2*Math.sin(2*Math.PI*70*t)*Math.exp(-(t%.5)*35);}}
  window.rehearsalFixture={buffer,duration:8,title:'Woro rehearsal test',session:'rc352-browser',tempo:120,phase:0,confidence:.98,meter:4,strings:5,beats:Array.from({length:17},(_,i)=>i*.5),chords:[{start:0,end:2,rootPc:0,quality:'maj',manual:true},{start:2,end:4,rootPc:5,quality:'maj',manual:true},{start:4,end:6,rootPc:7,quality:'maj',manual:true},{start:6,end:8,rootPc:9,quality:'min',manual:true}],notes:[]};
  window.bandStarts=[];window.bandStops=[];window.guideTones=[];
  const start=AudioBufferSourceNode.prototype.start,stop=AudioBufferSourceNode.prototype.stop;
  AudioBufferSourceNode.prototype.start=function(...args){if(this.loop&&this.buffer===buffer)bandStarts.push({when:args[0],end:this.loopEnd});return start.apply(this,args);};
  AudioBufferSourceNode.prototype.stop=function(...args){if(this.loop&&this.buffer===buffer)bandStops.push(args);return stop.apply(this,args);};
  const tone=BassPracticeAudio.tone;BassPracticeAudio.tone=(...args)=>{guideTones.push({midi:args[1],when:args[2],length:args[3],level:args[7]});return tone(...args);};
  BassRehearsal.init(document.getElementById('earRehearsal'),{get:()=>rehearsalFixture,session:()=>rehearsalFixture.session,band:async()=>buffer,cancelBand:async()=>{},readBass:async()=>[],phraseLabel:()=>'',openLibrary:()=>{},pickAudio:()=>{}});
  BassRehearsal.refresh();
 }''')
 assert page.locator('#rehearsalMusic').input_value()=='50'
 assert page.locator('#rehearsalGain').input_value()=='100'
 for style in ['worship','rnb','gospel','soul','reggae','jazz','blues','makossa','woro','highlife','ariaria','seben','soukous','zouk','source:bass-lady','source:bassmatics','source:world-method']:
  page.locator('#rehearsalStyle').select_option(style)
  groups=page.locator('#rehearsalPattern optgroup').evaluate_all('(rows)=>rows.map(r=>r.label)')
  assert all(label in groups for label in ['Bassline alternatives','Runs','Fills']),(style,groups)
 page.locator('#rehearsalStyle').select_option('woro')
 run=page.locator('#rehearsalPattern optgroup[label="Runs"] option').first.get_attribute('value');page.locator('#rehearsalPattern').select_option(run)
 page.locator('#rehearsalPlay').click();page.wait_for_function('bandStarts.length===1&&document.getElementById("rehearsalPlay").textContent==="Pause"')
 page.wait_for_function('guideTones.length>=3')
 assert page.evaluate('guideTones.every(n=>n.midi>=23&&n.midi<=59&&n.length>0&&n.level===1)')
 for style in ['highlife','ariaria','reggae','worship','rnb']:
  page.locator('#rehearsalStyle').select_option(style)
  fill=page.locator('#rehearsalPattern optgroup[label="Fills"] option').first.get_attribute('value');page.locator('#rehearsalPattern').select_option(fill)
  assert page.locator('#rehearsalPlay').inner_text()=='Pause'
 page.locator('#rehearsalFill').select_option('ends')
 assert page.evaluate('bandStarts.length===1&&bandStops.length===0')
 page.wait_for_function('guideTones.length>=16')
 assert page.evaluate('bandStarts.length===1&&bandStops.length===0')
 page.locator('#rehearsalPlay').click();assert page.evaluate('bandStops.length===1')
 if os.environ.get('BASS_TEST_SCREENSHOT'):page.screenshot(path=os.environ['BASS_TEST_SCREENSHOT'])
 assert not errors,errors
 print(json.dumps(dict(passed=True,mobilePracticeColours=4,culturalDegreeControlChecks=changes,newRecordedMixer=[100,50,50],rehearsalStylesChecked=17,sourceChoices=['Bass Lady','Bassmatics','World Methods'],uninterruptedRehearsalChanges=True)),flush=True)
 browser.close()
server.shutdown()
