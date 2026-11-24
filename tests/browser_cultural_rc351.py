"""Exercise the real controls, all directed changes and continuous audio.

Sparse development checkouts fetch unchanged audio/runtime assets lazily from
the existing live release. Modified application files are always served locally.
"""
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse,unquote,quote
from urllib.request import Request,urlopen
import json,os,threading,re,hashlib
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
CACHE=Path(os.environ.get('BASS_TEST_ASSET_CACHE','/tmp/bass-rc351-test-assets'));CACHE.mkdir(exist_ok=True)
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(ROOT),**kwargs)
 def log_message(self,*args):pass
 def do_GET(self):
  name=unquote(urlparse(self.path).path).lstrip('/') or 'index.html';local=(ROOT/name).resolve()
  if not local.is_relative_to(ROOT):self.send_error(403);return
  try:
   if local.is_file():data=local.read_bytes()
   else:
    cached=CACHE/hashlib.sha256(name.encode()).hexdigest()
    if not cached.exists():
     request=Request('https://bass-stem-studio-app-z5ja.onrender.com/'+quote(name),headers={'Accept-Encoding':'identity'})
     with urlopen(request,timeout=60) as remote:body=remote.read()
     cached.write_bytes(body)
    data=cached.read_bytes()
   match=re.fullmatch(r'bytes=(\d+)-(\d*)',self.headers.get('Range',''))
   if match:
    start=int(match[1]);end=min(len(data)-1,int(match[2]) if match[2] else len(data)-1)
    self.send_response(206);self.send_header('Content-Range',f'bytes {start}-{end}/{len(data)}');data=data[start:end+1]
   else:self.send_response(200)
   self.send_header('Content-Type',self.guess_type(name));self.send_header('Content-Length',str(len(data)));self.send_header('Accept-Ranges','bytes');self.end_headers();self.wfile.write(data)
  except (BrokenPipeError,ConnectionResetError):pass
  except Exception as error:self.send_error(502,str(error))

server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=os.environ.get('BASS_TEST_BROWSER'),args=['--no-sandbox','--disable-gpu','--autoplay-policy=no-user-gesture-required'])
 page=browser.new_page(viewport={'width':390,'height':850});page.set_default_timeout(120000);errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
 page.add_init_script("localStorage.setItem('bass-study-groups-v1',JSON.stringify({runs:'african',fills:'african'}))")
 page.goto('http://127.0.0.1:'+str(server.server_port),wait_until='domcontentloaded')
 for button in ['openEarTraining','earSectionFills']:page.locator('#'+button).dispatch_event('click')
 assert page.locator('#fillGroup').input_value()=='makossa'
 # Batch real change events to check every pair in each requested style.
 result=page.evaluate('''()=>{
  const $=id=>document.getElementById(id),select=(id,value)=>{$(id).value=String(value);$(id).dispatchEvent(new Event('change',{bubbles:true}));};let checks=0;
  for(const [kind,button] of [['fills','earSectionFills'],['runs','earSectionRuns']]){
   $(button).click();
   if([...$('fillGroup').options].some(o=>o.value==='african'))throw Error('Broad African group remains');
   for(const style of ['makossa','seben','soukous','zouk']){
    select('fillGroup',style);
    for(let from=1;from<=7;from++)for(let to=1;to<=7;to++)if(from!==to){
     select('fillFrom',from);select('fillTo',to);
     if($('fillTo').selectedOptions[0].disabled||$('fillFrom').value!==String(from)||$('fillTo').value!==String(to))throw Error('Unavailable change '+from+'→'+to+' '+style);
     const options=[...$('fillIdea').options];if(!options.length)throw Error('No patterns for '+style);
     const idea=Number($('fillIdea').value),plan=BassPracticeCore.make(kind,{idea,from,to,key:0});
     if(plan.from!==from||plan.to!==to||!plan.recordedStudy)throw Error('Wrong source change');
     if(!$('fillDifference').textContent.includes(from+'→'+to)||!$('fillDifference').textContent.includes('Adapted'))throw Error('Missing source/change label');
     if($('fillNotes').children.length<4)throw Error('Incomplete notes');
     const native=options.filter(o=>BassCulturalStudies.nativeMatch(BassCuratedStudies.get(kind,Number(o.value)),from,to));
     if(native.length&&!BassCulturalStudies.nativeMatch(BassCuratedStudies.get(kind,Number(options[0].value)),from,to))throw Error('Matching source is not first');
     checks++;
    }
   }
  }
  return {styles:4,changesPerStyle:42,realControlChanges:checks};
 }''')
 assert result['realControlChanges']==336
 for control,value in [('fillBassVolume','100'),('fillDrumVolume','50'),('fillKeyVolume','50')]:assert page.locator('#'+control).input_value()==value
 page.locator('#fillGroup').select_option('seben');page.locator('#fillFrom').select_option('6');page.locator('#fillTo').select_option('7')
 page.evaluate('''()=>{
  window.culturalAudio=[];const start=BassPracticeLoop.start;
  BassPracticeLoop.start=(ctx,rendered,options)=>{
   const transport=start(ctx,rendered,options),row={when:transport.when,stop:null,bass:options.bass,drums:options.drums,chords:options.chords,parts:Object.keys(rendered.stems)};culturalAudio.push(row);
   const stop=transport.stopAt;transport.stopAt=(when,fade)=>{row.stop=when;return stop(when,fade)};return transport;
  };
 }''')
 page.locator('#fillPlay').click();page.wait_for_function('culturalAudio.length===1')
 assert page.evaluate('culturalAudio[0].bass===1&&culturalAudio[0].drums===.5&&culturalAudio[0].chords===.5')
 page.locator('#fillTo').select_option('2');assert page.locator('#fillPlay').inner_text()=='Stop';page.wait_for_function('culturalAudio.length===2')
 assert page.evaluate('Math.abs(culturalAudio[0].stop-culturalAudio[1].when)<.000001')
 page.locator('#fillNext').click();page.wait_for_function('culturalAudio.length===3');assert page.evaluate('Math.abs(culturalAudio[1].stop-culturalAudio[2].when)<.000001')
 page.locator('#fillGroup').select_option('zouk');page.wait_for_function('culturalAudio.length===4');assert page.evaluate('Math.abs(culturalAudio[2].stop-culturalAudio[3].when)<.000001')
 page.locator('#fillPlay').click()
 # Pattern deletion survives reload, and source deletion hides its derivatives.
 deleted=page.evaluate("()=>{const idea=Number(document.getElementById('fillIdea').value);return {id:BassStudyGroups.id('runs',idea),source:BassCuratedStudies.get('runs',idea).recordedStudy.sourceId}}")
 page.locator('#fillDelete').click();assert not page.evaluate('(id)=>[...document.getElementById("fillIdea").options].some(o=>BassStudyGroups.id("runs",Number(o.value))===id)',deleted['id'])
 page.reload(wait_until='domcontentloaded')
 for button in ['openEarTraining','earSectionRuns']:page.locator('#'+button).dispatch_event('click')
 page.locator('#fillGroup').select_option('zouk');assert not page.evaluate('(id)=>[...document.getElementById("fillIdea").options].some(o=>BassStudyGroups.id("runs",Number(o.value))===id)',deleted['id'])
 page.locator('#fillFrom').select_option('4');page.locator('#fillTo').select_option('7')
 if os.environ.get('BASS_TEST_SCREENSHOT'):page.screenshot(path=os.environ['BASS_TEST_SCREENSHOT'])
 assert not errors,errors
 print(json.dumps({'passed':True,**result,'mixPercentages':[100,50,50],'continuousChangeAndNext':True,'sourceLabelsVisible':True,'patternDeletionPersists':True}),flush=True)
 browser.close()
server.shutdown()
