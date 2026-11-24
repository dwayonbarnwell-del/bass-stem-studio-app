from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
import threading,json,os
from playwright.sync_api import sync_playwright
os.chdir(Path(__file__).resolve().parents[1])
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=os.environ.get('BASS_TEST_BROWSER'),args=['--no-sandbox','--disable-gpu','--autoplay-policy=no-user-gesture-required'])
 page=browser.new_page(viewport={'width':390,'height':850});page.set_default_timeout(90000);errors=[]
 page.on('pageerror',lambda error:errors.append(str(error)))
 page.goto('http://127.0.0.1:'+str(server.server_port),wait_until='domcontentloaded')
 for button in ['openEarTraining','earSectionFills']:page.locator('#'+button).dispatch_event('click')
 choice=page.evaluate('''()=>{
  const entry=Object.entries(BassFlDrums.assignments).find(([key])=>key.startsWith('fills/'));
  const idea=Number(entry[0].split('/')[1]);return {idea,group:BassStudyGroups.groupOf('fills',idea),bpm:BassFlDrums.loops.find(l=>l.id===entry[1][0]).bpm};
 }''')
 page.locator('#fillGroup').select_option(choice['group']);page.locator('#fillIdea').select_option(str(choice['idea']))
 assert abs(float(page.locator('#fillTempo').input_value())-choice['bpm'])<.011
 # Real decoded loops, using the browser's player and stretching worker.
 rendered=page.evaluate('''async()=>{
  const ctx=new AudioContext({sampleRate:32000});let count=0,changed=0;const styles=new Set();
  for(const loop of BassFlDrums.loops){
   const beat=Math.round(ctx.sampleRate*60/loop.bpm),native=await BassSuppliedDrums.render(ctx,loop,beat);
   if(native.length!==beat*loop.beats)throw Error('Native duration: '+loop.id);
   const samples=native.getChannelData(0);if(!samples.every(Number.isFinite)||!samples.some(x=>Math.abs(x)>.01))throw Error('Invalid drums');
   count++;
   const kind=loop.genre;
   if(!styles.has(kind)){
    styles.add(kind);
    for(const bpm of [77,150]){
     const frames=Math.round(ctx.sampleRate*60/bpm),other=await BassSuppliedDrums.render(ctx,loop,frames);
     if(other.length!==frames*loop.beats||!other.getChannelData(0).every(Number.isFinite))throw Error('Tempo conversion: '+loop.id);
     changed++;
    }
   }
  }
  await ctx.close();return {nativeLoops:count,tempoConversions:changed};
 }''')
 # Verify that Next schedules its replacement before the old transport ends.
 page.evaluate('''()=>{
  window.drumSwitches=[];const start=BassPracticeLoop.start;
  BassPracticeLoop.start=(...args)=>{
   const transport=start(...args),trace={when:transport.when,stop:null};drumSwitches.push(trace);
   const stopAt=transport.stopAt;transport.stopAt=(when,fade)=>{trace.stop=when;return stopAt(when,fade)};
   return transport;
  };
 }''')
 page.locator('#fillPlay').click();page.wait_for_function('drumSwitches.length===1')
 page.locator('#fillNext').click();assert page.locator('#fillPlay').inner_text()=='Stop'
 page.wait_for_function('drumSwitches.length===2')
 assert page.evaluate('Math.abs(drumSwitches[0].stop-drumSwitches[1].when)<.000001')
 page.locator('#fillPlay').click()
 # Original uploaded reggae still uses its own bass and drums.
 page.locator('#earSectionBasslines').dispatch_event('click');page.locator('#fillCollection').select_option('reggae')
 assert page.locator('#fillIdea option').count()==49
 assert page.locator('#fillDrums').is_visible()
 assert not errors,errors
 print(json.dumps({'passed':True,'nativeTempoInInterface':True,'continuousNext':True,'originalReggaePreserved':True,**rendered}),flush=True)
 browser.close()
server.shutdown()
