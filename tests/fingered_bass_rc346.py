from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
import threading,os,json,numpy as np
from scipy.signal import correlate
from playwright.sync_api import sync_playwright
class H(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
os.chdir(Path(__file__).resolve().parents[1])
s=ThreadingHTTPServer(('127.0.0.1',0),H);threading.Thread(target=s.serve_forever,daemon=True).start()
with sync_playwright() as p:
 c=p.chromium.launch(headless=True,executable_path=os.environ.get('BASS_TEST_BROWSER'),args=['--no-process-singleton','--single-process','--no-zygote','--disable-gpu','--no-sandbox','--autoplay-policy=no-user-gesture-required'])
 page=c.new_page(viewport={'width':390,'height':850});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:'+str(s.server_port),wait_until='domcontentloaded');page.set_default_timeout(180000)
 page.locator('#openEarTraining').dispatch_event('click');page.locator('#earSectionFills').dispatch_event('click');page.locator('#earSectionBasslines').dispatch_event('click')
 result=page.evaluate('''async()=>{
 const A=BassPracticeAudio,ctx=new AudioContext({sampleRate:32000}),notes=Array.from({length:37},(_,i)=>({midi:23+i}));
 await A.prepare('bass',ctx,{notes});
 const rows=[];
 for(const {midi} of notes){
  if(!BassFingeredBass.has(midi))throw Error('Missing '+midi);
  const off=new OfflineAudioContext(1,32000,32000);A.tone(off,midi,0,.95,'bass',0,104,.72);
  rows.push({midi,data:Array.from((await off.startRendering()).getChannelData(0))});
 }
 const dynamics=[];
 for(const velocity of [40,64,84,104,127]){
  const off=new OfflineAudioContext(1,32000,32000);A.tone(off,35,0,.8,'bass',0,velocity,.72);
  const x=(await off.startRendering()).getChannelData(0);dynamics.push({velocity,rms:Math.sqrt(x.reduce((s,n)=>s+n*n,0)/x.length),peak:x.reduce((s,n)=>Math.max(s,Math.abs(n)),0)});
 }
 const off=new OfflineAudioContext(1,32000,32000),voice=A.tone(off,35,.1,.8,'bass');voice.stop();
 const stopped=(await off.startRendering()).getChannelData(0).every(x=>x===0);
 return {rows,dynamics,stopped,defaultSound:document.querySelector('#earSound').value};
}''')
 errors_cents=[];peaks=[]
 for row in result.pop('rows'):
  x=np.array(row['data']);assert np.isfinite(x).all();assert np.sqrt(np.mean(x*x))>.003
  peaks.append(max(abs(x)));x=x[4000:24000];x-=x.mean();corr=correlate(x,x,mode='full',method='fft')[len(x)-1:]
  expected=32000/(440*2**((row['midi']-69)/12));lo=int(expected*.94);hi=int(expected*1.06);lag=lo+np.argmax(corr[lo:hi]);a,b,d=corr[lag-1:lag+2];sub=.5*(a-d)/(a-2*b+d);cents=1200*np.log2(expected/(lag+sub));errors_cents.append(abs(cents))
  assert abs(cents)<20,(row['midi'],cents)
 assert max(peaks)<1
 assert result['stopped'];assert result['defaultSound']=='piano'
 rms=[x['rms'] for x in result['dynamics']];assert all(a<b for a,b in zip(rms,rms[1:])),rms
 assert not errors,errors
 print(json.dumps({'notes':37,'maxPitchErrorCents':round(max(errors_cents),2),'peak':round(max(peaks),3),**result}),flush=True)
 c.close()
s.shutdown()
