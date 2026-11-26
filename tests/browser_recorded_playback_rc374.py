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
 p=b.new_page(viewport={'width':360,'height':760},service_workers='block')
 p.goto(f'http://127.0.0.1:{server.server_port}',wait_until='domcontentloaded')
 p.wait_for_function('window.BassPracticeSeries')
 p.evaluate('openEarTraining.click()')
 result=p.evaluate("""async()=>{
 let separationCalls=0;BassEarAudio.recording=()=>{separationCalls++;throw Error("Unexpected vocal separation on first play")};
 const ctx=new AudioContext({sampleRate:32000}),issues=[],counts={};
 for(const item of BassUploadedCore.items){
  if(!BassPracticeCatalogue.visible('uploaded',item.id))continue;
  for(let part=0;part<(BassRecordedPhrases[item.id]?.length||0);part++){
   if(!BassPracticeCatalogue.visible('uploaded',item.id+'/'+part))continue;
   try{
    const plan=BassUploadedCore.practicePlan(item.id,'phrase-'+part);
    const band=BassAccompaniment.resolve(plan);
    const audio=await BassPracticeLoop.render(ctx,plan,{...band,recorded:true,drums:true,chords:true});
    const root=audio.stems.bass,drum=audio.stems.drums;
    const peak=b=>{if(!b)return 0;let y=0;for(let c=0;c<b.numberOfChannels;c++){const a=b.getChannelData(c);for(let i=0;i<a.length;i+=17)y=Math.max(y,Math.abs(a[i]));}return y};
    if(!root||peak(root)<.005||!drum||peak(drum)<.003)issues.push([item.id,part,peak(root),peak(drum)]);
    counts[item.group]=(counts[item.group]||0)+1;
   }catch(e){issues.push([item.id,part,e.message])}
  }
 }
 if(separationCalls)issues.push(["unrequested vocal separation",separationCalls]);
 return {issues,counts};}""")
 assert not result["issues"],result
 assert all(result["counts"].get(g,0)>0 for g in ("bass-lady","bassmatics","reggae","world-method","highlife","woro"))
 print(result["counts"])

