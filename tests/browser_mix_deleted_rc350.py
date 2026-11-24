from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
import threading,json,os,sys,subprocess
import numpy as np
from playwright.sync_api import sync_playwright
os.chdir(Path(__file__).resolve().parents[1])
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=os.environ.get('BASS_TEST_BROWSER'),args=['--no-sandbox','--disable-gpu','--autoplay-policy=no-user-gesture-required'])
 page=browser.new_page(viewport={'width':390,'height':850});page.set_default_timeout(90000);errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
 page.add_init_script("localStorage.setItem('bass-practice-accompaniment-v3',JSON.stringify({enabled:false,chords:false,volume:.45,keyVolume:.8,kit:'auto',groove:'auto',style:'auto',sound:'auto'}))")
 url='http://127.0.0.1:'+str(server.server_port)
 def open_basslines():
  for button in ['openEarTraining','earSectionFills','earSectionBasslines']:page.locator('#'+button).dispatch_event('click')
 def levels():return [page.locator('#'+name).input_value() for name in ['fillBassVolume','fillDrumVolume','fillKeyVolume']]
 def slide(name,value):page.locator('#'+name).evaluate('(element,value)=>{element.value=value;element.dispatchEvent(new Event("input",{bubbles:true}))}',value)
 page.goto(url,wait_until='domcontentloaded');open_basslines()
 assert levels()==['100','50','50']
 assert page.locator('#fillDrums').get_attribute('aria-pressed')=='true';assert page.locator('#fillBacking').get_attribute('aria-pressed')=='true'
 for group in ['reggae','bass-lady','gospel']:
  page.locator('#fillCollection').select_option(group)
  assert levels()==['100','50','50']
  page.locator('#fillDrumOptions').evaluate('(element)=>element.open=true')
  assert page.locator('#fillBassVolume').is_visible();assert page.locator('#fillDrumVolume').is_visible();assert page.locator('#fillKeyVolume').is_visible()
  for field in page.locator('#fillDrumOptions .fill-band-choice').all():assert field.is_visible()==(group=='gospel')
 for button in ['earSectionRuns','earSectionFills','earSectionBasslines']:
  page.locator('#'+button).dispatch_event('click');assert levels()==['100','50','50']
 page.locator('#fillCollection').select_option('reggae');page.locator('#fillIdea').select_option('clip:reggae-128c286eeb70')
 page.locator('#fillDrumOptions').evaluate('(element)=>element.open=true')
 assert page.locator('#fillMixNotice').is_visible();assert page.locator('#fillGenreReset').inner_text()=='Reset mix'
 slide('fillBassVolume',77);page.reload(wait_until='domcontentloaded');open_basslines();assert levels()==['77','50','50']
 page.locator('#fillCollection').select_option('reggae');page.locator('#fillIdea').select_option('clip:reggae-128c286eeb70');page.locator('#fillDrumOptions').evaluate('(element)=>element.open=true');page.locator('#fillGenreReset').click();assert levels()==['100','50','50']
 page.evaluate('''()=>{
  window.mixCalls=[];const start=BassPracticeLoop.start;
  BassPracticeLoop.start=(ctx,audio,options)=>{
   const transport=start(ctx,audio,options),row={bass:options.bass,drums:options.drums,chords:options.chords,parts:Object.keys(audio.stems),when:transport.when,stop:null,levels:[]};mixCalls.push(row);
   const stopAt=transport.stopAt;transport.stopAt=(when,fade)=>{row.stop=when;return stopAt(when,fade)};
   const level=transport.level;transport.level=(part,value)=>{row.levels.push([part,value]);return level(part,value)};
   return transport;
  };
 }''')
 page.locator('#fillPlay').click();page.wait_for_function('mixCalls.length===1')
 call=page.evaluate('mixCalls[0]');assert [call['bass'],call['drums'],call['chords']]==[1,.5,.5];assert call['parts']==['bass','drums','chords']
 slide('fillBassVolume',60);slide('fillDrumVolume',35);slide('fillKeyVolume',20)
 assert page.locator('#fillPlay').inner_text()=='Stop'
 assert page.evaluate("mixCalls[0].levels.some(row=>row[0]==='bass'&&row[1]===.6)&&mixCalls[0].levels.some(row=>row[0]==='drums'&&row[1]===.35)&&mixCalls[0].levels.some(row=>row[0]==='chords'&&row[1]===.2)")
 page.locator('#fillGenreReset').click();assert levels()==['100','50','50']
 page.locator('#fillNext').click();page.wait_for_function('mixCalls.length===2')
 assert page.evaluate('Math.abs(mixCalls[0].stop-mixCalls[1].when)<.000001');page.locator('#fillPlay').click()
 if '--require-methods' in sys.argv:
  page.locator('#fillCollection').select_option('world-method')
  assert page.locator('#fillIdea option').count()>0
  assert page.locator('#fillDifference').is_visible()
  page.locator('#fillDrumOptions').evaluate('(element)=>element.open=true');assert levels()==['100','50','50']
  page.locator('#fillPlay').click();page.wait_for_function('mixCalls.length===3')
  assert page.evaluate('mixCalls[2].parts.join(",")==="bass,drums,chords"')
  old=float(page.locator('#fillTempo').input_value());page.locator('#fillTempo').fill(str(round(old*.9,2)));page.locator('#fillTempo').dispatch_event('change')
  page.wait_for_function('mixCalls.length===4');assert page.evaluate('Math.abs(mixCalls[2].stop-mixCalls[3].when)<.000001')
  page.locator('#fillPlay').click()
  # Check the browser codec's actual channel order, not only the stem labels.
  paths=page.evaluate('()=>[Object.values(BassPracticeMixAssets)[0].url,Object.values(BassWorldMethodMixes)[0].url]')
  for path in paths:
   raw=subprocess.check_output(['ffmpeg','-v','error','-i',path,'-ac','6','-ar','32000','-f','f32le','-'])
   pcm=np.frombuffer(raw,'<f4').reshape(-1,6);indices=[123,1001,5231,min(10489,len(pcm)-1)]
   samples=page.evaluate('''async({path,indices})=>{
    const ctx=new OfflineAudioContext(6,1,32000),buffer=await ctx.decodeAudioData(await (await fetch(path)).arrayBuffer());
    if(buffer.numberOfChannels!==6)throw Error('Lost separated audio channels');
    return indices.map(at=>Array.from({length:6},(_,c)=>buffer.getChannelData(c)[at]));
   }''',{'path':path,'indices':indices})
   # Browser and FFmpeg PCM16 normalisation may differ by one sample step.
   assert np.max(np.abs(np.array(samples)-pcm[indices]))<1/32767,(path,'Browser instrument-channel samples differ')
 # Cancellation must leave all deleted items available for individual restore.
 ids=page.evaluate("()=>{const id=BassPracticeCore.runs[0].id;BassPracticeCatalogue.remove('runs',id);return id;}")
 page.locator('#fillRestore').dispatch_event('click');before=page.evaluate('BassCatalogueReview.removed().length')
 page.once('dialog',lambda dialog:dialog.dismiss());page.locator('#fillEmptyDeleted').click();assert page.evaluate('BassCatalogueReview.removed().length')==before
 page.once('dialog',lambda dialog:dialog.accept());page.locator('#fillEmptyDeleted').click();page.wait_for_function('BassCatalogueReview.removed().length===0')
 assert page.locator('#fillDeletedEmpty').is_visible();assert page.locator('#fillEmptyDeleted').is_disabled()
 page.reload(wait_until='domcontentloaded');open_basslines();assert page.evaluate('BassCatalogueReview.removed().length')==0
 assert page.evaluate('(id)=>BassPracticeCatalogue.permanentlyRemoved("runs",id)',ids)
 assert not errors,errors
 if os.environ.get('BASS_TEST_SCREENSHOT'):
  if '--require-methods' in sys.argv:page.locator('#fillCollection').select_option('world-method')
  page.locator('#fillDrumOptions').evaluate('(element)=>element.open=true');page.screenshot(path=os.environ['BASS_TEST_SCREENSHOT'])
 print(json.dumps({'passed':True,'defaultPercentages':[100,50,50],'legacyPreferencesMigrated':True,'liveRecordedFaders':True,'continuousNext':True,'emptyDeletedConfirmedAndPersistent':True,'cancelPreservesDeleted':True}),flush=True)
 browser.close()
server.shutdown()
