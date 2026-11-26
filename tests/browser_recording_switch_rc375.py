"""A delayed Ariaria download must yield to the newly selected Bassmatics recording."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
import threading,os
os.chdir(Path(__file__).resolve().parents[1])
class QuietHandler(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),QuietHandler)
threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ.get('BASS_TEST_BROWSER'),args=['--no-sandbox'])
 page=b.new_page(viewport={'width':360,'height':760},service_workers='block')
 url=f'http://127.0.0.1:{server.server_port}'
 page.add_init_script("""localStorage.setItem('bass-practice-accompaniment-v5',JSON.stringify({voice:false,chords:true}));""")
 page.goto(url,wait_until='domcontentloaded')
 page.wait_for_function('window.BassPracticeSeries')
 page.evaluate('openEarTraining.click()')
 page.evaluate('earSectionBasslines.click()')
 page.evaluate("""()=>{
  window.report={starts:[],voices:0,cancelled:false,pending:false};
  const fetchAudio=window.fetch;
  window.fetch=(path,options)=>{
   if(String(path).includes('/ariaria-')&&String(path).endsWith('-mix.flac')){
    report.pending=true;
    return new Promise((resolve,reject)=>{options.signal.addEventListener('abort',()=>{
     report.cancelled=true;reject(new DOMException('Selection changed','AbortError'));
    },{once:true});});
   }
   return fetchAudio(path,options);
  };
  const isolate=BassEarAudio.recording;
  BassEarAudio.recording=(...args)=>{report.voices++;return isolate(...args)};
  const start=BassPracticeLoop.start;
  BassPracticeLoop.start=(ctx,audio,opts)=>{
   report.starts.push(fillIdea.value);
   if(!audio.stems.bass.getChannelData(0).some(x=>Math.abs(x)>.01))throw Error('Silent bass');
   return start(ctx,audio,opts);
  };
 }""")
 def choose_recording(group):
  page.select_option('#fillCollection',group)
  select=page.locator('#fillIdea')
  choice=select.locator('option[value^="clip:"]').first.get_attribute('value')
  select.select_option(choice)
  return choice
 choose_recording('ariaria')
 page.locator('#fillPlay').click()
 page.wait_for_function('report.pending')
 target=choose_recording('bassmatics')
 page.wait_for_function('id=>report.starts.includes(id)',arg=target,timeout=6000)
 page.wait_for_timeout(300)
 result=page.evaluate('report')
 assert result['cancelled'] and result['voices']==0,result
 print(result)
